import { randomUUID } from "crypto";
import { XP_VALUES } from "../config/constants";
import type { UserProgress } from "../models/UserProgress";
import { XPSource, type XPTransaction } from "../models/XPTransaction";
import { FirestoreService } from "./firestore.service";
import { LevelService, type LevelUpResult } from "./level.service";

export type ReviewDifficulty = "again" | "hard" | "good" | "easy";

export interface XPResult {
  userProgress: UserProgress;
  levelUpInfo: LevelUpResult;
}

type ApplyXPParams = {
  userId: string;
  amount: number;
  source: XPSource;
  sourceId: string;
  description?: string;
  issuedAt?: Date;
};

const REVIEW_DIFFICULTY_TO_XP: Record<ReviewDifficulty, number> = {
  again: XP_VALUES.REVIEW_AGAIN,
  hard: XP_VALUES.REVIEW_HARD,
  good: XP_VALUES.REVIEW_GOOD,
  easy: XP_VALUES.REVIEW_EASY,
};

const REVIEW_DIFFICULTY_LABEL: Record<ReviewDifficulty, string> = {
  again: "Novamente",
  hard: "Difícil",
  good: "Bom",
  easy: "Fácil",
};

export class XPService {
  constructor(
    private readonly firestore: FirestoreService = new FirestoreService(),
    private readonly levelService: LevelService = new LevelService()
  ) {}

  calculateXPForReview(difficulty: ReviewDifficulty | string): number {
    const normalized = this.normalizeDifficulty(difficulty);
    return REVIEW_DIFFICULTY_TO_XP[normalized];
  }

  async addXP(
    userId: string,
    amount: number,
    source: XPSource,
    sourceId: string
  ): Promise<XPResult> {
    return this.applyXP({ userId, amount, source, sourceId });
  }

  async processCardReview(
    userId: string,
    cardId: string,
    difficulty: ReviewDifficulty | string
  ): Promise<XPResult> {
    if (!cardId?.trim()) {
      throw new Error("Identificador do card inválido.");
    }

    const normalizedDifficulty = this.normalizeDifficulty(difficulty);
    const amount = REVIEW_DIFFICULTY_TO_XP[normalizedDifficulty];

    return this.applyXP({
      userId,
      amount,
      source: XPSource.REVIEW,
      sourceId: cardId,
      description: `Revisão do card ${cardId} (${REVIEW_DIFFICULTY_LABEL[normalizedDifficulty]})`,
    });
  }

  private async applyXP({
    userId,
    amount,
    source,
    sourceId,
    description,
    issuedAt,
  }: ApplyXPParams): Promise<XPResult> {
    if (!userId?.trim()) {
      throw new Error("Identificador do usuário inválido.");
    }

    if (!sourceId?.trim()) {
      throw new Error("Identificador da origem inválido.");
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Quantidade de XP inválida.");
    }

    const timestamp = issuedAt ?? new Date();

    // Buscar progresso ANTES de adicionar XP para detectar level-up
    const oldProgress = await this.ensureUserProgress(userId);
    const oldTotalXP = oldProgress.totalXP;

    const updatedTotalXP = oldProgress.totalXP + numericAmount;

    // Calcular o novo nível baseado no totalXP atualizado
    const newLevel = this.levelService.calculateLevel(updatedTotalXP);

    // Calcular o currentXP baseado no novo nível
    const updatedCurrentXP = this.levelService.getCurrentXP(
      updatedTotalXP,
      newLevel
    );

    const transaction: XPTransaction = {
      id: randomUUID(),
      userId,
      amount: numericAmount,
      source,
      sourceId,
      description:
        description ?? this.defaultTransactionDescription(source, sourceId),
      timestamp,
    };

    const [updatedProgress] = await Promise.all([
      this.firestore.updateUserProgress(userId, {
        level: newLevel,
        currentXP: updatedCurrentXP,
        totalXP: updatedTotalXP,
        lastActivityDate: timestamp,
      }),
      this.firestore.createXPTransaction(transaction),
    ]);

    // Calcular informações de level-up
    const levelUpInfo = this.levelService.checkLevelUp(
      oldTotalXP,
      updatedTotalXP
    );

    return {
      userProgress: updatedProgress,
      levelUpInfo,
    };
  }

  private async ensureUserProgress(userId: string): Promise<UserProgress> {
    try {
      return await this.firestore.getUserProgress(userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);

      if (message.includes("não encontrado") || message.includes("not found")) {
        return this.firestore.createUserProgress(userId);
      }

      throw error;
    }
  }

  private defaultTransactionDescription(
    source: XPSource,
    sourceId: string
  ): string {
    switch (source) {
      case XPSource.REVIEW:
        return `XP de revisão (${sourceId})`;
      case XPSource.CARD_CREATION:
        return `XP por criação de card (${sourceId})`;
      case XPSource.DECK_CREATION:
        return `XP por criação de deck (${sourceId})`;
      case XPSource.DAILY_GOAL:
        return `XP por meta diária (${sourceId})`;
      case XPSource.STREAK_BONUS:
        return `XP por streak (${sourceId})`;
      case XPSource.ACHIEVEMENT:
        return `XP por conquista (${sourceId})`;
      case XPSource.MANUAL_ADJUSTMENT:
      default:
        return `XP adquirido (${sourceId})`;
    }
  }

  private normalizeDifficulty(
    difficulty: ReviewDifficulty | string
  ): ReviewDifficulty {
    const normalized = String(difficulty ?? "")
      .trim()
      .toLowerCase() as ReviewDifficulty;

    if (!normalized || !(normalized in REVIEW_DIFFICULTY_TO_XP)) {
      throw new Error(`Dificuldade de revisão inválida: ${difficulty}`);
    }

    return normalized;
  }
}
