import type { Request, Response } from "express";
import { SyncService } from "../services/sync.service";
import { logger } from "../utils/logger";
import {
  isValidSyncedDeckPayload,
  type SyncedDeckPayload,
} from "../models/SyncedDeck";
import {
  isValidSyncedCardPayload,
  type SyncedCardPayload,
} from "../models/SyncedCard";

/**
 * SyncController
 * Gerencia endpoints de sincronização entre backend PHP e Node.js
 */
export class SyncController {
  private readonly syncService: SyncService;

  constructor() {
    this.syncService = new SyncService();
  }

  /**
   * POST /api/sync/deck
   * Recebe sincronização de deck do backend PHP
   */
  syncDeck = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: SyncedDeckPayload = req.body;

      // Validar dados obrigatórios
      if (!isValidSyncedDeckPayload(payload)) {
        res.status(400).json({
          success: false,
          error:
            "Dados inválidos: deckId, userId e deckName são obrigatórios",
          code: "INVALID_PAYLOAD",
        });
        return;
      }

      // Salvar/atualizar deck sincronizado no Firestore
      const syncedDeck = await this.syncService.upsertDeck(payload);

      logger.info(
        `Deck ${payload.deckId} sincronizado com sucesso no Firestore`,
        { userId: payload.userId, deckName: payload.deckName }
      );

      res.status(200).json({
        success: true,
        message: "Deck sincronizado com sucesso",
        data: syncedDeck,
      });
    } catch (error: any) {
      logger.error("Erro ao sincronizar deck:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao sincronizar deck",
        code: "INTERNAL_ERROR",
        details: error.message,
      });
    }
  };

  /**
   * POST /api/sync/card
   * Recebe sincronização de card do backend PHP
   */
  syncCard = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: SyncedCardPayload = req.body;

      // Validar dados obrigatórios
      if (!isValidSyncedCardPayload(payload)) {
        res.status(400).json({
          success: false,
          error:
            "Dados inválidos: cardId, deckId, question e answer são obrigatórios",
          code: "INVALID_PAYLOAD",
        });
        return;
      }

      // Salvar/atualizar card sincronizado no Firestore
      const syncedCard = await this.syncService.upsertCard(payload);

      // Atualizar contador de cards no deck
      await this.syncService.updateDeckCardCount(payload.deckId);

      logger.info(
        `Card ${payload.cardId} sincronizado com sucesso no Firestore`,
        { deckId: payload.deckId }
      );

      res.status(200).json({
        success: true,
        message: "Card sincronizado com sucesso",
        data: syncedCard,
      });
    } catch (error: any) {
      logger.error("Erro ao sincronizar card:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao sincronizar card",
        code: "INTERNAL_ERROR",
        details: error.message,
      });
    }
  };

  /**
   * GET /api/sync/status
   * Retorna status de sincronização
   */
  getSyncStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.syncService.getSyncStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Erro ao buscar status de sincronização:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao buscar status",
        code: "INTERNAL_ERROR",
        details: error.message,
      });
    }
  };

  /**
   * POST /api/sync/clean-logs
   * Limpa logs antigos de sincronização
   */
  cleanOldLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { daysToKeep } = req.body;
      const days = daysToKeep || 30;

      await this.syncService.cleanOldLogs(days);

      res.status(200).json({
        success: true,
        message: `Logs mais antigos que ${days} dias foram removidos`,
      });
    } catch (error: any) {
      logger.error("Erro ao limpar logs antigos:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao limpar logs",
        code: "INTERNAL_ERROR",
        details: error.message,
      });
    }
  };
}
