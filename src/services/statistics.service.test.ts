import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatisticsService } from "./statistics.service";

// Mock simples do Firebase
vi.mock("../config/firebase.config", () => ({
  firestore: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
      add: vi.fn(),
    })),
  },
}));

// Mock do FirestoreService
vi.mock("./firestore.service", () => ({
  FirestoreService: vi.fn(() => ({
    getAllUserIds: vi.fn(),
    getXPTransactionsByPeriod: vi.fn(),
    getStudySessionsByPeriod: vi.fn(),
  })),
}));

describe("StatisticsService", () => {
  let service: StatisticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StatisticsService();
  });

  describe("calculateDeckProgress", () => {
    it("should calculate progress correctly with valid numbers", () => {
      const progress = service.calculateDeckProgress(80, 100);
      expect(progress).toBe(80);
    });

    it("should handle zero total cards", () => {
      const progress = service.calculateDeckProgress(0, 0);
      expect(progress).toBe(0);
    });

    it("should round to nearest integer", () => {
      const progress = service.calculateDeckProgress(33, 100);
      expect(progress).toBe(33);
    });

    it("should not exceed 100%", () => {
      const progress = service.calculateDeckProgress(150, 100);
      expect(progress).toBe(100);
    });

    it("should handle negative values gracefully", () => {
      const progress = service.calculateDeckProgress(-10, 50);
      expect(progress).toBe(0);
    });
  });

  describe("updateDeckStatistics", () => {
    it("should accept valid parameters", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const params = {
        userId: "user123",
        deckId: "deck456",
        deckName: "Test Deck",
        cardsNew: 10,
        cardsLearning: 5,
        cardsReview: 8,
        totalCards: 50,
        sessionTime: 30,
      };

      const result = await service.updateDeckStatistics(params);

      expect(result).toBeDefined();
      expect(result.userId).toBe("user123");
      expect(result.deckId).toBe("deck456");
    });
  });

  describe("getUserStatistics", () => {
    it("should handle existing user statistics", async () => {
      const { firestore } = await import("../config/firebase.config");

      // Mock simples que vai através da validação e mapeamento
      const mockUserData = {
        userId: "user123",
        totalCardsCreated: 50,
        totalDecksCreated: 3,
        totalReviewsCompleted: 250,
        totalStudySessions: 15,
        totalStudyTimeMinutes: 300,
        averageSessionDurationMinutes: 20,
        longestStreakDays: 15,
        weeklyReviewGoal: 50,
        monthlyReviewGoal: 200,
        currentWeekReviews: 25,
        currentMonthReviews: 100,
        overallAccuracyRate: 80,
        retentionRate: 85,
        overallAverageEase: 2.5,
        difficultyBreakdown: {
          againCount: 10,
          hardCount: 30,
          goodCount: 150,
          easyCount: 60,
        },
        firstActivityAt: new Date(),
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockUserData,
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.getUserStatistics("user123");

      // Testa apenas se retorna um objeto com userId correto
      expect(result).toBeTruthy();
      expect(result?.userId).toBe("user123");
    });

    it("should return null when user statistics do not exist", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.getUserStatistics("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("calculateAccuracyRate", () => {
    it("should calculate accuracy rate from user statistics", async () => {
      const { firestore } = await import("../config/firebase.config");

      // Mock que simula sessões de estudo
      const mockQuerySnapshot = {
        forEach: vi.fn((callback: any) => {
          // Simula 2 sessões
          callback({ data: () => ({ accuracyCount: 40, totalAnswers: 50 }) });
          callback({ data: () => ({ accuracyCount: 40, totalAnswers: 50 }) });
        }),
      };

      const mockCollection = {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockQuerySnapshot),
          }),
        }),
        doc: vi.fn(),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.calculateAccuracyRate("user123");

      expect(result).toBe(80); // 80/100 = 80%
    });

    it("should return 0 when no reviews exist", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockUserData = {
        totalCorrectAnswers: 0,
        totalReviews: 0,
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockUserData,
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
        where: vi.fn(),
        get: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.calculateAccuracyRate("user123");

      expect(result).toBe(0);
    });
  });

  describe("detectFavoriteStudyTime", () => {
    it("should return favorite study time when it exists", async () => {
      const { firestore } = await import("../config/firebase.config");

      // Mock que simula sessões de estudo em diferentes horários
      const mockQuerySnapshot = {
        forEach: vi.fn((callback: any) => {
          // Simula mais sessões à noite
          callback({ data: () => ({ studyTime: "evening" }) });
          callback({ data: () => ({ studyTime: "evening" }) });
          callback({ data: () => ({ studyTime: "evening" }) });
          callback({ data: () => ({ studyTime: "morning" }) });
          callback({ data: () => ({ studyTime: "afternoon" }) });
        }),
      };

      const mockCollection = {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockQuerySnapshot),
          }),
        }),
        doc: vi.fn(),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.detectFavoriteStudyTime("user123");

      expect(result).toBe("evening");
    });

    it("should return afternoon as default when no preference exists", async () => {
      const { firestore } = await import("../config/firebase.config");

      // Mock que simula ausência de sessões (retorna default)
      const mockQuerySnapshot = {
        forEach: vi.fn((callback: any) => {
          // Nenhuma sessão
        }),
      };

      const mockCollection = {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockQuerySnapshot),
          }),
        }),
        doc: vi.fn(),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.detectFavoriteStudyTime("user123");

      expect(result).toBe("afternoon");
    });
  });
});
