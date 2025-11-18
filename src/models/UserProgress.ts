import type { Timestamp } from "firebase-admin/firestore";

export interface UserProgress {
  userId: string;
  level: number;
  currentXP: number;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  totalCardsReviewed: number; // Total de cards revisados em todas as sessões
  lastActivityDate: Date | Timestamp | null;
  achievements: string[];
  createdAt: Date | Timestamp;
}

export interface LevelProgressSnapshot {
  totalRequired: number;
  remaining: number;
  percentage: number;
}

export const isValidUserProgress = (progress: UserProgress): boolean => {
  if (!progress.userId.trim()) {
    return false;
  }

  const numericFields: Array<keyof UserProgress> = [
    "level",
    "currentXP",
    "totalXP",
    "currentStreak",
    "longestStreak",
    "totalCardsReviewed",
  ];

  for (const field of numericFields) {
    const value = progress[field];
    if (typeof value !== "number" || value < 0 || !Number.isFinite(value)) {
      return false;
    }
  }

  return Array.isArray(progress.achievements);
};

export const UserProgressHelpers = {
  hasAchievement(progress: UserProgress, achievementId: string): boolean {
    return progress.achievements.includes(achievementId);
  },

  computeLevelProgress(
    progress: UserProgress,
    nextLevelTotalXp: number
  ): LevelProgressSnapshot {
    const safeNextLevelTotal = Math.max(progress.totalXP, nextLevelTotalXp);
    const totalRequired = Math.max(
      1,
      safeNextLevelTotal - (progress.totalXP - progress.currentXP)
    );
    const remaining = Math.max(0, totalRequired - progress.currentXP);
    const percentage = Math.min(
      100,
      Math.max(0, (progress.currentXP / totalRequired) * 100)
    );

    return {
      totalRequired,
      remaining,
      percentage: Number.isFinite(percentage)
        ? Number(percentage.toFixed(2))
        : 0,
    };
  },

  withAchievement(progress: UserProgress, achievementId: string): UserProgress {
    if (this.hasAchievement(progress, achievementId)) {
      return progress;
    }

    return {
      ...progress,
      achievements: [...progress.achievements, achievementId],
    };
  },

  sanitize(progress: UserProgress): UserProgress {
    return {
      ...progress,
      level: Math.max(0, Math.floor(progress.level)),
      currentXP: Math.max(0, progress.currentXP),
      totalXP: Math.max(0, progress.totalXP),
      currentStreak: Math.max(0, Math.floor(progress.currentStreak)),
      longestStreak: Math.max(0, Math.floor(progress.longestStreak)),
      totalCardsReviewed: Math.max(0, Math.floor(progress.totalCardsReviewed || 0)),
      achievements: [
        ...new Set(
          progress.achievements.map((id) => id.trim()).filter(Boolean)
        ),
      ],
    };
  },
};
