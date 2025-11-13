import type { Request, Response } from "express";
import { AchievementType } from "../models/Achievement";
import { AchievementService } from "../services/achievement.service";
import { DailyGoalService } from "../services/daily-goal.service";
import { FirestoreService } from "../services/firestore.service";
import { LevelService } from "../services/level.service";
import { StreakService } from "../services/streak.service";
import { XPService } from "../services/xp.service";
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

  constructor() {
    this.firestoreService = new FirestoreService();
    this.xpService = new XPService();
    this.achievementService = new AchievementService();
    this.dailyGoalService = new DailyGoalService();
    this.levelService = new LevelService();
    this.streakService = new StreakService();
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

      const { userId, cardId, difficulty, date } = validation.data;

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
        date
      );

      // Verificar e atualizar streak se a meta diária foi atingida
      const streakResult = await this.streakService.checkAndUpdateDailyStreak(
        userId,
        date
      );

      // Verificar conquistas relacionadas a reviews
      const newAchievements = await this.achievementService.checkAchievements(
        userId,
        [AchievementType.REVIEWS_COMPLETED]
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
}
