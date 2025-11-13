import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeUpdateStreaks } from "./update-streaks.job";
import { StreakService } from "../services/streak.service";

// Mock do logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock do StreakService
vi.mock("../services/streak.service", () => {
  const StreakService = vi.fn();
  StreakService.prototype.updateAllStreaks = vi.fn();
  return { StreakService };
});

describe("Update Streaks Job", () => {
  let mockUpdateAllStreaks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateAllStreaks = vi.fn();
    (StreakService as any).prototype.updateAllStreaks = mockUpdateAllStreaks;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("executeUpdateStreaks", () => {
    it("deve executar atualização de streaks com sucesso", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 10,
        incremented: 7,
        reset: 3,
        errors: [],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(mockUpdateAllStreaks).toHaveBeenCalledTimes(1);
    });

    it("deve registrar logs de sucesso quando não houver erros", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 5,
        incremented: 4,
        reset: 1,
        errors: [],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "🔥 [CRON] Iniciando atualização de streaks..."
      );
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Atualização de streaks concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 5,
          incremented: 4,
          reset: 1,
          errors: 0,
        })
      );
    });

    it("deve registrar warnings quando houver erros parciais", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 10,
        incremented: 7,
        reset: 2,
        errors: ["Erro no usuário 1", "Erro no usuário 2"],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ [CRON] Atualização de streaks concluída com 2 erro(s)",
        expect.objectContaining({
          errors: ["Erro no usuário 1", "Erro no usuário 2"],
        })
      );
    });

    it("deve lançar erro quando updateAllStreaks falhar", async () => {
      // Arrange
      const mockError = new Error("Erro crítico no Firestore");
      mockUpdateAllStreaks.mockRejectedValue(mockError);

      const { logger } = await import("../utils/logger");

      // Act & Assert
      await expect(executeUpdateStreaks()).rejects.toThrow(
        "Erro crítico no Firestore"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "❌ [CRON] Erro crítico ao atualizar streaks",
        expect.objectContaining({
          error: "Erro crítico no Firestore",
        })
      );
    });

    it("deve registrar estatísticas detalhadas em debug", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 100,
        incremented: 85,
        reset: 15,
        errors: [],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        "[CRON] Estatísticas detalhadas da atualização de streaks:",
        expect.objectContaining({
          totalUsuarios: 100,
          streaksIncrementados: 85,
          streaksResetados: 15,
          percentualSucesso: 100,
        })
      );
    });

    it("deve calcular percentual de sucesso corretamente com erros", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 10,
        incremented: 7,
        reset: 1,
        errors: ["Erro 1", "Erro 2"],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        "[CRON] Estatísticas detalhadas da atualização de streaks:",
        expect.objectContaining({
          percentualSucesso: 80, // (10 - 2) / 10 * 100 = 80%
        })
      );
    });

    it("deve retornar 100% de sucesso quando não houver usuários processados", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 0,
        incremented: 0,
        reset: 0,
        errors: [],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        "[CRON] Estatísticas detalhadas da atualização de streaks:",
        expect.objectContaining({
          percentualSucesso: 100,
        })
      );
    });

    it("deve registrar duração da execução", async () => {
      // Arrange
      const mockResult = {
        totalProcessed: 5,
        incremented: 5,
        reset: 0,
        errors: [],
      };
      mockUpdateAllStreaks.mockResolvedValue(mockResult);

      const { logger } = await import("../utils/logger");

      // Act
      await executeUpdateStreaks();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Atualização de streaks concluída com sucesso",
        expect.objectContaining({
          duration: expect.stringMatching(/^\d+ms$/),
        })
      );
    });
  });
});
