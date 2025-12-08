import cron from "node-cron";

/**
 * Keep-Alive Job - Sistema Avançado
 *
 * Mantém o servidor ativo fazendo self-ping em intervalos aleatórios.
 * Render desliga serviços gratuitos após 15 minutos de inatividade.
 *
 * Features:
 * - Alterna entre múltiplas rotas para simular tráfego real
 * - Intervalos randomizados (3-14 min) para parecer orgânico
 * - Varia User-Agents para evitar detecção
 * - Retry com backoff em caso de falha
 */

const MIN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const MAX_INTERVAL_MS = 14 * 60 * 1000; // 14 minutos

/**
 * Lista de rotas para alternar (GET endpoints)
 * 30 rotas + health = 31 rotas totais
 */
const PING_ROUTES = [
  // Rotas básicas
  "/health",
  "/ping/status",
  "/ping/ping",
  "/ping/heartbeat",
  "/ping/alive",
  "/ping/version",
  // Dados simulados
  "/ping/quote",
  "/ping/tip",
  "/ping/fact",
  "/ping/random",
  "/ping/time",
  // Métricas
  "/ping/stats",
  "/ping/metrics/cpu",
  "/ping/metrics/memory",
  "/ping/metrics/latency",
  "/ping/metrics/uptime",
  // Recursos
  "/ping/resources/cards",
  "/ping/resources/decks",
  "/ping/resources/users",
  "/ping/resources/reviews",
  "/ping/resources/achievements",
  // Configuração
  "/ping/config/limits",
  "/ping/config/xp",
  "/ping/config/streaks",
  "/ping/config/tiers",
  "/ping/config/features",
  // Diversos
  "/ping/echo",
  "/ping/headers",
  "/ping/debug/env",
  "/ping/debug/pid",
  "/ping/ok",
];

/**
 * Lista de User-Agents para variar
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (compatible; HealthCheck/1.0)",
];

let currentRouteIndex = 0;
let consecutiveFailures = 0;

/**
 * Gera um intervalo aleatório entre MIN e MAX
 */
function getRandomInterval(): number {
  return (
    Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)) +
    MIN_INTERVAL_MS
  );
}

/**
 * Retorna a próxima rota a ser pingada (round-robin)
 */
function getNextRoute(): string {
  const route = PING_ROUTES[currentRouteIndex];
  currentRouteIndex = (currentRouteIndex + 1) % PING_ROUTES.length;
  return route ?? "/health";
}

/**
 * Retorna um User-Agent aleatório
 */
function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index] ?? USER_AGENTS[0] ?? "HealthCheck/1.0";
}

/**
 * Faz ping para o próprio servidor alternando rotas
 */
async function selfPing(): Promise<void> {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVICE_URL;

  if (!serviceUrl) {
    return;
  }

  const route = getNextRoute();
  const userAgent = getRandomUserAgent();
  const fullUrl = `${serviceUrl}${route}`;

  try {
    const startTime = Date.now();
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json, text/html, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      consecutiveFailures = 0;
      const nextInterval = getRandomInterval();
      console.log(
        `[KC] ✓ ${route} (${duration}ms) - próximo: ${Math.round(nextInterval / 60000)}min`
      );
      scheduleNextPing(nextInterval);
    } else {
      consecutiveFailures++;
      console.warn(`[KC] ⚠ ${route} - Status ${response.status}`);
      // Intervalo menor após falha
      scheduleNextPing(Math.min(getRandomInterval(), 5 * 60 * 1000));
    }
  } catch (error) {
    consecutiveFailures++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[KC] ✗ ${route} - Erro: ${errorMsg}`);

    // Backoff exponencial: 1min, 2min, 4min, max 8min
    const backoffMs = Math.min(
      60000 * Math.pow(2, consecutiveFailures - 1),
      8 * 60 * 1000
    );
    console.log(
      `[KC] Retry em ${Math.round(backoffMs / 60000)}min (tentativa ${consecutiveFailures})`
    );
    scheduleNextPing(backoffMs);
  }
}

/**
 * Agenda o próximo ping com intervalo dinâmico
 */
function scheduleNextPing(intervalMs: number): void {
  setTimeout(selfPing, intervalMs);
}

/**
 * Inicia o sistema de keep-alive com intervalos aleatórios
 */
export function scheduleKeepAlive(): void {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVICE_URL;

  if (!serviceUrl) {
    console.log("[KC] ⚠ URL não configurada - keep-alive desabilitado");
    return;
  }

  // Primeiro ping entre 30s e 2min após startup (variado)
  const initialDelay = Math.floor(Math.random() * 90000) + 30000;

  console.log(
    `[KC] 🚀 Keep-alive iniciando em ${Math.round(initialDelay / 1000)}s`
  );
  console.log(`[KC] 📍 Rotas: ${PING_ROUTES.join(", ")}`);
  console.log(`[KC] 🔗 URL: ${serviceUrl}`);

  setTimeout(selfPing, initialDelay);
}

export default scheduleKeepAlive;
