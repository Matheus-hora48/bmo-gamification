import { AchievementTier } from "../models/Achievement";

export const XP_VALUES = {
  REVIEW_AGAIN: 5,
  REVIEW_HARD: 10,
  REVIEW_GOOD: 15,
  REVIEW_EASY: 20,
  CARD_CREATION: 25,
  DECK_CREATION: 50,
  DAILY_GOAL: 100,
  STREAK_7_DAYS: 200,
  STREAK_30_DAYS: 300,
} as const;

export const DAILY_GOAL_TARGET = 20;

export type AchievementTierMetadata = {
  label: string;
  color: string;
  baseXpRange: { min: number; max: number };
  description: string;
  totalAchievements: number;
};

export const ACHIEVEMENT_TIER_METADATA: Record<
  AchievementTier,
  AchievementTierMetadata
> = {
  [AchievementTier.BRONZE]: {
    label: "Bronze",
    color: "#CD7F32",
    baseXpRange: { min: 50, max: 100 },
    description: "Conquistas iniciais e fáceis de alcançar",
    totalAchievements: 15,
  },
  [AchievementTier.SILVER]: {
    label: "Prata",
    color: "#C0C0C0",
    baseXpRange: { min: 150, max: 300 },
    description: "Conquistas de dificuldade intermediária",
    totalAchievements: 20,
  },
  [AchievementTier.GOLD]: {
    label: "Ouro",
    color: "#FFD700",
    baseXpRange: { min: 400, max: 600 },
    description: "Conquistas avançadas para usuários dedicados",
    totalAchievements: 15,
  },
  [AchievementTier.PLATINUM]: {
    label: "Platina",
    color: "#E5E4E2",
    baseXpRange: { min: 800, max: 1200 },
    description: "Conquistas difíceis com alto comprometimento",
    totalAchievements: 10,
  },
  [AchievementTier.DIAMOND]: {
    label: "Diamante",
    color: "#B9F2FF",
    baseXpRange: { min: 2000, max: 5000 },
    description: "Conquistas lendárias para atingir o ápice",
    totalAchievements: 4,
  },
};
