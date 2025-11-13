import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Formato customizado para logs
 */
const customFormat = printf(({ level, message, timestamp, stack }) => {
  if (stack) {
    return `${timestamp} [${level}]: ${message}\n${stack}`;
  }
  return `${timestamp} [${level}]: ${message}`;
});

/**
 * Logger configurado com Winston
 *
 * Níveis de log disponíveis:
 * - error: Erros críticos do sistema
 * - warn: Avisos importantes
 * - info: Informações gerais
 * - debug: Informações de debug (apenas em desenvolvimento)
 *
 * @example
 * logger.info('Usuário criado com sucesso', { userId: '123' });
 * logger.error('Erro ao processar XP', { error: err.message });
 * logger.debug('Verificando achievement', { achievementId: 'abc' });
 */
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }), // Captura stack traces
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  transports: [
    // Console - sempre ativo
    new winston.transports.Console({
      format: combine(colorize(), customFormat),
    }),
    // Arquivo de erros
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Arquivo combinado (todos os níveis)
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Não sair do processo em caso de erro não tratado
  exitOnError: false,
});

/**
 * Stream para integração com Morgan (HTTP request logging)
 */
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
