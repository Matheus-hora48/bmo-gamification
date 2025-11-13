import { z } from "zod";
import { AchievementType } from "../models/Achievement";

/**
 * Schemas de validação Zod para endpoints de gamificação
 */

/**
 * Valida dificuldade de revisão de card
 */
export const ReviewDifficultySchema = z.enum(
  ["again", "hard", "good", "easy"],
  {
    message:
      "Dificuldade inválida. Valores permitidos: 'again', 'hard', 'good', 'easy'",
  }
);

/**
 * Schema para processo de revisão de card
 * POST /process-review
 */
export const ProcessReviewSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "ID do usuário é obrigatório")
    .max(128, "ID do usuário muito longo"),
  cardId: z
    .string()
    .trim()
    .min(1, "ID do card é obrigatório")
    .max(128, "ID do card muito longo"),
  difficulty: ReviewDifficultySchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
    .optional(),
});

/**
 * Schema para criação de card
 * POST /card-created
 */
export const CardCreatedSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "ID do usuário é obrigatório")
    .max(128, "ID do usuário muito longo"),
  cardId: z
    .string()
    .trim()
    .min(1, "ID do card é obrigatório")
    .max(128, "ID do card muito longo"),
  deckId: z
    .string()
    .trim()
    .min(1, "ID do deck é obrigatório")
    .max(128, "ID do deck muito longo")
    .optional(),
});

/**
 * Schema para criação de deck
 * POST /deck-created
 */
export const DeckCreatedSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "ID do usuário é obrigatório")
    .max(128, "ID do usuário muito longo"),
  deckId: z
    .string()
    .trim()
    .min(1, "ID do deck é obrigatório")
    .max(128, "ID do deck muito longo"),
  deckName: z
    .string()
    .trim()
    .min(1, "Nome do deck é obrigatório")
    .max(256, "Nome do deck muito longo")
    .optional(),
});

/**
 * Schema para parâmetro userId em rotas
 * GET /progress/:userId
 * GET /daily-progress/:userId
 * GET /achievements/:userId
 * POST /check-achievements/:userId
 */
export const UserIdParamSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, "ID do usuário é obrigatório")
    .max(128, "ID do usuário muito longo"),
});

/**
 * Schema para query params de progresso diário
 * GET /daily-progress/:userId?date=YYYY-MM-DD
 */
export const DailyProgressQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
    .optional(),
});

/**
 * Schema para forçar verificação de conquistas
 * POST /check-achievements/:userId
 */
export const CheckAchievementsSchema = z.object({
  types: z
    .array(z.nativeEnum(AchievementType))
    .optional()
    .describe("Tipos específicos de conquistas a verificar (opcional)"),
});

/**
 * Tipo inferido para processo de revisão
 */
export type ProcessReviewInput = z.infer<typeof ProcessReviewSchema>;

/**
 * Tipo inferido para criação de card
 */
export type CardCreatedInput = z.infer<typeof CardCreatedSchema>;

/**
 * Tipo inferido para criação de deck
 */
export type DeckCreatedInput = z.infer<typeof DeckCreatedSchema>;

/**
 * Tipo inferido para parâmetro userId
 */
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

/**
 * Tipo inferido para query params de progresso diário
 */
export type DailyProgressQuery = z.infer<typeof DailyProgressQuerySchema>;

/**
 * Tipo inferido para verificação de conquistas
 */
export type CheckAchievementsInput = z.infer<typeof CheckAchievementsSchema>;

/**
 * Helper para validar dados com Zod e retornar erro formatado
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((err) => err.message).join(", ");
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}
