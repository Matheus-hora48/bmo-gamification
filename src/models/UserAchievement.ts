import type { Timestamp } from "firebase-admin/firestore";

export interface UserAchievementProgress {
  userId: string;
  achievementId: string;
  unlockedAt: Date | Timestamp | null;
  progress: number;
  claimed: boolean;
  notificationSeen?: boolean;
  updatedAt: Date | Timestamp | null;
}

export const isValidUserAchievementProgress = (
  progress: UserAchievementProgress
): boolean => {
  if (!progress.userId.trim() || !progress.achievementId.trim()) {
    return false;
  }

  if (progress.progress < 0 || !Number.isFinite(progress.progress)) {
    return false;
  }

  if (
    progress.notificationSeen !== undefined &&
    typeof progress.notificationSeen !== "boolean"
  ) {
    return false;
  }

  return typeof progress.claimed === "boolean";
};

export const normalizeUserAchievementProgress = (
  progress: UserAchievementProgress
): UserAchievementProgress => ({
  ...progress,
  userId: progress.userId.trim(),
  achievementId: progress.achievementId.trim(),
  progress: Math.max(0, progress.progress),
  notificationSeen: progress.notificationSeen ?? false,
});
