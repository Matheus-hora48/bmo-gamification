import type { Timestamp } from "firebase-admin/firestore";
import { RankingEntry } from "./RankingEntry";

/**
 * Tipo de período do ranking
 */
export type RankingPeriod = "monthly" | "yearly";

/**
 * Sistema de ranking - Contêiner para múltiplas entradas de ranking
 */
export interface Ranking {
  /** Tipo do período (mensal ou anual) */
  period: RankingPeriod;
  /** Data de referência do ranking (formato: YYYY-MM ou YYYY) */
  date: string;

  // DADOS DO RANKING
  /** Array com todas as entradas do ranking ordenadas por posição */
  entries: RankingEntry[];
  /** Número total de participantes elegíveis */
  totalParticipants: number;

  // METADATA
  /** Data da última atualização */
  lastUpdated: Date | Timestamp;
  /** Data de criação do ranking */
  createdAt: Date | Timestamp;

  // ESTATÍSTICAS DO PERÍODO
  /** Total de reviews realizados por todos no período */
  totalReviews: number;
  /** Total de XP distribuído no período */
  totalXpDistributed: number;
  /** Média de reviews por participante ativo */
  averageReviewsPerUser: number;
}

/**
 * Snapshot do ranking para UI
 */
export interface RankingSnapshot {
  /** Período do ranking */
  period: RankingPeriod;
  /** Data formatada do período */
  formattedDate: string;
  /** Top 10 entradas do ranking */
  topEntries: RankingEntry[];
  /** Total de participantes */
  totalParticipants: number;
  /** Posição do usuário atual (se encontrado) */
  userRank?: number;
  /** Se o ranking está atualizado (< 1 hora) */
  isUpToDate: boolean;
}

/**
 * Estatísticas do período para insights
 */
export interface RankingPeriodStats {
  /** Maior número de reviews por usuário */
  maxReviewsByUser: number;
  /** Usuário com mais reviews */
  topPerformerName: string;
  /** Média de tempo de estudo */
  averageStudyTime: number;
  /** Taxa de participação (usuários ativos / total) */
  participationRate: number;
  /** Distribuição por faixas de reviews */
  reviewDistribution: {
    "0-10": number;
    "11-50": number;
    "51-100": number;
    "100+": number;
  };
}

/**
 * Helper para gerenciamento de rankings
 */
export class RankingHelpers {
  /**
   * Gera chave única para o ranking baseado no período e data
   */
  static generateRankingKey(period: RankingPeriod, date: Date): string {
    if (period === "monthly") {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    } else {
      return `${date.getFullYear()}`;
    }
  }

  /**
   * Calcula snapshot do ranking para UI
   */
  static calculateSnapshot(
    ranking: Ranking,
    currentUserId?: string
  ): RankingSnapshot {
    const topEntries = ranking.entries.slice(0, 10);
    const userEntry = currentUserId
      ? ranking.entries.find((entry) => entry.userId === currentUserId)
      : undefined;

    const lastUpdated =
      ranking.lastUpdated instanceof Date
        ? ranking.lastUpdated
        : ranking.lastUpdated.toDate();

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const snapshot: RankingSnapshot = {
      period: ranking.period,
      formattedDate: this.formatPeriodDate(ranking.period, ranking.date),
      topEntries,
      totalParticipants: ranking.totalParticipants,
      isUpToDate: lastUpdated > oneHourAgo,
    };

    // Adiciona userRank apenas se o usuário foi encontrado
    if (userEntry) {
      snapshot.userRank = userEntry.rank;
    }

    return snapshot;
  }

  /**
   * Formata data do período para exibição
   */
  static formatPeriodDate(period: RankingPeriod, date: string): string {
    if (period === "monthly") {
      const [year, month] = date.split("-");
      const monthNames = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const monthIndex = month ? parseInt(month) - 1 : 0;
      return `${monthNames[monthIndex] || "Janeiro"} ${year || ""}`;
    } else {
      return `Ano ${date}`;
    }
  }

  /**
   * Calcula estatísticas do período
   */
  static calculatePeriodStats(ranking: Ranking): RankingPeriodStats {
    const activeEntries = ranking.entries.filter((entry) => entry.isActive);

    if (activeEntries.length === 0) {
      return {
        maxReviewsByUser: 0,
        topPerformerName: "",
        averageStudyTime: 0,
        participationRate: 0,
        reviewDistribution: { "0-10": 0, "11-50": 0, "51-100": 0, "100+": 0 },
      };
    }

    const maxReviews = Math.max(...activeEntries.map((e) => e.cardsReviewed));
    const topPerformer = activeEntries.find(
      (e) => e.cardsReviewed === maxReviews
    );
    const avgStudyTime =
      activeEntries.reduce((sum, e) => sum + e.studyTimeMinutes, 0) /
      activeEntries.length;

    // Distribuição de reviews
    const distribution = { "0-10": 0, "11-50": 0, "51-100": 0, "100+": 0 };
    for (const entry of activeEntries) {
      const reviews = entry.cardsReviewed;
      if (reviews <= 10) distribution["0-10"]++;
      else if (reviews <= 50) distribution["11-50"]++;
      else if (reviews <= 100) distribution["51-100"]++;
      else distribution["100+"]++;
    }

    return {
      maxReviewsByUser: maxReviews,
      topPerformerName: topPerformer?.userName || "",
      averageStudyTime: Math.round(avgStudyTime),
      participationRate: Math.round(
        (activeEntries.length / ranking.totalParticipants) * 100
      ),
      reviewDistribution: distribution,
    };
  }

  /**
   * Ordena entradas do ranking por critérios
   */
  static sortRankingEntries(entries: RankingEntry[]): RankingEntry[] {
    return [...entries].sort((a, b) => {
      // Primeiro critério: número de cards revisados
      if (a.cardsReviewed !== b.cardsReviewed) {
        return b.cardsReviewed - a.cardsReviewed;
      }

      // Segundo critério: XP ganho
      if (a.xpEarned !== b.xpEarned) {
        return b.xpEarned - a.xpEarned;
      }

      // Terceiro critério: taxa de acertos (maior é melhor)
      if (a.accuracyRate !== b.accuracyRate) {
        return b.accuracyRate - a.accuracyRate;
      }

      // Quarto critério: sequência de dias
      if (a.streakDays !== b.streakDays) {
        return b.streakDays - a.streakDays;
      }

      // Critério de desempate: tempo de estudo (menor é melhor para mesma performance)
      return a.studyTimeMinutes - b.studyTimeMinutes;
    });
  }

  /**
   * Atualiza ranks baseado na ordem das entradas
   */
  static updateRanks(entries: RankingEntry[]): RankingEntry[] {
    const sortedEntries = this.sortRankingEntries(entries);

    return sortedEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  /**
   * Calcula se o ranking precisa ser atualizado
   */
  static needsUpdate(ranking: Ranking, maxAgeHours: number = 1): boolean {
    const lastUpdated =
      ranking.lastUpdated instanceof Date
        ? ranking.lastUpdated
        : ranking.lastUpdated.toDate();

    const maxAge = new Date();
    maxAge.setHours(maxAge.getHours() - maxAgeHours);

    return lastUpdated < maxAge;
  }

  /**
   * Filtra apenas usuários elegíveis para o ranking
   */
  static filterEligibleEntries(entries: RankingEntry[]): RankingEntry[] {
    return entries.filter((entry) => entry.isActive && entry.cardsReviewed > 0);
  }

  /**
   * Gera dados padrão para período sem atividade
   */
  static createEmptyRanking(period: RankingPeriod, date: string): Ranking {
    const now = new Date();

    return {
      period,
      date,
      entries: [],
      totalParticipants: 0,
      lastUpdated: now,
      createdAt: now,
      totalReviews: 0,
      totalXpDistributed: 0,
      averageReviewsPerUser: 0,
    };
  }
}

/**
 * Valida se o objeto Ranking é válido
 */
export const isValidRanking = (ranking: Ranking): boolean => {
  // Validação de campos obrigatórios
  if (!ranking.period || !ranking.date?.trim()) {
    return false;
  }

  // Validação do período
  if (!["monthly", "yearly"].includes(ranking.period)) {
    return false;
  }

  // Validação do formato da data
  if (ranking.period === "monthly") {
    const monthlyPattern = /^\d{4}-\d{2}$/;
    if (!monthlyPattern.test(ranking.date)) {
      return false;
    }
  } else {
    const yearlyPattern = /^\d{4}$/;
    if (!yearlyPattern.test(ranking.date)) {
      return false;
    }
  }

  // Validação de números não negativos
  const numericFields: Array<keyof Ranking> = [
    "totalParticipants",
    "totalReviews",
    "totalXpDistributed",
    "averageReviewsPerUser",
  ];

  for (const field of numericFields) {
    const value = (ranking as any)[field];
    if (typeof value !== "number" || value < 0) {
      return false;
    }
  }

  // Validação do array de entradas
  if (!Array.isArray(ranking.entries)) {
    return false;
  }

  // Validação da consistência de participantes
  if (ranking.totalParticipants < ranking.entries.length) {
    return false;
  }

  return true;
};

/**
 * Normaliza objeto Ranking garantindo valores válidos
 */
export const normalizeRanking = (ranking: Partial<Ranking>): Ranking => {
  const now = new Date();

  return {
    period: ranking.period || "monthly",
    date: ranking.date?.trim() || "",
    entries: Array.isArray(ranking.entries) ? ranking.entries : [],
    totalParticipants: Math.max(0, ranking.totalParticipants || 0),
    lastUpdated: ranking.lastUpdated || now,
    createdAt: ranking.createdAt || now,
    totalReviews: Math.max(0, ranking.totalReviews || 0),
    totalXpDistributed: Math.max(0, ranking.totalXpDistributed || 0),
    averageReviewsPerUser: Math.max(0, ranking.averageReviewsPerUser || 0),
  };
};

/**
 * Constantes para Ranking
 */
export const RANKING_CONSTANTS = {
  /** Número máximo de entradas no top ranking */
  TOP_RANKING_SIZE: 100,
  /** Número de entradas para exibição em top 10 */
  TOP_DISPLAY_SIZE: 10,
  /** Intervalo de atualização em horas */
  UPDATE_INTERVAL_HOURS: 1,
  /** Número mínimo de participantes para ranking válido */
  MIN_PARTICIPANTS_FOR_RANKING: 3,
  /** Períodos válidos para ranking */
  VALID_PERIODS: ["monthly", "yearly"] as const,
  /** Formato de data para ranking mensal */
  MONTHLY_DATE_FORMAT: "YYYY-MM",
  /** Formato de data para ranking anual */
  YEARLY_DATE_FORMAT: "YYYY",
} as const;
