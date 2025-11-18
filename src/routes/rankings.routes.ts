import { Router } from "express";
import { RankingsController } from "../controllers/rankings.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const rankingsController = new RankingsController();

// =============================================================================
// RANKINGS ROUTES - ETAPA 4.2
// =============================================================================

/**
 * @swagger
 * /api/rankings/monthly/{date}:
 *   get:
 *     summary: Busca ranking mensal para um período específico
 *     tags: [Rankings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *           example: '2025-11'
 *         description: Período no formato YYYY-MM (opcional, padrão é mês atual)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Número máximo de entradas no ranking
 *     responses:
 *       200:
 *         description: Ranking mensal encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       example: '2025-11'
 *                     type:
 *                       type: string
 *                       example: 'monthly'
 *                     entries:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RankingEntry'
 *                     totalParticipants:
 *                       type: integer
 *                       example: 156
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     hasMore:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Ranking não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
// Rota para ranking mensal com data específica
router.get(
  "/monthly/:date",
  authMiddleware,
  rankingsController.getMonthlyRanking
);

// Rota para ranking mensal atual (sem data)
router.get("/monthly", authMiddleware, rankingsController.getMonthlyRanking);

/**
 * @swagger
 * /api/rankings/yearly/{year}:
 *   get:
 *     summary: Busca ranking anual para um ano específico
 *     tags: [Rankings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: false
 *         schema:
 *           type: string
 *           pattern: '^\d{4}$'
 *           example: '2025'
 *         description: Ano no formato YYYY (opcional, padrão é ano atual)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Número máximo de entradas no ranking
 *     responses:
 *       200:
 *         description: Ranking anual encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       example: '2025'
 *                     type:
 *                       type: string
 *                       example: 'yearly'
 *                     entries:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RankingEntry'
 *                     totalParticipants:
 *                       type: integer
 *                       example: 1250
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     hasMore:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Ranking não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
// Rota para ranking anual com ano específico
router.get(
  "/yearly/:year",
  authMiddleware,
  rankingsController.getYearlyRanking
);

// Rota para ranking anual atual (sem ano)
router.get("/yearly", authMiddleware, rankingsController.getYearlyRanking);

/**
 * @swagger
 * /api/rankings/user/{userId}/position/{period}:
 *   get:
 *     summary: Busca posição específica de um usuário no ranking
 *     tags: [Rankings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *           enum: [monthly, yearly]
 *           example: 'monthly'
 *         description: Tipo de período (monthly ou yearly)
 *     responses:
 *       200:
 *         description: Posição do usuário encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: 'user123'
 *                     period:
 *                       type: string
 *                       example: 'monthly'
 *                     targetPeriod:
 *                       type: string
 *                       example: '2025-11'
 *                     position:
 *                       type: integer
 *                       example: 42
 *                     userEntry:
 *                       type: object
 *                       properties:
 *                         userName:
 *                           type: string
 *                           example: 'João Silva'
 *                         cardsReviewed:
 *                           type: integer
 *                           example: 150
 *                         xpEarned:
 *                           type: integer
 *                           example: 750
 *                         streakDays:
 *                           type: integer
 *                           example: 12
 *                     totalParticipants:
 *                       type: integer
 *                       example: 156
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Usuário não encontrado no ranking
 *       500:
 *         description: Erro interno do servidor
 */
router.get(
  "/user/:userId/position/:period",
  authMiddleware,
  rankingsController.getUserPosition
);

export { router as rankingsRoutes };
