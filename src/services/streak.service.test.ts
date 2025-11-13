import { beforeEach, describe, expect, it, vi } from "vitest";
import { XP_VALUES } from "../config/constants";
import type { StreakData } from "../models/StreakData";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import type { FirestoreService } from "./firestore.service";
import { StreakService } from "./streak.service";
import type { XPService } from "./xp.service";

describe("StreakService", () => {
  let service: StreakService;
  let mockFirestore: FirestoreService;
  let mockXpService: XPService;

  beforeEach(() => {
    // Mock FirestoreService
    mockFirestore = {
      getStreakData: vi.fn(),
      updateStreak: vi.fn(),
      getUserProgress: vi.fn(),
      updateUserProgress: vi.fn(),
      getDailyProgress: vi.fn(),
    } as unknown as FirestoreService;

    // Mock XPService
    mockXpService = {
      addXP: vi.fn(),
    } as unknown as XPService;

    service = new StreakService(mockFirestore, mockXpService);
  });

  describe("incrementStreak", () => {
    it("deve incrementar o streak do usuário", async () => {
      const userId = "user-123";
      const currentStreakData: StreakData = {
        userId,
        current: 5,
        longest: 10,
        lastUpdate: new Date("2025-11-10"),
        history: [
          { date: "2025-11-09", count: 4 },
          { date: "2025-11-10", count: 5 },
        ],
      };

      const updatedStreakData: StreakData = {
        userId,
        current: 6,
        longest: 10,
        lastUpdate: new Date(),
        history: [
          { date: "2025-11-09", count: 4 },
          { date: "2025-11-10", count: 5 },
          { date: expect.any(String), count: 6 },
        ],
      };

      vi.mocked(mockFirestore.getStreakData).mockResolvedValue(
        currentStreakData
      );
      vi.mocked(mockFirestore.updateStreak).mockResolvedValue(
        updatedStreakData
      );
      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue({
        userId,
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.incrementStreak(userId);

      expect(result.streakData.current).toBe(6);
      expect(result.bonusAwarded).toBe(0); // Não é milestone
      expect(result.milestone).toBeUndefined();
      expect(mockFirestore.updateStreak).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          current: 6,
          longest: 10,
        })
      );
      expect(mockFirestore.updateUserProgress).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentStreak: 6,
          longestStreak: 10,
        })
      );
    });

    it("deve atualizar o longest streak quando ultrapassar o recorde", async () => {
      const userId = "user-123";
      const currentStreakData: StreakData = {
        userId,
        current: 9,
        longest: 9,
        lastUpdate: new Date("2025-11-10"),
        history: [{ date: "2025-11-10", count: 9 }],
      };

      const updatedStreakData: StreakData = {
        userId,
        current: 10,
        longest: 10,
        lastUpdate: new Date(),
        history: [
          { date: "2025-11-10", count: 9 },
          { date: expect.any(String), count: 10 },
        ],
      };

      vi.mocked(mockFirestore.getStreakData).mockResolvedValue(
        currentStreakData
      );
      vi.mocked(mockFirestore.updateStreak).mockResolvedValue(
        updatedStreakData
      );
      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue({
        userId,
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 9,
        longestStreak: 9,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.incrementStreak(userId);

      expect(result.streakData.current).toBe(10);
      expect(result.streakData.longest).toBe(10);
      expect(mockFirestore.updateStreak).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          current: 10,
          longest: 10,
        })
      );
    });

    it("deve criar streak data se não existir", async () => {
      const userId = "user-new";

      vi.mocked(mockFirestore.getStreakData).mockRejectedValue(
        new Error("Não encontrado")
      );
      vi.mocked(mockFirestore.updateStreak)
        .mockResolvedValueOnce({
          userId,
          current: 0,
          longest: 0,
          lastUpdate: new Date(),
          history: [],
        })
        .mockResolvedValueOnce({
          userId,
          current: 1,
          longest: 1,
          lastUpdate: new Date(),
          history: [{ date: expect.any(String), count: 1 }],
        });

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue({
        userId,
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.incrementStreak(userId);

      expect(result.streakData.current).toBe(1);
      expect(result.streakData.longest).toBe(1);
      expect(mockFirestore.updateStreak).toHaveBeenCalledTimes(2);
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.incrementStreak("")).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });
  });

  describe("resetStreak", () => {
    it("deve resetar o streak mantendo o longest", async () => {
      const userId = "user-123";
      const currentStreakData: StreakData = {
        userId,
        current: 15,
        longest: 20,
        lastUpdate: new Date("2025-11-10"),
        history: [{ date: "2025-11-10", count: 15 }],
      };

      const resetStreakData: StreakData = {
        userId,
        current: 0,
        longest: 20,
        lastUpdate: new Date(),
        history: [
          { date: "2025-11-10", count: 15 },
          { date: expect.any(String), count: 0 },
        ],
      };

      vi.mocked(mockFirestore.getStreakData).mockResolvedValue(
        currentStreakData
      );
      vi.mocked(mockFirestore.updateStreak).mockResolvedValue(resetStreakData);

      const result = await service.resetStreak(userId);

      expect(result.current).toBe(0);
      expect(result.longest).toBe(20); // Preserva o recorde
      expect(mockFirestore.updateStreak).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          current: 0,
          longest: 20,
        })
      );
      expect(mockFirestore.updateUserProgress).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentStreak: 0,
          longestStreak: 20,
        })
      );
    });

    it("deve criar streak data com zero se não existir", async () => {
      const userId = "user-new";

      vi.mocked(mockFirestore.getStreakData).mockRejectedValue(
        new Error("Não encontrado")
      );
      vi.mocked(mockFirestore.updateStreak).mockResolvedValue({
        userId,
        current: 0,
        longest: 0,
        lastUpdate: new Date(),
        history: [{ date: expect.any(String), count: 0 }],
      });

      const result = await service.resetStreak(userId);

      expect(result.current).toBe(0);
      expect(result.longest).toBe(0);
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.resetStreak("")).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });
  });

  describe("checkStreakBonus", () => {
    it("deve premiar 200 XP no streak de 7 dias", async () => {
      const userId = "user-123";
      const userProgress: UserProgress = {
        userId,
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 6,
        longestStreak: 6,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      };

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue(userProgress);
      vi.mocked(mockXpService.addXP).mockResolvedValue({
        userId,
        level: 1,
        currentXP: 200,
        totalXP: 200,
        currentStreak: 7,
        longestStreak: 7,
        lastActivityDate: new Date(),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkStreakBonus(userId, 7);

      expect(result.bonusAwarded).toBe(XP_VALUES.STREAK_7_DAYS);
      expect(result.milestone).toBe(7);
      expect(mockXpService.addXP).toHaveBeenCalledWith(
        userId,
        XP_VALUES.STREAK_7_DAYS,
        XPSource.STREAK_BONUS,
        expect.stringContaining("streak-7-")
      );
    });

    it("deve premiar 300 XP no streak de 30 dias", async () => {
      const userId = "user-123";
      const userProgress: UserProgress = {
        userId,
        level: 2,
        currentXP: 50,
        totalXP: 250,
        currentStreak: 29,
        longestStreak: 29,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      };

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue(userProgress);
      vi.mocked(mockXpService.addXP).mockResolvedValue({
        userId,
        level: 2,
        currentXP: 350,
        totalXP: 550,
        currentStreak: 30,
        longestStreak: 30,
        lastActivityDate: new Date(),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkStreakBonus(userId, 30);

      expect(result.bonusAwarded).toBe(XP_VALUES.STREAK_30_DAYS);
      expect(result.milestone).toBe(30);
      expect(mockXpService.addXP).toHaveBeenCalledWith(
        userId,
        XP_VALUES.STREAK_30_DAYS,
        XPSource.STREAK_BONUS,
        expect.stringContaining("streak-30-")
      );
    });

    it("não deve premiar bônus se streak for menor que 7", async () => {
      const userId = "user-123";
      const userProgress: UserProgress = {
        userId,
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      };

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue(userProgress);

      const result = await service.checkStreakBonus(userId, 6);

      expect(result.bonusAwarded).toBe(0);
      expect(result.milestone).toBeUndefined();
      expect(mockXpService.addXP).not.toHaveBeenCalled();
    });

    it("não deve premiar bônus se já teve atividade hoje", async () => {
      const userId = "user-123";
      const today = new Date();
      const userProgress: UserProgress = {
        userId,
        level: 1,
        currentXP: 200,
        totalXP: 200,
        currentStreak: 7,
        longestStreak: 7,
        lastActivityDate: today, // Já teve atividade hoje
        achievements: [],
        createdAt: new Date(),
      };

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue(userProgress);

      const result = await service.checkStreakBonus(userId, 7);

      expect(result.bonusAwarded).toBe(0);
      expect(result.milestone).toBeUndefined();
      expect(mockXpService.addXP).not.toHaveBeenCalled();
    });

    it("deve premiar 200 XP a cada múltiplo de 7 (ex: 14, 21, 28)", async () => {
      const userId = "user-123";
      const userProgress: UserProgress = {
        userId,
        level: 2,
        currentXP: 50,
        totalXP: 250,
        currentStreak: 13,
        longestStreak: 13,
        lastActivityDate: new Date("2025-11-10"),
        achievements: [],
        createdAt: new Date(),
      };

      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue(userProgress);
      vi.mocked(mockXpService.addXP).mockResolvedValue({
        userId,
        level: 2,
        currentXP: 250,
        totalXP: 450,
        currentStreak: 14,
        longestStreak: 14,
        lastActivityDate: new Date(),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.checkStreakBonus(userId, 14);

      expect(result.bonusAwarded).toBe(XP_VALUES.STREAK_7_DAYS);
      expect(result.milestone).toBe(7);
      expect(mockXpService.addXP).toHaveBeenCalledWith(
        userId,
        XP_VALUES.STREAK_7_DAYS,
        XPSource.STREAK_BONUS,
        expect.stringContaining("streak-7-")
      );
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.checkStreakBonus("", 7)).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });
  });

  describe("updateAllStreaks", () => {
    it("deve processar todos os usuários e atualizar streaks", async () => {
      // Mock do getAllUserIds no FirestoreService
      (mockFirestore as any).getAllUserIds = vi
        .fn()
        .mockResolvedValue(["user1", "user2"]);

      // Mock de DailyProgress para ontem
      vi.mocked(mockFirestore.getDailyProgress)
        .mockResolvedValueOnce({
          userId: "user1",
          date: "2025-11-10",
          cardsReviewed: 25,
          goalMet: true,
          xpEarned: 100,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          userId: "user2",
          date: "2025-11-10",
          cardsReviewed: 10,
          goalMet: false,
          xpEarned: 0,
          timestamp: new Date(),
        });

      // Mock getStreakData para ambos usuários
      vi.mocked(mockFirestore.getStreakData)
        .mockResolvedValueOnce({
          userId: "user1",
          current: 6,
          longest: 10,
          lastUpdate: new Date(),
          history: [],
        })
        .mockResolvedValueOnce({
          userId: "user2",
          current: 5,
          longest: 10,
          lastUpdate: new Date(),
          history: [],
        });

      // Mock updateStreak
      vi.mocked(mockFirestore.updateStreak)
        .mockResolvedValueOnce({
          userId: "user1",
          current: 7,
          longest: 10,
          lastUpdate: new Date(),
          history: [],
        })
        .mockResolvedValueOnce({
          userId: "user2",
          current: 0,
          longest: 10,
          lastUpdate: new Date(),
          history: [],
        });

      // Mock getUserProgress
      vi.mocked(mockFirestore.getUserProgress).mockResolvedValue({
        userId: "user1",
        level: 1,
        currentXP: 0,
        totalXP: 0,
        currentStreak: 6,
        longestStreak: 10,
        lastActivityDate: new Date("2025-11-09"),
        achievements: [],
        createdAt: new Date(),
      });

      const result = await service.updateAllStreaks();

      expect(result.totalProcessed).toBe(2);
      expect(result.incremented).toBe(1); // user1 atingiu meta
      expect(result.reset).toBe(1); // user2 não atingiu meta
      expect(result.errors).toHaveLength(0);
    });
  });
});
