import { Router } from "express";
import gamificationRoutes from "./gamification.routes";
import { statisticsRoutes } from "./statistics.routes";
import { rankingsRoutes } from "./rankings.routes";
import syncRoutes from "./sync.routes";

/**
 * Routes Index
 *
 * Exporta todas as rotas da aplicação
 */

const router = Router();

// Montar rotas de gamificação
router.use("/gamification", gamificationRoutes);

// Montar rotas de estatísticas
router.use("/statistics", statisticsRoutes);

// Montar rotas de rankings - ETAPA 4.2
router.use("/rankings", rankingsRoutes);

// Montar rotas de sincronização - Sync PHP Backend
router.use("/sync", syncRoutes);

export default router;
