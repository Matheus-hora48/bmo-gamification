import cron from "node-cron";

/**
 * Keep-Alive Job
 *
 * Mantém o servidor ativo fazendo self-ping em intervalos aleatórios.
 * Render desliga serviços gratuitos após 15 minutos de inatividade.
 *
 * Usa intervalos randomizados (3-14 min) para simular tráfego orgânico.
 */

const MIN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
const MAX_INTERVAL_MS = 14 * 60 * 1000; // 14 minutos

/**
 * Gera um intervalo aleatório entre MIN e MAX
 */
function getRandomInterval(): number {
  return Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)) + MIN_INTERVAL_MS;
}

/**
 * Faz ping para o próprio servidor
 */
async function selfPing(): Promise<void> {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVICE_URL;

  if (!serviceUrl) {
    return;
  }

  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HealthCheck/1.0)",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
      },
    });

    if (response.ok) {
      // Log discreto
      const nextInterval = getRandomInterval();
      console.log(`[HC] OK ${new Date().toLocaleTimeString("pt-BR")} - next: ${Math.round(nextInterval / 60000)}min`);
      scheduleNextPing(nextInterval);
    } else {
      console.warn(`[HC] Status ${response.status}`);
      scheduleNextPing(getRandomInterval());
    }
  } catch (error) {
    console.error(`[HC] Erro:`, error instanceof Error ? error.message : error);
    // Tentar novamente em intervalo menor se falhar
    scheduleNextPing(MIN_INTERVAL_MS);
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
    console.log("[HC] URL não configurada - desabilitado");
    return;
  }

  // Primeiro ping entre 30s e 2min após startup (variado)
  const initialDelay = Math.floor(Math.random() * 90000) + 30000;
  
  console.log(`[HC] Iniciando em ${Math.round(initialDelay / 1000)}s`);
  
  setTimeout(selfPing, initialDelay);
}

export default scheduleKeepAlive;
