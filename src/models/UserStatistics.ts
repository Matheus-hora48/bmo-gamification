import type { Timestamp } from "firebase-admin/firestore";

/**
 * Estatísticas globais do usuário - Tracking de performance e progresso geral
 */
export interface UserStatistics {
  /** ID único do usuário */
  userId: string;

  // TOTALS ABSOLUTOS
  /** Total de cards criados pelo usuário */
  totalCardsCreated: number;
  /** Total de decks criados */
  totalDecksCreated: number;
  /** Total de reviews realizados (histórico) */
  totalReviewsCompleted: number;

  // SESSÕES DE ESTUDO
  /** Número total de sessões de estudo */
  totalStudySessions: number;
  /** Tempo total de estudo em minutos */
  totalStudyTimeMinutes: number;
  /** Tempo médio por sessão em minutos */
  averageSessionDurationMinutes: number;
  /** Maior sequência de dias estudando */
  longestStreakDays: number;

  // METAS E PROGRESSO
  /** Meta semanal de reviews */
  weeklyReviewGoal: number;
  /** Reviews completados na semana atual */
  currentWeekReviews: number;
  /** Meta mensal de reviews */
  monthlyReviewGoal: number;
  /** Reviews completados no mês atual */
  currentMonthReviews: number;

  // PERFORMANCE E QUALIDADE
  /** Taxa de acertos geral (0-100) */
  overallAccuracyRate: number;
  /** Taxa de retenção (cards lembrados) (0-100) */
  retentionRate: number;
  /** Facilidade média em todos os cards */
  overallAverageEase: number;

  // BREAKDOWN POR DIFICULDADE
  /** Stats de performance por dificuldade */
  difficultyBreakdown: {
    /** Acertos em cards Again */
    againCount: number;
    /** Acertos em cards Hard */
    hardCount: number;
    /** Acertos em cards Good */
    goodCount: number;
    /** Acertos em cards Easy */
    easyCount: number;
  };

  // TIMING
  /** Data da primeira atividade */
  firstActivityAt: Date | Timestamp;
  /** Data da última atividade */
  lastActivityAt: Date | Timestamp;
  /** Data de criação das stats */
  createdAt: Date | Timestamp;
  /** Data da última atualização */
  updatedAt: Date | Timestamp;
}

/**
 * Performance snapshot para UI
 */
export interface UserPerformanceSnapshot {
  /** Taxa de acertos atual */
  accuracyRate: number;
  /** Taxa de retenção */
  retentionRate: number;
  /** Progresso semanal (0-100) */
  weeklyProgress: number;
  /** Progresso mensal (0-100) */
  monthlyProgress: number;
  /** Avaliação da performance */
  performanceRating: "excellent" | "good" | "average" | "needs_improvement";
}

/**
 * Insights de estudo para motivação
 */
export interface StudyInsights {
  /** Tempo médio de estudo por dia esta semana */
  averageDailyStudyMinutes: number;
  /** Melhor dia da semana (0=Dom, 1=Seg, etc) */
  bestStudyDay: number;
  /** Cards dominados esta semana */
  cardsMasteredThisWeek: number;
  /** Evolução da taxa de acerto (comparado ao mês anterior) */
  accuracyTrend: "improving" | "stable" | "declining";
  /** Status da sequência atual */
  streakStatus: "on_track" | "at_risk" | "broken";
}

/**
 * Helper para cálculos de estatísticas do usuário
 */
export class UserStatisticsHelpers {
  /**
   * Calcula snapshot de performance do usuário
   */
  static calculatePerformanceSnapshot(
    stats: UserStatistics
  ): UserPerformanceSnapshot {
    const weeklyProgress =
      stats.weeklyReviewGoal > 0
        ? Math.min(
            100,
            (stats.currentWeekReviews / stats.weeklyReviewGoal) * 100
          )
        : 0;

    const monthlyProgress =
      stats.monthlyReviewGoal > 0
        ? Math.min(
            100,
            (stats.currentMonthReviews / stats.monthlyReviewGoal) * 100
          )
        : 0;

    return {
      accuracyRate: stats.overallAccuracyRate,
      retentionRate: stats.retentionRate,
      weeklyProgress,
      monthlyProgress,
      performanceRating: this.calculatePerformanceRating(stats),
    };
  }

  /**
   * Calcula rating de performance baseado em múltiplas métricas
   */
  static calculatePerformanceRating(
    stats: UserStatistics
  ): UserPerformanceSnapshot["performanceRating"] {
    const accuracyWeight = 0.4;
    const retentionWeight = 0.3;
    const consistencyWeight = 0.3;

    // Score de acurácia (0-100)
    const accuracyScore = stats.overallAccuracyRate;

    // Score de retenção (0-100)
    const retentionScore = stats.retentionRate;

    // Score de consistência baseado em meta semanal
    const weeklyConsistency =
      stats.weeklyReviewGoal > 0
        ? Math.min(
            100,
            (stats.currentWeekReviews / stats.weeklyReviewGoal) * 100
          )
        : 0;

    const overallScore =
      accuracyScore * accuracyWeight +
      retentionScore * retentionWeight +
      weeklyConsistency * consistencyWeight;

    if (overallScore >= 85) return "excellent";
    if (overallScore >= 70) return "good";
    if (overallScore >= 50) return "average";
    return "needs_improvement";
  }

  /**
   * Calcula tempo médio de sessão
   */
  static calculateAverageSessionDuration(
    totalTimeMinutes: number,
    totalSessions: number
  ): number {
    if (totalSessions === 0) return 0;
    return Math.round(totalTimeMinutes / totalSessions);
  }

  /**
   * Calcula taxa de acertos baseado em breakdown de dificuldade
   */
  static calculateAccuracyFromBreakdown(
    breakdown: UserStatistics["difficultyBreakdown"]
  ): number {
    const totalResponses =
      breakdown.againCount +
      breakdown.hardCount +
      breakdown.goodCount +
      breakdown.easyCount;

    if (totalResponses === 0) return 0;

    // Considera Good e Easy como acertos
    const correctResponses = breakdown.goodCount + breakdown.easyCount;
    return Math.round((correctResponses / totalResponses) * 100);
  }

  /**
   * Determina se usuário está ativo (estudou nos últimos 7 dias)
   */
  static isActiveUser(stats: UserStatistics): boolean {
    const lastActivity =
      stats.lastActivityAt instanceof Date
        ? stats.lastActivityAt
        : stats.lastActivityAt.toDate();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return lastActivity >= sevenDaysAgo;
  }

  /**
   * Calcula XP total baseado nas atividades (integração com sistema existente)
   */
  static estimateXPFromStats(stats: UserStatistics): number {
    // XP por reviews (5-20 XP cada, média 12.5)
    const reviewXP = stats.totalReviewsCompleted * 12.5;

    // XP por criação de cards (25 XP cada)
    const cardCreationXP = stats.totalCardsCreated * 25;

    // XP por criação de decks (50 XP cada)
    const deckCreationXP = stats.totalDecksCreated * 50;

    return Math.round(reviewXP + cardCreationXP + deckCreationXP);
  }
}

/**
 * Valida se o objeto UserStatistics é válido
 */
export const isValidUserStatistics = (stats: UserStatistics): boolean => {
  // Validação de campos obrigatórios
  if (!stats.userId?.trim()) {
    return false;
  }

  // Validação de números não negativos
  const numericFields: Array<keyof UserStatistics> = [
    "totalCardsCreated",
    "totalDecksCreated",
    "totalReviewsCompleted",
    "totalStudySessions",
    "totalStudyTimeMinutes",
    "averageSessionDurationMinutes",
    "longestStreakDays",
    "weeklyReviewGoal",
    "currentWeekReviews",
    "monthlyReviewGoal",
    "currentMonthReviews",
    "overallAccuracyRate",
    "retentionRate",
    "overallAverageEase",
  ];

  for (const field of numericFields) {
    const value = (stats as any)[field] as number;
    if (typeof value !== "number" || value < 0) {
      return false;
    }
  }

  // Validação de porcentagens (0-100)
  const percentageFields = ["overallAccuracyRate", "retentionRate"];
  for (const field of percentageFields) {
    const value = (stats as any)[field] as number;
    if (value > 100) {
      return false;
    }
  }

  // Validação do breakdown de dificuldade
  const breakdown = stats.difficultyBreakdown;
  const breakdownFields = ["againCount", "hardCount", "goodCount", "easyCount"];
  for (const field of breakdownFields) {
    const value = (breakdown as any)[field];
    if (typeof value !== "number" || value < 0) {
      return false;
    }
  }

  // Validação de facilidade (FSRS: 1.3 - 5.0)
  if (stats.overallAverageEase > 0) {
    if (stats.overallAverageEase < 1.3 || stats.overallAverageEase > 5.0) {
      return false;
    }
  }

  return true;
};

/**
 * Normaliza objeto UserStatistics garantindo valores válidos
 */
export const normalizeUserStatistics = (
  stats: Partial<UserStatistics>
): UserStatistics => {
  const now = new Date();

  const normalized: UserStatistics = {
    userId: stats.userId?.trim() || "",
    totalCardsCreated: Math.max(0, stats.totalCardsCreated || 0),
    totalDecksCreated: Math.max(0, stats.totalDecksCreated || 0),
    totalReviewsCompleted: Math.max(0, stats.totalReviewsCompleted || 0),
    totalStudySessions: Math.max(0, stats.totalStudySessions || 0),
    totalStudyTimeMinutes: Math.max(0, stats.totalStudyTimeMinutes || 0),
    averageSessionDurationMinutes: Math.max(
      0,
      stats.averageSessionDurationMinutes || 0
    ),
    longestStreakDays: Math.max(0, stats.longestStreakDays || 0),
    weeklyReviewGoal: Math.max(0, stats.weeklyReviewGoal || 0),
    currentWeekReviews: Math.max(0, stats.currentWeekReviews || 0),
    monthlyReviewGoal: Math.max(0, stats.monthlyReviewGoal || 0),
    currentMonthReviews: Math.max(0, stats.currentMonthReviews || 0),
    overallAccuracyRate: Math.min(
      100,
      Math.max(0, stats.overallAccuracyRate || 0)
    ),
    retentionRate: Math.min(100, Math.max(0, stats.retentionRate || 0)),
    overallAverageEase: Math.max(0, stats.overallAverageEase || 0),
    difficultyBreakdown: {
      againCount: Math.max(0, stats.difficultyBreakdown?.againCount || 0),
      hardCount: Math.max(0, stats.difficultyBreakdown?.hardCount || 0),
      goodCount: Math.max(0, stats.difficultyBreakdown?.goodCount || 0),
      easyCount: Math.max(0, stats.difficultyBreakdown?.easyCount || 0),
    },
    firstActivityAt: stats.firstActivityAt || now,
    lastActivityAt: stats.lastActivityAt || now,
    createdAt: stats.createdAt || now,
    updatedAt: now,
  };

  // Recalcula duração média de sessão se necessário
  if (
    normalized.averageSessionDurationMinutes === 0 &&
    normalized.totalStudySessions > 0
  ) {
    normalized.averageSessionDurationMinutes =
      UserStatisticsHelpers.calculateAverageSessionDuration(
        normalized.totalStudyTimeMinutes,
        normalized.totalStudySessions
      );
  }

  return normalized;
};

/**
 * Constantes para UserStatistics
 */
export const USER_STATISTICS_CONSTANTS = {
  /** Meta semanal padrão de reviews */
  DEFAULT_WEEKLY_GOAL: 50,
  /** Meta mensal padrão de reviews */
  DEFAULT_MONTHLY_GOAL: 200,
  /** Número mínimo de sessões para calcular média confiável */
  MIN_SESSIONS_FOR_AVERAGE: 5,
  /** Dias para considerar usuário ativo */
  ACTIVE_USER_THRESHOLD_DAYS: 7,
  /** Taxa de acurácia mínima considerada boa */
  GOOD_ACCURACY_THRESHOLD: 70,
  /** Taxa de retenção mínima considerada boa */
  GOOD_RETENTION_THRESHOLD: 80,
} as const;
