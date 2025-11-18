import type { Request, Response } from "express";
import { RankingService } from "../services/ranking.service";
import { logger } from "../utils/logger";

/**
 * Rankings Controller
 *
 * Controller específico para rankings mensais e anuais
 * Implementa endpoints para buscar rankings e posições de usuários
 */
export class RankingsController {
  private readonly rankingService: RankingService;

  constructor() {
    this.rankingService = new RankingService();
  }

  // =============================================================================
  // RANKINGS ENDPOINTS
  // =============================================================================

  /**
   * GET /api/rankings/monthly/:date?
   * Busca ranking mensal para um período específico
   * Se date não informado, usa mês atual
   */
  getMonthlyRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date } = req.params; // Opcional: '2025-11'
      const { limit } = req.query;

      // Se não informado: usar mês atual
      let targetDate = date;
      if (!targetDate) {
        const currentDate = new Date();
        targetDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      }

      // Validar formato do período
      const periodRegex = /^\d{4}-\d{2}$/;
      if (!periodRegex.test(targetDate)) {
        res.status(400).json({
          success: false,
          error: "Formato de data inválido (use: YYYY-MM)",
          code: "INVALID_DATE_FORMAT",
        });
        return;
      }

      const limitNumber = limit ? parseInt(limit as string, 10) : 50;

      if (limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: "Limit deve ser entre 1 e 100",
          code: "INVALID_LIMIT",
        });
        return;
      }

      logger.info(
        `Buscando ranking mensal para período: ${targetDate}, limit: ${limitNumber}`
      );

      const ranking = await this.rankingService.getRanking(
        "monthly",
        targetDate
      );

      if (!ranking) {
        res.status(404).json({
          success: false,
          error: "Ranking não encontrado para o período especificado",
          code: "RANKING_NOT_FOUND",
        });
        return;
      }

      // Retornar ranking mensal
      res.status(200).json({
        success: true,
        data: {
          period: targetDate,
          type: "monthly",
          entries: ranking.entries.slice(0, limitNumber),
          totalParticipants: ranking.totalParticipants,
          lastUpdated: ranking.lastUpdated,
          hasMore: ranking.entries.length > limitNumber,
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar ranking mensal:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * GET /api/rankings/yearly/:year?
   * Busca ranking anual para um ano específico
   * Se year não informado, usa ano atual
   */
  getYearlyRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { year } = req.params; // Opcional: '2025'
      const { limit } = req.query;

      // Se não informado: usar ano atual
      let targetYear = year;
      if (!targetYear) {
        targetYear = String(new Date().getFullYear());
      }

      // Validar formato do ano
      const yearNumber = parseInt(targetYear, 10);
      if (
        isNaN(yearNumber) ||
        yearNumber < 2020 ||
        yearNumber > new Date().getFullYear() + 1
      ) {
        res.status(400).json({
          success: false,
          error: "Ano inválido",
          code: "INVALID_YEAR",
        });
        return;
      }

      const limitNumber = limit ? parseInt(limit as string, 10) : 50;

      if (limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: "Limit deve ser entre 1 e 100",
          code: "INVALID_LIMIT",
        });
        return;
      }

      logger.info(
        `Buscando ranking anual para ano: ${targetYear}, limit: ${limitNumber}`
      );

      const ranking = await this.rankingService.getRanking(
        "yearly",
        targetYear
      );

      if (!ranking) {
        res.status(404).json({
          success: false,
          error: "Ranking não encontrado para o ano especificado",
          code: "RANKING_NOT_FOUND",
        });
        return;
      }

      // Retornar ranking anual
      res.status(200).json({
        success: true,
        data: {
          period: targetYear,
          type: "yearly",
          entries: ranking.entries.slice(0, limitNumber),
          totalParticipants: ranking.totalParticipants,
          lastUpdated: ranking.lastUpdated,
          hasMore: ranking.entries.length > limitNumber,
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar ranking anual:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * GET /api/rankings/user/:userId/position/:period
   * Busca posição específica de um usuário
   * Retornar posição específica do usuário
   */
  getUserPosition = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, period } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      if (!period) {
        res.status(400).json({
          success: false,
          error: "period é obrigatório",
          code: "MISSING_PERIOD",
        });
        return;
      }

      // Validar se período é 'monthly' ou 'yearly'
      if (period !== "monthly" && period !== "yearly") {
        res.status(400).json({
          success: false,
          error: "Period deve ser 'monthly' ou 'yearly'",
          code: "INVALID_PERIOD",
        });
        return;
      }

      logger.info(`Buscando posição do usuário ${userId} no ranking ${period}`);

      let targetPeriod: string;
      const currentDate = new Date();

      if (period === "monthly") {
        targetPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      } else {
        targetPeriod = String(currentDate.getFullYear());
      }

      const position = await this.rankingService.getUserRankPosition(
        userId,
        period,
        targetPeriod
      );

      if (position === -1) {
        res.status(404).json({
          success: false,
          error: "Usuário não encontrado no ranking para o período",
          code: "USER_NOT_IN_RANKING",
        });
        return;
      }

      // Buscar dados completos do ranking para contexto
      const ranking = await this.rankingService.getRanking(
        period,
        targetPeriod
      );
      const userEntry = ranking?.entries.find(
        (entry) => entry.userId === userId
      );

      res.status(200).json({
        success: true,
        data: {
          userId,
          period,
          targetPeriod,
          position,
          userEntry: userEntry
            ? {
                userName: userEntry.userName,
                cardsReviewed: userEntry.cardsReviewed,
                xpEarned: userEntry.xpEarned,
                streakDays: userEntry.streakDays,
              }
            : null,
          totalParticipants: ranking?.totalParticipants || 0,
          lastUpdated: ranking?.lastUpdated || null,
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar posição do usuário no ranking:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };
}
