import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import "./config/firebase.config";
import { swaggerSpec } from "./config/swagger.config";
import scheduleKeepAlive from "./jobs/keep-alive.job";
import scheduleUpdateStreaks from "./jobs/update-streaks.job";
import { authMiddleware } from "./middlewares/auth.middleware";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import { rateLimiter } from "./middlewares/rate-limit.middleware";
import routes from "./routes";
import pingRoutes from "./routes/ping.routes";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();

// Segurança
app.use(helmet());

// CORS
app.use(cors());

// Parse JSON
app.use(express.json());

// Logger de requisições
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// Health check endpoint (não requer autenticação)
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Rotas de ping para keep-alive (não requer autenticação)
app.use("/ping", pingRoutes);

// Swagger Documentation (público)
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "BMO Gamification API",
  })
);

// =============================================================================
// ETAPA 4.4 - INTEGRAÇÃO COM APP.TS
// =============================================================================

// Montar todas as rotas da aplicação com middlewares de segurança
// Aplicar rate limiting e autenticação para todas as rotas /api/*
app.use("/api", rateLimiter, authMiddleware, routes);

// ROTAS REGISTRADAS:
// - /api/statistics/* (getDeckStatistics, getUserStatistics, updateSession)
// - /api/rankings/* (getMonthlyRanking, getYearlyRanking, getUserPosition)
// - /api/gamification/* (rotas de gamificação existentes)

// Middleware de rota não encontrada (404)
app.use(notFoundMiddleware);

// Middleware global de tratamento de erros (deve ser o último)
app.use(errorMiddleware);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

if (Number.isNaN(port)) {
  throw new Error("PORT deve ser um número válido");
}

if (require.main === module) {
  app.listen(port, host, () => {
    // Mantém log simples indicando porta ativa.
    console.log(`Gamification service listening on ${host}:${port}`);
    console.log(`Acesse pela rede local em: http://<SEU_IP_LOCAL>:${port}`);

    // Inicializar cron jobs
    scheduleUpdateStreaks();
    scheduleKeepAlive();
  });
}

export default app;
