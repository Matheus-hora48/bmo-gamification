/**
 * Entrada individual no ranking - Representa um usuário no ranking
 */
export interface RankingEntry {
  /** ID único do usuário */
  userId: string;
  /** Nome de exibição do usuário */
  userName: string;
  /** URL do avatar do usuário */
  userAvatar?: string;

  // MÉTRICAS PRINCIPAIS DO RANKING
  /** Número de cards revisados no período */
  cardsReviewed: number;
  /** Posição no ranking (1 = primeiro lugar) */
  rank: number;
  /** XP total ganho no período */
  xpEarned: number;
  /** Dias de sequência atual */
  streakDays: number;

  // MÉTRICAS SECUNDÁRIAS (para desempate e detalhes)
  /** Taxa de acertos no período (0-100) */
  accuracyRate: number;
  /** Tempo total de estudo em minutos */
  studyTimeMinutes: number;
  /** Número de sessões de estudo */
  studySessions: number;

  // ACHIEVEMENTS E BADGES
  /** Número de conquistas desbloqueadas no período */
  achievementsUnlocked: number;
  /** Badges especiais para este período */
  specialBadges: string[];

  // STATUS E COMPARAÇÃO
  /** Mudança de posição desde o último período (+3, -1, 0, "new") */
  rankChange: number | "new";
  /** Se é usuário ativo no período */
  isActive: boolean;
}

/**
 * Constantes para RankingEntry
 */
export const RANKING_ENTRY_CONSTANTS = {
  /** Posição padrão para usuários sem atividade */
  DEFAULT_INACTIVE_RANK: 9999,
  /** Badges especiais disponíveis */
  SPECIAL_BADGES: {
    TOP_PERFORMER: "top_performer", // Top 10%
    CONSISTENCY_KING: "consistency_king", // Estudou todos os dias
    SPEED_DEMON: "speed_demon", // Mais reviews por minuto
    ACCURACY_MASTER: "accuracy_master", // >95% de acertos
    COMEBACK_KID: "comeback_kid", // Maior subida no ranking
    STUDY_CHAMPION: "study_champion", // Mais tempo de estudo
  },
  /** Tempo mínimo de estudo para aparecer no ranking (em minutos) */
  MIN_STUDY_TIME_FOR_RANKING: 10,
  /** Reviews mínimos para aparecer no ranking */
  MIN_REVIEWS_FOR_RANKING: 5,
} as const;

/**
 * Helper para cálculos de ranking entry
 */
export class RankingEntryHelpers {
  /**
   * Determina badges especiais baseado nas métricas
   */
  static calculateSpecialBadges(
    entry: RankingEntry,
    totalParticipants: number
  ): string[] {
    const badges: string[] = [];
    const { SPECIAL_BADGES } = RANKING_ENTRY_CONSTANTS;

    // Top 10% do ranking
    if (entry.rank <= Math.ceil(totalParticipants * 0.1)) {
      badges.push(SPECIAL_BADGES.TOP_PERFORMER);
    }

    // Taxa de acerto > 95%
    if (entry.accuracyRate >= 95) {
      badges.push(SPECIAL_BADGES.ACCURACY_MASTER);
    }

    // Sequência de 7+ dias
    if (entry.streakDays >= 7) {
      badges.push(SPECIAL_BADGES.CONSISTENCY_KING);
    }

    // Mais de 2 hours de estudo
    if (entry.studyTimeMinutes >= 120) {
      badges.push(SPECIAL_BADGES.STUDY_CHAMPION);
    }

    // Mais de 100 reviews
    if (entry.cardsReviewed >= 100) {
      badges.push(SPECIAL_BADGES.SPEED_DEMON);
    }

    // Subiu mais de 10 posições
    if (typeof entry.rankChange === "number" && entry.rankChange >= 10) {
      badges.push(SPECIAL_BADGES.COMEBACK_KID);
    }

    return badges;
  }

  /**
   * Calcula se usuário é elegível para o ranking
   */
  static isEligibleForRanking(entry: Partial<RankingEntry>): boolean {
    const { MIN_STUDY_TIME_FOR_RANKING, MIN_REVIEWS_FOR_RANKING } =
      RANKING_ENTRY_CONSTANTS;

    return (
      (entry.studyTimeMinutes || 0) >= MIN_STUDY_TIME_FOR_RANKING &&
      (entry.cardsReviewed || 0) >= MIN_REVIEWS_FOR_RANKING &&
      (entry.isActive ?? false)
    );
  }

  /**
   * Formata mudança de posição para exibição
   */
  static formatRankChange(change: number | "new"): string {
    if (change === "new") return "NEW";
    if (change === 0) return "–";
    if (change > 0) return `+${change}`;
    return change.toString();
  }

  /**
   * Calcula score composto para ordenação do ranking
   */
  static calculateRankingScore(entry: Partial<RankingEntry>): number {
    // Pesos para diferentes métricas
    const weights = {
      cardsReviewed: 10,
      xpEarned: 1,
      accuracyRate: 0.5,
      streakDays: 5,
      studySessions: 2,
    };

    return (
      (entry.cardsReviewed || 0) * weights.cardsReviewed +
      (entry.xpEarned || 0) * weights.xpEarned +
      (entry.accuracyRate || 0) * weights.accuracyRate +
      (entry.streakDays || 0) * weights.streakDays +
      (entry.studySessions || 0) * weights.studySessions
    );
  }
}

/**
 * Valida se o objeto RankingEntry é válido
 */
export const isValidRankingEntry = (entry: RankingEntry): boolean => {
  // Campos obrigatórios
  if (!entry.userId?.trim() || !entry.userName?.trim()) {
    return false;
  }

  // Rank deve ser positivo
  if (typeof entry.rank !== "number" || entry.rank < 1) {
    return false;
  }

  // Números não negativos
  const numericFields: Array<keyof RankingEntry> = [
    "cardsReviewed",
    "xpEarned",
    "streakDays",
    "studyTimeMinutes",
    "studySessions",
    "achievementsUnlocked",
  ];

  for (const field of numericFields) {
    const value = (entry as any)[field];
    if (typeof value !== "number" || value < 0) {
      return false;
    }
  }

  // Taxa de acertos deve estar entre 0-100
  if (entry.accuracyRate < 0 || entry.accuracyRate > 100) {
    return false;
  }

  // rankChange deve ser número ou "new"
  if (entry.rankChange !== "new" && typeof entry.rankChange !== "number") {
    return false;
  }

  // specialBadges deve ser array
  if (!Array.isArray(entry.specialBadges)) {
    return false;
  }

  return true;
};

/**
 * Normaliza objeto RankingEntry garantindo valores válidos
 */
export const normalizeRankingEntry = (
  entry: Partial<RankingEntry>
): RankingEntry => {
  const normalized: RankingEntry = {
    userId: entry.userId?.trim() || "",
    userName: entry.userName?.trim() || "",
    cardsReviewed: Math.max(0, entry.cardsReviewed || 0),
    rank: Math.max(1, entry.rank || 1),
    xpEarned: Math.max(0, entry.xpEarned || 0),
    streakDays: Math.max(0, entry.streakDays || 0),
    accuracyRate: Math.min(100, Math.max(0, entry.accuracyRate || 0)),
    studyTimeMinutes: Math.max(0, entry.studyTimeMinutes || 0),
    studySessions: Math.max(0, entry.studySessions || 0),
    achievementsUnlocked: Math.max(0, entry.achievementsUnlocked || 0),
    specialBadges: Array.isArray(entry.specialBadges)
      ? entry.specialBadges
      : [],
    rankChange: entry.rankChange ?? "new",
    isActive: entry.isActive ?? false,
  };

  // Adiciona userAvatar apenas se fornecido
  if (entry.userAvatar?.trim()) {
    normalized.userAvatar = entry.userAvatar.trim();
  }

  return normalized;
};
