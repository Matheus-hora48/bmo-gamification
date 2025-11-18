import admin from "firebase-admin";

/**
 * Model: SyncLog
 * Registra logs de sincronização entre backends
 */
export interface SyncLog {
  syncType: "deck" | "card";
  direction: "php_to_nodejs";
  entityId: number;
  status: "success" | "failed";
  errorMessage?: string;
  syncedAt: admin.firestore.Timestamp;
}

/**
 * Estatísticas de sincronização
 */
export interface SyncStats {
  decks: {
    total_decks: number;
    synced_last_5min: number;
    oldest_sync: Date | null;
    newest_sync: Date | null;
  };
  cards: {
    total_cards: number;
    synced_last_5min: number;
  };
  lastUpdated: Date;
}
