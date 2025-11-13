import { DAILY_GOAL_TARGET, XP_VALUES } from "../config/constants";
import type { StreakData } from "../models/StreakData";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import { FirestoreService } from "./firestore.service";
import { XPService } from "./xp.service";

export interface StreakIncrementResult {
  streakData: StreakData;
  bonusAwarded: number; // XP bônus (0, 200 ou 300)
  milestone?: 7 | 30 | undefined; // Qual milestone foi atingido
}

export class StreakService {
  constructor(
    private readonly firestore: FirestoreService = new FirestoreService(),
    private readonly xpService: XPService = new XPService()
  ) {}

  /**
   * Incrementa o streak do usuário e verifica bônus
   * @param userId ID do usuário
   * @returns Resultado com streak atualizado e bônus premiado
   */
  async incrementStreak(userId: string): Promise<StreakIncrementResult> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    // Obter dados de streak atuais (ou criar se não existir)
    let currentStreakData: StreakData;
    try {
      currentStreakData = await this.firestore.getStreakData(userId);
    } catch {
      // Se não existir, criar novo registro de streak
      currentStreakData = {
        userId,
        current: 0,
        longest: 0,
        lastUpdate: new Date(),
        history: [],
      };
      await this.firestore.updateStreak(userId, currentStreakData);
    }

    const newCurrent = currentStreakData.current + 1;
    const newLongest = Math.max(newCurrent, currentStreakData.longest);
    const today = this.getTodayDate();

    // Adicionar à história
    const updatedHistory = [
      ...currentStreakData.history,
      { date: today, count: newCurrent },
    ];

    // Atualizar streak no Firestore
    const updatedStreakData = await this.firestore.updateStreak(userId, {
      current: newCurrent,
      longest: newLongest,
      history: updatedHistory,
      lastUpdate: new Date(),
    });

    // Também atualizar no UserProgress para manter sincronizado
    await this.firestore.updateUserProgress(userId, {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastActivityDate: new Date(),
    });

    // Verificar e premiar bônus de streak
    const bonusResult = await this.checkStreakBonus(userId, newCurrent);

    return {
      streakData: updatedStreakData,
      bonusAwarded: bonusResult.bonusAwarded,
      milestone: bonusResult.milestone,
    };
  }

  /**
   * Reseta o streak do usuário para 0
   * @param userId ID do usuário
   * @returns Streak data resetado
   */
  async resetStreak(userId: string): Promise<StreakData> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    // Obter streak atual para preservar longest
    let currentStreakData: StreakData;
    try {
      currentStreakData = await this.firestore.getStreakData(userId);
    } catch {
      // Se não existir, criar novo já com zero
      currentStreakData = {
        userId,
        current: 0,
        longest: 0,
        lastUpdate: new Date(),
        history: [],
      };
    }

    const today = this.getTodayDate();

    // Resetar streak mas preservar longest
    const updatedStreakData = await this.firestore.updateStreak(userId, {
      current: 0,
      longest: currentStreakData.longest, // Manter o maior streak histórico
      history: [
        ...currentStreakData.history,
        { date: today, count: 0 }, // Marca quebra do streak no histórico
      ],
      lastUpdate: new Date(),
    });

    // Sincronizar com UserProgress
    await this.firestore.updateUserProgress(userId, {
      currentStreak: 0,
      longestStreak: currentStreakData.longest,
    });

    return updatedStreakData;
  }

  /**
   * Verifica e atualiza o streak baseado na meta diária atual
   * Deve ser chamado quando o usuário completa a meta diária pela primeira vez no dia
   * @param userId ID do usuário
   * @param date Data no formato YYYY-MM-DD
   * @returns Resultado do incremento de streak (se aplicável)
   */
  async checkAndUpdateDailyStreak(
    userId: string,
    date?: string
  ): Promise<StreakIncrementResult | null> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    const checkDate = date ?? this.getTodayDate();

    try {
      // Obter progresso diário
      const dailyProgress = await this.firestore.getDailyProgress(
        userId,
        checkDate
      );

      // Verificar se a meta foi atingida
      if (
        !dailyProgress.goalMet ||
        dailyProgress.cardsReviewed < DAILY_GOAL_TARGET
      ) {
        return null;
      }

      // Verificar se já incrementamos o streak hoje.
      // Usar os dados de `streak` (history / lastUpdate) é mais confiável do que
      // checar `userProgress.lastActivityDate`, porque este último pode ter sido
      // atualizado por outras ações (XP, achievements) antes do progresso diário
      // ser registrado — o que impedia o incremento quando a meta era atingida
      // durante o mesmo fluxo.
      try {
        const streakData = await this.firestore.getStreakData(userId);

        const lastUpdateDate = streakData.lastUpdate
          ? this.toDateString(streakData.lastUpdate)
          : null;

        const hasHistoryToday = Array.isArray(streakData.history)
          ? streakData.history.some((h) => h.date === checkDate)
          : false;

        if (lastUpdateDate === checkDate || hasHistoryToday) {
          // Já incrementado hoje — retornar o streak atual sem incrementar
          return {
            streakData,
            bonusAwarded: 0,
          };
        }
      } catch {
        // Se não existir registro de streak, vamos prosseguir e incrementar
        // (incrementStreak criará/atualizará o documento conforme necessário).
      }

      // Meta atingida pela primeira vez hoje - incrementar streak
      return await this.incrementStreak(userId);
    } catch (error) {
      // Se não existe progresso diário, não fazer nada
      return null;
    }
  }

  /**
   * Verifica se o usuário atingiu milestone de streak e premia bônus
   * @param userId ID do usuário
   * @param currentStreak Streak atual do usuário
   * @returns Informação do bônus premiado
   */
  async checkStreakBonus(
    userId: string,
    currentStreak: number
  ): Promise<{ bonusAwarded: number; milestone?: 7 | 30 }> {
    if (!userId?.trim()) {
      throw new Error("ID do usuário é obrigatório.");
    }

    if (currentStreak < 7) {
      return { bonusAwarded: 0 };
    }

    // Obter progresso do usuário para verificar se já foi premiado hoje
    const userProgress = await this.firestore.getUserProgress(userId);
    const today = this.getTodayDate();
    const lastActivityDate = userProgress.lastActivityDate
      ? this.toDateString(userProgress.lastActivityDate)
      : null;

    // Verificar se já teve atividade hoje (evitar dupla premiação)
    if (lastActivityDate === today) {
      // Já foi premiado hoje, não premiar novamente
      return { bonusAwarded: 0 };
    }

    // Verificar bônus de 30 dias (prioridade maior)
    if (currentStreak === 30) {
      const result = await this.xpService.addXP(
        userId,
        XP_VALUES.STREAK_30_DAYS,
        XPSource.STREAK_BONUS,
        `streak-30-${today}`
      );

      return {
        bonusAwarded: XP_VALUES.STREAK_30_DAYS,
        milestone: 30,
      };
    }

    // Verificar bônus de 7 dias
    if (currentStreak === 7 || currentStreak % 7 === 0) {
      const result = await this.xpService.addXP(
        userId,
        XP_VALUES.STREAK_7_DAYS,
        XPSource.STREAK_BONUS,
        `streak-7-${today}`
      );

      return {
        bonusAwarded: XP_VALUES.STREAK_7_DAYS,
        milestone: 7,
      };
    }

    return { bonusAwarded: 0 };
  }

  /**
   * Atualiza todos os streaks dos usuários (executado por cron job à meia-noite)
   * Verifica a meta diária de ontem e incrementa/reseta streaks conforme necessário
   */
  async updateAllStreaks(): Promise<{
    totalProcessed: number;
    incremented: number;
    reset: number;
    errors: string[];
  }> {
    const yesterday = this.getYesterdayDate();
    const errors: string[] = [];
    let totalProcessed = 0;
    let incremented = 0;
    let reset = 0;

    try {
      // Buscar todos os usuários com progresso
      const allUserIds = await this.getAllUserIds();

      for (const userId of allUserIds) {
        try {
          totalProcessed++;

          // Verificar se a meta diária de ontem foi atingida
          const dailyProgress = await this.firestore.getDailyProgress(
            userId,
            yesterday
          );

          if (
            dailyProgress.goalMet &&
            dailyProgress.cardsReviewed >= DAILY_GOAL_TARGET
          ) {
            // Meta atingida: incrementar streak
            await this.incrementStreak(userId);
            incremented++;
          } else {
            // Meta não atingida: resetar streak
            await this.resetStreak(userId);
            reset++;
          }
        } catch (err) {
          const errorMsg = `Erro ao atualizar streak do usuário ${userId}: ${
            err instanceof Error ? err.message : String(err)
          }`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        totalProcessed,
        incremented,
        reset,
        errors,
      };
    } catch (err) {
      throw new Error(
        `Erro ao buscar usuários: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Busca todos os IDs de usuários que possuem progresso
   * @returns Array com IDs de usuários
   */
  private async getAllUserIds(): Promise<string[]> {
    return await this.firestore.getAllUserIds();
  }

  // ========== HELPER METHODS ==========

  private getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getYesterdayDate(): string {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private toDateString(
    value: Date | FirebaseFirestore.Timestamp | string
  ): string {
    if (typeof value === "string") {
      return value;
    }

    const date =
      value instanceof Date ? value : ((value as any).toDate?.() ?? value);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
}
