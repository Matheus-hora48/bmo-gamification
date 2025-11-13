import type { Timestamp } from "firebase-admin/firestore";

export enum AchievementTier {
  BRONZE = "bronze",
  SILVER = "silver",
  GOLD = "gold",
  PLATINUM = "platinum",
  DIAMOND = "diamond",
}

export enum AchievementType {
  STREAK = "streak",
  DAILY_GOAL = "daily_goal",
  REVIEWS_COMPLETED = "reviews_completed",
  CARDS_CREATED = "cards_created",
  DECK_CREATED = "deck_created",
  XP_TOTAL = "xp_total",
  LEVEL_REACHED = "level_reached",
  CUSTOM = "custom",
}

export interface AchievementCondition {
  type: AchievementType;
  target: number;
  params?: Record<string, unknown>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  xpReward: number;
  icon: string;
  condition: AchievementCondition;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  isActive?: boolean;
}

export const isValidAchievement = (achievement: Achievement): boolean => {
  if (!achievement.id.trim() || !achievement.name.trim()) {
    return false;
  }

  if (achievement.xpReward < 0 || !Number.isFinite(achievement.xpReward)) {
    return false;
  }

  if (
    achievement.condition.target <= 0 ||
    !Number.isFinite(achievement.condition.target)
  ) {
    return false;
  }

  return true;
};

export const normalizeAchievement = (
  achievement: Achievement
): Achievement => ({
  ...achievement,
  id: achievement.id.trim(),
  name: achievement.name.trim(),
  description: achievement.description.trim(),
  icon: achievement.icon.trim(),
  xpReward: Math.max(0, Math.round(achievement.xpReward)),
  condition: {
    ...achievement.condition,
    target: Math.max(1, Math.round(achievement.condition.target)),
  },
});
