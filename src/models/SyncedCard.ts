import admin from "firebase-admin";

/**
 * Model: SyncedCard
 * Representa um card sincronizado do backend PHP
 */
export interface SyncedCard {
  cardId: number;
  deckId: number;
  question: string;
  answer: string;
  syncedFrom: "php_backend";
  firstSyncedAt: admin.firestore.Timestamp;
  lastSyncedAt: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Payload para criação/atualização de card sincronizado
 */
export interface SyncedCardPayload {
  cardId: number;
  deckId: number;
  question: string;
  answer: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Valida se os dados obrigatórios do card estão presentes
 */
export function isValidSyncedCardPayload(
  payload: any
): payload is SyncedCardPayload {
  return (
    typeof payload === "object" &&
    typeof payload.cardId === "number" &&
    typeof payload.deckId === "number" &&
    typeof payload.question === "string" &&
    typeof payload.answer === "string" &&
    payload.question.trim().length > 0 &&
    payload.answer.trim().length > 0
  );
}
