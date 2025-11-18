import admin from "firebase-admin";
import { firestore } from "../config/firebase.config";
import { logger } from "../utils/logger";
import type { SyncedDeckPayload } from "../models/SyncedDeck";
import type { SyncedCardPayload } from "../models/SyncedCard";
import type { SyncStats } from "../models/SyncLog";

/**
 * SyncService
 * Gerencia sincronização de decks e cards do backend PHP para Firestore
 */
export class SyncService {
  /**
   * Insere ou atualiza deck sincronizado no Firestore
   */
  async upsertDeck(deckData: SyncedDeckPayload) {
    try {
      const docId = `${deckData.deckId}_${deckData.userId}`;
      const deckRef = firestore.collection("synced_decks").doc(docId);

      // Verificar se já existe
      const existingDoc = await deckRef.get();
      const now = admin.firestore.Timestamp.now();

      const deckPayload = {
        deckId: deckData.deckId,
        userId: deckData.userId,
        deckName: deckData.deckName,
        description: deckData.description || "",
        totalCards: deckData.totalCards || 0,
        syncedFrom: "php_backend" as const,
        lastSyncedAt: now,
        updatedAt: deckData.updatedAt
          ? admin.firestore.Timestamp.fromDate(new Date(deckData.updatedAt))
          : now,
      };

      if (existingDoc.exists) {
        // Update
        await deckRef.update(deckPayload);
      } else {
        // Create
        await deckRef.set({
          ...deckPayload,
          firstSyncedAt: now,
          createdAt: deckData.createdAt
            ? admin.firestore.Timestamp.fromDate(new Date(deckData.createdAt))
            : now,
        });
      }

      // Log de sucesso
      await this.logSync("deck", deckData.deckId, "success");

      logger.info(`Deck ${deckData.deckId} salvo no Firestore`, { docId });

      return { id: docId, ...deckPayload };
    } catch (error: any) {
      // Log de erro
      await this.logSync("deck", deckData.deckId, "failed", error.message);
      throw error;
    }
  }

  /**
   * Insere ou atualiza card sincronizado no Firestore
   */
  async upsertCard(cardData: SyncedCardPayload) {
    try {
      const docId = `${cardData.cardId}_${cardData.deckId}`;
      const cardRef = firestore.collection("synced_cards").doc(docId);

      // Verificar se já existe
      const existingDoc = await cardRef.get();
      const now = admin.firestore.Timestamp.now();

      const cardPayload = {
        cardId: cardData.cardId,
        deckId: cardData.deckId,
        question: cardData.question,
        answer: cardData.answer,
        syncedFrom: "php_backend" as const,
        lastSyncedAt: now,
        updatedAt: cardData.updatedAt
          ? admin.firestore.Timestamp.fromDate(new Date(cardData.updatedAt))
          : now,
      };

      if (existingDoc.exists) {
        // Update
        await cardRef.update(cardPayload);
      } else {
        // Create
        await cardRef.set({
          ...cardPayload,
          firstSyncedAt: now,
          createdAt: cardData.createdAt
            ? admin.firestore.Timestamp.fromDate(new Date(cardData.createdAt))
            : now,
        });
      }

      // Log de sucesso
      await this.logSync("card", cardData.cardId, "success");

      logger.info(`Card ${cardData.cardId} salvo no Firestore`, { docId });

      return { id: docId, ...cardPayload };
    } catch (error: any) {
      // Log de erro
      await this.logSync("card", cardData.cardId, "failed", error.message);
      throw error;
    }
  }

  /**
   * Atualiza contador de cards do deck no Firestore
   */
  async updateDeckCardCount(deckId: number) {
    try {
      // Buscar todos os cards do deck
      const cardsSnapshot = await firestore
        .collection("synced_cards")
        .where("deckId", "==", deckId)
        .get();

      const totalCards = cardsSnapshot.size;

      // Atualizar todos os decks que contêm este deckId
      const decksSnapshot = await firestore
        .collection("synced_decks")
        .where("deckId", "==", deckId)
        .get();

      const batch = firestore.batch();

      decksSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          totalCards,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      });

      await batch.commit();

      logger.info(
        `Contador de cards atualizado para deck ${deckId}: ${totalCards} cards`
      );
    } catch (error: any) {
      logger.error(
        `Erro ao atualizar contador de cards do deck ${deckId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Retorna estatísticas de sincronização do Firestore
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Buscar total de decks
      const decksSnapshot = await firestore.collection("synced_decks").get();
      const totalDecks = decksSnapshot.size;

      // Buscar decks sincronizados nos últimos 5 minutos
      const recentDecksSnapshot = await firestore
        .collection("synced_decks")
        .where(
          "lastSyncedAt",
          ">=",
          admin.firestore.Timestamp.fromDate(fiveMinutesAgo)
        )
        .get();
      const recentDecks = recentDecksSnapshot.size;

      // Buscar total de cards
      const cardsSnapshot = await firestore.collection("synced_cards").get();
      const totalCards = cardsSnapshot.size;

      // Buscar cards sincronizados nos últimos 5 minutos
      const recentCardsSnapshot = await firestore
        .collection("synced_cards")
        .where(
          "lastSyncedAt",
          ">=",
          admin.firestore.Timestamp.fromDate(fiveMinutesAgo)
        )
        .get();
      const recentCards = recentCardsSnapshot.size;

      // Buscar timestamps mais antigo e mais recente
      let oldestSync: Date | null = null;
      let newestSync: Date | null = null;

      decksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const syncDate = data.lastSyncedAt?.toDate();
        if (syncDate) {
          if (!oldestSync || syncDate < oldestSync) oldestSync = syncDate;
          if (!newestSync || syncDate > newestSync) newestSync = syncDate;
        }
      });

      return {
        decks: {
          total_decks: totalDecks,
          synced_last_5min: recentDecks,
          oldest_sync: oldestSync,
          newest_sync: newestSync,
        },
        cards: {
          total_cards: totalCards,
          synced_last_5min: recentCards,
        },
        lastUpdated: now,
      };
    } catch (error: any) {
      logger.error("Erro ao buscar estatísticas de sincronização:", error);
      throw error;
    }
  }

  /**
   * Busca deck sincronizado no Firestore
   */
  async getSyncedDeck(deckId: number, userId: number) {
    try {
      const docId = `${deckId}_${userId}`;
      const deckDoc = await firestore
        .collection("synced_decks")
        .doc(docId)
        .get();

      if (!deckDoc.exists) {
        return null;
      }

      return {
        id: deckDoc.id,
        ...deckDoc.data(),
      };
    } catch (error: any) {
      logger.error(
        `Erro ao buscar deck ${deckId} do usuário ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Registra log de sincronização no Firestore
   */
  private async logSync(
    syncType: "deck" | "card",
    entityId: number,
    status: "success" | "failed",
    errorMessage?: string
  ) {
    try {
      await firestore.collection("sync_logs").add({
        syncType,
        direction: "php_to_nodejs",
        entityId,
        status,
        errorMessage: errorMessage || null,
        syncedAt: admin.firestore.Timestamp.now(),
      });
    } catch (error: any) {
      logger.error("Erro ao registrar log de sincronização:", error);
      // Não lançar erro para não bloquear sincronização
    }
  }

  /**
   * Limpa logs antigos (opcional - executar periodicamente)
   */
  async cleanOldLogs(daysToKeep: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldLogsSnapshot = await firestore
        .collection("sync_logs")
        .where(
          "syncedAt",
          "<",
          admin.firestore.Timestamp.fromDate(cutoffDate)
        )
        .get();

      const batch = firestore.batch();

      oldLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info(
        `${oldLogsSnapshot.size} logs antigos removidos do Firestore`
      );
    } catch (error: any) {
      logger.error("Erro ao limpar logs antigos:", error);
    }
  }
}
