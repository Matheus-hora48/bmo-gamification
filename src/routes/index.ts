import { Router } from "express";
import gamificationRoutes from "./gamification.routes";
import userRoutes from "./user.routes";

/**
 * Routes Index
 *
 * Exporta todas as rotas da aplicação
 */

const router = Router();

// Montar rotas de gamificação
router.use("/gamification", gamificationRoutes);
router.use("/user", userRoutes);

export default router;
