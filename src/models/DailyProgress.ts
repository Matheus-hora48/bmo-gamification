import type { Timestamp } from "firebase-admin/firestore";

export const DAILY_GOAL = 20;

export interface DailyProgress {
  userId: string;
  date: string;
  cardsReviewed: number;
  goalMet: boolean;
  xpEarned: number;
  timestamp: Date | Timestamp;
}

export const isValidDailyProgress = (progress: DailyProgress): boolean => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(progress.date)) {
    return false;
  }

  if (progress.cardsReviewed < 0 || progress.xpEarned < 0) {
    return false;
  }

  return true;
};

export const hasMetDailyGoal = (
  progress: DailyProgress,
  goal: number = DAILY_GOAL
): boolean => progress.cardsReviewed >= goal;
