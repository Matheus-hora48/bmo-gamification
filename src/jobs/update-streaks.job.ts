import cron from "node-cron";
import { StreakService } from "../services/streak.service";
import { logger } from "../utils/logger";

/**
 * Cron Job: Update Streaks
 *
 * Execução: Diariamente à meia-noite (00:00) - Horário de Brasília
 * Timezone: America/Sao_Paulo
 *
 * Responsabilidades:
 * 1. Buscar todos os usuários com progresso
 * 2. Verificar meta diária de ontem (20 cards revisados)
 * 3. Incrementar streak se meta foi atingida
 * 4. Resetar streak se meta não foi atingida
 * 5. Aplicar bônus de streak (7 dias = 200 XP, 30 dias = 300 XP)
 * 6. Registrar logs de execução
 */

const streakService = new StreakService();

/**
 * Executa a atualização de streaks de todos os usuários
 * Chamado pelo cron job à meia-noite
 */
export const executeUpdateStreaks = async (): Promise<void> => {
  const startTime = Date.now();
  logger.info("🔥 [CRON] Iniciando atualização de streaks...");

  try {
    // Executa a atualização de todos os streaks usando o StreakService
    const result = await streakService.updateAllStreaks();

    const duration = Date.now() - startTime;

    // Log de sucesso com estatísticas
    logger.info("✅ [CRON] Atualização de streaks concluída com sucesso", {
      totalProcessed: result.totalProcessed,
      incremented: result.incremented,
      reset: result.reset,
      errors: result.errors.length,
      duration: `${duration}ms`,
    });

    // Se houver erros, registrar em nível de warning
    if (result.errors.length > 0) {
      logger.warn(
        `⚠️ [CRON] Atualização de streaks concluída com ${result.errors.length} erro(s)`,
        {
          errors: result.errors,
        }
      );
    }

    // Log detalhado dos resultados
    logger.debug("[CRON] Estatísticas detalhadas da atualização de streaks:", {
      totalUsuarios: result.totalProcessed,
      streaksIncrementados: result.incremented,
      streaksResetados: result.reset,
      erros: result.errors,
      percentualSucesso:
        result.totalProcessed > 0
          ? ((result.totalProcessed - result.errors.length) /
              result.totalProcessed) *
            100
          : 100,
      tempoDecorrido: `${duration}ms`,
    });
  } catch (error) {
    // Log de erro crítico
    const duration = Date.now() - startTime;
    logger.error("❌ [CRON] Erro crítico ao atualizar streaks", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
    });

    // Re-lança o erro para que o sistema de monitoramento possa capturar
    throw error;
  }
};

/**
 * Configuração do Cron Job
 *
 * Pattern: '0 0 * * *'
 * - Segundo: 0
 * - Minuto: 0
 * - Hora: 0 (meia-noite)
 * - Dia do mês: * (todos os dias)
 * - Mês: * (todos os meses)
 * - Dia da semana: * (todos os dias da semana)
 *
 * Timezone: America/Sao_Paulo (Horário de Brasília)
 */
export const scheduleUpdateStreaks = (): void => {
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await executeUpdateStreaks();
      } catch (error) {
        // Erro já foi logado em executeUpdateStreaks
        // Apenas garantir que não quebre o cron job
        logger.error(
          "[CRON] Falha na execução do cron job de atualização de streaks",
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  logger.info(
    "⏰ [CRON] Job de atualização de streaks agendado para 00:00 (Brasília)",
    {
      pattern: "0 0 * * *",
      timezone: "America/Sao_Paulo",
      description: "Executa diariamente à meia-noite",
    }
  );
};

// Exportar função para inicialização do job
export default scheduleUpdateStreaks;
