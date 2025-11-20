import { Router } from "express";
import { GamificationController } from "../controllers/gamification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { rateLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = new GamificationController();

router.use(authMiddleware);
router.use(rateLimiter);

/**
 * @swagger
 * /api/user/clear_all_notifications:
 *   post:
 *     summary: Limpar todas as notificações
 *     description: Marca todas as conquistas desbloqueadas como vistas
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notificações limpas com sucesso
 */
router.post("/clear_all_notifications", controller.clearAllNotifications);

/**
 * @swagger
 * /api/user/test_notification:
 *   post:
 *     summary: Enviar notificação de teste (Estudos)
 *     description: Envia uma notificação push de lembrete de estudos para o usuário (PushType 30)
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notificação enviada com sucesso
 *       404:
 *         description: Token FCM não encontrado
 */
router.post("/test_notification", controller.sendTestNotification);

export default router;
