import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { RankingsController } from "../controllers/rankings.controller";
import { RankingService } from "../services/ranking.service";

// Mock dos services e utils
vi.mock("../services/ranking.service");
vi.mock("../utils/logger");

describe("RankingsController", () => {
  let controller: RankingsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockRankingService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup service mocks
    mockRankingService = {
      getRanking: vi.fn(),
      getUserRankPosition: vi.fn(),
    };

    // Mock constructor
    (RankingService as any).mockImplementation(() => mockRankingService);

    controller = new RankingsController();

    // Setup response mock
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // Setup default request
    mockReq = {
      params: {},
      query: {},
    };
  });

  describe("getMonthlyRanking", () => {
    it("deve retornar ranking mensal para data específica", async () => {
      // Arrange
      mockReq.params = { date: "2025-11" };
      const mockRanking = {
        period: "monthly",
        date: "2025-11",
        entries: [
          {
            userId: "user1",
            userName: "João Silva",
            cardsReviewed: 100,
            rank: 1,
            xpEarned: 500,
            streakDays: 10,
          },
        ],
        totalParticipants: 1,
        lastUpdated: new Date("2025-11-17T10:00:00Z"),
      };

      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRankingService.getRanking).toHaveBeenCalledWith(
        "monthly",
        "2025-11"
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          period: "2025-11",
          type: "monthly",
          entries: mockRanking.entries,
          totalParticipants: mockRanking.totalParticipants,
          lastUpdated: mockRanking.lastUpdated,
          hasMore: false,
        },
      });
    });

    it("deve usar mês atual quando data não é fornecida", async () => {
      // Arrange
      mockReq.params = {}; // Sem data
      const currentDate = new Date();
      const expectedMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

      const mockRanking = {
        period: "monthly",
        date: expectedMonth,
        entries: [],
        totalParticipants: 0,
        lastUpdated: new Date(),
      };

      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRankingService.getRanking).toHaveBeenCalledWith(
        "monthly",
        expectedMonth
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("deve retornar erro 400 para formato de data inválido", async () => {
      // Arrange
      mockReq.params = { date: "data-invalida" };

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Formato de data inválido (use: YYYY-MM)",
        code: "INVALID_DATE_FORMAT",
      });
    });

    it("deve retornar erro 400 para limit inválido", async () => {
      // Arrange
      mockReq.params = { date: "2025-11" };
      mockReq.query = { limit: "200" }; // Acima do máximo

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Limit deve ser entre 1 e 100",
        code: "INVALID_LIMIT",
      });
    });

    it("deve retornar erro 404 quando ranking não encontrado", async () => {
      // Arrange
      mockReq.params = { date: "2025-11" };
      mockRankingService.getRanking.mockResolvedValue(null);

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Ranking não encontrado para o período especificado",
        code: "RANKING_NOT_FOUND",
      });
    });

    it("deve aplicar limit corretamente quando há mais entradas", async () => {
      // Arrange
      mockReq.params = { date: "2025-11" };
      mockReq.query = { limit: "2" };

      const mockRanking = {
        period: "monthly",
        date: "2025-11",
        entries: [
          {
            userId: "user1",
            userName: "User 1",
            cardsReviewed: 100,
            rank: 1,
            xpEarned: 500,
            streakDays: 10,
          },
          {
            userId: "user2",
            userName: "User 2",
            cardsReviewed: 90,
            rank: 2,
            xpEarned: 450,
            streakDays: 8,
          },
          {
            userId: "user3",
            userName: "User 3",
            cardsReviewed: 80,
            rank: 3,
            xpEarned: 400,
            streakDays: 5,
          },
        ],
        totalParticipants: 3,
        lastUpdated: new Date(),
      };

      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          period: "2025-11",
          type: "monthly",
          entries: mockRanking.entries.slice(0, 2), // Apenas 2 primeiros
          totalParticipants: 3,
          lastUpdated: mockRanking.lastUpdated,
          hasMore: true, // Deve ser true pois há mais entradas
        },
      });
    });
  });

  describe("getYearlyRanking", () => {
    it("deve retornar ranking anual para ano específico", async () => {
      // Arrange
      mockReq.params = { year: "2025" };
      const mockRanking = {
        period: "yearly",
        date: "2025",
        entries: [
          {
            userId: "user1",
            userName: "Maria Silva",
            cardsReviewed: 1000,
            rank: 1,
            xpEarned: 5000,
            streakDays: 30,
          },
        ],
        totalParticipants: 1,
        lastUpdated: new Date("2025-11-17T10:00:00Z"),
      };

      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getYearlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRankingService.getRanking).toHaveBeenCalledWith(
        "yearly",
        "2025"
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          period: "2025",
          type: "yearly",
          entries: mockRanking.entries,
          totalParticipants: mockRanking.totalParticipants,
          lastUpdated: mockRanking.lastUpdated,
          hasMore: false,
        },
      });
    });

    it("deve usar ano atual quando year não é fornecido", async () => {
      // Arrange
      mockReq.params = {}; // Sem year
      const expectedYear = String(new Date().getFullYear());

      const mockRanking = {
        period: "yearly",
        date: expectedYear,
        entries: [],
        totalParticipants: 0,
        lastUpdated: new Date(),
      };

      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getYearlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRankingService.getRanking).toHaveBeenCalledWith(
        "yearly",
        expectedYear
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("deve retornar erro 400 para ano inválido", async () => {
      // Arrange
      mockReq.params = { year: "2010" }; // Ano muito antigo

      // Act
      await controller.getYearlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Ano inválido",
        code: "INVALID_YEAR",
      });
    });

    it("deve retornar erro 400 para ano futuro demais", async () => {
      // Arrange
      const futureYear = String(new Date().getFullYear() + 2);
      mockReq.params = { year: futureYear };

      // Act
      await controller.getYearlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Ano inválido",
        code: "INVALID_YEAR",
      });
    });
  });

  describe("getUserPosition", () => {
    it("deve retornar posição do usuário para período monthly", async () => {
      // Arrange
      mockReq.params = { userId: "user123", period: "monthly" };
      const currentDate = new Date();
      const expectedPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

      const mockRanking = {
        period: "monthly",
        date: expectedPeriod,
        entries: [
          {
            userId: "user123",
            userName: "Test User",
            cardsReviewed: 50,
            rank: 5,
            xpEarned: 250,
            streakDays: 7,
          },
        ],
        totalParticipants: 10,
        lastUpdated: new Date("2025-11-17T10:00:00Z"),
      };

      mockRankingService.getUserRankPosition.mockResolvedValue(5);
      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRankingService.getUserRankPosition).toHaveBeenCalledWith(
        "user123",
        "monthly",
        expectedPeriod
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          userId: "user123",
          period: "monthly",
          targetPeriod: expectedPeriod,
          position: 5,
          userEntry: {
            userName: "Test User",
            cardsReviewed: 50,
            xpEarned: 250,
            streakDays: 7,
          },
          totalParticipants: 10,
          lastUpdated: mockRanking.lastUpdated,
        },
      });
    });

    it("deve retornar posição do usuário para período yearly", async () => {
      // Arrange
      mockReq.params = { userId: "user456", period: "yearly" };
      const expectedYear = String(new Date().getFullYear());

      const mockRanking = {
        period: "yearly",
        date: expectedYear,
        entries: [
          {
            userId: "user456",
            userName: "Another User",
            cardsReviewed: 500,
            rank: 10,
            xpEarned: 2500,
            streakDays: 25,
          },
        ],
        totalParticipants: 50,
        lastUpdated: new Date("2025-11-17T10:00:00Z"),
      };

      mockRankingService.getUserRankPosition.mockResolvedValue(10);
      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRankingService.getUserRankPosition).toHaveBeenCalledWith(
        "user456",
        "yearly",
        expectedYear
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          userId: "user456",
          period: "yearly",
          targetPeriod: expectedYear,
          position: 10,
          userEntry: {
            userName: "Another User",
            cardsReviewed: 500,
            xpEarned: 2500,
            streakDays: 25,
          },
          totalParticipants: 50,
          lastUpdated: mockRanking.lastUpdated,
        },
      });
    });

    it("deve retornar erro 400 para userId missing", async () => {
      // Arrange
      mockReq.params = { period: "monthly" }; // Sem userId

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "userId é obrigatório",
        code: "MISSING_USER_ID",
      });
    });

    it("deve retornar erro 400 para period missing", async () => {
      // Arrange
      mockReq.params = { userId: "user123" }; // Sem period

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "period é obrigatório",
        code: "MISSING_PERIOD",
      });
    });

    it("deve retornar erro 400 para period inválido", async () => {
      // Arrange
      mockReq.params = { userId: "user123", period: "weekly" }; // Period inválido

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Period deve ser 'monthly' ou 'yearly'",
        code: "INVALID_PERIOD",
      });
    });

    it("deve retornar erro 404 quando usuário não encontrado no ranking", async () => {
      // Arrange
      mockReq.params = { userId: "user-inexistente", period: "monthly" };
      mockRankingService.getUserRankPosition.mockResolvedValue(-1);

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Usuário não encontrado no ranking para o período",
        code: "USER_NOT_IN_RANKING",
      });
    });

    it("deve retornar userEntry null quando usuário não está nas entradas", async () => {
      // Arrange
      mockReq.params = { userId: "user789", period: "monthly" };
      const currentDate = new Date();
      const expectedPeriod = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

      const mockRanking = {
        period: "monthly",
        date: expectedPeriod,
        entries: [], // Ranking vazio
        totalParticipants: 0,
        lastUpdated: new Date(),
      };

      mockRankingService.getUserRankPosition.mockResolvedValue(50); // Posição válida mas não nas top entries
      mockRankingService.getRanking.mockResolvedValue(mockRanking);

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          userId: "user789",
          period: "monthly",
          targetPeriod: expectedPeriod,
          position: 50,
          userEntry: null, // Deve ser null quando não encontrado
          totalParticipants: 0,
          lastUpdated: mockRanking.lastUpdated,
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("deve tratar erros internos em getMonthlyRanking", async () => {
      // Arrange
      mockReq.params = { date: "2025-11" };
      mockRankingService.getRanking.mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await controller.getMonthlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    });

    it("deve tratar erros internos em getYearlyRanking", async () => {
      // Arrange
      mockReq.params = { year: "2025" };
      mockRankingService.getRanking.mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await controller.getYearlyRanking(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    });

    it("deve tratar erros internos em getUserPosition", async () => {
      // Arrange
      mockReq.params = { userId: "user123", period: "monthly" };
      mockRankingService.getUserRankPosition.mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await controller.getUserPosition(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
      });
    });
  });
});
