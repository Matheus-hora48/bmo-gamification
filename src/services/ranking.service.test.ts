import { describe, it, expect, vi, beforeEach } from "vitest";
import { RankingService } from "./ranking.service";

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
  })),
}));

describe("RankingService", () => {
  let service: RankingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RankingService();
  });

  describe("getUserRankPosition", () => {
    it("should return user position when found", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockRankingData = {
        period: "monthly",
        date: "2025-11",
        entries: [
          {
            userId: "user1",
            userName: "User 1",
            rank: 1,
            cardsReviewed: 100,
            xpEarned: 1000,
            streakDays: 10,
            accuracyRate: 85,
            studyTimeMinutes: 120,
            studySessions: 5,
            achievementsUnlocked: 3,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            userId: "user2",
            userName: "User 2",
            rank: 2,
            cardsReviewed: 80,
            xpEarned: 800,
            streakDays: 8,
            accuracyRate: 80,
            studyTimeMinutes: 100,
            studySessions: 4,
            achievementsUnlocked: 2,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        totalParticipants: 2,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockRankingData,
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const position = await service.getUserRankPosition(
        "user2",
        "monthly",
        "2025-11"
      );

      expect(position).toBe(2);
    });

    it("should return null when user not found", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockRankingData = {
        period: "monthly",
        date: "2025-11",
        entries: [
          {
            userId: "user1",
            userName: "User 1",
            rank: 1,
            cardsReviewed: 100,
            xpEarned: 1000,
            streakDays: 10,
            accuracyRate: 85,
            studyTimeMinutes: 120,
            studySessions: 5,
            achievementsUnlocked: 3,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        totalParticipants: 1,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockRankingData,
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const position = await service.getUserRankPosition(
        "nonexistent",
        "monthly",
        "2025-11"
      );

      expect(position).toBeNull();
    });

    it("should return null when ranking does not exist", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const position = await service.getUserRankPosition(
        "user1",
        "monthly",
        "2025-11"
      );

      expect(position).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockRejectedValue(new Error("Database error")),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const position = await service.getUserRankPosition(
        "user1",
        "monthly",
        "2025-11"
      );

      expect(position).toBeNull();
    });
  });

  describe("getRanking", () => {
    it("should return ranking when it exists", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockRankingData = {
        period: "yearly",
        date: "2025",
        entries: [
          {
            userId: "user1",
            userName: "User 1",
            rank: 1,
            cardsReviewed: 1000,
            xpEarned: 10000,
            streakDays: 100,
            accuracyRate: 90,
            studyTimeMinutes: 1200,
            studySessions: 50,
            achievementsUnlocked: 10,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        totalParticipants: 1,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockRankingData,
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const ranking = await service.getRanking("yearly", "2025");

      expect(ranking).toBeTruthy();
      expect(ranking?.period).toBe("yearly");
      expect(ranking?.date).toBe("2025");
      expect(ranking?.entries).toHaveLength(1);
    });

    it("should return null when ranking does not exist", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const ranking = await service.getRanking("monthly", "2025-11");

      expect(ranking).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const { firestore } = await import("../config/firebase.config");
      const mockDoc = {
        get: vi.fn().mockRejectedValue(new Error("Database error")),
        set: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const ranking = await service.getRanking("monthly", "2025-11");

      expect(ranking).toBeNull();
    });
  });

  describe("updateMonthlyRanking", () => {
    it("should create monthly ranking successfully", async () => {
      const { firestore } = await import("../config/firebase.config");
      const { FirestoreService } = await import("./firestore.service");

      // Mock FirestoreService
      const mockFirestoreService = new (FirestoreService as any)();
      mockFirestoreService.getAllUserIds = vi
        .fn()
        .mockResolvedValue(["user1", "user2"]);
      mockFirestoreService.getXPTransactionsByPeriod = vi
        .fn()
        .mockResolvedValue([
          {
            userId: "user1",
            source: "REVIEW",
            amount: 10,
            timestamp: new Date(),
            cardId: "card1",
          },
        ]);

      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.updateMonthlyRanking("2025-11");

      expect(result).toBeTruthy();
      expect(result.period).toBe("monthly");
      expect(result.date).toBe("2025-11");
    });
  });

  describe("updateYearlyRanking", () => {
    it("should create yearly ranking successfully", async () => {
      const { firestore } = await import("../config/firebase.config");
      const { FirestoreService } = await import("./firestore.service");

      // Mock FirestoreService
      const mockFirestoreService = new (FirestoreService as any)();
      mockFirestoreService.getAllUserIds = vi
        .fn()
        .mockResolvedValue(["user1", "user2"]);
      mockFirestoreService.getXPTransactionsByPeriod = vi
        .fn()
        .mockResolvedValue([
          {
            userId: "user1",
            source: "REVIEW",
            amount: 10,
            timestamp: new Date(),
            cardId: "card1",
          },
        ]);

      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        update: vi.fn(),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn(),
      };

      (firestore.collection as any).mockReturnValue(mockCollection);

      const result = await service.updateYearlyRanking("2025");

      expect(result).toBeTruthy();
      expect(result.period).toBe("yearly");
      expect(result.date).toBe("2025");
    });
  });
});
