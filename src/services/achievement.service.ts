import { randomUUID } from "crypto";
import { XP_VALUES } from "../config/constants";
import { AchievementType, type Achievement } from "../models/Achievement";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import { FirestoreService, type UserMetrics } from "./firestore.service";
import { XPService } from "./xp.service";
import { NotificationService, PushType } from "./notification.service";

export class AchievementService {
  constructor(
    private readonly firestore: FirestoreService = new FirestoreService(),
    private readonly xpService: XPService = new XPService(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  /**
   * Verifica todas as conquistas pendentes de um usuário
   * @param userId - ID do usuário
   * @param types - (Opcional) Tipos específicos de conquistas a verificar
   * @returns Lista de conquistas desbloqueadas
   */
  async checkAchievements(
    userId: string,
    types?: AchievementType[]
  ): Promise<Achievement[]> {
    // Buscar todas as conquistas disponíveis
    const allAchievements = await this.firestore.getAllAchievements();

    // Filtrar por tipos se especificado
    const achievementsToCheck = types
      ? allAchievements.filter((achievement) =>
          types.includes(achievement.condition.type)
        )
      : allAchievements;

    // Buscar conquistas já desbloqueadas pelo usuário
    const userAchievements = await this.firestore.getUserAchievements(userId);
    const unlockedIds = new Set(
      userAchievements
        .filter((ua) => ua.unlockedAt !== null)
        .map((ua) => ua.achievementId)
    );

    // Verificar apenas conquistas ainda não desbloqueadas
    const pendingAchievements = achievementsToCheck.filter(
      (achievement) => !unlockedIds.has(achievement.id)
    );

    const newlyUnlocked: Achievement[] = [];

    // Verificar cada conquista pendente
    for (const achievement of pendingAchievements) {
      const shouldUnlock = await this.checkAchievement(userId, achievement);

      if (shouldUnlock) {
        await this.unlockAchievement(userId, achievement.id);
        newlyUnlocked.push(achievement);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Verifica se um usuário cumpre os requisitos de uma conquista específica
   * @param userId - ID do usuário
   * @param achievement - Conquista a verificar
   * @returns true se a conquista deve ser desbloqueada
   */
  async checkAchievement(
    userId: string,
    achievement: Achievement
  ): Promise<boolean> {
    const { type, target } = achievement.condition;

    try {
      switch (type) {
        case AchievementType.CARDS_CREATED:
          return await this.checkCardsCreated(userId, target);

        case AchievementType.REVIEWS_COMPLETED:
          return await this.checkReviewsCompleted(userId, target);

        case AchievementType.STREAK:
          return await this.checkStreak(userId, target);

        case AchievementType.DECK_CREATED:
          return await this.checkDecksCreated(userId, target);

        case AchievementType.DAILY_GOAL:
          return await this.checkDailyGoalsCompleted(userId, target);

        case AchievementType.XP_TOTAL:
          return await this.checkTotalXP(userId, target);

        case AchievementType.LEVEL_REACHED:
          return await this.checkLevelReached(userId, target);

        case AchievementType.CUSTOM:
          return await this.checkCustomAchievement(userId, achievement);

        default:
          console.warn(
            `Tipo de conquista não suportado: ${type} (achievement: ${achievement.id})`
          );
          return false;
      }
    } catch (error) {
      console.error(
        `Erro ao verificar conquista ${achievement.id} para usuário ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Desbloqueia uma conquista para o usuário e concede XP
   * @param userId - ID do usuário
   * @param achievementId - ID da conquista
   */
  async unlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<void> {
    // Buscar dados da conquista
    const achievement = await this.firestore.getAchievement(achievementId);

    if (!achievement) {
      throw new Error(`Conquista "${achievementId}" não encontrada.`);
    }

    // Desbloquear a conquista usando transação atômica
    // Isso evita race conditions e duplicação de notificações
    const { isNewUnlock } = await this.firestore.unlockAchievement(
      userId,
      achievementId
    );

    // Se não foi um novo desbloqueio, não processar XP nem notificação
    if (!isNewUnlock) {
      console.warn(
        `Conquista ${achievementId} já desbloqueada para usuário ${userId} - ignorando duplicata`
      );
      return;
    }

    // Conceder XP da conquista
    await this.xpService.addXP(
      userId,
      achievement.xpReward,
      XPSource.ACHIEVEMENT,
      achievementId
    );

    // Atualizar o progresso do usuário adicionando o id da conquista
    try {
      const userProgress = await this.firestore.getUserProgress(userId);
      const current = Array.isArray(userProgress.achievements)
        ? userProgress.achievements
        : [];

      await this.firestore.updateUserProgress(userId, {
        achievements: [...new Set([...current, achievement.id])],
      });
    } catch (err) {
      // Não falhar todo o fluxo se a atualização do profile falhar;
      // registrar para investigação.
      // eslint-disable-next-line no-console
      console.error(
        `Falha ao atualizar UserProgress com a conquista ${achievementId} para usuário ${userId}:`,
        err
      );
    }

    console.log(
      `✅ Conquista "${achievement.name}" desbloqueada para usuário ${userId}! (+${achievement.xpReward} XP)`
    );

    // Enviar notificação push em background (não bloqueia o retorno)
    this.sendAchievementNotification(userId, achievement).catch((err) => {
      console.error(
        `Falha ao enviar notificação de conquista para ${userId}:`,
        err
      );
    });
  }

  /**
   * Envia notificação push de conquista desbloqueada
   */
  private async sendAchievementNotification(
    userId: string,
    achievement: Achievement
  ): Promise<void> {
    const fcmToken = await this.firestore.getUserFcmToken(userId);

    if (fcmToken) {
      await this.notificationService.sendPushNotification(fcmToken, {
        title: "Conquista Desbloqueada!",
        body: `Você desbloqueou: ${achievement.name}`,
        pushType: PushType.ACHIEVEMENT,
        additionalData: {
          achievementId: achievement.id,
          xpReward: String(achievement.xpReward),
        },
      });
    }
  }

  /**
   * Obtém o progresso atual de um usuário em uma conquista específica
   * @param userId - ID do usuário
   * @param achievementId - ID da conquista
   * @returns Valor de progresso (número)
   */
  async getUserProgress(
    userId: string,
    achievementId: string
  ): Promise<number> {
    const achievement = await this.firestore.getAchievement(achievementId);

    if (!achievement) {
      throw new Error(`Conquista "${achievementId}" não encontrada.`);
    }

    const { type, target } = achievement.condition;

    try {
      let currentValue: number;

      if (type === AchievementType.CUSTOM) {
        currentValue = await this.getCustomProgressValue(userId, achievement);
      } else {
        currentValue = await this.getCurrentProgressValue(userId, type);
      }

      // Calcular porcentagem de progresso (0-100)
      const progressPercent = Math.min(100, (currentValue / target) * 100);

      return Math.round(progressPercent);
    } catch (error) {
      console.error(
        `Erro ao obter progresso da conquista ${achievementId} para usuário ${userId}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Marca todas as conquistas desbloqueadas como vistas (notificação limpa)
   * @param userId - ID do usuário
   */
  async markAllAsSeen(userId: string): Promise<void> {
    await this.firestore.markAllAchievementsAsSeen(userId);
  }

  // ==========================================
  // VERIFICADORES ESPECÍFICOS
  // ==========================================

  /**
   * Verifica se o usuário criou o número especificado de cards
   */
  async checkCardsCreated(userId: string, target: number): Promise<boolean> {
    const count = await this.firestore.countXPTransactionsBySource(
      userId,
      XPSource.CARD_CREATION
    );
    return count >= target;
  }

  /**
   * Verifica se o usuário completou o número especificado de revisões
   */
  async checkReviewsCompleted(
    userId: string,
    target: number
  ): Promise<boolean> {
    const count = await this.firestore.countXPTransactionsBySource(
      userId,
      XPSource.REVIEW
    );
    return count >= target;
  }

  /**
   * Verifica se o usuário mantém o streak especificado
   */
  async checkStreak(userId: string, target: number): Promise<boolean> {
    try {
      const streakData = await this.firestore.getStreakData(userId);
      return streakData.current >= target;
    } catch (error) {
      // Se streak não existe, considerar como 0
      return false;
    }
  }

  /**
   * Verifica se o usuário criou o número especificado de decks
   */
  async checkDecksCreated(userId: string, target: number): Promise<boolean> {
    const count = await this.firestore.countXPTransactionsBySource(
      userId,
      XPSource.DECK_CREATION
    );
    return count >= target;
  }

  /**
   * Verifica se o usuário completou a meta diária o número especificado de vezes
   */
  async checkDailyGoalsCompleted(
    userId: string,
    target: number
  ): Promise<boolean> {
    const count = await this.firestore.countXPTransactionsBySource(
      userId,
      XPSource.DAILY_GOAL
    );
    return count >= target;
  }

  /**
   * Verifica se o usuário alcançou o XP total especificado
   */
  async checkTotalXP(userId: string, target: number): Promise<boolean> {
    try {
      const userProgress = await this.firestore.getUserProgress(userId);
      return userProgress.totalXP >= target;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se o usuário alcançou o nível especificado
   */
  async checkLevelReached(userId: string, target: number): Promise<boolean> {
    try {
      const userProgress = await this.firestore.getUserProgress(userId);
      return userProgress.level >= target;
    } catch (error) {
      return false;
    }
  }

  // ==========================================
  // MÉTODOS AUXILIARES
  // ==========================================

  /**
   * Obtém o valor atual de progresso baseado no tipo de conquista
   */
  private async getCurrentProgressValue(
    userId: string,
    type: AchievementType
  ): Promise<number> {
    switch (type) {
      case AchievementType.CARDS_CREATED:
        return await this.firestore.countXPTransactionsBySource(
          userId,
          XPSource.CARD_CREATION
        );

      case AchievementType.REVIEWS_COMPLETED:
        return await this.firestore.countXPTransactionsBySource(
          userId,
          XPSource.REVIEW
        );

      case AchievementType.STREAK: {
        try {
          const streakData = await this.firestore.getStreakData(userId);
          return streakData.current;
        } catch {
          return 0;
        }
      }

      case AchievementType.DECK_CREATED:
        return await this.firestore.countXPTransactionsBySource(
          userId,
          XPSource.DECK_CREATION
        );

      case AchievementType.DAILY_GOAL:
        return await this.firestore.countXPTransactionsBySource(
          userId,
          XPSource.DAILY_GOAL
        );

      case AchievementType.XP_TOTAL: {
        try {
          const userProgress = await this.firestore.getUserProgress(userId);
          return userProgress.totalXP;
        } catch {
          return 0;
        }
      }

      case AchievementType.LEVEL_REACHED: {
        try {
          const userProgress = await this.firestore.getUserProgress(userId);
          return userProgress.level;
        } catch {
          return 0;
        }
      }

      case AchievementType.CUSTOM: {
        // Para CUSTOM, precisamos da conquista completa para saber a métrica
        // Isso será tratado por getCustomProgressValue
        return 0;
      }

      default:
        return 0;
    }
  }

  /**
   * Atualiza o progresso de uma conquista específica
   * (Pode ser usado para atualizar visualmente o progresso antes do unlock)
   */
  async updateAchievementProgress(
    userId: string,
    achievementId: string
  ): Promise<void> {
    const progressValue = await this.getUserProgress(userId, achievementId);

    await this.firestore.updateAchievementProgress(userId, achievementId, {
      progress: progressValue,
    });
  }

  // ==========================================
  // VERIFICADORES DE CONQUISTAS CUSTOMIZADAS
  // ==========================================

  /**
   * Verifica conquistas do tipo CUSTOM baseadas em métricas específicas
   */
  async checkCustomAchievement(
    userId: string,
    achievement: Achievement
  ): Promise<boolean> {
    const { target, params } = achievement.condition;
    const metric = params?.metric as string;

    if (!metric) {
      console.warn(
        `Conquista CUSTOM "${achievement.id}" não possui parâmetro "metric" definido.`
      );
      return false;
    }

    try {
      const metrics = await this.firestore.getUserMetrics(userId);

      switch (metric) {
        case "unique_decks_studied":
          return metrics.uniqueDecksStudied.length >= target;

        case "difficulty_levels_used":
          return metrics.difficultyLevelsUsed.length >= target;

        case "marketplace_decks_added":
          return metrics.marketplaceDecksAdded.length >= target;

        case "profile_completed":
          return metrics.profileCompleted === true;

        case "cards_reviewed_single_day":
          return metrics.maxCardsInSingleDay >= target;

        case "study_sessions_before_hour":
          return metrics.studySessionsBeforeHour.length >= target;

        case "study_sessions_after_hour":
          return metrics.studySessionsAfterHour.length >= target;

        case "decks_shared":
          return metrics.decksShared.length >= target;

        case "deck_reviews_submitted":
          return metrics.deckReviewsSubmitted >= target;

        case "active_decks":
          return metrics.activeDecks.length >= target;

        case "easy_cards_streak":
          return metrics.maxEasyCardsStreak >= target;

        case "hard_cards_completed":
          return metrics.hardCardsCompleted >= target;

        case "expert_cards_completed":
          return metrics.expertCardsCompleted >= target;

        case "decks_completed":
          return metrics.decksCompleted.length >= target;

        case "decks_studied_same_day":
          return this.checkDecksStudiedSameDay(metrics, target);

        case "minimum_cards_consecutive_days":
          return this.checkMinimumCardsConsecutiveDays(
            metrics,
            params?.consecutiveDays as number,
            params?.minimumCardsPerDay as number
          );

        case "cards_created_in_week":
          // Esta métrica precisa ser calculada diferentemente
          return await this.checkCardsCreatedInWeek(userId, target);

        case "card_review_iterations":
          // Esta métrica requer rastreamento específico de cards
          return await this.checkCardReviewIterations(userId, target);

        default:
          console.warn(
            `Métrica customizada desconhecida: "${metric}" (achievement: ${achievement.id})`
          );
          return false;
      }
    } catch (error) {
      console.error(
        `Erro ao verificar conquista customizada ${achievement.id}:`,
        error
      );
      return false;
    }
  }

  /**
   * Verifica se o usuário estudou N decks diferentes no mesmo dia
   */
  private checkDecksStudiedSameDay(
    metrics: UserMetrics,
    target: number
  ): boolean {
    // Usa o máximo de decks estudados no mesmo dia
    return (metrics.maxDecksStudiedSameDay || 0) >= target;
  }

  /**
   * Verifica se o usuário estudou o mínimo de cards por N dias consecutivos
   */
  private checkMinimumCardsConsecutiveDays(
    metrics: UserMetrics,
    consecutiveDays: number,
    minimumCardsPerDay: number
  ): boolean {
    if (!consecutiveDays || !minimumCardsPerDay) {
      return false;
    }

    const cardsPerDay = metrics.cardsPerDay || {};
    const dates = Object.keys(cardsPerDay).sort();

    if (dates.length < consecutiveDays) {
      return false;
    }

    let currentStreak = 0;
    let previousDate: Date | null = null;

    for (const dateStr of dates) {
      const count = cardsPerDay[dateStr] ?? 0;
      if (count < minimumCardsPerDay) {
        currentStreak = 0;
        previousDate = null;
        continue;
      }

      const currentDate = new Date(dateStr);

      if (previousDate) {
        const diffDays = Math.round(
          (currentDate.getTime() - previousDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      if (currentStreak >= consecutiveDays) {
        return true;
      }

      previousDate = currentDate;
    }

    return false;
  }

  /**
   * Verifica se o usuário criou N cards em uma semana
   */
  private async checkCardsCreatedInWeek(
    userId: string,
    target: number
  ): Promise<boolean> {
    // Buscar transações de criação de cards dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await this.firestore.getXPTransactionsByPeriod(
      sevenDaysAgo,
      new Date(),
      XPSource.CARD_CREATION
    );

    const userTransactions = transactions.filter((t) => t.userId === userId);
    return userTransactions.length >= target;
  }

  /**
   * Verifica se o usuário revisou o mesmo card N vezes
   */
  private async checkCardReviewIterations(
    userId: string,
    target: number
  ): Promise<boolean> {
    // Buscar todas as transações de revisão do usuário
    const transactions = await this.firestore.getUserXPTransactions(
      userId,
      200
    );
    const reviewTransactions = transactions.filter(
      (t) => t.source === XPSource.REVIEW
    );

    // Contar revisões por card (sourceId)
    const reviewsPerCard = new Map<string, number>();
    for (const t of reviewTransactions) {
      const count = reviewsPerCard.get(t.sourceId) || 0;
      reviewsPerCard.set(t.sourceId, count + 1);
    }

    // Verificar se algum card atingiu o target
    for (const count of reviewsPerCard.values()) {
      if (count >= target) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtém o valor de progresso atual para conquistas customizadas
   */
  private async getCustomProgressValue(
    userId: string,
    achievement: Achievement
  ): Promise<number> {
    const { target, params } = achievement.condition;
    const metric = params?.metric as string;

    if (!metric) {
      return 0;
    }

    try {
      const metrics = await this.firestore.getUserMetrics(userId);

      switch (metric) {
        case "unique_decks_studied":
          return metrics.uniqueDecksStudied.length;

        case "difficulty_levels_used":
          return metrics.difficultyLevelsUsed.length;

        case "marketplace_decks_added":
          return metrics.marketplaceDecksAdded.length;

        case "profile_completed":
          return metrics.profileCompleted ? 1 : 0;

        case "cards_reviewed_single_day":
          return metrics.maxCardsInSingleDay;

        case "study_sessions_before_hour":
          return metrics.studySessionsBeforeHour.length;

        case "study_sessions_after_hour":
          return metrics.studySessionsAfterHour.length;

        case "decks_shared":
          return metrics.decksShared.length;

        case "deck_reviews_submitted":
          return metrics.deckReviewsSubmitted;

        case "active_decks":
          return metrics.activeDecks.length;

        case "easy_cards_streak":
          return metrics.maxEasyCardsStreak;

        case "hard_cards_completed":
          return metrics.hardCardsCompleted;

        case "expert_cards_completed":
          return metrics.expertCardsCompleted;

        case "decks_completed":
          return metrics.decksCompleted.length;

        default:
          return 0;
      }
    } catch (error) {
      return 0;
    }
  }
}
