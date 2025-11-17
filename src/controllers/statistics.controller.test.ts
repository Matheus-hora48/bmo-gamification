import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { StatisticsController } from "../controllers/statistics.controller";
import { StatisticsService } from "../services/statistics.service";
import { RankingService } from "../services/ranking.service";

// Mock dos services
vi.mock("../services/statistics.service");
vi.mock("../services/ranking.service");
vi.mock("../utils/logger");

describe("StatisticsController - updateSession", () => {
  let controller: StatisticsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockStatisticsService: any;
  let mockRankingService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup service mocks
    mockStatisticsService = {
      recordStudySession: vi.fn().mockResolvedValue(undefined),
      updateUserStatistics: vi.fn().mockResolvedValue({}),
    };

    mockRankingService = {
      getRanking: vi.fn(),
    };

    // Mock constructor
    (StatisticsService as any).mockImplementation(() => mockStatisticsService);
    (RankingService as any).mockImplementation(() => mockRankingService);

    controller = new StatisticsController();

    // Setup response mock
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // Setup default request
    mockReq = {
      params: {
        userId: "user-123",
      },
      body: {
        sessionDurationMinutes: 30,
        cardsReviewed: 15,
        accuracyCount: 12,
        totalAnswers: 15,
        studyTime: "morning",
      },
    };
  });

  it("deve registrar sessão de estudo com sucesso", async () => {
    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockStatisticsService.recordStudySession).toHaveBeenCalledWith({
      userId: "user-123",
      sessionDurationMinutes: 30,
      cardsReviewed: 15,
      accuracyCount: 12,
      totalAnswers: 15,
      studyTime: "morning",
    });

    expect(mockStatisticsService.updateUserStatistics).toHaveBeenCalledWith(
      "user-123"
    );

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message:
        "Sessão de estudo registrada e estatísticas atualizadas com sucesso",
      data: expect.objectContaining({
        userId: "user-123",
        sessionDurationMinutes: 30,
        cardsReviewed: 15,
        accuracyCount: 12,
        totalAnswers: 15,
        studyTime: "morning",
        timestamp: expect.any(String),
      }),
    });
  });

  it("deve registrar sessão com dados mínimos obrigatórios apenas", async () => {
    mockReq.body = {
      sessionDurationMinutes: 25,
    };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockStatisticsService.recordStudySession).toHaveBeenCalledWith({
      userId: "user-123",
      sessionDurationMinutes: 25,
      cardsReviewed: 0,
      accuracyCount: 0,
      totalAnswers: 0,
      studyTime: undefined,
    });

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          sessionDurationMinutes: 25,
          cardsReviewed: 0,
          accuracyCount: 0,
          totalAnswers: 0,
          studyTime: null,
        }),
      })
    );
  });

  it("deve retornar erro 400 quando userId ausente", async () => {
    mockReq.params = {};

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "userId é obrigatório",
      code: "MISSING_USER_ID",
    });

    expect(mockStatisticsService.recordStudySession).not.toHaveBeenCalled();
  });

  it("deve retornar erro 400 quando sessionDurationMinutes ausente", async () => {
    mockReq.body = {};

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "sessionDurationMinutes deve ser maior que 0",
      code: "INVALID_SESSION_DURATION",
    });
  });

  it("deve retornar erro 400 quando sessionDurationMinutes é zero ou negativo", async () => {
    mockReq.body = { sessionDurationMinutes: 0 };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "sessionDurationMinutes deve ser maior que 0",
      code: "INVALID_SESSION_DURATION",
    });

    mockReq.body = { sessionDurationMinutes: -5 };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "sessionDurationMinutes deve ser maior que 0",
      code: "INVALID_SESSION_DURATION",
    });
  });

  it("deve retornar erro 400 quando cardsReviewed é negativo", async () => {
    mockReq.body = {
      sessionDurationMinutes: 30,
      cardsReviewed: -5,
    };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "cardsReviewed deve ser maior ou igual a 0",
      code: "INVALID_CARDS_REVIEWED",
    });
  });

  it("deve retornar erro 400 quando accuracyCount > totalAnswers", async () => {
    mockReq.body = {
      sessionDurationMinutes: 30,
      accuracyCount: 15,
      totalAnswers: 10,
    };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "accuracyCount não pode ser maior que totalAnswers",
      code: "INVALID_ACCURACY_RATIO",
    });
  });

  it("deve retornar erro 400 quando studyTime é inválido", async () => {
    mockReq.body = {
      sessionDurationMinutes: 30,
      studyTime: "invalid_time",
    };

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "studyTime deve ser 'morning', 'afternoon' ou 'evening'",
      code: "INVALID_STUDY_TIME",
    });
  });

  it("deve aceitar valores válidos para studyTime", async () => {
    const validStudyTimes = ["morning", "afternoon", "evening"];

    for (const studyTime of validStudyTimes) {
      vi.clearAllMocks();

      mockReq.body = {
        sessionDurationMinutes: 30,
        studyTime,
      };

      await controller.updateSession(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockStatisticsService.recordStudySession).toHaveBeenCalledWith(
        expect.objectContaining({
          studyTime,
        })
      );
    }
  });

  it("deve retornar erro 500 quando service lança exceção", async () => {
    mockStatisticsService.recordStudySession.mockRejectedValue(
      new Error("Database error")
    );

    await controller.updateSession(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: "Erro interno do servidor",
      code: "INTERNAL_ERROR",
    });
  });

  it("deve chamar updateUserStatistics mesmo se recordStudySession falhar", async () => {
    mockStatisticsService.recordStudySession.mockRejectedValue(
      new Error("Session error")
    );

    await controller.updateSession(mockReq as Request, mockRes as Response);

    // Service deve ser chamado mas irá falhar e retornar erro 500
    expect(mockStatisticsService.recordStudySession).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
