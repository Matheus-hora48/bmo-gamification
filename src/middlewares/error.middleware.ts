import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

/**
 * Interface para erros customizados da aplicação
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware global de tratamento de erros
 *
 * Captura todos os erros não tratados nas rotas e controllers
 * e retorna uma resposta JSON padronizada
 *
 * Tipos de erros tratados:
 * - AppError: Erros customizados da aplicação
 * - ZodError: Erros de validação do Zod
 * - Error: Erros genéricos do Node.js
 *
 * @example
 * // No app.ts
 * app.use(errorMiddleware);
 */
export const errorMiddleware = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Log do erro
  logger.error(`Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
    body: req.body,
  });

  // Erro de validação Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Erro customizado da aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Erro genérico não tratado
  return res.status(500).json({
    success: false,
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      message: err.message,
      stack: err.stack,
    }),
  });
};

/**
 * Middleware para tratar rotas não encontradas (404)
 */
export const notFoundMiddleware = (
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);

  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
  });
};
