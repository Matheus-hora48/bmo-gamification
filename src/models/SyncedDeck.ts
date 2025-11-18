import admin from "firebase-admin";

/**
 * Model: SyncedDeck
 * Representa um deck sincronizado do backend PHP
 */
export interface SyncedDeck {
  deckId: number;
  userId: number;
  deckName: string;
  description: string;
  totalCards: number;
  syncedFrom: "php_backend";
  firstSyncedAt: admin.firestore.Timestamp;
  lastSyncedAt: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Payload para criação/atualização de deck sincronizado
 */
export interface SyncedDeckPayload {
  deckId: number;
  userId: number;
  deckName: string;
  totalCards?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Valida se os dados obrigatórios do deck estão presentes
 */
export function isValidSyncedDeckPayload(
  payload: any
): payload is SyncedDeckPayload {
  return (
    typeof payload === "object" &&
    typeof payload.deckId === "number" &&
    typeof payload.userId === "number" &&
    typeof payload.deckName === "string" &&
    payload.deckName.trim().length > 0
  );
}
