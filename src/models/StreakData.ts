import type { Timestamp } from "firebase-admin/firestore";

export interface StreakHistoryItem {
  date: string;
  count: number;
}

export interface StreakData {
  userId: string;
  current: number;
  longest: number;
  lastUpdate: Date | Timestamp;
  history: StreakHistoryItem[];
}

export const isValidStreakData = (streak: StreakData): boolean => {
  if (!streak.userId.trim()) {
    return false;
  }

  if (streak.current < 0 || streak.longest < 0) {
    return false;
  }

  return streak.history.every(
    (item) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(item.date) && item.count >= 0
  );
};

export const sortStreakHistory = (
  history: StreakHistoryItem[]
): StreakHistoryItem[] =>
  [...history].sort((a, b) => a.date.localeCompare(b.date));
