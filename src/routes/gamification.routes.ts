import { Router } from "express";
import { GamificationController } from "../controllers/gamification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { rateLimiter } from "../middlewares/rate-limit.middleware";

/**
 * Gamification Routes
 *
 * Rotas para o sistema de gamificação do BMO:
 * - Processar revisões de cards
 * - Registrar criação de cards e decks
 * - Consultar progresso do usuário
 * - Consultar conquistas
 * - Verificar conquistas pendentes
 *
 * Todos os endpoints requerem autenticação via token e são protegidos por rate limiting.
 */

const router = Router();
const controller = new GamificationController();

// Aplicar middlewares globais a todas as rotas
router.use(authMiddleware);
router.use(rateLimiter);

/**
 * @swagger
 * /api/gamification/process-review:
 *   post:
 *     summary: Processar revisão de card
 *     description: Adiciona XP baseado na dificuldade da revisão do card
 *     tags: [Gamification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - cardId
 *               - difficulty
 *             properties:
 *               userId:
 *                 type: string
 *               cardId:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [again, hard, good, easy]
 *     responses:
 *       200:
 *         description: Revisão processada com sucesso
 *       401:
 *         description: Não autorizado
 */
router.post("/process-review", controller.processCardReview);

/**
 * @swagger
 * /api/gamification/card-created:
 *   post:
 *     summary: Registrar criação de card
 *     description: Adiciona 25 XP pela criação de um card
 *     tags: [Gamification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - cardId
 *             properties:
 *               userId:
 *                 type: string
 *               cardId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Card criado registrado com sucesso
 */
router.post("/card-created", controller.onCardCreated);

/**
 * @swagger
 * /api/gamification/deck-created:
 *   post:
 *     summary: Registrar criação de deck
 *     description: Adiciona 50 XP pela criação de um deck
 *     tags: [Gamification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - deckId
 *             properties:
 *               userId:
 *                 type: string
 *               deckId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deck criado registrado com sucesso
 */
router.post("/deck-created", controller.onDeckCreated);

/**
 * @swagger
 * /api/gamification/progress/{userId}:
 *   get:
 *     summary: Buscar progresso do usuário
 *     description: Retorna o progresso completo do usuário (XP, nível, streaks, etc)
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progresso do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProgress'
 */
router.get("/progress/:userId", controller.getUserProgress);

/**
 * @swagger
 * /api/gamification/daily-progress/{userId}:
 *   get:
 *     summary: Buscar progresso diário do usuário
 *     description: Retorna o progresso diário do usuário
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Data no formato YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Progresso diário do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DailyProgress'
 */
router.get("/daily-progress/:userId", controller.getDailyProgress);

/**
 * @swagger
 * /api/gamification/achievements/{userId}:
 *   get:
 *     summary: Buscar conquistas do usuário
 *     description: Retorna todas as conquistas desbloqueadas do usuário
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de conquistas do usuário
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
 *                     $ref: '#/components/schemas/UserAchievement'
 */
router.get("/achievements/:userId", controller.getUserAchievements);

/**
 * @swagger
 * /api/gamification/check-achievements/{userId}:
 *   post:
 *     summary: Verificar conquistas pendentes
 *     description: Força a verificação de conquistas que o usuário pode ter desbloqueado
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [xp, level, streak, cards, decks]
 *     responses:
 *       200:
 *         description: Novas conquistas desbloqueadas
 */
router.post("/check-achievements/:userId", controller.checkAchievements);

export default router;
