import type { Request, RequestHandler } from "express";
import { authConfig } from "../config/auth.config";

function extractHeaderToken(request: Request): string | undefined {
  const headerToken = request.get(authConfig.headerName);

  if (headerToken?.trim()) {
    return headerToken.trim();
  }

  const authorizationHeader = request.get(authConfig.authorizationHeader);

  if (!authorizationHeader) {
    return undefined;
  }

  const normalized = authorizationHeader.trim();

  if (
    !normalized.toLowerCase().startsWith(authConfig.bearerPrefix.toLowerCase())
  ) {
    return undefined;
  }

  const [, rawToken] = normalized.split(/\s+/, 2);
  return rawToken?.trim() || undefined;
}

export const authMiddleware: RequestHandler = (request, response, next) => {
  const providedToken = extractHeaderToken(request);

  if (!providedToken) {
    return response.status(401).json({
      success: false,
      error: "Token de autenticação ausente.",
    });
  }

  if (providedToken !== authConfig.token) {
    return response.status(401).json({
      success: false,
      error: "Token de autenticação inválido.",
    });
  }

  return next();
};
