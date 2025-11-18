import { describe, expect, it, vi } from "vitest";
import { XP_VALUES } from "../config/constants";
import type { UserProgress } from "../models/UserProgress";
import { XPSource } from "../models/XPTransaction";
import { XPService, type ReviewDifficulty } from "./xp.service";
import type { LevelUpResult } from "./level.service";

const createUserProgress = (
  overrides: Partial<UserProgress> = {}
): UserProgress => ({
  userId: "user-1",
  level: 1,
  currentXP: 0,
  totalXP: 0,
  currentStreak: 0,
  longestStreak: 0,
      totalCardsReviewed: 0,
  lastActivityDate: null,
  achievements: [],
  createdAt: new Date(0),
  ...overrides,
});

const createFirestoreMock = () => ({
  getUserProgress: vi.fn(),
  createUserProgress: vi.fn(),
  updateUserProgress: vi.fn(),
  createXPTransaction: vi.fn(),
});

const createLevelServiceMock = () => ({
  checkLevelUp: vi.fn(),
  xpForLevel: vi.fn(),
  calculateLevel: vi.fn(),
  getCurrentXP: vi.fn(),
  xpForNextLevel: vi.fn(),
  xpToNextLevel: vi.fn(),
});

const difficulties: ReviewDifficulty[] = ["again", "hard", "good", "easy"];

describe("XPService", () => {
  describe("calculateXPForReview", () => {
    it.each(difficulties)("returns XP for %s difficulty", (difficulty) => {
      const service = new XPService(createFirestoreMock() as any);
      const expectedMap: Record<ReviewDifficulty, number> = {
        again: XP_VALUES.REVIEW_AGAIN,
        hard: XP_VALUES.REVIEW_HARD,
        good: XP_VALUES.REVIEW_GOOD,
        easy: XP_VALUES.REVIEW_EASY,
      };
      const expected = expectedMap[difficulty];

      expect(service.calculateXPForReview(difficulty)).toBe(expected);
    });

    it("throws for invalid difficulty", () => {
      const service = new XPService(createFirestoreMock() as any);

      expect(() => service.calculateXPForReview("unknown")).toThrowError(
        /Dificuldade de revisão inválida/
      );
    });
  });

  describe("addXP", () => {
    it("returns XPResult with userProgress and levelUpInfo", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const initial = createUserProgress({ currentXP: 50, totalXP: 100 });
      const updated = createUserProgress({
        level: 1,
        currentXP: 30,
        totalXP: 130,
        lastActivityDate: new Date("2025-01-01T00:00:00Z"),
      });

      const levelUpInfo: LevelUpResult = {
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        levelsGained: 0,
      };

      firestore.getUserProgress.mockResolvedValue(initial);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(1);
      levelService.getCurrentXP.mockReturnValue(30);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.addXP(
        "user-1",
        30,
        XPSource.REVIEW,
        "card-123"
      );

      // Verificar estrutura do XPResult
      expect(result).toHaveProperty("userProgress");
      expect(result).toHaveProperty("levelUpInfo");
      expect(result.userProgress).toBe(updated);
      expect(result.levelUpInfo).toBe(levelUpInfo);

      // Verificar que calculateLevel foi chamado
      expect(levelService.calculateLevel).toHaveBeenCalledWith(130);

      // Verificar que getCurrentXP foi chamado
      expect(levelService.getCurrentXP).toHaveBeenCalledWith(130, 1);

      // Verificar que checkLevelUp foi chamado com XP correto
      expect(levelService.checkLevelUp).toHaveBeenCalledWith(100, 130);

      expect(firestore.updateUserProgress).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          level: 1,
          currentXP: 30,
          totalXP: 130,
          lastActivityDate: expect.any(Date),
        })
      );
      expect(firestore.createXPTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          amount: 30,
          source: XPSource.REVIEW,
          sourceId: "card-123",
        })
      );
    });

    it("detects level-up when user gains enough XP", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const initial = createUserProgress({
        currentXP: 90,
        totalXP: 390,
        level: 1,
      });
      const updated = createUserProgress({
        currentXP: 15,
        totalXP: 415,
        level: 2,
      });

      const levelUpInfo: LevelUpResult = {
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
        levelsGained: 1,
      };

      firestore.getUserProgress.mockResolvedValue(initial);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(2);
      levelService.getCurrentXP.mockReturnValue(15);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.addXP(
        "user-1",
        25,
        XPSource.CARD_CREATION,
        "card-456"
      );

      expect(result.levelUpInfo.leveledUp).toBe(true);
      expect(result.levelUpInfo.oldLevel).toBe(1);
      expect(result.levelUpInfo.newLevel).toBe(2);
      expect(result.levelUpInfo.levelsGained).toBe(1);
      expect(levelService.calculateLevel).toHaveBeenCalledWith(415);
      expect(levelService.getCurrentXP).toHaveBeenCalledWith(415, 2);
      expect(levelService.checkLevelUp).toHaveBeenCalledWith(390, 415);
    });

    it("detects multi-level-up when user gains massive XP", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const initial = createUserProgress({
        currentXP: 50,
        totalXP: 50,
        level: 0,
      });
      const updated = createUserProgress({
        currentXP: 150,
        totalXP: 1050,
        level: 3,
      });

      const levelUpInfo: LevelUpResult = {
        leveledUp: true,
        oldLevel: 0,
        newLevel: 3,
        levelsGained: 3,
      };

      firestore.getUserProgress.mockResolvedValue(initial);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(3);
      levelService.getCurrentXP.mockReturnValue(150);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.addXP(
        "user-1",
        1000,
        XPSource.ACHIEVEMENT,
        "achievement-legendary"
      );

      expect(result.levelUpInfo.leveledUp).toBe(true);
      expect(result.levelUpInfo.levelsGained).toBe(3);
      expect(levelService.calculateLevel).toHaveBeenCalledWith(1050);
      expect(levelService.getCurrentXP).toHaveBeenCalledWith(1050, 3);
      expect(levelService.checkLevelUp).toHaveBeenCalledWith(50, 1050);
    });

    it("creates user progress when missing", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const created = createUserProgress();
      const updated = createUserProgress({ currentXP: 10, totalXP: 10 });

      const levelUpInfo: LevelUpResult = {
        leveledUp: false,
        oldLevel: 0,
        newLevel: 0,
        levelsGained: 0,
      };

      firestore.getUserProgress.mockRejectedValue(
        new Error('Progresso do usuário "user-1" não encontrado.')
      );
      firestore.createUserProgress.mockResolvedValue(created);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(0);
      levelService.getCurrentXP.mockReturnValue(10);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.addXP(
        "user-1",
        10,
        XPSource.REVIEW,
        "card-001"
      );

      expect(firestore.createUserProgress).toHaveBeenCalledWith("user-1");
      expect(result.userProgress).toBe(updated);
      expect(result.levelUpInfo).toBe(levelUpInfo);
    });
  });

  describe("processCardReview", () => {
    it("returns XPResult with level-up info for review", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const initial = createUserProgress({ currentXP: 0, totalXP: 0 });
      const updated = createUserProgress({ currentXP: 15, totalXP: 15 });

      const levelUpInfo: LevelUpResult = {
        leveledUp: false,
        oldLevel: 0,
        newLevel: 0,
        levelsGained: 0,
      };

      firestore.getUserProgress.mockResolvedValue(initial);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(0);
      levelService.getCurrentXP.mockReturnValue(15);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.processCardReview(
        "user-1",
        "card-abc",
        "good"
      );

      expect(result).toHaveProperty("userProgress");
      expect(result).toHaveProperty("levelUpInfo");
      expect(result.userProgress).toBe(updated);
      expect(result.levelUpInfo).toBe(levelUpInfo);

      expect(firestore.updateUserProgress).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ currentXP: 15, totalXP: 15 })
      );

      expect(firestore.createXPTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          source: XPSource.REVIEW,
          amount: XP_VALUES.REVIEW_GOOD,
          description: expect.stringContaining("Revisão do card card-abc"),
        })
      );

      expect(levelService.calculateLevel).toHaveBeenCalledWith(15);
      expect(levelService.getCurrentXP).toHaveBeenCalledWith(15, 0);
      expect(levelService.checkLevelUp).toHaveBeenCalledWith(0, 15);
    });

    it("detects level-up when review pushes user to next level", async () => {
      const firestore = createFirestoreMock();
      const levelService = createLevelServiceMock();

      const initial = createUserProgress({
        currentXP: 95,
        totalXP: 395,
        level: 1,
      });
      const updated = createUserProgress({
        currentXP: 15,
        totalXP: 415,
        level: 2,
      });

      const levelUpInfo: LevelUpResult = {
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
        levelsGained: 1,
      };

      firestore.getUserProgress.mockResolvedValue(initial);
      firestore.updateUserProgress.mockResolvedValue(updated);
      firestore.createXPTransaction.mockResolvedValue(undefined);
      levelService.calculateLevel.mockReturnValue(2);
      levelService.getCurrentXP.mockReturnValue(15);
      levelService.checkLevelUp.mockReturnValue(levelUpInfo);

      const service = new XPService(firestore as any, levelService as any);
      const result = await service.processCardReview(
        "user-1",
        "card-xyz",
        "easy" // easy = 20 XP
      );

      expect(result.levelUpInfo.leveledUp).toBe(true);
      expect(result.levelUpInfo.oldLevel).toBe(1);
      expect(result.levelUpInfo.newLevel).toBe(2);
      expect(levelService.calculateLevel).toHaveBeenCalledWith(415);
      expect(levelService.getCurrentXP).toHaveBeenCalledWith(415, 2);
      expect(levelService.checkLevelUp).toHaveBeenCalledWith(395, 415); // 395 + 20 = 415
    });
  });
});
