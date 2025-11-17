import { randomUUID } from "crypto";
import admin from "firebase-admin";
import { firestore } from "../config/firebase.config";
import type { DeckStatistics } from "../models/DeckStatistics";
import {
  isValidDeckStatistics,
  normalizeDeckStatistics,
} from "../models/DeckStatistics";
import type { UserStatistics } from "../models/UserStatistics";
import {
  isValidUserStatistics,
  normalizeUserStatistics,
  UserStatisticsHelpers,
} from "../models/UserStatistics";
import type { XPTransaction } from "../models/XPTransaction";
import { XPSource } from "../models/XPTransaction";
import type { DailyProgress } from "../models/DailyProgress";
import type { UserProgress } from "../models/UserProgress";
import { FirestoreService } from "./firestore.service";

export interface UpdateDeckStatsParams {
  userId: string;
  deckId: string;
  deckName: string;
  cardsNew?: number;
  cardsLearning?: number;
  cardsReview?: number;
  totalCards?: number;
  sessionTime?: number;
  cardStates?: Array<{
    ease: number;
    interval: number;
    state: "new" | "learning" | "review";
  }>;
}

export interface ReviewSessionData {
  userId: string;
  sessionDurationMinutes: number;
  cardsReviewed: number;
  accuracyCount: number;
  totalAnswers: number;
  studyTime?: string; // "morning" | "afternoon" | "evening"
}

/**
 * Serviço para gerenciamento de estatísticas de usuários e decks
 * Integra com FirestoreService existente e sistema de gamificação
 */
export class StatisticsService {
  constructor(
    private readonly firestoreService: FirestoreService = new FirestoreService()
  ) {}

  // =============================================================================
  // DECK STATISTICS METHODS (15 min)
  // =============================================================================

  /**
   * Atualiza estatísticas de um deck específico
   * Calcula progresso baseado em estados FSRS e cards dominados
   */
  async updateDeckStatistics(
    params: UpdateDeckStatsParams
  ): Promise<DeckStatistics> {
    const {
      userId,
      deckId,
      deckName,
      cardsNew = 0,
      cardsLearning = 0,
      cardsReview = 0,
      totalCards = cardsNew + cardsLearning + cardsReview,
      cardStates = [],
    } = params;

    // Buscar estatísticas atuais do deck
    const existingStats = await this.getDeckStatistics(userId, deckId);

    // Calcular cards dominados (interval > 30 dias)
    const masteredCards = cardStates.filter(
      (card) => card.interval > 30 && card.state !== "new"
    ).length;

    // Calcular facilidade média
    const averageEase = this.calculateAverageEase(cardStates);

    // Calcular porcentagem de progresso
    const progressPercentage = this.calculateDeckProgress(
      masteredCards,
      totalCards
    );

    const now = new Date();

    // Verificar se existingStats é um array ou um objeto único
    let existingCreatedAt = now;
    if (existingStats && !Array.isArray(existingStats)) {
      existingCreatedAt =
        existingStats.createdAt instanceof Date
          ? existingStats.createdAt
          : (existingStats.createdAt as any)?.toDate?.() ||
            existingStats.createdAt ||
            now;
    }

    const deckStats: DeckStatistics = {
      deckId,
      userId,
      deckName,
      cardsNew,
      cardsLearning,
      cardsReview,
      totalCards,
      progressPercentage,
      masteredCards,
      averageEase,
      lastStudiedAt: now,
      createdAt: existingCreatedAt,
      updatedAt: now,
    };

    // Validar e normalizar dados
    const normalizedStats = normalizeDeckStatistics(deckStats);
    if (!isValidDeckStatistics(normalizedStats)) {
      throw new Error(`Dados inválidos para estatísticas do deck ${deckId}`);
    }

    // Salvar no Firestore: deckStatistics/{userId}__{deckId}
    const docId = `${userId}__${deckId}`;
    await firestore
      .collection("deckStatistics")
      .doc(docId)
      .set(normalizedStats);

    return normalizedStats;
  }

  /**
   * Busca estatísticas de deck(s) do usuário
   * Se deckId específico: retorna stats de 1 deck
   * Se sem deckId: retorna stats de todos os decks do usuário
   */
  async getDeckStatistics(
    userId: string,
    deckId?: string
  ): Promise<DeckStatistics | DeckStatistics[] | null> {
    try {
      if (deckId) {
        // Buscar stats de deck específico
        const docId = `${userId}__${deckId}`;
        const doc = await firestore
          .collection("deckStatistics")
          .doc(docId)
          .get();

        if (!doc.exists) {
          return null;
        }

        const data = doc.data();
        if (!data) return null;

        const stats = this.mapDeckStatistics(data);

        return isValidDeckStatistics(stats) ? stats : null;
      } else {
        // Buscar stats de todos os decks do usuário
        const snapshot = await firestore
          .collection("deckStatistics")
          .where("userId", "==", userId)
          .get();

        const deckStats: DeckStatistics[] = [];

        snapshot.forEach((doc: any) => {
          const data = doc.data();
          const stats = this.mapDeckStatistics(data);

          if (isValidDeckStatistics(stats)) {
            deckStats.push(stats);
          }
        });

        return deckStats;
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas do deck:", error);
      return deckId ? null : [];
    }
  }

  /**
   * Calcula porcentagem de progresso baseado em cards dominados
   */
  calculateDeckProgress(masteredCards: number, totalCards: number): number {
    if (totalCards === 0) return 0;
    if (masteredCards < 0) return 0;

    const percentage = Math.round((masteredCards / totalCards) * 100);
    return Math.min(percentage, 100); // Limita a 100%
  }

  // =============================================================================
  // USER STATISTICS METHODS (20 min)
  // =============================================================================

  /**
   * Atualiza estatísticas globais do usuário
   * Calcula estatísticas agregadas e detecta padrões de estudo
   */
  async updateUserStatistics(userId: string): Promise<UserStatistics> {
    try {
      // Buscar dados existentes
      const existingStats = await this.getUserStatistics(userId);
      const userProgress = await this.firestoreService.getUserProgress(userId);

      // Calcular totais baseados em XP transactions
      const cardsCriados =
        await this.firestoreService.countXPTransactionsBySource(
          userId,
          XPSource.CARD_CREATION
        );
      const decksCriados =
        await this.firestoreService.countXPTransactionsBySource(
          userId,
          XPSource.DECK_CREATION
        );
      const reviewsCompletos =
        await this.firestoreService.countXPTransactionsBySource(
          userId,
          XPSource.REVIEW
        );

      // Calcular tempo de sessões e favorito
      const sessionData = await this.calculateSessionData(userId);

      // Calcular accuracy e retention rates
      const accuracyRate = await this.calculateAccuracyRate(userId);
      const retentionRate = await this.calculateRetentionRate(userId);

      // Calcular progresso semanal e mensal
      const weeklyData = await this.calculateWeeklyProgress(userId);
      const monthlyData = await this.calculateMonthlyProgress(userId);

      // Detectar horário favorito de estudo
      const favoriteStudyTime = await this.detectFavoriteStudyTime(userId);

      const now = new Date();
      const userStats: Partial<UserStatistics> = {
        userId,
        totalCardsCreated: cardsCriados,
        totalDecksCreated: decksCriados,
        totalReviewsCompleted: reviewsCompletos,
        totalStudySessions: sessionData.totalSessions,
        totalStudyTimeMinutes: sessionData.totalTimeMinutes,
        averageSessionDurationMinutes: sessionData.averageDuration,
        longestStreakDays: userProgress.longestStreak,
        weeklyReviewGoal: existingStats?.weeklyReviewGoal || 50,
        currentWeekReviews: weeklyData.thisWeekReviews,
        monthlyReviewGoal: existingStats?.monthlyReviewGoal || 200,
        currentMonthReviews: monthlyData.thisMonthReviews,
        overallAccuracyRate: accuracyRate,
        retentionRate,
        overallAverageEase: await this.calculateOverallAverageEase(userId),
        difficultyBreakdown: await this.calculateDifficultyBreakdown(userId),
        firstActivityAt:
          existingStats?.firstActivityAt || userProgress.createdAt,
        lastActivityAt: now,
        updatedAt: now,
      };

      // Normalizar e validar
      const normalizedStats = normalizeUserStatistics(userStats);

      if (!isValidUserStatistics(normalizedStats)) {
        throw new Error(
          `Dados inválidos para estatísticas do usuário ${userId}`
        );
      }

      // Salvar no Firestore: userStatistics/{userId}
      await firestore
        .collection("userStatistics")
        .doc(userId)
        .set(normalizedStats);

      return normalizedStats;
    } catch (error) {
      console.error("Erro ao atualizar estatísticas do usuário:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do usuário do Firestore
   */
  async getUserStatistics(userId: string): Promise<UserStatistics | null> {
    try {
      const doc = await firestore
        .collection("userStatistics")
        .doc(userId)
        .get();

      if (!doc.exists || !doc.data()) {
        return null;
      }

      const data = doc.data()!;
      const stats = this.mapUserStatistics(data);

      return isValidUserStatistics(stats) ? stats : null;
    } catch (error) {
      console.error("Erro ao buscar estatísticas do usuário:", error);
      return null;
    }
  }

  /**
   * Incrementa contadores de revisão para usuário
   * Atualiza thisWeekReviews, thisMonthReviews
   */
  async incrementReviewCount(
    userId: string,
    reviewCount: number = 1
  ): Promise<void> {
    try {
      const userStatsRef = firestore.collection("userStatistics").doc(userId);
      const doc = await userStatsRef.get();

      if (doc.exists) {
        // Incrementar contadores existentes
        await userStatsRef.update({
          totalReviewsCompleted:
            admin.firestore.FieldValue.increment(reviewCount),
          currentWeekReviews: admin.firestore.FieldValue.increment(reviewCount),
          currentMonthReviews:
            admin.firestore.FieldValue.increment(reviewCount),
          updatedAt: new Date(),
        });
      } else {
        // Criar stats iniciais se não existir
        await this.updateUserStatistics(userId);
      }
    } catch (error) {
      console.error("Erro ao incrementar contadores de revisão:", error);
      throw error;
    }
  }

  /**
   * Registra dados de sessão de estudo
   */
  async recordStudySession(data: ReviewSessionData): Promise<void> {
    try {
      const {
        userId,
        sessionDurationMinutes,
        cardsReviewed,
        accuracyCount,
        totalAnswers,
      } = data;

      // Incrementar contadores de review
      await this.incrementReviewCount(userId, cardsReviewed);

      // Atualizar dados de sessão
      const sessionId = randomUUID();
      await firestore
        .collection("studySessions")
        .doc(sessionId)
        .set({
          userId,
          sessionDurationMinutes,
          cardsReviewed,
          accuracyCount,
          totalAnswers,
          accuracyRate:
            totalAnswers > 0 ? (accuracyCount / totalAnswers) * 100 : 0,
          studyTime:
            data.studyTime || this.determineStudyTimeFromDate(new Date()),
          timestamp: new Date(),
        });

      // Trigger atualização de stats globais (pode ser async)
      setImmediate(() =>
        this.updateUserStatistics(userId).catch(console.error)
      );
    } catch (error) {
      console.error("Erro ao registrar sessão de estudo:", error);
      throw error;
    }
  }

  // =============================================================================
  // ANALYTICS METHODS (10 min)
  // =============================================================================

  /**
   * Calcula taxa de acertos analisando histórico de respostas
   */
  async calculateAccuracyRate(userId: string): Promise<number> {
    try {
      const sessionsSnapshot = await firestore
        .collection("studySessions")
        .where("userId", "==", userId)
        .limit(100)
        .get();

      let totalCorrect = 0;
      let totalAnswers = 0;

      sessionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        totalCorrect += data.accuracyCount || 0;
        totalAnswers += data.totalAnswers || 0;
      });

      return totalAnswers > 0
        ? Math.round((totalCorrect / totalAnswers) * 100)
        : 0;
    } catch (error) {
      console.error("Erro ao calcular taxa de acertos:", error);
      return 0;
    }
  }

  /**
   * Calcula taxa de retenção analisando retenção geral dos cards
   */
  async calculateRetentionRate(userId: string): Promise<number> {
    try {
      // Buscar estatísticas de todos os decks do usuário
      const deckStats = (await this.getDeckStatistics(
        userId
      )) as DeckStatistics[];

      if (!Array.isArray(deckStats) || deckStats.length === 0) {
        return 0;
      }

      let totalCards = 0;
      let masteredCards = 0;

      deckStats.forEach((deck) => {
        totalCards += deck.totalCards;
        masteredCards += deck.masteredCards;
      });

      return totalCards > 0
        ? Math.round((masteredCards / totalCards) * 100)
        : 0;
    } catch (error) {
      console.error("Erro ao calcular taxa de retenção:", error);
      return 0;
    }
  }

  /**
   * Detecta horário favorito de estudo analisando sessões
   * Retorna: "morning", "afternoon", "evening"
   */
  async detectFavoriteStudyTime(
    userId: string
  ): Promise<"morning" | "afternoon" | "evening"> {
    try {
      const sessionsSnapshot = await firestore
        .collection("studySessions")
        .where("userId", "==", userId)
        .limit(50)
        .get();

      const timeSlots = { morning: 0, afternoon: 0, evening: 0 };

      sessionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        const studyTime = data.studyTime || "afternoon";

        if (studyTime in timeSlots) {
          timeSlots[studyTime as keyof typeof timeSlots]++;
        }
      });

      // Verifica se há pelo menos uma sessão registrada
      const totalSessions = Object.values(timeSlots).reduce(
        (sum, count) => sum + count,
        0
      );
      if (totalSessions === 0) {
        return "afternoon"; // Default quando não há dados
      }

      // Retorna horário com mais sessões
      const favorite = Object.entries(timeSlots).reduce((max, [time, count]) =>
        count > max[1] ? [time, count] : max
      )[0] as "morning" | "afternoon" | "evening";

      return favorite;
    } catch (error) {
      console.error("Erro ao detectar horário favorito:", error);
      return "afternoon"; // Default
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async calculateSessionData(userId: string): Promise<{
    totalSessions: number;
    totalTimeMinutes: number;
    averageDuration: number;
  }> {
    try {
      const sessionsSnapshot = await firestore
        .collection("studySessions")
        .where("userId", "==", userId)
        .get();

      let totalSessions = 0;
      let totalTimeMinutes = 0;

      sessionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        totalSessions++;
        totalTimeMinutes += data.sessionDurationMinutes || 0;
      });

      const averageDuration =
        totalSessions > 0 ? Math.round(totalTimeMinutes / totalSessions) : 0;

      return { totalSessions, totalTimeMinutes, averageDuration };
    } catch (error) {
      console.error("Erro ao calcular dados de sessão:", error);
      return { totalSessions: 0, totalTimeMinutes: 0, averageDuration: 0 };
    }
  }

  private async calculateWeeklyProgress(
    userId: string
  ): Promise<{ thisWeekReviews: number }> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const snapshot = await firestore
        .collection("xpTransactions")
        .where("userId", "==", userId)
        .where("source", "==", XPSource.REVIEW)
        .where("timestamp", ">=", oneWeekAgo)
        .get();

      return { thisWeekReviews: snapshot.size };
    } catch (error) {
      console.error("Erro ao calcular progresso semanal:", error);
      return { thisWeekReviews: 0 };
    }
  }

  private async calculateMonthlyProgress(
    userId: string
  ): Promise<{ thisMonthReviews: number }> {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

      const snapshot = await firestore
        .collection("xpTransactions")
        .where("userId", "==", userId)
        .where("source", "==", XPSource.REVIEW)
        .where("timestamp", ">=", oneMonthAgo)
        .get();

      return { thisMonthReviews: snapshot.size };
    } catch (error) {
      console.error("Erro ao calcular progresso mensal:", error);
      return { thisMonthReviews: 0 };
    }
  }

  private async calculateOverallAverageEase(userId: string): Promise<number> {
    try {
      const deckStats = (await this.getDeckStatistics(
        userId
      )) as DeckStatistics[];

      if (!Array.isArray(deckStats) || deckStats.length === 0) {
        return 0;
      }

      const totalEase = deckStats.reduce(
        (sum, deck) => sum + deck.averageEase,
        0
      );
      return totalEase / deckStats.length;
    } catch (error) {
      console.error("Erro ao calcular facilidade média geral:", error);
      return 0;
    }
  }

  private async calculateDifficultyBreakdown(
    userId: string
  ): Promise<UserStatistics["difficultyBreakdown"]> {
    try {
      const sessionsSnapshot = await firestore
        .collection("studySessions")
        .where("userId", "==", userId)
        .get();

      const breakdown = {
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
      };

      sessionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        // Aqui você pode implementar lógica para contar by difficulty
        // Por enquanto, vamos simular uma distribuição
        const total = data.totalAnswers || 0;
        breakdown.againCount += Math.round(total * 0.15);
        breakdown.hardCount += Math.round(total * 0.25);
        breakdown.goodCount += Math.round(total * 0.4);
        breakdown.easyCount += Math.round(total * 0.2);
      });

      return breakdown;
    } catch (error) {
      console.error("Erro ao calcular breakdown de dificuldade:", error);
      return { againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 };
    }
  }

  private calculateAverageEase(cardStates: Array<{ ease: number }>): number {
    if (cardStates.length === 0) return 0;

    const totalEase = cardStates.reduce(
      (sum, card) => sum + (card.ease || 0),
      0
    );
    return Math.round((totalEase / cardStates.length) * 100) / 100;
  }

  private determineStudyTimeFromDate(
    date: Date
  ): "morning" | "afternoon" | "evening" {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "evening";
  }

  private mapDeckStatistics(data: any): DeckStatistics {
    return {
      deckId: data.deckId || "",
      userId: data.userId || "",
      deckName: data.deckName || "",
      cardsNew: data.cardsNew || 0,
      cardsLearning: data.cardsLearning || 0,
      cardsReview: data.cardsReview || 0,
      totalCards: data.totalCards || 0,
      progressPercentage: data.progressPercentage || 0,
      masteredCards: data.masteredCards || 0,
      averageEase: data.averageEase || 0,
      lastStudiedAt:
        data.lastStudiedAt?.toDate?.() || data.lastStudiedAt || new Date(),
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
    };
  }

  private mapUserStatistics(data: any): UserStatistics {
    return {
      userId: data.userId || "",
      totalCardsCreated: data.totalCardsCreated || 0,
      totalDecksCreated: data.totalDecksCreated || 0,
      totalReviewsCompleted: data.totalReviewsCompleted || 0,
      totalStudySessions: data.totalStudySessions || 0,
      totalStudyTimeMinutes: data.totalStudyTimeMinutes || 0,
      averageSessionDurationMinutes: data.averageSessionDurationMinutes || 0,
      longestStreakDays: data.longestStreakDays || 0,
      weeklyReviewGoal: data.weeklyReviewGoal || 50,
      currentWeekReviews: data.currentWeekReviews || 0,
      monthlyReviewGoal: data.monthlyReviewGoal || 200,
      currentMonthReviews: data.currentMonthReviews || 0,
      overallAccuracyRate: data.overallAccuracyRate || 0,
      retentionRate: data.retentionRate || 0,
      overallAverageEase: data.overallAverageEase || 0,
      difficultyBreakdown: {
        againCount: data.difficultyBreakdown?.againCount || 0,
        hardCount: data.difficultyBreakdown?.hardCount || 0,
        goodCount: data.difficultyBreakdown?.goodCount || 0,
        easyCount: data.difficultyBreakdown?.easyCount || 0,
      },
      firstActivityAt:
        data.firstActivityAt?.toDate?.() || data.firstActivityAt || new Date(),
      lastActivityAt:
        data.lastActivityAt?.toDate?.() || data.lastActivityAt || new Date(),
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
    };
  }
}
