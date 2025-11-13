import type { Timestamp } from "firebase-admin/firestore";

export enum XPSource {
  REVIEW = "review",
  ACHIEVEMENT = "achievement",
  DAILY_GOAL = "daily_goal",
  STREAK_BONUS = "streak_bonus",
  CARD_CREATION = "card_creation",
  DECK_CREATION = "deck_creation",
  MANUAL_ADJUSTMENT = "manual_adjustment",
}

export interface XPTransaction {
  id: string;
  userId: string;
  amount: number;
  source: XPSource;
  sourceId: string;
  description: string;
  timestamp: Date | Timestamp;
}

export const isValidXPTransaction = (transaction: XPTransaction): boolean => {
  if (!transaction.id.trim() || !transaction.userId.trim()) {
    return false;
  }

  if (transaction.amount <= 0 || !Number.isFinite(transaction.amount)) {
    return false;
  }

  return Boolean(transaction.sourceId.trim());
};
