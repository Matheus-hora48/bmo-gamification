import { firestore } from "../config/firebase.config";
import type { Ranking, RankingPeriod } from "../models/Ranking";
import { isValidRanking, normalizeRanking } from "../models/Ranking";
import type { RankingEntry } from "../models/RankingEntry";
import {
  isValidRankingEntry,
  normalizeRankingEntry,
} from "../models/RankingEntry";
import type { XPTransaction } from "../models/XPTransaction";
import { XPSource } from "../models/XPTransaction";
import type { UserProgress } from "../models/UserProgress";

export interface RankingCalculationParams {
  period: RankingPeriod;
  date: string; // "2025-11" para monthly ou "2025" para yearly
  startDate: Date;
  endDate: Date;
}

export interface UserRankingData {
  userId: string;
  userName: string;
  userAvatar?: string;
  cardsReviewed: number;
  xpEarned: number;
  streakDays: number;
}

/**
 * Serviço para gerenciamento de rankings mensal e anual
 * Calcula posições baseado em quantidade de cards revisados
 */
export class RankingService {
  // =============================================================================
  // RANKING GENERATION METHODS
  // =============================================================================

  /**
   * Atualiza ranking mensal para uma data específica
   * Busca todos os usuários do mês, ordena por cardsReviewed e calcula ranks
   */
  async updateMonthlyRanking(date?: string): Promise<Ranking> {
    const targetDate = date || this.getCurrentMonthString();
    const { startDate, endDate } = this.getMonthlyDateRange(targetDate);

    const params: RankingCalculationParams = {
      period: "monthly",
      date: targetDate,
      startDate,
      endDate,
    };

    return this.calculateAndSaveRanking(params);
  }

  /**
   * Atualiza ranking anual para um ano específico
   * Busca todos os usuários do ano, ordena por cardsReviewed e calcula ranks
   */
  async updateYearlyRanking(year?: string): Promise<Ranking> {
    const targetYear = year || this.getCurrentYearString();
    const { startDate, endDate } = this.getYearlyDateRange(targetYear);

    const params: RankingCalculationParams = {
      period: "yearly",
      date: targetYear,
      startDate,
      endDate,
    };

    return this.calculateAndSaveRanking(params);
  }

  /**
   * Busca posição específica do usuário no ranking
   */
  async getUserRankPosition(
    userId: string,
    period: RankingPeriod,
    date?: string
  ): Promise<number | null> {
    try {
      const targetDate =
        date ||
        (period === "monthly"
          ? this.getCurrentMonthString()
          : this.getCurrentYearString());
      const docId = `${period}_${targetDate}`;

      const rankingDoc = await firestore
        .collection("rankings")
        .doc(docId)
        .get();

      if (!rankingDoc.exists || !rankingDoc.data()) {
        return null;
      }

      const ranking = this.mapRanking(rankingDoc.data()!);

      if (!isValidRanking(ranking)) {
        return null;
      }

      const userEntry = ranking.entries.find(
        (entry) => entry.userId === userId
      );

      return userEntry ? userEntry.rank : null;
    } catch (error) {
      console.error("Erro ao buscar posição do usuário no ranking:", error);
      return null;
    }
  }

  /**
   * Busca top N do ranking
   */
  async getTopRanking(
    period: RankingPeriod,
    limit: number = 10,
    date?: string
  ): Promise<RankingEntry[]> {
    try {
      const targetDate =
        date ||
        (period === "monthly"
          ? this.getCurrentMonthString()
          : this.getCurrentYearString());
      const docId = `${period}_${targetDate}`;

      const rankingDoc = await firestore
        .collection("rankings")
        .doc(docId)
        .get();

      if (!rankingDoc.exists || !rankingDoc.data()) {
        return [];
      }

      const ranking = this.mapRanking(rankingDoc.data()!);

      if (!isValidRanking(ranking)) {
        return [];
      }

      // Retorna top N entradas (já estão ordenadas por rank)
      return ranking.entries.slice(0, limit);
    } catch (error) {
      console.error("Erro ao buscar top ranking:", error);
      return [];
    }
  }

  /**
   * Busca ranking completo (com paginação opcional)
   */
  async getRanking(
    period: RankingPeriod,
    date?: string
  ): Promise<Ranking | null> {
    try {
      const targetDate =
        date ||
        (period === "monthly"
          ? this.getCurrentMonthString()
          : this.getCurrentYearString());
      const docId = `${period}_${targetDate}`;

      const rankingDoc = await firestore
        .collection("rankings")
        .doc(docId)
        .get();

      if (!rankingDoc.exists || !rankingDoc.data()) {
        return null;
      }

      const ranking = this.mapRanking(rankingDoc.data()!);

      return isValidRanking(ranking) ? ranking : null;
    } catch (error) {
      console.error("Erro ao buscar ranking:", error);
      return null;
    }
  }

  /**
   * Calcula dados do usuário para o ranking em um período específico
   */
  async calculateUserRankingData(
    userId: string,
    period: RankingPeriod,
    date?: string
  ): Promise<UserRankingData | null> {
    try {
      const targetDate =
        date ||
        (period === "monthly"
          ? this.getCurrentMonthString()
          : this.getCurrentYearString());
      const { startDate, endDate } =
        period === "monthly"
          ? this.getMonthlyDateRange(targetDate)
          : this.getYearlyDateRange(targetDate);

      // Buscar dados do usuário
      const userProgress = await this.getUserProgress(userId);
      if (!userProgress) {
        return null;
      }

      // Contar reviews no período
      const cardsReviewed = await this.countUserReviewsInPeriod(
        userId,
        startDate,
        endDate
      );

      // Calcular XP ganho no período
      const xpEarned = await this.calculateUserXPInPeriod(
        userId,
        startDate,
        endDate
      );

      const userData: UserRankingData = {
        userId,
        userName: userProgress.userId, // Você pode buscar nome real de outra source
        cardsReviewed,
        xpEarned,
        streakDays: userProgress.currentStreak,
      };

      return userData;
    } catch (error) {
      console.error("Erro ao calcular dados do usuário para ranking:", error);
      return null;
    }
  }

  // =============================================================================
  // PRIVATE CALCULATION METHODS
  // =============================================================================

  private async calculateAndSaveRanking(
    params: RankingCalculationParams
  ): Promise<Ranking> {
    const { period, date, startDate, endDate } = params;

    try {
      // Buscar todos os usuários ativos no período
      const usersData = await this.getAllUsersRankingData(startDate, endDate);

      // Ordenar por cardsReviewed (descendente)
      usersData.sort((a, b) => b.cardsReviewed - a.cardsReviewed);

      // Calcular ranks (lidar com empates)
      const entries = this.calculateRanks(usersData);

      // Calcular estatísticas agregadas
      const totalReviews = usersData.reduce(
        (sum, user) => sum + user.cardsReviewed,
        0
      );
      const totalXpDistributed = usersData.reduce(
        (sum, user) => sum + user.xpEarned,
        0
      );
      const averageReviewsPerUser =
        usersData.length > 0 ? totalReviews / usersData.length : 0;

      const now = new Date();
      const ranking: Ranking = {
        period,
        date,
        entries,
        totalParticipants: usersData.length,
        totalReviews,
        totalXpDistributed,
        averageReviewsPerUser: Math.round(averageReviewsPerUser),
        lastUpdated: now,
        createdAt: now, // Será sobrescrito se já existir
      };

      // Buscar ranking existente para preservar createdAt
      const existingRanking = await this.getRanking(period, date);
      if (existingRanking) {
        ranking.createdAt = existingRanking.createdAt;
      }

      // Validar e normalizar
      const normalizedRanking = normalizeRanking(ranking);
      if (!isValidRanking(normalizedRanking)) {
        throw new Error(`Dados inválidos para ranking ${period}_${date}`);
      }

      // Salvar no Firestore: rankings/{period}_{date}
      const docId = `${period}_${date}`;
      await firestore.collection("rankings").doc(docId).set(normalizedRanking);

      return normalizedRanking;
    } catch (error) {
      console.error(`Erro ao calcular ranking ${period}_${date}:`, error);
      throw error;
    }
  }

  private async getAllUsersRankingData(
    startDate: Date,
    endDate: Date
  ): Promise<UserRankingData[]> {
    try {
      // Buscar todos os usuários que fizeram reviews no período
      const reviewsSnapshot = await firestore
        .collection("xpTransactions")
        .where("source", "==", XPSource.REVIEW)
        .where("timestamp", ">=", startDate)
        .where("timestamp", "<=", endDate)
        .get();

      // Agrupar por usuário
      const userReviewsMap = new Map<string, { reviews: number; xp: number }>();

      reviewsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        const userId = data.userId;
        const xpAmount = data.amount || 0;

        if (!userReviewsMap.has(userId)) {
          userReviewsMap.set(userId, { reviews: 0, xp: 0 });
        }

        const userData = userReviewsMap.get(userId)!;
        userData.reviews += 1;
        userData.xp += xpAmount;
      });

      // Buscar dados complementares de cada usuário
      const usersData: UserRankingData[] = [];

      for (const [userId, stats] of userReviewsMap) {
        const userProgress = await this.getUserProgress(userId);

        if (userProgress) {
          usersData.push({
            userId,
            userName: userId, // TODO: Buscar nome real
            cardsReviewed: stats.reviews,
            xpEarned: stats.xp,
            streakDays: userProgress.currentStreak,
          });
        }
      }

      return usersData;
    } catch (error) {
      console.error("Erro ao buscar dados dos usuários para ranking:", error);
      return [];
    }
  }

  private calculateRanks(usersData: UserRankingData[]): RankingEntry[] {
    const entries: RankingEntry[] = [];
    let currentRank = 1;

    for (let i = 0; i < usersData.length; i++) {
      const user = usersData[i];
      if (!user) continue;

      // Se não é o primeiro e tem mesmo número de reviews que o anterior, mantém o rank
      if (i > 0 && user.cardsReviewed === usersData[i - 1]?.cardsReviewed) {
        // Mantém o rank atual (empate)
      } else {
        // Atualiza rank para posição atual (i + 1)
        currentRank = i + 1;
      }

      const entryData = {
        userId: user.userId,
        userName: user.userName,
        cardsReviewed: user.cardsReviewed,
        rank: currentRank,
        xpEarned: user.xpEarned,
        streakDays: user.streakDays,
        accuracyRate: 0, // TODO: Implementar cálculo real
        studyTimeMinutes: 0, // TODO: Implementar cálculo real
        studySessions: 0, // TODO: Implementar cálculo real
        achievementsUnlocked: 0, // TODO: Implementar cálculo real
        specialBadges: [] as string[],
        rankChange: "new" as const, // TODO: Implementar comparação com período anterior
        isActive: user.cardsReviewed > 0,
        ...(user.userAvatar && { userAvatar: user.userAvatar }),
      };

      const normalizedEntry = normalizeRankingEntry(entryData as RankingEntry);
      if (isValidRankingEntry(normalizedEntry)) {
        entries.push(normalizedEntry);
      }
    }

    return entries;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async countUserReviewsInPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const snapshot = await firestore
        .collection("xpTransactions")
        .where("userId", "==", userId)
        .where("source", "==", XPSource.REVIEW)
        .where("timestamp", ">=", startDate)
        .where("timestamp", "<=", endDate)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error("Erro ao contar reviews do usuário:", error);
      return 0;
    }
  }

  private async calculateUserXPInPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const snapshot = await firestore
        .collection("xpTransactions")
        .where("userId", "==", userId)
        .where("timestamp", ">=", startDate)
        .where("timestamp", "<=", endDate)
        .get();

      let totalXP = 0;
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        totalXP += data.amount || 0;
      });

      return totalXP;
    } catch (error) {
      console.error("Erro ao calcular XP do usuário:", error);
      return 0;
    }
  }

  private async getUserProgress(userId: string): Promise<UserProgress | null> {
    try {
      // Você precisa ajustar isso para usar o método correto do FirestoreService
      const userDoc = await firestore
        .collection("users")
        .doc(userId)
        .collection("profile")
        .doc("profile")
        .get();

      if (!userDoc.exists || !userDoc.data()) {
        return null;
      }

      const data = userDoc.data()!;

      return {
        userId,
        level: data.level || 1,
        currentXP: data.currentXP || 0,
        totalXP: data.totalXP || 0,
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        lastActivityDate: data.lastActivityDate || null,
        achievements: data.achievements || [],
        createdAt: data.createdAt || new Date(),
      };
    } catch (error) {
      console.error("Erro ao buscar progresso do usuário:", error);
      return null;
    }
  }

  private getCurrentMonthString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  private getCurrentYearString(): string {
    return String(new Date().getFullYear());
  }

  private getMonthlyDateRange(dateString: string): {
    startDate: Date;
    endDate: Date;
  } {
    const parts = dateString.split("-");
    if (parts.length !== 2) {
      throw new Error(
        `Formato de data inválido para mensal: ${dateString}. Esperado: YYYY-MM`
      );
    }

    const [yearStr, monthStr] = parts;
    if (!yearStr || !monthStr) {
      throw new Error(
        `Formato de data inválido para mensal: ${dateString}. Partes faltando.`
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new Error(`Data inválida para formato mensal: ${dateString}`);
    }

    const startDate = new Date(year, month - 1, 1); // Primeiro dia do mês
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Último dia do mês

    return { startDate, endDate };
  }

  private getYearlyDateRange(year: string): { startDate: Date; endDate: Date } {
    const yearNum = parseInt(year);

    const startDate = new Date(yearNum, 0, 1); // 1º de janeiro
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999); // 31 de dezembro

    return { startDate, endDate };
  }

  private mapRanking(data: any): Ranking {
    return {
      period: data.period || "monthly",
      date: data.date || "",
      entries: Array.isArray(data.entries)
        ? data.entries.map((entry: any) => this.mapRankingEntry(entry))
        : [],
      totalParticipants: data.totalParticipants || 0,
      totalReviews: data.totalReviews || 0,
      totalXpDistributed: data.totalXpDistributed || 0,
      averageReviewsPerUser: data.averageReviewsPerUser || 0,
      lastUpdated:
        data.lastUpdated?.toDate?.() || data.lastUpdated || new Date(),
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
    };
  }

  private mapRankingEntry(data: any): RankingEntry {
    return {
      userId: data.userId || "",
      userName: data.userName || "",
      userAvatar: data.userAvatar,
      cardsReviewed: data.cardsReviewed || 0,
      rank: data.rank || 0,
      xpEarned: data.xpEarned || 0,
      streakDays: data.streakDays || 0,
      accuracyRate: data.accuracyRate || 0,
      studyTimeMinutes: data.studyTimeMinutes || 0,
      studySessions: data.studySessions || 0,
      achievementsUnlocked: data.achievementsUnlocked || 0,
      specialBadges: data.specialBadges || [],
      rankChange: data.rankChange || "new",
      isActive: data.isActive ?? true,
    };
  }
}

export const rankingService = new RankingService();
