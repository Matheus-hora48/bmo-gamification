import { describe, it, expect, beforeEach, vi } from "vitest";
import { AchievementService } from "./achievement.service";
import { FirestoreService } from "./firestore.service";
import { XPService } from "./xp.service";
import {
  AchievementTier,
  AchievementType,
  type Achievement,
} from "../models/Achievement";
import type { UserAchievementProgress } from "../models/UserAchievement";
import { XPSource } from "../models/XPTransaction";
import type { UserProgress } from "../models/UserProgress";
import type { StreakData } from "../models/StreakData";

describe("AchievementService", () => {
  let service: AchievementService;
  let mockFirestore: FirestoreService;
  let mockXPService: XPService;

  const mockUserId = "user-123";

  const createMockAchievement = (
    id: string,
    type: AchievementType,
    target: number
  ): Achievement => ({
    id,
    name: `Achievement ${id}`,
    description: `Description for ${id}`,
    tier: AchievementTier.BRONZE,
    xpReward: 100,
    icon: "icon.png",
    condition: {
      type,
      target,
    },
    createdAt: new Date(),
  });

  beforeEach(() => {
    mockFirestore = {
      getAllAchievements: vi.fn(),
      getUserAchievements: vi.fn(),
      getAchievement: vi.fn(),
      getUserAchievementProgress: vi.fn(),
      unlockAchievement: vi.fn(),
      updateAchievementProgress: vi.fn(),
      countXPTransactionsBySource: vi.fn(),
      getUserProgress: vi.fn(),
      getStreakData: vi.fn(),
    } as unknown as FirestoreService;

    mockXPService = {
      addXP: vi.fn(),
    } as unknown as XPService;

    service = new AchievementService(mockFirestore, mockXPService);
  });

  describe("checkAchievements", () => {
    it("deve retornar conquistas desbloqueadas", async () => {
      const achievement1 = createMockAchievement(
        "cards_5",
        AchievementType.CARDS_CREATED,
        5
      );
      const achievement2 = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "getAllAchievements").mockResolvedValue([
        achievement1,
        achievement2,
      ]);
      vi.spyOn(mockFirestore, "getUserAchievements").mockResolvedValue([]);
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        7
      );
      vi.spyOn(mockFirestore, "getAchievement").mockImplementation(
        async (id: string) => {
          if (id === "cards_5") return achievement1;
          return achievement2;
        }
      );
      vi.spyOn(mockFirestore, "unlockAchievement").mockResolvedValue(
        {} as UserAchievementProgress
      );
      vi.spyOn(mockXPService, "addXP").mockResolvedValue({
        userProgress: {} as UserProgress,
        levelUpInfo: {
          leveledUp: false,
          oldLevel: 1,
          newLevel: 1,
          levelsGained: 0,
        },
      });

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("cards_5");
      expect(mockFirestore.unlockAchievement).toHaveBeenCalledWith(
        mockUserId,
        "cards_5"
      );
    });

    it("deve filtrar por tipos específicos de conquistas", async () => {
      const streakAchievement = createMockAchievement(
        "streak_7",
        AchievementType.STREAK,
        7
      );
      const cardsAchievement = createMockAchievement(
        "cards_5",
        AchievementType.CARDS_CREATED,
        5
      );

      vi.spyOn(mockFirestore, "getAllAchievements").mockResolvedValue([
        streakAchievement,
        cardsAchievement,
      ]);
      vi.spyOn(mockFirestore, "getUserAchievements").mockResolvedValue([]);
      vi.spyOn(mockFirestore, "getStreakData").mockResolvedValue({
        userId: mockUserId,
        current: 10,
        longest: 10,
        lastUpdate: new Date(),
        history: [],
      } as StreakData);
      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(
        streakAchievement
      );
      vi.spyOn(mockFirestore, "unlockAchievement").mockResolvedValue(
        {} as UserAchievementProgress
      );
      vi.spyOn(mockXPService, "addXP").mockResolvedValue({
        userProgress: {} as UserProgress,
        levelUpInfo: {
          leveledUp: false,
          oldLevel: 1,
          newLevel: 1,
          levelsGained: 0,
        },
      });

      const result = await service.checkAchievements(mockUserId, [
        AchievementType.STREAK,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("streak_7");
    });

    it("não deve desbloquear conquistas já desbloqueadas", async () => {
      const achievement = createMockAchievement(
        "cards_5",
        AchievementType.CARDS_CREATED,
        5
      );

      vi.spyOn(mockFirestore, "getAllAchievements").mockResolvedValue([
        achievement,
      ]);
      vi.spyOn(mockFirestore, "getUserAchievements").mockResolvedValue([
        {
          userId: mockUserId,
          achievementId: "cards_5",
          unlockedAt: new Date(),
          progress: 100,
          claimed: true,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.checkAchievements(mockUserId);

      expect(result).toHaveLength(0);
      expect(mockFirestore.unlockAchievement).not.toHaveBeenCalled();
    });
  });

  describe("checkAchievement", () => {
    it("deve verificar conquista de cards criados corretamente", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        15
      );

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(true);
      expect(mockFirestore.countXPTransactionsBySource).toHaveBeenCalledWith(
        mockUserId,
        XPSource.CARD_CREATION
      );
    });

    it("deve verificar conquista de reviews completados", async () => {
      const achievement = createMockAchievement(
        "reviews_100",
        AchievementType.REVIEWS_COMPLETED,
        100
      );

      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        50
      );

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(false);
    });

    it("deve verificar conquista de streak", async () => {
      const achievement = createMockAchievement(
        "streak_7",
        AchievementType.STREAK,
        7
      );

      vi.spyOn(mockFirestore, "getStreakData").mockResolvedValue({
        userId: mockUserId,
        current: 10,
        longest: 10,
        lastUpdate: new Date(),
        history: [],
      } as StreakData);

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(true);
    });

    it("deve verificar conquista de decks criados", async () => {
      const achievement = createMockAchievement(
        "decks_5",
        AchievementType.DECK_CREATED,
        5
      );

      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        3
      );

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(false);
    });

    it("deve verificar conquista de metas diárias", async () => {
      const achievement = createMockAchievement(
        "daily_goal_15",
        AchievementType.DAILY_GOAL,
        15
      );

      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        20
      );

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(true);
    });

    it("deve verificar conquista de XP total", async () => {
      const achievement = createMockAchievement(
        "xp_1000",
        AchievementType.XP_TOTAL,
        1000
      );

      vi.spyOn(mockFirestore, "getUserProgress").mockResolvedValue({
        userId: mockUserId,
        level: 5,
        currentXP: 500,
        totalXP: 1500,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(true);
    });

    it("deve verificar conquista de nível alcançado", async () => {
      const achievement = createMockAchievement(
        "level_10",
        AchievementType.LEVEL_REACHED,
        10
      );

      vi.spyOn(mockFirestore, "getUserProgress").mockResolvedValue({
        userId: mockUserId,
        level: 8,
        currentXP: 500,
        totalXP: 1500,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(false);
    });

    it("deve retornar false para tipo de conquista não suportado", async () => {
      const achievement = createMockAchievement(
        "custom",
        AchievementType.CUSTOM,
        100
      );

      const result = await service.checkAchievement(mockUserId, achievement);

      expect(result).toBe(false);
    });
  });

  describe("unlockAchievement", () => {
    it("deve desbloquear conquista e conceder XP", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );
      achievement.xpReward = 150;

      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(achievement);
      vi.spyOn(mockFirestore, "getUserAchievementProgress").mockResolvedValue(
        null
      );
      vi.spyOn(mockFirestore, "unlockAchievement").mockResolvedValue(
        {} as UserAchievementProgress
      );
      vi.spyOn(mockXPService, "addXP").mockResolvedValue({
        userProgress: {} as UserProgress,
        levelUpInfo: {
          leveledUp: false,
          oldLevel: 1,
          newLevel: 1,
          levelsGained: 0,
        },
      });

      await service.unlockAchievement(mockUserId, "cards_10");

      expect(mockFirestore.unlockAchievement).toHaveBeenCalledWith(
        mockUserId,
        "cards_10"
      );
      expect(mockXPService.addXP).toHaveBeenCalledWith(
        mockUserId,
        150,
        XPSource.ACHIEVEMENT,
        "cards_10"
      );
    });

    it("não deve desbloquear se já está desbloqueada", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(achievement);
      vi.spyOn(mockFirestore, "getUserAchievementProgress").mockResolvedValue({
        userId: mockUserId,
        achievementId: "cards_10",
        unlockedAt: new Date(),
        progress: 100,
        claimed: true,
        updatedAt: new Date(),
      });

      await service.unlockAchievement(mockUserId, "cards_10");

      expect(mockFirestore.unlockAchievement).not.toHaveBeenCalled();
      expect(mockXPService.addXP).not.toHaveBeenCalled();
    });

    it("deve lançar erro se conquista não existe", async () => {
      vi.spyOn(mockFirestore, "getAchievement").mockRejectedValue(
        new Error('Conquista "invalid" não encontrada.')
      );

      await expect(
        service.unlockAchievement(mockUserId, "invalid")
      ).rejects.toThrow('Conquista "invalid" não encontrada.');
    });
  });

  describe("getUserProgress", () => {
    it("deve calcular progresso corretamente para cards criados", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(achievement);
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        5
      );

      const progress = await service.getUserProgress(mockUserId, "cards_10");

      expect(progress).toBe(50); // 5/10 = 50%
    });

    it("deve limitar progresso a 100%", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(achievement);
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        15
      );

      const progress = await service.getUserProgress(mockUserId, "cards_10");

      expect(progress).toBe(100); // Máximo 100%
    });

    it("deve retornar 0 se conquista não existe", async () => {
      vi.spyOn(mockFirestore, "getAchievement").mockRejectedValue(
        new Error('Conquista "invalid" não encontrada.')
      );

      await expect(
        service.getUserProgress(mockUserId, "invalid")
      ).rejects.toThrow('Conquista "invalid" não encontrada.');
    });
  });

  describe("Verificadores específicos", () => {
    it("checkCardsCreated deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        10
      );

      const result = await service.checkCardsCreated(mockUserId, 10);

      expect(result).toBe(true);
      expect(mockFirestore.countXPTransactionsBySource).toHaveBeenCalledWith(
        mockUserId,
        XPSource.CARD_CREATION
      );
    });

    it("checkReviewsCompleted deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        50
      );

      const result = await service.checkReviewsCompleted(mockUserId, 100);

      expect(result).toBe(false);
    });

    it("checkStreak deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "getStreakData").mockResolvedValue({
        userId: mockUserId,
        current: 7,
        longest: 10,
        lastUpdate: new Date(),
        history: [],
      } as StreakData);

      const result = await service.checkStreak(mockUserId, 7);

      expect(result).toBe(true);
    });

    it("checkStreak deve retornar false se streak não existe", async () => {
      vi.spyOn(mockFirestore, "getStreakData").mockRejectedValue(
        new Error("Streak não encontrado")
      );

      const result = await service.checkStreak(mockUserId, 7);

      expect(result).toBe(false);
    });

    it("checkDecksCreated deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        3
      );

      const result = await service.checkDecksCreated(mockUserId, 5);

      expect(result).toBe(false);
    });

    it("checkDailyGoalsCompleted deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        20
      );

      const result = await service.checkDailyGoalsCompleted(mockUserId, 15);

      expect(result).toBe(true);
    });

    it("checkTotalXP deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "getUserProgress").mockResolvedValue({
        userId: mockUserId,
        level: 5,
        currentXP: 500,
        totalXP: 2500,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkTotalXP(mockUserId, 2000);

      expect(result).toBe(true);
    });

    it("checkLevelReached deve verificar corretamente", async () => {
      vi.spyOn(mockFirestore, "getUserProgress").mockResolvedValue({
        userId: mockUserId,
        level: 10,
        currentXP: 500,
        totalXP: 2500,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkLevelReached(mockUserId, 10);

      expect(result).toBe(true);
    });
  });

  describe("updateAchievementProgress", () => {
    it("deve atualizar o progresso da conquista", async () => {
      const achievement = createMockAchievement(
        "cards_10",
        AchievementType.CARDS_CREATED,
        10
      );

      vi.spyOn(mockFirestore, "getAchievement").mockResolvedValue(achievement);
      vi.spyOn(mockFirestore, "countXPTransactionsBySource").mockResolvedValue(
        7
      );
      vi.spyOn(mockFirestore, "updateAchievementProgress").mockResolvedValue(
        {} as UserAchievementProgress
      );

      await service.updateAchievementProgress(mockUserId, "cards_10");

      expect(mockFirestore.updateAchievementProgress).toHaveBeenCalledWith(
        mockUserId,
        "cards_10",
        { progress: 70 }
      );
    });
  });
});
