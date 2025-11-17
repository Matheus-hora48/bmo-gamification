import type { Timestamp } from "firebase-admin/firestore";

/**
 * Estatísticas por deck - Tracking de progresso individual de cada deck
 */
export interface DeckStatistics {
  /** ID único do deck */
  deckId: string;
  /** ID do usuário proprietário */
  userId: string;
  /** Nome do deck */
  deckName: string;

  // ESTADOS DOS CARDS (FSRS)
  /** Cards nunca estudados */
  cardsNew: number;
  /** Cards em aprendizado (FSRS) */
  cardsLearning: number;
  /** Cards para revisão */
  cardsReview: number;
  /** Total de cards no deck */
  totalCards: number;

  // PROGRESSO
  /** Porcentagem de progresso no deck (0-100) */
  progressPercentage: number;
  /** Cards dominados (interval > 30 dias) */
  masteredCards: number;

  // PERFORMANCE
  /** Facilidade média dos cards (FSRS) */
  averageEase: number;

  // TIMING
  /** Última vez que estudou este deck */
  lastStudiedAt: Date | Timestamp;
  /** Data de criação */
  createdAt: Date | Timestamp;
  /** Data da última atualização */
  updatedAt: Date | Timestamp;
}

/**
 * Snapshot de progresso do deck para UI
 */
export interface DeckProgressSnapshot {
  /** Total de cards no deck */
  totalCards: number;
  /** Cards já dominados */
  masteredCards: number;
  /** Progresso em porcentagem (0-100) */
  progressPercentage: number;
  /** Cards restantes para dominar */
  remainingCards: number;
}

/**
 * Helper para cálculos de progresso do deck
 */
export class DeckStatisticsHelpers {
  /**
   * Calcula snapshot de progresso do deck
   */
  static calculateProgressSnapshot(
    stats: DeckStatistics
  ): DeckProgressSnapshot {
    const remainingCards = Math.max(0, stats.totalCards - stats.masteredCards);

    return {
      totalCards: stats.totalCards,
      masteredCards: stats.masteredCards,
      progressPercentage: stats.progressPercentage,
      remainingCards,
    };
  }

  /**
   * Calcula porcentagem de progresso baseado em cards dominados
   */
  static calculateProgressPercentage(
    masteredCards: number,
    totalCards: number
  ): number {
    if (totalCards === 0) return 0;
    return Math.round((masteredCards / totalCards) * 100);
  }

  /**
   * Determina se o deck está completo (100% dominado)
   */
  static isDeckCompleted(stats: DeckStatistics): boolean {
    return (
      stats.progressPercentage >= 100 || stats.masteredCards >= stats.totalCards
    );
  }

  /**
   * Calcula cards ativos (new + learning + review)
   */
  static getActiveCards(stats: DeckStatistics): number {
    return stats.cardsNew + stats.cardsLearning + stats.cardsReview;
  }

  /**
   * Valida se facilidade média está dentro do range esperado (FSRS: 1.3 - 5.0)
   */
  static isValidAverageEase(ease: number): boolean {
    return ease >= 1.3 && ease <= 5.0;
  }
}

/**
 * Valida se o objeto DeckStatistics é válido
 */
export const isValidDeckStatistics = (stats: DeckStatistics): boolean => {
  // Validação de campos obrigatórios
  if (
    !stats.deckId?.trim() ||
    !stats.userId?.trim() ||
    !stats.deckName?.trim()
  ) {
    return false;
  }

  // Validação de números não negativos
  const numericFields: Array<keyof DeckStatistics> = [
    "cardsNew",
    "cardsLearning",
    "cardsReview",
    "totalCards",
    "progressPercentage",
    "masteredCards",
    "averageEase",
  ];

  for (const field of numericFields) {
    const value = stats[field] as number;
    if (typeof value !== "number" || value < 0) {
      return false;
    }
  }

  // Validação de consistência
  const activeCards = stats.cardsNew + stats.cardsLearning + stats.cardsReview;
  const totalAccountedCards = activeCards + stats.masteredCards;

  // Total de cards deve ser pelo menos o número de cards contabilizados
  if (stats.totalCards < totalAccountedCards) {
    return false;
  }

  // Progresso não pode exceder 100%
  if (stats.progressPercentage > 100) {
    return false;
  }

  // Cards dominados não podem exceder total
  if (stats.masteredCards > stats.totalCards) {
    return false;
  }

  // Facilidade deve estar em range válido (FSRS)
  if (
    stats.averageEase > 0 &&
    !DeckStatisticsHelpers.isValidAverageEase(stats.averageEase)
  ) {
    return false;
  }

  return true;
};

/**
 * Normaliza objeto DeckStatistics garantindo valores válidos
 */
export const normalizeDeckStatistics = (
  stats: Partial<DeckStatistics>
): DeckStatistics => {
  const now = new Date();

  return {
    deckId: stats.deckId?.trim() || "",
    userId: stats.userId?.trim() || "",
    deckName: stats.deckName?.trim() || "",
    cardsNew: Math.max(0, stats.cardsNew || 0),
    cardsLearning: Math.max(0, stats.cardsLearning || 0),
    cardsReview: Math.max(0, stats.cardsReview || 0),
    totalCards: Math.max(0, stats.totalCards || 0),
    progressPercentage: Math.min(
      100,
      Math.max(0, stats.progressPercentage || 0)
    ),
    masteredCards: Math.max(0, stats.masteredCards || 0),
    averageEase: Math.max(0, stats.averageEase || 0),
    lastStudiedAt: stats.lastStudiedAt || now,
    createdAt: stats.createdAt || now,
    updatedAt: now,
  };
};

/**
 * Constantes para DeckStatistics
 */
export const DECK_STATISTICS_CONSTANTS = {
  /** Intervalo mínimo em dias para considerar card como dominado */
  MASTERED_INTERVAL_DAYS: 30,
  /** Facilidade padrão inicial (FSRS) */
  DEFAULT_EASE: 2.5,
  /** Facilidade mínima (FSRS) */
  MIN_EASE: 1.3,
  /** Facilidade máxima (FSRS) */
  MAX_EASE: 5.0,
} as const;
