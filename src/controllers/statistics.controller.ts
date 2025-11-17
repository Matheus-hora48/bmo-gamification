import type { Request, Response } from "express";
import { StatisticsService } from "../services/statistics.service";
import { RankingService } from "../services/ranking.service";
import { logger } from "../utils/logger";
import { z } from "zod";

/**
 * Statistics Controller
 *
 * Endpoints para acessar estatísticas de usuários e decks
 * Inclui métricas de progresso, analytics e rankings
 */
export class StatisticsController {
  private readonly statisticsService: StatisticsService;
  private readonly rankingService: RankingService;

  constructor() {
    this.statisticsService = new StatisticsService();
    this.rankingService = new RankingService();
  }

  // =============================================================================
  // DECK STATISTICS
  // =============================================================================

  /**
   * GET /statistics/deck/:deckId/:userId
   * Busca estatísticas de um deck específico para um usuário
   */
  getDeckStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deckId, userId } = req.params;

      if (!deckId || !userId) {
        res.status(400).json({
          success: false,
          error: "deckId e userId são obrigatórios",
          code: "MISSING_PARAMS",
        });
        return;
      }

      const statistics = await this.statisticsService.getDeckStatistics(
        userId,
        deckId
      );

      if (!statistics) {
        res.status(404).json({
          success: false,
          error: "Estatísticas não encontradas",
          code: "STATS_NOT_FOUND",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error("Erro ao buscar estatísticas do deck:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * GET /statistics/deck/:userId/all
   * Busca estatísticas de todos os decks de um usuário
   */
  getAllUserDeckStatistics = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      // Por enquanto retorna array vazio - implementação futura
      // TODO: Implementar método getAllUserDeckStatistics no StatisticsService
      const allStatistics: any[] = [];

      res.status(200).json({
        success: true,
        data: allStatistics,
      });
    } catch (error) {
      logger.error("Erro ao buscar todas estatísticas de decks:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // =============================================================================
  // USER STATISTICS
  // =============================================================================

  /**
   * GET /statistics/user/:userId
   * Busca estatísticas gerais de um usuário
   */
  getUserStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      const statistics = await this.statisticsService.getUserStatistics(userId);

      if (!statistics) {
        res.status(404).json({
          success: false,
          error: "Estatísticas do usuário não encontradas",
          code: "USER_STATS_NOT_FOUND",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error("Erro ao buscar estatísticas do usuário:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * GET /statistics/user/:userId/analytics
   * Busca analytics avançados de um usuário (taxa de acerto, retenção, etc.)
   */
  getUserAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      // Validar datas se fornecidas
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate as string);
        if (isNaN(start.getTime())) {
          res.status(400).json({
            success: false,
            error: "startDate inválida",
            code: "INVALID_START_DATE",
          });
          return;
        }
      }

      if (endDate) {
        end = new Date(endDate as string);
        if (isNaN(end.getTime())) {
          res.status(400).json({
            success: false,
            error: "endDate inválida",
            code: "INVALID_END_DATE",
          });
          return;
        }
      }

      // Se não fornecidas, usar últimos 30 dias
      if (!start || !end) {
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - 30);
      }

      const [accuracyRate, retentionRate, favoriteStudyTime] =
        await Promise.all([
          this.statisticsService.calculateAccuracyRate(userId),
          this.statisticsService.calculateRetentionRate(userId),
          this.statisticsService.detectFavoriteStudyTime(userId),
        ]);

      res.status(200).json({
        success: true,
        data: {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
          accuracyRate: Math.round(accuracyRate * 100) / 100, // 2 decimais
          retentionRate: Math.round(retentionRate * 100) / 100,
          favoriteStudyTime,
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar analytics do usuário:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // =============================================================================
  // RANKINGS
  // =============================================================================

  /**
   * GET /statistics/rankings/monthly/:period
   * Busca ranking mensal (período formato: YYYY-MM)
   */
  getMonthlyRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { period } = req.params;
      const { limit } = req.query;

      if (!period) {
        res.status(400).json({
          success: false,
          error: "período é obrigatório (formato: YYYY-MM)",
          code: "MISSING_PERIOD",
        });
        return;
      }

      // Validar formato do período
      const periodRegex = /^\d{4}-\d{2}$/;
      if (!periodRegex.test(period)) {
        res.status(400).json({
          success: false,
          error: "formato de período inválido (use: YYYY-MM)",
          code: "INVALID_PERIOD_FORMAT",
        });
        return;
      }

      const limitNumber = limit ? parseInt(limit as string, 10) : 50;

      if (limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: "limit deve ser entre 1 e 100",
          code: "INVALID_LIMIT",
        });
        return;
      }

      const ranking = await this.rankingService.getRanking("monthly", period);

      res.status(200).json({
        success: true,
        data: {
          period,
          type: "monthly",
          entries: ranking?.entries || [],
          totalUsers: ranking?.totalParticipants || 0,
          lastUpdated: ranking?.lastUpdated || null,
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
   * GET /statistics/rankings/yearly/:year
   * Busca ranking anual
   */
  getYearlyRanking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { year } = req.params;
      const { limit } = req.query;

      if (!year) {
        res.status(400).json({
          success: false,
          error: "ano é obrigatório",
          code: "MISSING_YEAR",
        });
        return;
      }

      // Validar formato do ano
      const yearNumber = parseInt(year, 10);
      if (
        isNaN(yearNumber) ||
        yearNumber < 2020 ||
        yearNumber > new Date().getFullYear() + 1
      ) {
        res.status(400).json({
          success: false,
          error: "ano inválido",
          code: "INVALID_YEAR",
        });
        return;
      }

      const limitNumber = limit ? parseInt(limit as string, 10) : 50;

      if (limitNumber < 1 || limitNumber > 100) {
        res.status(400).json({
          success: false,
          error: "limit deve ser entre 1 e 100",
          code: "INVALID_LIMIT",
        });
        return;
      }

      const ranking = await this.rankingService.getRanking("yearly", year);

      res.status(200).json({
        success: true,
        data: {
          period: year,
          type: "yearly",
          entries: ranking?.entries || [],
          totalUsers: ranking?.totalParticipants || 0,
          lastUpdated: ranking?.lastUpdated || null,
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
   * GET /statistics/rankings/user/:userId/position
   * Busca posição de um usuário nos rankings mensais e anuais atuais
   */
  getUserRankingPosition = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      const currentYear = String(currentDate.getFullYear());

      const [monthlyPosition, yearlyPosition] = await Promise.all([
        this.rankingService.getUserRankPosition(
          userId,
          "monthly",
          currentMonth
        ),
        this.rankingService.getUserRankPosition(userId, "yearly", currentYear),
      ]);

      res.status(200).json({
        success: true,
        data: {
          userId,
          monthly: {
            period: currentMonth,
            position: monthlyPosition,
          },
          yearly: {
            period: currentYear,
            position: yearlyPosition,
          },
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar posição do usuário nos rankings:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // =============================================================================
  // SESSION MANAGEMENT
  // =============================================================================

  /**
   * PUT /statistics/session/:userId
   * Atualiza dados de sessão de estudo de um usuário
   * Registra tempo de sessão e recalcula estatísticas
   */
  updateSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const {
        sessionDurationMinutes,
        cardsReviewed,
        accuracyCount,
        totalAnswers,
        studyTime,
      } = req.body;

      // Validação de parâmetros obrigatórios
      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      if (!sessionDurationMinutes || sessionDurationMinutes <= 0) {
        res.status(400).json({
          success: false,
          error: "sessionDurationMinutes deve ser maior que 0",
          code: "INVALID_SESSION_DURATION",
        });
        return;
      }

      // Validar dados opcionais se fornecidos
      if (cardsReviewed !== undefined && cardsReviewed < 0) {
        res.status(400).json({
          success: false,
          error: "cardsReviewed deve ser maior ou igual a 0",
          code: "INVALID_CARDS_REVIEWED",
        });
        return;
      }

      if (accuracyCount !== undefined && totalAnswers !== undefined) {
        if (accuracyCount < 0 || totalAnswers < 0) {
          res.status(400).json({
            success: false,
            error: "accuracyCount e totalAnswers devem ser maior ou igual a 0",
            code: "INVALID_ACCURACY_DATA",
          });
          return;
        }

        if (accuracyCount > totalAnswers) {
          res.status(400).json({
            success: false,
            error: "accuracyCount não pode ser maior que totalAnswers",
            code: "INVALID_ACCURACY_RATIO",
          });
          return;
        }
      }

      if (
        studyTime &&
        !["morning", "afternoon", "evening"].includes(studyTime)
      ) {
        res.status(400).json({
          success: false,
          error: "studyTime deve ser 'morning', 'afternoon' ou 'evening'",
          code: "INVALID_STUDY_TIME",
        });
        return;
      }

      // Registrar sessão de estudo
      await this.statisticsService.recordStudySession({
        userId,
        sessionDurationMinutes,
        cardsReviewed: cardsReviewed || 0,
        accuracyCount: accuracyCount || 0,
        totalAnswers: totalAnswers || 0,
        studyTime,
      });

      // Atualizar estatísticas do usuário
      await this.statisticsService.updateUserStatistics(userId);

      res.status(200).json({
        success: true,
        message:
          "Sessão de estudo registrada e estatísticas atualizadas com sucesso",
        data: {
          userId,
          sessionDurationMinutes,
          cardsReviewed: cardsReviewed || 0,
          accuracyCount: accuracyCount || 0,
          totalAnswers: totalAnswers || 0,
          studyTime: studyTime || null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Erro ao atualizar sessão de estudo:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  // =============================================================================
  // TRIGGERS INTERNOS (para jobs/automações)
  // =============================================================================

  /**
   * POST /statistics/update-user/:userId
   * Força atualização das estatísticas de um usuário
   * (usado internamente por jobs/webhooks)
   */
  updateUserStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId é obrigatório",
          code: "MISSING_USER_ID",
        });
        return;
      }

      await this.statisticsService.updateUserStatistics(userId);

      res.status(200).json({
        success: true,
        message: "Estatísticas do usuário atualizadas com sucesso",
      });
    } catch (error) {
      logger.error("Erro ao atualizar estatísticas do usuário:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * POST /statistics/rankings/update
   * Força atualização dos rankings mensais e anuais
   * (usado internamente por jobs)
   */
  updateRankings = async (req: Request, res: Response): Promise<void> => {
    try {
      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      const currentYear = String(currentDate.getFullYear());

      await Promise.all([
        this.rankingService.updateMonthlyRanking(currentMonth),
        this.rankingService.updateYearlyRanking(currentYear),
      ]);

      res.status(200).json({
        success: true,
        message: "Rankings atualizados com sucesso",
        data: {
          monthlyPeriod: currentMonth,
          yearlyPeriod: currentYear,
        },
      });
    } catch (error) {
      logger.error("Erro ao atualizar rankings:", error);
      res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    }
  };
}
