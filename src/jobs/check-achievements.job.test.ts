import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeCheckAchievements } from "./check-achievements.job";
import { AchievementService } from "../services/achievement.service";
import { FirestoreService } from "../services/firestore.service";
import type { Achievement } from "../models/Achievement";
import { AchievementType, AchievementTier } from "../models/Achievement";

// Mock do logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock do AchievementService
vi.mock("../services/achievement.service", () => {
  const AchievementService = vi.fn();
  AchievementService.prototype.checkAchievements = vi.fn();
  return { AchievementService };
});

// Mock do FirestoreService
vi.mock("../services/firestore.service", () => {
  const FirestoreService = vi.fn();
  FirestoreService.prototype.getAllUserIds = vi.fn();
  return { FirestoreService };
});

describe("Check Achievements Job", () => {
  let mockCheckAchievements: ReturnType<typeof vi.fn>;
  let mockGetAllUserIds: ReturnType<typeof vi.fn>;

  const mockAchievement1: Achievement = {
    id: "achievement1",
    name: "Primeira Revisão",
    description: "Complete sua primeira revisão",
    icon: "🎯",
    xpReward: 50,
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 1,
    },
    tier: AchievementTier.BRONZE,
    createdAt: new Date(),
  };

  const mockAchievement2: Achievement = {
    id: "achievement2",
    name: "10 Cards Criados",
    description: "Crie 10 cards",
    icon: "📝",
    xpReward: 100,
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 10,
    },
    tier: AchievementTier.SILVER,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAchievements = vi.fn();
    mockGetAllUserIds = vi.fn();
    (AchievementService as any).prototype.checkAchievements =
      mockCheckAchievements;
    (FirestoreService as any).prototype.getAllUserIds = mockGetAllUserIds;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("executeCheckAchievements", () => {
    it("deve executar verificação de conquistas com sucesso", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3"]);
      mockCheckAchievements.mockResolvedValue([]);

      // Act
      await executeCheckAchievements();

      // Assert
      expect(mockGetAllUserIds).toHaveBeenCalledTimes(1);
      expect(mockCheckAchievements).toHaveBeenCalledTimes(3);
      expect(mockCheckAchievements).toHaveBeenCalledWith("user1");
      expect(mockCheckAchievements).toHaveBeenCalledWith("user2");
      expect(mockCheckAchievements).toHaveBeenCalledWith("user3");
    });

    it("deve registrar logs de início e total de usuários", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3", "user4"]);
      mockCheckAchievements.mockResolvedValue([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "🏆 [CRON] Iniciando verificação de conquistas..."
      );
      expect(logger.info).toHaveBeenCalledWith(
        "📊 [CRON] Total de usuários a processar: 4"
      );
    });

    it("deve registrar logs de sucesso quando não houver conquistas desbloqueadas", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2"]);
      mockCheckAchievements.mockResolvedValue([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 2,
          totalUnlocked: 0,
          errors: 0,
        })
      );
    });

    it("deve registrar logs de conquistas desbloqueadas", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2"]);
      mockCheckAchievements
        .mockResolvedValueOnce([mockAchievement1, mockAchievement2])
        .mockResolvedValueOnce([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✨ [CRON] Usuário user1 desbloqueou 2 conquista(s):",
        expect.objectContaining({
          achievements: ["Primeira Revisão", "10 Cards Criados"],
        })
      );
    });

    it("deve contar total de conquistas desbloqueadas corretamente", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3"]);
      mockCheckAchievements
        .mockResolvedValueOnce([mockAchievement1])
        .mockResolvedValueOnce([mockAchievement1, mockAchievement2])
        .mockResolvedValueOnce([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 3,
          totalUnlocked: 3, // 1 + 2 + 0 = 3
          errors: 0,
        })
      );
    });

    it("deve continuar processamento mesmo com erro em um usuário", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3"]);
      mockCheckAchievements
        .mockResolvedValueOnce([mockAchievement1])
        .mockRejectedValueOnce(new Error("Erro no Firestore"))
        .mockResolvedValueOnce([mockAchievement2]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(mockCheckAchievements).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "❌ [CRON] Erro ao verificar conquistas do usuário user2"
        )
      );
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 3,
          totalUnlocked: 2, // user1: 1, user2: erro, user3: 1
          errors: 1,
        })
      );
    });

    it("deve registrar warnings quando houver erros", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3"]);
      mockCheckAchievements
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("Erro 1"))
        .mockRejectedValueOnce(new Error("Erro 2"));

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ [CRON] Verificação de conquistas concluída com 2 erro(s)",
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.stringContaining("user2"),
            expect.stringContaining("user3"),
          ]),
        })
      );
    });

    it("deve limitar erros no log a 10 primeiros", async () => {
      // Arrange
      const userIds = Array.from({ length: 15 }, (_, i) => `user${i}`);
      mockGetAllUserIds.mockResolvedValue(userIds);
      mockCheckAchievements.mockRejectedValue(new Error("Erro genérico"));

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "⚠️ [CRON] Verificação de conquistas concluída com 15 erro(s)",
        expect.objectContaining({
          errors: expect.arrayContaining([expect.any(String)]),
        })
      );

      // Verificar que foram logados apenas 10 erros
      const warnCall = (logger.warn as any).mock.calls.find((call: any) =>
        call[0].includes("15 erro(s)")
      );
      expect(warnCall[1].errors).toHaveLength(10);
    });

    it("deve lançar erro crítico quando getAllUserIds falhar", async () => {
      // Arrange
      const mockError = new Error("Erro crítico no Firestore");
      mockGetAllUserIds.mockRejectedValue(mockError);

      const { logger } = await import("../utils/logger");

      // Act & Assert
      await expect(executeCheckAchievements()).rejects.toThrow(
        "Erro crítico no Firestore"
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("🔥 [CRON]"),
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it("deve registrar duração da execução", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1", "user2"]);
      mockCheckAchievements.mockResolvedValue([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          duration: expect.stringMatching(/^\d+ms$/),
        })
      );
    });

    it("deve processar lista vazia de usuários sem erro", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue([]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(mockCheckAchievements).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "📊 [CRON] Total de usuários a processar: 0"
      );
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 0,
          totalUnlocked: 0,
          errors: 0,
        })
      );
    });

    it("deve processar múltiplas conquistas para múltiplos usuários", async () => {
      // Arrange
      const achievement3: Achievement = {
        id: "achievement3",
        name: "Streak 7 Dias",
        description: "Mantenha 7 dias consecutivos",
        icon: "🔥",
        xpReward: 200,
        condition: {
          type: AchievementType.STREAK,
          target: 7,
        },
        tier: AchievementTier.GOLD,
        createdAt: new Date(),
      };

      mockGetAllUserIds.mockResolvedValue(["user1", "user2", "user3", "user4"]);
      mockCheckAchievements
        .mockResolvedValueOnce([mockAchievement1, mockAchievement2])
        .mockResolvedValueOnce([achievement3])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockAchievement1]);

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "✅ [CRON] Verificação de conquistas concluída com sucesso",
        expect.objectContaining({
          totalProcessed: 4,
          totalUnlocked: 4, // 2 + 1 + 0 + 1 = 4
          errors: 0,
        })
      );
    });

    it("deve tratar erros com mensagem de erro personalizada", async () => {
      // Arrange
      mockGetAllUserIds.mockResolvedValue(["user1"]);
      mockCheckAchievements.mockRejectedValue("String de erro");

      const { logger } = await import("../utils/logger");

      // Act
      await executeCheckAchievements();

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("String de erro")
      );
    });
  });
});
