import cron from "node-cron";
import { AchievementService } from "../services/achievement.service";
import { FirestoreService } from "../services/firestore.service";
import { logger } from "../utils/logger";

/**
 * Cron Job: Check Achievements
 *
 * Execução: A cada hora (minuto 0) - Horário de Brasília
 * Timezone: America/Sao_Paulo
 * Expressão Cron: '0 * * * *' (minuto 0 de cada hora)
 *
 * Responsabilidades:
 * 1. Buscar todos os usuários com progresso
 * 2. Verificar conquistas pendentes para cada usuário
 * 3. Desbloquear conquistas que atingiram a meta automaticamente
 * 4. Registrar logs de execução e erros
 */

const achievementService = new AchievementService();
const firestoreService = new FirestoreService();

/**
 * Executa a verificação de conquistas para todos os usuários
 * Chamado pelo cron job a cada hora
 */
export const executeCheckAchievements = async (): Promise<void> => {
  const startTime = Date.now();
  logger.info("🏆 [CRON] Iniciando verificação de conquistas...");

  try {
    // 1. Buscar todos os usuários com progresso
    const allUserIds = await firestoreService.getAllUserIds();
    logger.info(
      `📊 [CRON] Total de usuários a processar: ${allUserIds.length}`
    );

    let totalProcessed = 0;
    let totalUnlocked = 0;
    const errors: string[] = [];

    // 2. Verificar conquistas pendentes para cada usuário (processamento em batch)
    for (const userId of allUserIds) {
      try {
        totalProcessed++;

        // 3. Verificar e desbloquear conquistas que atingiram a meta
        const newlyUnlocked =
          await achievementService.checkAchievements(userId);

        if (newlyUnlocked.length > 0) {
          totalUnlocked += newlyUnlocked.length;
          logger.info(
            `✨ [CRON] Usuário ${userId} desbloqueou ${newlyUnlocked.length} conquista(s):`,
            {
              achievements: newlyUnlocked.map((a) => a.name),
            }
          );
        }
      } catch (err) {
        const errorMsg = `Erro ao verificar conquistas do usuário ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`;
        errors.push(errorMsg);
        logger.error(`❌ [CRON] ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;

    // Log de sucesso com estatísticas
    logger.info("✅ [CRON] Verificação de conquistas concluída com sucesso", {
      totalProcessed,
      totalUnlocked,
      errors: errors.length,
      duration: `${duration}ms`,
    });

    // Se houver erros, registrar em nível de warning
    if (errors.length > 0) {
      logger.warn(
        `⚠️ [CRON] Verificação de conquistas concluída com ${errors.length} erro(s)`,
        {
          errors: errors.slice(0, 10), // Limitar a 10 erros no log
        }
      );
    }
  } catch (err) {
    const errorMsg = `Erro crítico na verificação de conquistas: ${
      err instanceof Error ? err.message : String(err)
    }`;
    logger.error(`🔥 [CRON] ${errorMsg}`, {
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
};

/**
 * Agenda o cron job para executar a cada hora
 * Executa no minuto 0 de cada hora (ex: 00:00, 01:00, 02:00...)
 */
export const scheduleCheckAchievementsJob = (): void => {
  // Executar a cada hora (minuto 0)
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        await executeCheckAchievements();
      } catch (err) {
        logger.error("❌ [CRON] Falha na execução do check achievements job:", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  logger.info(
    '🕐 [CRON] Check Achievements Job agendado (a cada hora - "0 * * * *" em America/Sao_Paulo)'
  );
};
