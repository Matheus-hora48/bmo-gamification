import { Router } from "express";
import gamificationRoutes from "./gamification.routes";

/**
 * Routes Index
 *
 * Exporta todas as rotas da aplicação
 */

const router = Router();

// Montar rotas de gamificação
router.use("/gamification", gamificationRoutes);

export default router;
