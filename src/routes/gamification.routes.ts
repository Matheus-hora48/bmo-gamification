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

// ==========================================
// ROTAS PARA MÉTRICAS CUSTOMIZADAS
// ==========================================

/**
 * @swagger
 * /api/gamification/marketplace-deck-added:
 *   post:
 *     summary: Registrar deck adicionado do marketplace
 *     tags: [Gamification - Métricas]
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
 */
router.post("/marketplace-deck-added", controller.onMarketplaceDeckAdded);

/**
 * @swagger
 * /api/gamification/profile-completed:
 *   post:
 *     summary: Registrar perfil completo
 *     tags: [Gamification - Métricas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - completed
 *             properties:
 *               userId:
 *                 type: string
 *               completed:
 *                 type: boolean
 */
router.post("/profile-completed", controller.onProfileCompleted);

/**
 * @swagger
 * /api/gamification/deck-shared:
 *   post:
 *     summary: Registrar compartilhamento de deck
 *     tags: [Gamification - Métricas]
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
 */
router.post("/deck-shared", controller.onDeckShared);

/**
 * @swagger
 * /api/gamification/deck-rated:
 *   post:
 *     summary: Registrar avaliação de deck
 *     tags: [Gamification - Métricas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - deckId
 *               - rating
 *             properties:
 *               userId:
 *                 type: string
 *               deckId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 */
router.post("/deck-rated", controller.onDeckRated);

/**
 * @swagger
 * /api/gamification/deck-completed:
 *   post:
 *     summary: Registrar conclusão de deck (100%)
 *     tags: [Gamification - Métricas]
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
 */
router.post("/deck-completed", controller.onDeckCompleted);

/**
 * @swagger
 * /api/gamification/active-decks:
 *   post:
 *     summary: Atualizar lista de decks ativos
 *     tags: [Gamification - Métricas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - deckIds
 *             properties:
 *               userId:
 *                 type: string
 *               deckIds:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post("/active-decks", controller.updateActiveDecks);

/**
 * @swagger
 * /api/gamification/study-session:
 *   post:
 *     summary: Registrar sessão de estudo com horário
 *     tags: [Gamification - Métricas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - deckId
 *               - date
 *               - hour
 *             properties:
 *               userId:
 *                 type: string
 *               deckId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               hour:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 23
 *               cardsReviewed:
 *                 type: number
 */
router.post("/study-session", controller.onStudySession);

/**
 * @swagger
 * /api/gamification/metrics/{userId}:
 *   get:
 *     summary: Obter métricas customizadas do usuário
 *     tags: [Gamification - Métricas]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/metrics/:userId", controller.getUserMetrics);

export default router;
