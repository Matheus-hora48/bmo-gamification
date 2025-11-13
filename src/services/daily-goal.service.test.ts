import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_GOAL_TARGET, XP_VALUES } from "../config/constants";
import type { DailyProgress } from "../models/DailyProgress";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import type { DailyProgressUpdate } from "./firestore.service";
import { FirestoreService } from "./firestore.service";
import { XPService } from "./xp.service";
import { DailyGoalService } from "./daily-goal.service";

vi.mock("./firestore.service");
vi.mock("./xp.service");

describe("DailyGoalService", () => {
  let service: DailyGoalService;
  let mockFirestore: FirestoreService;
  let mockXpService: XPService;

  beforeEach(() => {
    mockFirestore = new FirestoreService();
    mockXpService = new XPService();
    service = new DailyGoalService(mockFirestore, mockXpService);
    vi.clearAllMocks();
  });

  // Mocks padrão para evitar chamadas não implementadas
  beforeEach(() => {
    const defaultProgress: UserProgress = {
      userId: "user123",
      level: 1,
      currentXP: 0,
      totalXP: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      achievements: [],
      createdAt: new Date(),
    };

    vi.spyOn(mockFirestore, "getUserProgress").mockImplementation(
      async () => defaultProgress
    );
    vi.spyOn(mockFirestore, "createUserProgress").mockImplementation(
      async () => defaultProgress
    );
    vi.spyOn(mockFirestore, "updateUserProgress").mockImplementation(
      async (_userId, partial) => ({ ...defaultProgress, ...(partial as any) })
    );
  });

  describe("recordCardReview", () => {
    it("deve incrementar o contador de cards revisados", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const existingProgress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 5,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      const updatedProgress: DailyProgress = {
        ...existingProgress,
        cardsReviewed: 6,
        goalMet: false,
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(
        existingProgress
      );
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue(
        updatedProgress
      );

      const result = await service.recordCardReview(userId, date);

      expect(result.cardsReviewed).toBe(6);
      expect(result.goalMet).toBe(false);
      expect(mockFirestore.updateDailyProgress).toHaveBeenCalledWith(
        userId,
        date,
        {
          cardsReviewed: 6,
          goalMet: false,
        }
      );
    });

    it("deve marcar goalMet como true quando atingir a meta", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const existingProgress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 19,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      const updatedProgress: DailyProgress = {
        ...existingProgress,
        cardsReviewed: 20,
        goalMet: true,
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(
        existingProgress
      );
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue(
        updatedProgress
      );

      const result = await service.recordCardReview(userId, date);

      expect(result.cardsReviewed).toBe(20);
      expect(result.goalMet).toBe(true);
      expect(mockFirestore.updateDailyProgress).toHaveBeenCalledWith(
        userId,
        date,
        {
          cardsReviewed: 20,
          goalMet: true,
        }
      );
    });

    it("deve criar novo progresso diário se não existir", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const newProgress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 1,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockRejectedValue(
        new Error("Progresso diário do usuário não encontrado.")
      );
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue(
        newProgress
      );

      const result = await service.recordCardReview(userId, date);

      expect(result.cardsReviewed).toBe(1);
      expect(result.goalMet).toBe(false);
      expect(mockFirestore.updateDailyProgress).toHaveBeenCalledWith(
        userId,
        date,
        {
          cardsReviewed: 1,
          goalMet: false,
          xpEarned: 0,
        }
      );
    });

    it("deve usar a data de hoje se não for fornecida", async () => {
      const userId = "user123";
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const newProgress: DailyProgress = {
        userId,
        date: expectedDate,
        cardsReviewed: 1,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockRejectedValue(
        new Error("Progresso diário do usuário não encontrado.")
      );
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue(
        newProgress
      );

      await service.recordCardReview(userId);

      expect(mockFirestore.updateDailyProgress).toHaveBeenCalledWith(
        userId,
        expectedDate,
        expect.any(Object)
      );
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.recordCardReview("")).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });

    it("deve lançar erro se formato de data for inválido", async () => {
      await expect(
        service.recordCardReview("user123", "11-11-2025")
      ).rejects.toThrow("Formato de data inválido");
    });
  });

  describe("checkDailyGoal", () => {
    it("deve retornar status da meta quando atingida", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const progress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 25,
        goalMet: true,
        xpEarned: 100,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);

      const result = await service.checkDailyGoal(userId, date);

      expect(result).toEqual({
        goalMet: true,
        cardsReviewed: 25,
        cardsRemaining: 0,
        xpEarned: 100,
        date,
      });
    });

    it("deve retornar status da meta quando não atingida", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const progress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 15,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);

      const result = await service.checkDailyGoal(userId, date);

      expect(result).toEqual({
        goalMet: false,
        cardsReviewed: 15,
        cardsRemaining: 5,
        xpEarned: 0,
        date,
      });
    });

    it("deve retornar valores padrão se progresso não existir", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      vi.spyOn(mockFirestore, "getDailyProgress").mockRejectedValue(
        new Error("Progresso diário do usuário não encontrado.")
      );

      const result = await service.checkDailyGoal(userId, date);

      expect(result).toEqual({
        goalMet: false,
        cardsReviewed: 0,
        cardsRemaining: DAILY_GOAL_TARGET,
        xpEarned: 0,
        date,
      });
    });

    it("deve usar a data de hoje se não for fornecida", async () => {
      const userId = "user123";
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      vi.spyOn(mockFirestore, "getDailyProgress").mockRejectedValue(
        new Error("Progresso diário do usuário não encontrado.")
      );

      const result = await service.checkDailyGoal(userId);

      expect(result.date).toBe(expectedDate);
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.checkDailyGoal("")).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });

    it("deve lançar erro se formato de data for inválido", async () => {
      await expect(
        service.checkDailyGoal("user123", "2025/11/11")
      ).rejects.toThrow("Formato de data inválido");
    });
  });

  describe("awardDailyGoalXP", () => {
    it("deve premiar XP quando meta foi atingida", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const progress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 20,
        goalMet: true,
        xpEarned: 0,
        timestamp: new Date(),
      };

      const updatedUserProgress: UserProgress = {
        userId,
        level: 5,
        currentXP: 150,
        totalXP: 2650,
        currentStreak: 7,
        longestStreak: 10,
        lastActivityDate: new Date(),
        achievements: [],
        createdAt: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);
      vi.spyOn(mockXpService, "addXP").mockResolvedValue({
        userProgress: updatedUserProgress,
        levelUpInfo: {
          leveledUp: false,
          oldLevel: 5,
          newLevel: 5,
          levelsGained: 0,
        },
      });
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue({
        ...progress,
        xpEarned: XP_VALUES.DAILY_GOAL,
      });

      const result = await service.awardDailyGoalXP(userId, date);

      expect(result).toEqual({
        xpAwarded: XP_VALUES.DAILY_GOAL,
        totalXP: 2650,
        level: 5,
        currentXP: 150,
        transactionId: `daily-goal-${date}`,
      });

      expect(mockXpService.addXP).toHaveBeenCalledWith(
        userId,
        XP_VALUES.DAILY_GOAL,
        XPSource.DAILY_GOAL,
        `daily-goal-${date}`
      );

      expect(mockFirestore.updateDailyProgress).toHaveBeenCalledWith(
        userId,
        date,
        {
          xpEarned: XP_VALUES.DAILY_GOAL,
        }
      );
    });

    it("deve lançar erro se meta não foi atingida", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const progress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 15,
        goalMet: false,
        xpEarned: 0,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);

      await expect(service.awardDailyGoalXP(userId, date)).rejects.toThrow(
        "Meta diária não atingida"
      );

      expect(mockXpService.addXP).not.toHaveBeenCalled();
    });

    it("deve lançar erro se XP já foi premiado", async () => {
      const userId = "user123";
      const date = "2025-11-11";

      const progress: DailyProgress = {
        userId,
        date,
        cardsReviewed: 25,
        goalMet: true,
        xpEarned: XP_VALUES.DAILY_GOAL,
        timestamp: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);

      await expect(service.awardDailyGoalXP(userId, date)).rejects.toThrow(
        "XP da meta diária já foi premiado"
      );

      expect(mockXpService.addXP).not.toHaveBeenCalled();
    });

    it("deve usar a data de hoje se não for fornecida", async () => {
      const userId = "user123";
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const progress: DailyProgress = {
        userId,
        date: expectedDate,
        cardsReviewed: 20,
        goalMet: true,
        xpEarned: 0,
        timestamp: new Date(),
      };

      const updatedUserProgress: UserProgress = {
        userId,
        level: 1,
        currentXP: 100,
        totalXP: 100,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
        achievements: [],
        createdAt: new Date(),
      };

      vi.spyOn(mockFirestore, "getDailyProgress").mockResolvedValue(progress);
      vi.spyOn(mockXpService, "addXP").mockResolvedValue({
        userProgress: updatedUserProgress,
        levelUpInfo: {
          leveledUp: false,
          oldLevel: 1,
          newLevel: 1,
          levelsGained: 0,
        },
      });
      vi.spyOn(mockFirestore, "updateDailyProgress").mockResolvedValue({
        ...progress,
        xpEarned: XP_VALUES.DAILY_GOAL,
      });

      await service.awardDailyGoalXP(userId);

      expect(mockXpService.addXP).toHaveBeenCalledWith(
        userId,
        XP_VALUES.DAILY_GOAL,
        XPSource.DAILY_GOAL,
        `daily-goal-${expectedDate}`
      );
    });

    it("deve lançar erro se userId for vazio", async () => {
      await expect(service.awardDailyGoalXP("")).rejects.toThrow(
        "ID do usuário é obrigatório."
      );
    });

    it("deve lançar erro se formato de data for inválido", async () => {
      await expect(
        service.awardDailyGoalXP("user123", "11/11/2025")
      ).rejects.toThrow("Formato de data inválido");
    });
  });
});
