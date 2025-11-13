import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BMO Gamification API",
      version: "0.1.0",
      description:
        "API de Gamificação do BMO - Sistema de XP, níveis, streaks e conquistas",
      contact: {
        name: "BMO Team",
      },
    },
    servers: [
      {
        url: "http://localhost:3005",
        description: "Servidor de Desenvolvimento (Local)",
      },
      {
        url: "http://192.168.1.236:3005",
        description: "Servidor de Desenvolvimento (Rede Local)",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT do Firebase Authentication",
        },
      },
      schemas: {
        UserProgress: {
          type: "object",
          properties: {
            userId: { type: "string" },
            totalXP: { type: "number" },
            currentLevel: { type: "number" },
            currentLevelXP: { type: "number" },
            xpForNextLevel: { type: "number" },
            totalCardsReviewed: { type: "number" },
            totalDecksCreated: { type: "number" },
            totalCardsCreated: { type: "number" },
            currentStreak: { type: "number" },
            longestStreak: { type: "number" },
            lastActivityDate: { type: "string", format: "date" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DailyProgress: {
          type: "object",
          properties: {
            userId: { type: "string" },
            date: { type: "string", format: "date" },
            cardsReviewed: { type: "number" },
            xpEarned: { type: "number" },
            goalMet: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Achievement: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: ["xp", "level", "streak", "cards", "decks"],
            },
            title: { type: "string" },
            description: { type: "string" },
            icon: { type: "string" },
            requirement: { type: "number" },
            xpReward: { type: "number" },
          },
        },
        UserAchievement: {
          type: "object",
          properties: {
            userId: { type: "string" },
            achievementId: { type: "string" },
            unlockedAt: { type: "string", format: "date-time" },
            achievement: { $ref: "#/components/schemas/Achievement" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
            details: { type: "object" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
