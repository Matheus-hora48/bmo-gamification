import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV_VAR = "GAMIFICATION_API_TOKEN" as const;

const apiToken = process.env[REQUIRED_ENV_VAR]?.trim();

if (!apiToken) {
  throw new Error(
    `Variável de ambiente ${REQUIRED_ENV_VAR} não definida. ` +
      "Configure o token de acesso em um arquivo .env ou no ambiente de execução."
  );
}

export const authConfig = {
  token: apiToken,
  headerName: "x-api-token",
  authorizationHeader: "authorization",
  bearerPrefix: "Bearer ",
} as const;

export type AuthConfig = typeof authConfig;
