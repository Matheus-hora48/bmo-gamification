import type { Request, Response } from "express";
import { AchievementType } from "../models/Achievement";
import { AchievementService } from "../services/achievement.service";
import { DailyGoalService } from "../services/daily-goal.service";
import { FirestoreService } from "../services/firestore.service";
import { LevelService } from "../services/level.service";
import { StreakService } from "../services/streak.service";
import { XPService } from "../services/xp.service";
import {
  NotificationService,
  PushType,
} from "../services/notification.service";
import { logger } from "../utils/logger";
import {
  CardCreatedSchema,
  CheckAchievementsSchema,
  DailyProgressQuerySchema,
  DeckCreatedSchema,
  ProcessReviewSchema,
  UserIdParamSchema,
  validateSchema,
} from "../utils/validators";
import { XP_VALUES } from "../config/constants";
import { XPSource } from "../models/XPTransaction";

// Schemas de validação adicionais para métricas customizadas
import { z } from "zod";

const MarketplaceDeckSchema = z.object({
  userId: z.string().min(1).max(128),
  deckId: z.string().min(1).max(128),
});

const ProfileCompletedSchema = z.object({
  userId: z.string().min(1).max(128),
  completed: z.boolean(),
});

const ShareDeckSchema = z.object({
  userId: z.string().min(1).max(128),
  deckId: z.string().min(1).max(128),
});

const RateDeckSchema = z.object({
  userId: z.string().min(1).max(128),
  deckId: z.string().min(1).max(128),
  rating: z.number().min(1).max(5),
});

const CompleteDeckSchema = z.object({
  userId: z.string().min(1).max(128),
  deckId: z.string().min(1).max(128),
});

const ActiveDecksSchema = z.object({
  userId: z.string().min(1).max(128),
  deckIds: z.array(z.string().min(1).max(128)),
});

const StudySessionSchema = z.object({
  userId: z.string().min(1).max(128),
  deckId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().min(0).max(23),
  cardsReviewed: z.number().min(0).optional(),
});

/**
 * Gamification Controller
 *
 * Endpoints para processar eventos de gamificação e retornar progresso do usuário.
 * Todos os endpoints validam parâmetros usando Zod e incluem error handling completo.
 */
export class GamificationController {
  private readonly firestoreService: FirestoreService;
  private readonly xpService: XPService;
  private readonly achievementService: AchievementService;
  private readonly dailyGoalService: DailyGoalService;
  private readonly levelService: LevelService;
  private readonly streakService: StreakService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.firestoreService = new FirestoreService();
    this.xpService = new XPService();
    this.achievementService = new AchievementService();
    this.dailyGoalService = new DailyGoalService();
    this.levelService = new LevelService();
    this.streakService = new StreakService();
    this.notificationService = new NotificationService();
  }

  /**
   * POST /process-review
   * Processar revisão de card - Adiciona XP baseado na dificuldade
   */
  processCardReview = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /process-review - Iniciando processamento", {
        body: req.body,
      });

      // Validar parâmetros
      const validation = validateSchema(ProcessReviewSchema, req.body);
      if (!validation.success) {
        logger.warn("Validação falhou em /process-review", {
          error: validation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, cardId, difficulty, deckId } = validation.data;
      const reviewDate = (validation.data.date ||
        new Date().toISOString().split("T")[0]) as string;

      // Processar revisão através do XP Service
      const xpResult = await this.xpService.processCardReview(
        userId,
        cardId,
        difficulty
      );

      const { userProgress, levelUpInfo } = xpResult;

      // Registrar no progresso diário
      const dailyProgress = await this.dailyGoalService.recordCardReview(
        userId,
        reviewDate
      );

      // Verificar e atualizar streak se a meta diária foi atingida
      const streakResult = await this.streakService.checkAndUpdateDailyStreak(
        userId,
        reviewDate
      );

      // ====== ATUALIZAR MÉTRICAS CUSTOMIZADAS ======

      // Registrar nível de dificuldade usado
      await this.firestoreService.addDifficultyLevelUsed(userId, difficulty);

      // Registrar deck estudado (se fornecido)
      if (deckId) {
        await this.firestoreService.addStudiedDeck(userId, deckId);
      }

      // Registrar horário da sessão de estudo
      const currentHour = new Date().getHours();
      await this.firestoreService.recordStudySessionTime(
        userId,
        reviewDate,
        currentHour
      );

      // Atualizar contagem de cards no dia
      await this.firestoreService.updateCardsPerDay(
        userId,
        reviewDate,
        dailyProgress.cardsReviewed
      );

      // Atualizar streak de cards "fácil"
      if (difficulty === "easy") {
        const metrics = await this.firestoreService.getUserMetrics(userId);
        await this.firestoreService.updateEasyCardsStreak(
          userId,
          metrics.easyCardsStreak + 1
        );
      } else {
        // Resetar streak de cards fácil se não foi "easy"
        await this.firestoreService.updateEasyCardsStreak(userId, 0);
      }

      // Incrementar contadores de dificuldade
      if (difficulty === "hard") {
        await this.firestoreService.incrementHardCardsCompleted(userId);
      }

      // ====== FIM DAS MÉTRICAS CUSTOMIZADAS ======

      // Verificar conquistas relacionadas a reviews E customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.REVIEWS_COMPLETED, AchievementType.CUSTOM]
      );

      // Calcular XP ganho nesta revisão (baseado na dificuldade)
      const xpGained = this.xpService.calculateXPForReview(difficulty);

      // Calcular informações do próximo nível
      const xpForNextLevel = this.levelService.xpForNextLevel(
        userProgress.level
      );
      const xpToNextLevel = this.levelService.xpToNextLevel(
        userProgress.totalXP,
        userProgress.level
      );

      logger.info("Revisão de card processada com sucesso", {
        userId,
        cardId,
        difficulty,
        xpGained,
        newLevel: userProgress.level,
        leveledUp: levelUpInfo.leveledUp,
        achievementsUnlocked: newAchievements.length,
        currentStreak:
          streakResult?.streakData.current ?? userProgress.currentStreak,
      });

      res.status(200).json({
        success: true,
        xpGained,
        totalXP: userProgress.totalXP,
        level: userProgress.level,
        currentXP: userProgress.currentXP,
        levelUp: {
          leveledUp: levelUpInfo.leveledUp,
          oldLevel: levelUpInfo.oldLevel,
          newLevel: levelUpInfo.newLevel,
          xpForNextLevel,
          xpToNextLevel,
        },
        dailyProgress: {
          cardsReviewed: dailyProgress.cardsReviewed,
          goalMet: dailyProgress.goalMet,
        },
        streak: {
          current:
            streakResult?.streakData.current ?? userProgress.currentStreak,
          longest:
            streakResult?.streakData.longest ?? userProgress.longestStreak,
          bonusAwarded: streakResult?.bonusAwarded ?? 0,
          milestone: streakResult?.milestone,
        },
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao processar revisão de card", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao processar revisão de card",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * POST /card-created
   * Registrar criação de card - Adiciona 25 XP
   */
  onCardCreated = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /card-created - Registrando criação de card", {
        body: req.body,
      });

      // Validar parâmetros
      const validation = validateSchema(CardCreatedSchema, req.body);
      if (!validation.success) {
        logger.warn("Validação falhou em /card-created", {
          error: validation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, cardId } = validation.data;

      // Adicionar XP pela criação do card
      const xpResult = await this.xpService.addXP(
        userId,
        XP_VALUES.CARD_CREATION,
        XPSource.CARD_CREATION,
        cardId
      );

      const { userProgress, levelUpInfo } = xpResult;

      // Verificar conquistas relacionadas a criação de cards
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CARDS_CREATED]
      );

      // Calcular informações do próximo nível
      const xpForNextLevel = this.levelService.xpForNextLevel(
        userProgress.level
      );
      const xpToNextLevel = this.levelService.xpToNextLevel(
        userProgress.totalXP,
        userProgress.level
      );

      logger.info("Criação de card registrada com sucesso", {
        userId,
        cardId,
        xpGained: XP_VALUES.CARD_CREATION,
        newLevel: userProgress.level,
        leveledUp: levelUpInfo.leveledUp,
        achievementsUnlocked: newAchievements.length,
      });

      res.status(200).json({
        success: true,
        xpGained: XP_VALUES.CARD_CREATION,
        totalXP: userProgress.totalXP,
        level: userProgress.level,
        currentXP: userProgress.currentXP,
        levelUp: {
          leveledUp: levelUpInfo.leveledUp,
          oldLevel: levelUpInfo.oldLevel,
          newLevel: levelUpInfo.newLevel,
          xpForNextLevel,
          xpToNextLevel,
        },
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar criação de card", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao registrar criação de card",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * POST /deck-created
   * Registrar criação de deck - Adiciona 50 XP
   */
  onDeckCreated = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /deck-created - Registrando criação de deck", {
        body: req.body,
      });

      // Validar parâmetros
      const validation = validateSchema(DeckCreatedSchema, req.body);
      if (!validation.success) {
        logger.warn("Validação falhou em /deck-created", {
          error: validation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckId } = validation.data;

      // Adicionar XP pela criação do deck
      const xpResult = await this.xpService.addXP(
        userId,
        XP_VALUES.DECK_CREATION,
        XPSource.DECK_CREATION,
        deckId
      );

      const { userProgress, levelUpInfo } = xpResult;

      // Verificar conquistas relacionadas a criação de decks
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.DECK_CREATED]
      );

      // Calcular informações do próximo nível
      const xpForNextLevel = this.levelService.xpForNextLevel(
        userProgress.level
      );
      const xpToNextLevel = this.levelService.xpToNextLevel(
        userProgress.totalXP,
        userProgress.level
      );

      logger.info("Criação de deck registrada com sucesso", {
        userId,
        deckId,
        xpGained: XP_VALUES.DECK_CREATION,
        newLevel: userProgress.level,
        leveledUp: levelUpInfo.leveledUp,
        achievementsUnlocked: newAchievements.length,
      });

      res.status(200).json({
        success: true,
        xpGained: XP_VALUES.DECK_CREATION,
        totalXP: userProgress.totalXP,
        level: userProgress.level,
        currentXP: userProgress.currentXP,
        levelUp: {
          leveledUp: levelUpInfo.leveledUp,
          oldLevel: levelUpInfo.oldLevel,
          newLevel: levelUpInfo.newLevel,
          xpForNextLevel,
          xpToNextLevel,
        },
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar criação de deck", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao registrar criação de deck",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * GET /progress/:userId
   * Obter progresso completo do usuário
   */
  getUserProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("GET /progress/:userId - Buscando progresso do usuário", {
        params: req.params,
      });

      // Validar parâmetro userId
      const validation = validateSchema(UserIdParamSchema, req.params);
      if (!validation.success) {
        logger.warn("Validação falhou em /progress/:userId", {
          error: validation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId } = validation.data;

      // Buscar progresso do usuário
      const userProgress = await this.firestoreService.getUserProgress(userId);

      // Buscar streak data
      const streakData = await this.firestoreService.getStreakData(userId);

      logger.info("Progresso do usuário recuperado com sucesso", {
        userId,
        level: userProgress.level,
        totalXP: userProgress.totalXP,
      });

      res.status(200).json({
        success: true,
        userId: userProgress.userId,
        level: userProgress.level,
        totalXP: userProgress.totalXP,
        currentXP: userProgress.currentXP,
        achievements: userProgress.achievements,
        currentStreak: streakData.current,
        longestStreak: streakData.longest,
        lastActivityDate: userProgress.lastActivityDate,
        createdAt: userProgress.createdAt,
      });
    } catch (error) {
      logger.error("Erro ao buscar progresso do usuário", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao buscar progresso do usuário",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * GET /daily-progress/:userId
   * Obter progresso diário do usuário
   */
  getDailyProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("GET /daily-progress/:userId - Buscando progresso diário", {
        params: req.params,
        query: req.query,
      });

      // Validar parâmetro userId
      const paramValidation = validateSchema(UserIdParamSchema, req.params);
      if (!paramValidation.success) {
        logger.warn("Validação de params falhou em /daily-progress/:userId", {
          error: paramValidation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: paramValidation.error,
        });
        return;
      }

      // Validar query params (opcional)
      const queryValidation = validateSchema(
        DailyProgressQuerySchema,
        req.query
      );
      if (!queryValidation.success) {
        logger.warn("Validação de query falhou em /daily-progress/:userId", {
          error: queryValidation.error,
        });
        res.status(400).json({
          error: "Query params inválidos",
          details: queryValidation.error,
        });
        return;
      }

      const { userId } = paramValidation.data;
      const { date } = queryValidation.data;

      // Usar data de hoje se não fornecida
      const targetDate = date || new Date().toISOString().split("T")[0];

      // Buscar progresso diário
      const dailyProgress = await this.firestoreService.getDailyProgress(
        userId,
        targetDate as string
      );

      // Verificar se atingiu a meta
      const goalCheckResult = await this.dailyGoalService.checkDailyGoal(
        userId,
        targetDate as string
      );

      logger.info("Progresso diário recuperado com sucesso", {
        userId,
        date: dailyProgress.date,
        cardsReviewed: dailyProgress.cardsReviewed,
        goalMet: dailyProgress.goalMet,
      });

      res.status(200).json({
        success: true,
        userId: dailyProgress.userId,
        date: dailyProgress.date,
        cardsReviewed: dailyProgress.cardsReviewed,
        goalMet: dailyProgress.goalMet,
        goalTarget:
          goalCheckResult.cardsRemaining + goalCheckResult.cardsReviewed,
        cardsRemaining: goalCheckResult.cardsRemaining,
        xpEarned: dailyProgress.xpEarned,
      });
    } catch (error) {
      logger.error("Erro ao buscar progresso diário", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao buscar progresso diário",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * GET /achievements/:userId
   * Obter conquistas desbloqueadas do usuário
   */
  getUserAchievements = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug(
        "GET /achievements/:userId - Buscando conquistas do usuário",
        {
          params: req.params,
        }
      );

      // Validar parâmetro userId
      const validation = validateSchema(UserIdParamSchema, req.params);
      if (!validation.success) {
        logger.warn("Validação falhou em /achievements/:userId", {
          error: validation.error,
        });
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId } = validation.data;

      // Buscar conquistas do usuário
      const userAchievements =
        await this.firestoreService.getUserAchievements(userId);

      // Filtrar apenas conquistas desbloqueadas
      const unlocked = userAchievements.filter((ua) => ua.unlockedAt !== null);

      // Buscar detalhes completos das conquistas
      const achievementsDetails = await Promise.all(
        unlocked.map(async (ua) => {
          const achievement = await this.firestoreService.getAchievement(
            ua.achievementId
          );
          return {
            ...achievement,
            unlockedAt: ua.unlockedAt,
            progress: ua.progress,
          };
        })
      );

      logger.info("Conquistas do usuário recuperadas com sucesso", {
        userId,
        totalUnlocked: unlocked.length,
      });

      res.status(200).json({
        success: true,
        userId,
        totalUnlocked: unlocked.length,
        achievements: achievementsDetails,
      });
    } catch (error) {
      logger.error("Erro ao buscar conquistas do usuário", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao buscar conquistas do usuário",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * POST /check-achievements/:userId
   * Forçar verificação de conquistas do usuário
   */
  checkAchievements = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug(
        "POST /check-achievements/:userId - Verificando conquistas",
        {
          params: req.params,
          body: req.body,
        }
      );

      // Validar parâmetro userId
      const paramValidation = validateSchema(UserIdParamSchema, req.params);
      if (!paramValidation.success) {
        logger.warn(
          "Validação de params falhou em /check-achievements/:userId",
          {
            error: paramValidation.error,
          }
        );
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: paramValidation.error,
        });
        return;
      }

      // Validar body (opcional)
      const bodyValidation = validateSchema(
        CheckAchievementsSchema,
        req.body || {}
      );
      if (!bodyValidation.success) {
        logger.warn("Validação de body falhou em /check-achievements/:userId", {
          error: bodyValidation.error,
        });
        res.status(400).json({
          error: "Body inválido",
          details: bodyValidation.error,
        });
        return;
      }

      const { userId } = paramValidation.data;
      const { types } = bodyValidation.data;

      // Verificar conquistas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        types
      );

      logger.info("Verificação de conquistas concluída", {
        userId,
        typesFilter: types || "all",
        newAchievementsUnlocked: newAchievements.length,
      });

      res.status(200).json({
        success: true,
        userId,
        newAchievementsUnlocked: newAchievements.length,
        achievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
          condition: a.condition,
        })),
      });
    } catch (error) {
      logger.error("Erro ao verificar conquistas", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        error: "Erro ao verificar conquistas",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * POST /user/clear_all_notifications
   * Limpar todas as notificações de conquistas
   */
  clearAllNotifications = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        res.status(400).json({ error: "user_id é obrigatório" });
        return;
      }

      await this.achievementService.markAllAsSeen(String(user_id));

      logger.info("Notificações limpas com sucesso", { userId: user_id });

      res.status(200).json({
        status: 200,
        message: "All notifications cleared successfully.",
      });
    } catch (error) {
      logger.error("Erro ao limpar notificações", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao limpar notificações",
      });
    }
  };

  /**
   * POST /user/test_notification
   * Enviar notificação de teste (Estudos)
   */
  sendTestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        res.status(400).json({ error: "user_id é obrigatório" });
        return;
      }

      const fcmToken = await this.firestoreService.getUserFcmToken(
        String(user_id)
      );

      if (!fcmToken) {
        res
          .status(404)
          .json({ error: "Token FCM não encontrado para o usuário" });
        return;
      }

      await this.notificationService.sendPushNotification(fcmToken, {
        title: "Hora de Estudar! 📚",
        body: "Mantenha seu ritmo! Revise seus cards hoje.",
        pushType: PushType.STUDY_REMINDER,
        additionalData: {
          type: "study_reminder",
        },
      });

      logger.info("Notificação de teste enviada", { userId: user_id });

      res.status(200).json({
        status: 200,
        message: "Test notification sent successfully.",
      });
    } catch (error) {
      logger.error("Erro ao enviar notificação de teste", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao enviar notificação de teste",
      });
    }
  };

  /**
   * POST /user/broadcast
   * Enviar notificação para todos os usuários
   */
  sendBroadcast = async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, body, pushType, additionalData } = req.body;

      if (!title || !body || !pushType) {
        res.status(400).json({
          error: "Campos obrigatórios: title, body, pushType",
        });
        return;
      }

      const tokens = await this.firestoreService.getAllFcmTokens();

      if (tokens.length === 0) {
        res.status(200).json({
          message: "Nenhum usuário com token FCM encontrado.",
          stats: { success: 0, failure: 0 },
        });
        return;
      }

      const result = await this.notificationService.sendBroadcastNotification(
        tokens,
        {
          title,
          body,
          pushType: Number(pushType),
          additionalData: additionalData || {},
        }
      );

      logger.info("Broadcast enviado", {
        title,
        pushType,
        stats: result,
      });

      res.status(200).json({
        message: "Broadcast processado.",
        stats: {
          success: result.successCount,
          failure: result.failureCount,
          totalTokens: tokens.length,
        },
      });
    } catch (error) {
      logger.error("Erro ao enviar broadcast", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao enviar broadcast",
      });
    }
  };

  // ==========================================
  // ENDPOINTS PARA MÉTRICAS CUSTOMIZADAS
  // ==========================================

  /**
   * POST /marketplace-deck-added
   * Registrar adição de deck do marketplace
   */
  onMarketplaceDeckAdded = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      logger.debug(
        "POST /marketplace-deck-added - Registrando deck do marketplace",
        {
          body: req.body,
        }
      );

      const validation = validateSchema(MarketplaceDeckSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckId } = validation.data;

      // Registrar deck do marketplace
      await this.firestoreService.addMarketplaceDeck(userId, deckId);

      // Também adicionar como deck ativo
      await this.firestoreService.addActiveDeck(userId, deckId);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Deck do marketplace registrado", { userId, deckId });

      res.status(200).json({
        success: true,
        message: "Deck do marketplace registrado com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar deck do marketplace", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao registrar deck do marketplace",
      });
    }
  };

  /**
   * POST /profile-completed
   * Registrar perfil completo
   */
  onProfileCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /profile-completed - Registrando perfil completo", {
        body: req.body,
      });

      const validation = validateSchema(ProfileCompletedSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, completed } = validation.data;

      // Atualizar status do perfil
      await this.firestoreService.setProfileCompleted(userId, completed);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Status do perfil atualizado", { userId, completed });

      res.status(200).json({
        success: true,
        message: "Status do perfil atualizado com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao atualizar status do perfil", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao atualizar status do perfil",
      });
    }
  };

  /**
   * POST /deck-shared
   * Registrar compartilhamento de deck
   */
  onDeckShared = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /deck-shared - Registrando compartilhamento de deck", {
        body: req.body,
      });

      const validation = validateSchema(ShareDeckSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckId } = validation.data;

      // Registrar deck compartilhado
      await this.firestoreService.addSharedDeck(userId, deckId);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Deck compartilhado registrado", { userId, deckId });

      res.status(200).json({
        success: true,
        message: "Compartilhamento de deck registrado com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar compartilhamento de deck", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao registrar compartilhamento de deck",
      });
    }
  };

  /**
   * POST /deck-rated
   * Registrar avaliação de deck
   */
  onDeckRated = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /deck-rated - Registrando avaliação de deck", {
        body: req.body,
      });

      const validation = validateSchema(RateDeckSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId } = validation.data;

      // Incrementar contador de avaliações
      await this.firestoreService.incrementDeckReviews(userId);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Avaliação de deck registrada", { userId });

      res.status(200).json({
        success: true,
        message: "Avaliação de deck registrada com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar avaliação de deck", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao registrar avaliação de deck",
      });
    }
  };

  /**
   * POST /deck-completed
   * Registrar conclusão de deck (100%)
   */
  onDeckCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /deck-completed - Registrando conclusão de deck", {
        body: req.body,
      });

      const validation = validateSchema(CompleteDeckSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckId } = validation.data;

      // Registrar deck completado
      await this.firestoreService.addCompletedDeck(userId, deckId);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Conclusão de deck registrada", { userId, deckId });

      res.status(200).json({
        success: true,
        message: "Conclusão de deck registrada com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar conclusão de deck", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao registrar conclusão de deck",
      });
    }
  };

  /**
   * POST /active-decks
   * Atualizar lista de decks ativos
   */
  updateActiveDecks = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /active-decks - Atualizando decks ativos", {
        body: req.body,
      });

      const validation = validateSchema(ActiveDecksSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckIds } = validation.data;

      // Atualizar lista de decks ativos
      await this.firestoreService.setActiveDecks(userId, deckIds);

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Decks ativos atualizados", {
        userId,
        deckCount: deckIds.length,
      });

      res.status(200).json({
        success: true,
        message: "Decks ativos atualizados com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao atualizar decks ativos", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao atualizar decks ativos",
      });
    }
  };

  /**
   * POST /study-session
   * Registrar sessão de estudo com horário
   */
  onStudySession = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("POST /study-session - Registrando sessão de estudo", {
        body: req.body,
      });

      const validation = validateSchema(StudySessionSchema, req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId, deckId, date, hour, cardsReviewed } = validation.data;

      // Registrar horário da sessão
      await this.firestoreService.recordStudySessionTime(userId, date, hour);

      // Registrar deck estudado
      await this.firestoreService.addStudiedDeck(userId, deckId);

      // Atualizar cards por dia se fornecido
      if (cardsReviewed !== undefined) {
        await this.firestoreService.updateCardsPerDay(
          userId,
          date,
          cardsReviewed
        );
      }

      // Verificar conquistas customizadas
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.CUSTOM]
      );

      logger.info("Sessão de estudo registrada", { userId, deckId, hour });

      res.status(200).json({
        success: true,
        message: "Sessão de estudo registrada com sucesso",
        newAchievements: newAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
        })),
      });
    } catch (error) {
      logger.error("Erro ao registrar sessão de estudo", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao registrar sessão de estudo",
      });
    }
  };

  /**
   * GET /metrics/:userId
   * Obter métricas customizadas do usuário
   */
  getUserMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.debug("GET /metrics/:userId - Buscando métricas do usuário", {
        params: req.params,
      });

      const validation = validateSchema(UserIdParamSchema, req.params);
      if (!validation.success) {
        res.status(400).json({
          error: "Parâmetros inválidos",
          details: validation.error,
        });
        return;
      }

      const { userId } = validation.data;

      const metrics = await this.firestoreService.getUserMetrics(userId);

      logger.info("Métricas do usuário recuperadas", { userId });

      res.status(200).json({
        success: true,
        metrics,
      });
    } catch (error) {
      logger.error("Erro ao buscar métricas do usuário", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "Erro ao buscar métricas do usuário",
      });
    }
  };
}
