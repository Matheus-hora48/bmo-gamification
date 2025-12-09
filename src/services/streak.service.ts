import { DAILY_GOAL_TARGET, XP_VALUES } from "../config/constants";
import type { StreakData, StreakHistoryItem } from "../models/StreakData";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import { FirestoreService } from "./firestore.service";
import { XPService } from "./xp.service";
import { logger } from "../utils/logger";

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

    const today = this.getTodayDate();

    // Obter dados de streak atuais (ou criar se não existir)
    let currentStreakData: StreakData;
    try {
      currentStreakData = await this.firestore.getStreakData(userId);

      // IMPORTANTE: Verificar se já existe entrada para hoje no histórico
      // Isso evita duplicação quando o cron job e o processamento em tempo real
      // tentam incrementar o streak no mesmo dia
      const hasHistoryToday = Array.isArray(currentStreakData.history)
        ? currentStreakData.history.some((h) => h.date === today && h.count > 0)
        : false;

      if (hasHistoryToday) {
        logger.debug(
          "[StreakService] incrementStreak - já existe entrada para hoje, ignorando",
          {
            userId,
            today,
            currentStreak: currentStreakData.current,
          }
        );
        // Retornar o streak atual sem modificar
        return {
          streakData: currentStreakData,
          bonusAwarded: 0,
        };
      }
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

    // Adicionar à história (já verificamos que não existe entrada para hoje)
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

    logger.info("[StreakService] incrementStreak - streak incrementado", {
      userId,
      newCurrent,
      newLongest,
    });

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
   *
   * LÓGICA DE STREAK CONSECUTIVO:
   * - Se é o primeiro dia do usuário: inicia streak em 1
   * - Se o dia anterior (ontem) teve meta atingida: incrementa streak
   * - Se o dia anterior NÃO teve meta atingida: reseta streak para 1
   *
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

    logger.debug("[StreakService] checkAndUpdateDailyStreak iniciado", {
      userId,
      checkDate,
    });

    try {
      // Obter progresso diário de hoje
      const dailyProgress = await this.firestore.getDailyProgress(
        userId,
        checkDate
      );

      logger.debug("[StreakService] Progresso diário obtido", {
        userId,
        checkDate,
        cardsReviewed: dailyProgress.cardsReviewed,
        goalMet: dailyProgress.goalMet,
        target: DAILY_GOAL_TARGET,
      });

      // Verificar se a meta foi atingida hoje
      if (
        !dailyProgress.goalMet ||
        dailyProgress.cardsReviewed < DAILY_GOAL_TARGET
      ) {
        logger.debug("[StreakService] Meta não atingida, ignorando streak", {
          userId,
          checkDate,
        });
        return null;
      }

      // Verificar se já processamos o streak hoje
      let streakData: StreakData | null = null;
      try {
        streakData = await this.firestore.getStreakData(userId);

        // IMPORTANTE: Verificar APENAS pelo histórico, não pelo lastUpdate
        // O lastUpdate pode ser atualizado em outras situações (como reset de streak)
        // O único indicador confiável é se há um registro na história com a data de hoje
        const hasHistoryToday = Array.isArray(streakData.history)
          ? streakData.history.some((h) => h.date === checkDate && h.count > 0)
          : false;

        logger.debug("[StreakService] Verificando histórico de streak", {
          userId,
          checkDate,
          hasHistoryToday,
          currentStreak: streakData.current,
          historyLength: streakData.history?.length ?? 0,
          lastHistoryEntries: streakData.history?.slice(-3),
        });

        if (hasHistoryToday) {
          // Já processado hoje — retornar o streak atual sem modificar
          logger.debug("[StreakService] Streak já processado hoje", {
            userId,
            checkDate,
          });
          return {
            streakData,
            bonusAwarded: 0,
          };
        }
      } catch {
        // Se não existir registro de streak, vamos criar
        logger.debug(
          "[StreakService] Nenhum registro de streak encontrado, será criado",
          {
            userId,
          }
        );
        streakData = null;
      }

      // ===== VERIFICAR SE O STREAK É CONSECUTIVO =====
      const yesterday = this.getDateMinusDays(checkDate, 1);
      let yesterdayGoalMet = false;

      try {
        const yesterdayProgress = await this.firestore.getDailyProgress(
          userId,
          yesterday
        );
        yesterdayGoalMet =
          yesterdayProgress.goalMet &&
          yesterdayProgress.cardsReviewed >= DAILY_GOAL_TARGET;

        logger.debug("[StreakService] Verificando meta de ontem", {
          userId,
          yesterday,
          yesterdayGoalMet,
          yesterdayCards: yesterdayProgress.cardsReviewed,
        });
      } catch {
        // Sem dados de ontem = não atingiu meta
        logger.debug("[StreakService] Sem dados de ontem", {
          userId,
          yesterday,
        });
        yesterdayGoalMet = false;
      }

      // Se ontem NÃO atingiu a meta, precisamos resetar o streak para 1
      if (!yesterdayGoalMet) {
        // Resetar streak e começar novo com 1
        logger.info(
          "[StreakService] Iniciando novo streak (ontem não atingiu meta)",
          {
            userId,
            checkDate,
          }
        );
        return await this.startNewStreak(userId, checkDate);
      }

      // Ontem atingiu a meta, então incrementar streak normalmente
      logger.info("[StreakService] Incrementando streak (consecutivo)", {
        userId,
        checkDate,
        currentStreak: streakData?.current ?? 0,
      });
      return await this.incrementStreak(userId);
    } catch (error) {
      // Se não existe progresso diário, não fazer nada
      logger.error("[StreakService] Erro ao processar streak", {
        userId,
        checkDate,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Inicia um novo streak (usado quando o streak anterior foi quebrado)
   * @param userId ID do usuário
   * @param date Data no formato YYYY-MM-DD
   * @returns Resultado com streak iniciado em 1
   */
  private async startNewStreak(
    userId: string,
    date: string
  ): Promise<StreakIncrementResult> {
    // Obter dados atuais para preservar longest
    let currentLongest = 0;
    let currentHistory: StreakHistoryItem[] = [];

    try {
      const currentData = await this.firestore.getStreakData(userId);
      currentLongest = currentData.longest;
      currentHistory = currentData.history || [];
    } catch {
      // Primeiro streak do usuário
    }

    logger.info("[StreakService] startNewStreak - Criando streak de 1", {
      userId,
      date,
      previousLongest: currentLongest,
    });

    try {
      // Criar novo streak começando em 1
      const updatedStreakData = await this.firestore.updateStreak(userId, {
        current: 1,
        longest: Math.max(1, currentLongest),
        history: [...currentHistory, { date, count: 1 }],
        lastUpdate: new Date(),
      });

      // Sincronizar com UserProgress
      await this.firestore.updateUserProgress(userId, {
        currentStreak: 1,
        longestStreak: Math.max(1, currentLongest),
        lastActivityDate: new Date(),
      });

      logger.info(
        "[StreakService] startNewStreak - Streak criado com sucesso",
        {
          userId,
          newStreak: updatedStreakData.current,
        }
      );

      // Não há bônus para streak de 1 dia
      return {
        streakData: updatedStreakData,
        bonusAwarded: 0,
      };
    } catch (error) {
      logger.error("[StreakService] startNewStreak - ERRO ao salvar streak", {
        userId,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retorna uma data X dias atrás no formato YYYY-MM-DD
   * @param dateStr Data base no formato YYYY-MM-DD
   * @param days Número de dias para subtrair
   * @returns Data no formato YYYY-MM-DD
   */
  private getDateMinusDays(dateStr: string, days: number): string {
    const parts = dateStr.split("-").map(Number);
    const year = parts[0] ?? 1970;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - days);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
   *
   * LÓGICA:
   * - Roda à meia-noite verificando o dia anterior (ontem)
   * - Se ontem atingiu meta E anteontem também → incrementa streak
   * - Se ontem atingiu meta MAS anteontem não → inicia novo streak em 1
   * - Se ontem NÃO atingiu meta → reseta streak para 0
   *
   * @param options Configurações de batch para evitar estouro de cota
   */
  async updateAllStreaks(options?: {
    batchSize?: number;
    batchDelayMs?: number;
    maxUsers?: number;
  }): Promise<{
    totalProcessed: number;
    incremented: number;
    reset: number;
    started: number;
    skipped: number;
    errors: string[];
  }> {
    const batchSize = options?.batchSize ?? 50;
    const batchDelayMs = options?.batchDelayMs ?? 0;
    const maxUsers = options?.maxUsers ?? Infinity;

    const yesterday = this.getYesterdayDate();
    const dayBeforeYesterday = this.getDateMinusDays(yesterday, 1);
    const errors: string[] = [];
    let totalProcessed = 0;
    let incremented = 0;
    let reset = 0;
    let started = 0;
    let skipped = 0;

    try {
      // Buscar todos os usuários com progresso
      let allUserIds = await this.getAllUserIds();

      // Limitar número de usuários se configurado
      if (allUserIds.length > maxUsers) {
        logger.info(
          `[StreakService] Limitando de ${allUserIds.length} para ${maxUsers} usuários`
        );
        skipped = allUserIds.length - maxUsers;
        allUserIds = allUserIds.slice(0, maxUsers);
      }

      logger.info(
        `[StreakService] Processando ${allUserIds.length} usuários em batches de ${batchSize}`
      );

      // Processar em batches
      for (let i = 0; i < allUserIds.length; i += batchSize) {
        const batch = allUserIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allUserIds.length / batchSize);

        logger.debug(
          `[StreakService] Processando batch ${batchNumber}/${totalBatches} (${batch.length} usuários)`
        );

        for (const userId of batch) {
          try {
            totalProcessed++;

            // Verificar se a meta diária de ontem foi atingida
            let yesterdayGoalMet = false;
            try {
              const yesterdayProgress = await this.firestore.getDailyProgress(
                userId,
                yesterday
              );
              yesterdayGoalMet =
                yesterdayProgress.goalMet &&
                yesterdayProgress.cardsReviewed >= DAILY_GOAL_TARGET;
            } catch {
              yesterdayGoalMet = false;
            }

            if (!yesterdayGoalMet) {
              // Ontem NÃO atingiu meta: resetar streak
              await this.resetStreak(userId);
              reset++;
              continue;
            }

            // Ontem atingiu meta, verificar anteontem para saber se incrementa ou inicia novo
            let dayBeforeYesterdayGoalMet = false;
            try {
              const dayBeforeProgress = await this.firestore.getDailyProgress(
                userId,
                dayBeforeYesterday
              );
              dayBeforeYesterdayGoalMet =
                dayBeforeProgress.goalMet &&
                dayBeforeProgress.cardsReviewed >= DAILY_GOAL_TARGET;
            } catch {
              dayBeforeYesterdayGoalMet = false;
            }

            if (dayBeforeYesterdayGoalMet) {
              // Anteontem também atingiu: incrementar streak
              await this.incrementStreak(userId);
              incremented++;
            } else {
              // Anteontem NÃO atingiu: iniciar novo streak em 1
              await this.startNewStreak(userId, yesterday);
              started++;
            }
          } catch (err) {
            const errorMsg = `Erro ao atualizar streak do usuário ${userId}: ${
              err instanceof Error ? err.message : String(err)
            }`;
            errors.push(errorMsg);
            logger.error(`[StreakService] ${errorMsg}`);

            // Se for erro de cota, parar imediatamente
            if (
              err instanceof Error &&
              err.message.includes("RESOURCE_EXHAUSTED")
            ) {
              logger.error(
                "[StreakService] ⚠️ Cota do Firebase esgotada! Parando processamento."
              );
              return {
                totalProcessed,
                incremented,
                reset,
                started,
                skipped: skipped + (allUserIds.length - totalProcessed),
                errors: [
                  ...errors,
                  "Processamento interrompido: cota do Firebase esgotada",
                ],
              };
            }
          }
        }

        // Aguardar entre batches para não sobrecarregar o Firebase
        if (batchDelayMs > 0 && i + batchSize < allUserIds.length) {
          logger.debug(
            `[StreakService] Aguardando ${batchDelayMs}ms antes do próximo batch...`
          );
          await this.sleep(batchDelayMs);
        }
      }

      return {
        totalProcessed,
        incremented,
        reset,
        started,
        skipped,
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
   * Função auxiliar para aguardar um tempo
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
