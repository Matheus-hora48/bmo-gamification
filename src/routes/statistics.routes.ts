import { Router } from "express";
import { StatisticsController } from "../controllers/statistics.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const statisticsController = new StatisticsController();

// =============================================================================
// DECK STATISTICS ROUTES
// =============================================================================

/**
 * @swagger
 * /api/statistics/deck/{userId}:
 *   get:
 *     summary: Busca estatísticas de todos os decks do usuário
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Estatísticas de todos os decks encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeckStatistics'
 *       404:
 *         description: Estatísticas não encontradas
 *       500:
 *         description: Erro interno do servidor
 */

/**
 * @swagger
 * /api/statistics/deck/{userId}/{deckId}:
 *   get:
 *     summary: Busca estatísticas de um deck específico
 *     tags: [Statistics]
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
 *         name: deckId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do deck
 *     responses:
 *       200:
 *         description: Estatísticas do deck encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DeckStatistics'
 *       404:
 *         description: Estatísticas não encontradas
 *       500:
 *         description: Erro interno do servidor
 */

// Rota para deck específico (deve vir primeiro para evitar conflito)
router.get(
  "/deck/:userId/:deckId",
  authMiddleware,
  statisticsController.getDeckStatistics
);

// Rota para todos os decks do usuário
router.get(
  "/deck/:userId",
  authMiddleware,
  statisticsController.getDeckStatistics
);

// =============================================================================
// USER STATISTICS ROUTES
// =============================================================================

/**
 * @swagger
 * /api/statistics/user/{userId}:
 *   get:
 *     summary: Busca estatísticas gerais de um usuário
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Estatísticas do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserStatistics'
 *       404:
 *         description: Estatísticas não encontradas
 */
router.get(
  "/user/:userId",
  authMiddleware,
  statisticsController.getUserStatistics
);

/**
 * @swagger
 * /api/statistics/session/{userId}:
 *   put:
 *     summary: Atualiza dados de sessão de estudo de um usuário
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionDurationMinutes
 *             properties:
 *               sessionDurationMinutes:
 *                 type: number
 *                 minimum: 1
 *                 description: Duração da sessão em minutos
 *               cardsReviewed:
 *                 type: number
 *                 minimum: 0
 *                 description: Número de cards revisados na sessão
 *               accuracyCount:
 *                 type: number
 *                 minimum: 0
 *                 description: Número de respostas corretas
 *               totalAnswers:
 *                 type: number
 *                 minimum: 0
 *                 description: Total de respostas dadas
 *               studyTime:
 *                 type: string
 *                 enum: [morning, afternoon, evening]
 *                 description: Período do dia da sessão
 *     responses:
 *       200:
 *         description: Sessão registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     sessionDurationMinutes:
 *                       type: number
 *                     cardsReviewed:
 *                       type: number
 *                     accuracyCount:
 *                       type: number
 *                     totalAnswers:
 *                       type: number
 *                     studyTime:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.put(
  "/session/:userId",
  authMiddleware,
  statisticsController.updateSession
);

export { router as statisticsRoutes };
