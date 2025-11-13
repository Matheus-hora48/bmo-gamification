import rateLimit from "express-rate-limit";

/**
 * Rate Limiter Middleware
 *
 * Limita o número de requisições por IP para prevenir abuso da API
 * - Janela de 15 minutos
 * - Máximo de 100 requisições por janela
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por janela
  message: {
    success: false,
    error: "Muitas requisições deste IP. Tente novamente mais tarde.",
  },
  standardHeaders: true, // Retorna info de rate limit nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  // Pula rate limit para requisições de desenvolvimento (opcional)
  skip: (req) => {
    // Descomente a linha abaixo para pular rate limit em desenvolvimento
    // return process.env.NODE_ENV === 'development';
    return false;
  },
});
