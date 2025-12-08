import { Router, Request, Response } from "express";

/**
 * Ping Routes - Rotas leves para keep-alive
 *
 * 30 rotas simples que retornam respostas rápidas para manter o servidor ativo.
 * Cada rota simula um endpoint diferente para parecer tráfego orgânico.
 */

const router = Router();

// Dados simulados para respostas variadas
const quotes = [
  "A jornada de mil milhas começa com um único passo.",
  "O conhecimento é a única coisa que ninguém pode tirar de você.",
  "Aprender é a única coisa da qual a mente nunca se cansa.",
  "A educação é a arma mais poderosa para mudar o mundo.",
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
];

const tips = [
  "Revise seus cards diariamente para melhor retenção.",
  "Use a técnica de repetição espaçada para memorizar melhor.",
  "Crie cards com perguntas específicas e diretas.",
  "Mantenha seu streak para ganhar bônus de XP.",
  "Complete a meta diária para desbloquear conquistas.",
];

const facts = [
  "O cérebro humano pode armazenar aproximadamente 2.5 petabytes de informação.",
  "Estudar antes de dormir melhora a consolidação da memória.",
  "A repetição espaçada pode aumentar a retenção em até 200%.",
  "Flashcards são usados há mais de 200 anos para aprendizado.",
  "O método Leitner foi criado em 1972 por Sebastian Leitner.",
];

// Helper para resposta padrão
const jsonResponse = (res: Response, data: object) => {
  res
    .status(200)
    .json({ success: true, timestamp: new Date().toISOString(), ...data });
};

// ===== ROTAS DE PING (30 rotas) =====

// 1-5: Status e Info
router.get("/status", (_req: Request, res: Response) => {
  jsonResponse(res, { status: "online", uptime: process.uptime() });
});

router.get("/ping", (_req: Request, res: Response) => {
  jsonResponse(res, { pong: true });
});

router.get("/heartbeat", (_req: Request, res: Response) => {
  jsonResponse(res, { beat: Date.now() });
});

router.get("/alive", (_req: Request, res: Response) => {
  jsonResponse(res, {
    alive: true,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

router.get("/version", (_req: Request, res: Response) => {
  jsonResponse(res, {
    version: "1.0.0",
    env: process.env.NODE_ENV || "development",
  });
});

// 6-10: Dados simulados
router.get("/quote", (_req: Request, res: Response) => {
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  jsonResponse(res, { quote });
});

router.get("/tip", (_req: Request, res: Response) => {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  jsonResponse(res, { tip });
});

router.get("/fact", (_req: Request, res: Response) => {
  const fact = facts[Math.floor(Math.random() * facts.length)];
  jsonResponse(res, { fact });
});

router.get("/random", (_req: Request, res: Response) => {
  jsonResponse(res, { number: Math.floor(Math.random() * 1000) });
});

router.get("/time", (_req: Request, res: Response) => {
  const now = new Date();
  jsonResponse(res, {
    iso: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    readable: now.toLocaleString("pt-BR"),
  });
});

// 11-15: Métricas simuladas
router.get("/stats", (_req: Request, res: Response) => {
  jsonResponse(res, {
    requests: Math.floor(Math.random() * 10000),
    users: Math.floor(Math.random() * 500),
  });
});

router.get("/metrics/cpu", (_req: Request, res: Response) => {
  jsonResponse(res, { cpu: Math.floor(Math.random() * 100) });
});

router.get("/metrics/memory", (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  jsonResponse(res, {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
  });
});

router.get("/metrics/latency", (_req: Request, res: Response) => {
  jsonResponse(res, { latency: Math.floor(Math.random() * 50) + 5 });
});

router.get("/metrics/uptime", (_req: Request, res: Response) => {
  jsonResponse(res, { uptime: Math.round(process.uptime()), unit: "seconds" });
});

// 16-20: Endpoints de "recursos"
router.get("/resources/cards", (_req: Request, res: Response) => {
  jsonResponse(res, { count: Math.floor(Math.random() * 5000) });
});

router.get("/resources/decks", (_req: Request, res: Response) => {
  jsonResponse(res, { count: Math.floor(Math.random() * 200) });
});

router.get("/resources/users", (_req: Request, res: Response) => {
  jsonResponse(res, { count: Math.floor(Math.random() * 1000) });
});

router.get("/resources/reviews", (_req: Request, res: Response) => {
  jsonResponse(res, { today: Math.floor(Math.random() * 500) });
});

router.get("/resources/achievements", (_req: Request, res: Response) => {
  jsonResponse(res, { total: 50, unlocked: Math.floor(Math.random() * 50) });
});

// 21-25: Endpoints de "configuração"
router.get("/config/limits", (_req: Request, res: Response) => {
  jsonResponse(res, { dailyGoal: 20, maxCards: 1000 });
});

router.get("/config/xp", (_req: Request, res: Response) => {
  jsonResponse(res, { easy: 20, good: 15, hard: 10, again: 5 });
});

router.get("/config/streaks", (_req: Request, res: Response) => {
  jsonResponse(res, { bonus7days: 200, bonus30days: 300 });
});

router.get("/config/tiers", (_req: Request, res: Response) => {
  jsonResponse(res, { tiers: ["bronze", "silver", "gold", "platinum"] });
});

router.get("/config/features", (_req: Request, res: Response) => {
  jsonResponse(res, {
    gamification: true,
    achievements: true,
    leaderboard: true,
  });
});

// 26-30: Endpoints diversos
router.get("/echo", (req: Request, res: Response) => {
  jsonResponse(res, { query: req.query, path: req.path });
});

router.get("/headers", (req: Request, res: Response) => {
  jsonResponse(res, { userAgent: req.headers["user-agent"] });
});

router.get("/debug/env", (_req: Request, res: Response) => {
  jsonResponse(res, { nodeEnv: process.env.NODE_ENV || "development" });
});

router.get("/debug/pid", (_req: Request, res: Response) => {
  jsonResponse(res, { pid: process.pid });
});

router.get("/ok", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

export default router;
