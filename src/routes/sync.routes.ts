import { Router } from "express";
import { SyncController } from "../controllers/sync.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const syncController = new SyncController();

/**
 * @swagger
 * /api/sync/deck:
 *   post:
 *     summary: Sincroniza deck do backend PHP
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deckId
 *               - userId
 *               - deckName
 *             properties:
 *               deckId:
 *                 type: number
 *                 example: 123
 *               userId:
 *                 type: number
 *                 example: 456
 *               deckName:
 *                 type: string
 *                 example: "Matemática Básica"
 *               description:
 *                 type: string
 *                 example: "Deck de matemática para iniciantes"
 *               totalCards:
 *                 type: number
 *                 example: 50
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               updatedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Deck sincronizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post("/deck", authMiddleware, syncController.syncDeck);

/**
 * @swagger
 * /api/sync/card:
 *   post:
 *     summary: Sincroniza card do backend PHP
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cardId
 *               - deckId
 *               - question
 *               - answer
 *             properties:
 *               cardId:
 *                 type: number
 *                 example: 789
 *               deckId:
 *                 type: number
 *                 example: 123
 *               question:
 *                 type: string
 *                 example: "Quanto é 2 + 2?"
 *               answer:
 *                 type: string
 *                 example: "4"
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               updatedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Card sincronizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post("/card", authMiddleware, syncController.syncCard);

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Retorna status da sincronização
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Status de sincronização
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     decks:
 *                       type: object
 *                       properties:
 *                         total_decks:
 *                           type: number
 *                         synced_last_5min:
 *                           type: number
 *                         oldest_sync:
 *                           type: string
 *                           format: date-time
 *                         newest_sync:
 *                           type: string
 *                           format: date-time
 *                     cards:
 *                       type: object
 *                       properties:
 *                         total_cards:
 *                           type: number
 *                         synced_last_5min:
 *                           type: number
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Erro interno
 */
router.get("/status", authMiddleware, syncController.getSyncStatus);

/**
 * @swagger
 * /api/sync/clean-logs:
 *   post:
 *     summary: Limpa logs antigos de sincronização
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysToKeep:
 *                 type: number
 *                 example: 30
 *                 description: Número de dias de logs para manter (padrão 30)
 *     responses:
 *       200:
 *         description: Logs removidos com sucesso
 *       500:
 *         description: Erro interno
 */
router.post("/clean-logs", authMiddleware, syncController.cleanOldLogs);

export default router;
