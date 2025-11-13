import { DAILY_GOAL_TARGET, XP_VALUES } from "../config/constants";
import type { DailyProgress } from "../models/DailyProgress";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import { FirestoreService } from "./firestore.service";
import { XPService } from "./xp.service";

export interface DailyGoalCheckResult {
  goalMet: boolean;
  cardsReviewed: number;
  cardsRemaining: number;
  xpEarned: number;
  date: string;
}

export interface DailyGoalXPResult {
  xpAwarded: number;
  totalXP: number;
  level: number;
  currentXP: number;
  transactionId: string;
}

export class DailyGoalService {
  constructor(
    private readonly firestore: FirestoreService = new FirestoreService(),
    private readonly xpService: XPService = new XPService()
  ) {}

  /**
   * Registra uma revisão de card no progresso diário do usuário
   * @param userId ID do usuário
   * @param date Data no formato YYYY-MM-DD (opcional, padrão: hoje)
   * @returns Progresso diário atualizado
   */
  async recordCardReview(
    userId: string,
    date?: string
  ): Promise<DailyProgress> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    const reviewDate = date ?? this.getTodayDate();

    if (!this.isValidDateFormat(reviewDate)) {
      throw new Error(
        "Formato de data inválido. Use o formato YYYY-MM-DD (ex: 2025-11-11)."
      );
    }

    try {
      const existing = await this.firestore.getDailyProgress(
        userId,
        reviewDate
      );

      const newCardsReviewed = existing.cardsReviewed + 1;
      const goalMet = newCardsReviewed >= DAILY_GOAL_TARGET;

      return await this.firestore.updateDailyProgress(userId, reviewDate, {
        cardsReviewed: newCardsReviewed,
        goalMet,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        return await this.firestore.updateDailyProgress(userId, reviewDate, {
          cardsReviewed: 1,
          goalMet: 1 >= DAILY_GOAL_TARGET,
          xpEarned: 0,
        });
      }
      throw error;
    }
  }

  /**
   * Verifica se a meta diária foi atingida
   * @param userId ID do usuário
   * @param date Data no formato YYYY-MM-DD (opcional, padrão: hoje)
   * @returns Resultado da verificação da meta diária
   */
  async checkDailyGoal(
    userId: string,
    date?: string
  ): Promise<DailyGoalCheckResult> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    const checkDate = date ?? this.getTodayDate();

    if (!this.isValidDateFormat(checkDate)) {
      throw new Error(
        "Formato de data inválido. Use o formato YYYY-MM-DD (ex: 2025-11-11)."
      );
    }

    try {
      const progress = await this.firestore.getDailyProgress(userId, checkDate);

      const goalMet = progress.cardsReviewed >= DAILY_GOAL_TARGET;
      const cardsRemaining = Math.max(
        0,
        DAILY_GOAL_TARGET - progress.cardsReviewed
      );

      return {
        goalMet,
        cardsReviewed: progress.cardsReviewed,
        cardsRemaining,
        xpEarned: progress.xpEarned,
        date: checkDate,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        return {
          goalMet: false,
          cardsReviewed: 0,
          cardsRemaining: DAILY_GOAL_TARGET,
          xpEarned: 0,
          date: checkDate,
        };
      }
      throw error;
    }
  }

  /**
   * Premia o usuário com XP pela conclusão da meta diária
   * @param userId ID do usuário
   * @param date Data no formato YYYY-MM-DD (opcional, padrão: hoje)
   * @returns Resultado da premiação de XP
   */
  async awardDailyGoalXP(
    userId: string,
    date?: string
  ): Promise<DailyGoalXPResult> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    const awardDate = date ?? this.getTodayDate();

    if (!this.isValidDateFormat(awardDate)) {
      throw new Error(
        "Formato de data inválido. Use o formato YYYY-MM-DD (ex: 2025-11-11)."
      );
    }

    // Verificar se a meta foi atingida
    const goalCheck = await this.checkDailyGoal(userId, awardDate);

    if (!goalCheck.goalMet) {
      throw new Error(
        `Meta diária não atingida. Cards revisados: ${goalCheck.cardsReviewed}/${DAILY_GOAL_TARGET}`
      );
    }

    // Verificar se o XP já foi premiado
    const dailyProgress = await this.firestore.getDailyProgress(
      userId,
      awardDate
    );

    if (dailyProgress.xpEarned >= XP_VALUES.DAILY_GOAL) {
      throw new Error("XP da meta diária já foi premiado para esta data.");
    }

    // Adicionar XP ao usuário
    const xpResult = await this.xpService.addXP(
      userId,
      XP_VALUES.DAILY_GOAL,
      XPSource.DAILY_GOAL,
      `daily-goal-${awardDate}`
    );

    // Atualizar progresso diário com o XP ganho
    await this.firestore.updateDailyProgress(userId, awardDate, {
      xpEarned: XP_VALUES.DAILY_GOAL,
    });

    return {
      xpAwarded: XP_VALUES.DAILY_GOAL,
      totalXP: xpResult.userProgress.totalXP,
      level: xpResult.userProgress.level,
      currentXP: xpResult.userProgress.currentXP,
      transactionId: `daily-goal-${awardDate}`,
    };
  }

  /**
   * Retorna a data de hoje no formato YYYY-MM-DD
   * @returns Data atual no formato YYYY-MM-DD
   */
  private getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Valida se a string está no formato YYYY-MM-DD
   * @param date Data a ser validada
   * @returns true se o formato é válido, false caso contrário
   */
  private isValidDateFormat(date: string): boolean {
    return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date);
  }

  private toDateString(value: Date | { toDate?: () => Date } | null): string {
    if (!value) return "";

    let d: Date;
    // Firestore Timestamp has toDate()
    if (typeof (value as any).toDate === "function") {
      d = (value as any).toDate();
    } else {
      d = value as Date;
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private dateMinusOne(dateStr: string): string {
    const parts = dateStr.split("-").map((p) => Number(p));
    const [y = 1970, m = 1, d = 1] = parts;
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
