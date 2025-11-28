import admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import { firestoreCollections } from "../config/firebase.config";
import type { Achievement } from "../models/Achievement";
import {
  isValidAchievement,
  normalizeAchievement,
} from "../models/Achievement";
import type { DailyProgress } from "../models/DailyProgress";
import { isValidDailyProgress } from "../models/DailyProgress";
import type { StreakData } from "../models/StreakData";
import { isValidStreakData, sortStreakHistory } from "../models/StreakData";
import type { UserProgress } from "../models/UserProgress";
import {
  UserProgressHelpers,
  isValidUserProgress,
} from "../models/UserProgress";
import type { UserAchievementProgress } from "../models/UserAchievement";
import {
  isValidUserAchievementProgress,
  normalizeUserAchievementProgress,
} from "../models/UserAchievement";
import type { XPTransaction } from "../models/XPTransaction";
import { isValidXPTransaction, XPSource } from "../models/XPTransaction";

type FirestoreCollections = typeof firestoreCollections;
type FieldValueNamespace = typeof admin.firestore.FieldValue;

export type UserProgressUpdate = Partial<
  Omit<
    UserProgress,
    | "userId"
    | "createdAt"
    | "achievements"
    | "lastActivityDate"
    | "currentStreak"
    | "longestStreak"
  > & {
    achievements?: string[];
    lastActivityDate?: Date | FirebaseFirestore.Timestamp | null;
    currentStreak?: number;
    longestStreak?: number;
  }
>;

export type DailyProgressUpdate = Partial<
  Omit<DailyProgress, "userId" | "date"> & {
    timestamp?: Date | FirebaseFirestore.Timestamp;
  }
>;

export type UserAchievementProgressUpdate = Partial<
  Pick<
    UserAchievementProgress,
    "progress" | "claimed" | "unlockedAt" | "notificationSeen"
  >
>;

export type StreakUpdate = Partial<
  Pick<StreakData, "current" | "longest" | "history" | "lastUpdate">
>;

const DEFAULT_USER_PROGRESS: Omit<UserProgress, "userId"> = {
  level: 1,
  currentXP: 0,
  totalXP: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalCardsReviewed: 0,
  lastActivityDate: null,
  achievements: [],
  createdAt: new Date(0),
};

export class FirestoreService {
  constructor(
    private readonly collections: FirestoreCollections = firestoreCollections,
    private readonly fieldValue: FieldValueNamespace = admin.firestore
      .FieldValue
  ) {}

  async getUserProgress(userId: string): Promise<UserProgress> {
    const snapshot = await this.collections.userProfileDoc(userId).get();

    if (!snapshot.exists) {
      throw new Error(`Progresso do usuário "${userId}" não encontrado.`);
    }

    const data = snapshot.data() ?? {};
    const mapped = this.mapUserProgress(userId, data);

    if (!isValidUserProgress(mapped)) {
      throw new Error(
        `Documento de progresso do usuário "${userId}" possui dados inválidos.`
      );
    }

    return UserProgressHelpers.sanitize(mapped);
  }

  async createUserProgress(userId: string): Promise<UserProgress> {
    const document = {
      ...DEFAULT_USER_PROGRESS,
      userId,
      createdAt: this.fieldValue.serverTimestamp(),
      lastActivityDate: null,
    } satisfies Record<string, unknown>;

    await this.collections
      .userProfileDoc(userId)
      .set(document, { merge: false });

    return this.getUserProgress(userId);
  }

  async updateUserProgress(
    userId: string,
    partial: UserProgressUpdate
  ): Promise<UserProgress> {
    const sanitized = this.removeUndefined({
      ...partial,
      achievements: Array.isArray(partial.achievements)
        ? [
            ...new Set(
              partial.achievements.map((id) => id.trim()).filter(Boolean)
            ),
          ]
        : undefined,
      lastActivityDate: partial.lastActivityDate ?? undefined,
      currentStreak:
        typeof partial.currentStreak === "number"
          ? Math.max(0, Math.floor(partial.currentStreak))
          : undefined,
      longestStreak:
        typeof partial.longestStreak === "number"
          ? Math.max(0, Math.floor(partial.longestStreak))
          : undefined,
      updatedAt: this.fieldValue.serverTimestamp(),
    });

    await this.collections.userProfileDoc(userId).set(sanitized, {
      merge: true,
    });

    return this.getUserProgress(userId);
  }

  async getDailyProgress(userId: string, date: string): Promise<DailyProgress> {
    const snapshot = await this.collections
      .dailyProgressEntry(userId, date)
      .get();

    if (!snapshot.exists) {
      throw new Error(
        `Progresso diário do usuário "${userId}" para "${date}" não encontrado.`
      );
    }

    const data = snapshot.data() ?? {};
    const mapped = this.mapDailyProgress(userId, date, data);

    if (!isValidDailyProgress(mapped)) {
      throw new Error(
        `Documento de progresso diário do usuário "${userId}" está inválido.`
      );
    }

    return mapped;
  }

  async updateDailyProgress(
    userId: string,
    date: string,
    update: DailyProgressUpdate
  ): Promise<DailyProgress> {
    const payload = this.removeUndefined({
      userId,
      date,
      ...update,
      timestamp: update.timestamp ?? this.fieldValue.serverTimestamp(),
    });

    await this.collections
      .dailyProgressEntry(userId, date)
      .set(payload, { merge: true });

    return this.getDailyProgress(userId, date);
  }

  async createXPTransaction(transaction: XPTransaction): Promise<void> {
    if (!isValidXPTransaction(transaction)) {
      throw new Error("Transação de XP inválida.");
    }

    const payload: Record<string, unknown> = {
      ...transaction,
      timestamp: transaction.timestamp ?? this.fieldValue.serverTimestamp(),
    };

    await this.collections
      .xpTransactionEntry(transaction.userId, transaction.id)
      .set(payload, { merge: false });
  }

  async getUserXPTransactions(
    userId: string,
    limit = 25
  ): Promise<XPTransaction[]> {
    const cappedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const querySnapshot = await this.collections
      .xpTransactionEntries(userId)
      .orderBy("timestamp", "desc")
      .limit(cappedLimit)
      .get();

    return querySnapshot.docs.map((doc) => this.mapXPTransaction(doc, userId));
  }

  async getAchievement(achievementId: string): Promise<Achievement> {
    const snapshot = await this.collections.achievementDoc(achievementId).get();

    if (!snapshot.exists) {
      throw new Error(`Conquista "${achievementId}" não encontrada.`);
    }

    const achievement = this.mapAchievement(snapshot);

    if (!isValidAchievement(achievement)) {
      throw new Error(
        `Documento da conquista "${achievementId}" possui dados inválidos.`
      );
    }

    return achievement;
  }

  async getAllAchievements(): Promise<Achievement[]> {
    const snapshot = await this.collections.achievements().get();
    const achievements = snapshot.docs
      .map((doc) => this.mapAchievement(doc))
      .filter((achievement) => isValidAchievement(achievement));

    return achievements;
  }

  async getUserAchievements(
    userId: string
  ): Promise<UserAchievementProgress[]> {
    const snapshot = await this.collections
      .userAchievementEntries(userId)
      .get();

    return snapshot.docs.map((doc) =>
      this.mapUserAchievement(userId, doc.id, doc.data() ?? {})
    );
  }

  /**
   * Desbloqueia uma conquista de forma atômica usando transação.
   * Retorna o progresso atualizado e um flag indicando se foi um novo desbloqueio.
   */
  async unlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<{ progress: UserAchievementProgress; isNewUnlock: boolean }> {
    const entryRef = this.collections.userAchievementEntry(
      userId,
      achievementId
    );

    const result = await admin.firestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(entryRef);
      const data = snapshot.data() ?? {};

      // Se já está desbloqueada, não fazer nada (evita race condition)
      if (snapshot.exists && data.unlockedAt !== null && data.unlockedAt !== undefined) {
        return {
          progress: this.mapUserAchievement(userId, achievementId, data),
          isNewUnlock: false,
        };
      }

      // Novo desbloqueio
      const payload = this.removeUndefined({
        userId,
        achievementId,
        progress: 100,
        claimed: false,
        unlockedAt: this.fieldValue.serverTimestamp(),
        notificationSeen: false,
        updatedAt: this.fieldValue.serverTimestamp(),
      });

      transaction.set(entryRef, payload, { merge: true });

      return {
        progress: this.mapUserAchievement(userId, achievementId, {
          ...data,
          ...payload,
        }),
        isNewUnlock: true,
      };
    });

    return result;
  }

  async markAllAchievementsAsSeen(userId: string): Promise<void> {
    const userAchievementsRef = this.collections.userAchievementEntries(userId);
    const snapshot = await userAchievementsRef
      .where("unlockedAt", "!=", null)
      .where("notificationSeen", "==", false)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        notificationSeen: true,
        updatedAt: this.fieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
  }

  async updateAchievementProgress(
    userId: string,
    achievementId: string,
    update: UserAchievementProgressUpdate
  ): Promise<UserAchievementProgress> {
    const entryRef = this.collections.userAchievementEntry(
      userId,
      achievementId
    );

    const payload = this.removeUndefined({
      userId,
      achievementId,
      ...update,
      updatedAt: this.fieldValue.serverTimestamp(),
    });

    await entryRef.set(payload, { merge: true });

    const snapshot = await entryRef.get();
    const data = snapshot.data() ?? {};

    return this.mapUserAchievement(userId, achievementId, data);
  }

  async getStreakData(userId: string): Promise<StreakData> {
    const snapshot = await this.collections.streaksDoc(userId).get();

    if (!snapshot.exists) {
      throw new Error(`Dados de streak para "${userId}" não encontrados.`);
    }

    const data = snapshot.data() ?? {};
    const mapped = this.mapStreakData(userId, data);

    if (!isValidStreakData(mapped)) {
      throw new Error(`Documento de streak do usuário "${userId}" inválido.`);
    }

    return mapped;
  }

  async updateStreak(
    userId: string,
    update: StreakUpdate
  ): Promise<StreakData> {
    const payload = this.removeUndefined({
      userId,
      ...update,
      history: update.history ? sortStreakHistory(update.history) : undefined,
      lastUpdate: update.lastUpdate ?? this.fieldValue.serverTimestamp(),
    });

    await this.collections.streaksDoc(userId).set(payload, { merge: true });

    return this.getStreakData(userId);
  }

  /**
   * Obtém o progresso específico de uma conquista de um usuário
   */
  async getUserAchievementProgress(
    userId: string,
    achievementId: string
  ): Promise<UserAchievementProgress | null> {
    const snapshot = await this.collections
      .userAchievementEntry(userId, achievementId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return this.mapUserAchievement(
      userId,
      achievementId,
      snapshot.data() ?? {}
    );
  }

  /**
   * Conta quantas transações de XP existem de uma fonte específica
   */
  async countXPTransactionsBySource(
    userId: string,
    source: XPSource
  ): Promise<number> {
    const snapshot = await this.collections
      .xpTransactionEntries(userId)
      .where("source", "==", source)
      .count()
      .get();

    return snapshot.data().count;
  }

  // =============================================================================
  // STATISTICS & RANKINGS SUPPORT METHODS
  // =============================================================================

  /**
   * Busca todos os IDs de usuários que possuem progresso
   * @returns Array com IDs de usuários
   */
  async getAllUserIds(): Promise<string[]> {
    try {
      const snapshot = await this.collections.users().listDocuments();
      return snapshot.map((doc) => doc.id);
    } catch (error) {
      throw new Error(
        `Erro ao buscar usuários: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Busca transações de XP por período e fonte
   */
  async getXPTransactionsByPeriod(
    startDate: Date,
    endDate: Date,
    source?: XPSource
  ): Promise<XPTransaction[]> {
    try {
      // Usar collection group para buscar em todas as subcollections de transactions
      let query = admin
        .firestore()
        .collectionGroup("transactions")
        .where("timestamp", ">=", startDate)
        .where("timestamp", "<=", endDate);

      if (source) {
        query = query.where("source", "==", source);
      }

      const snapshot = await query.get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        // Extrair userId do path do documento: xpTransactions/{userId}/transactions/{docId}
        const pathParts = doc.ref.path.split("/");
        const userId = pathParts[1] || "";

        return this.mapXPTransaction(doc as any, userId);
      });
    } catch (error) {
      console.error("Erro ao buscar transações por período:", error);
      return [];
    }
  }

  /**
   * Busca dados de sessões de estudo por período
   */
  async getStudySessionsByPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      sessionDurationMinutes: number;
      cardsReviewed: number;
      accuracyCount: number;
      totalAnswers: number;
      studyTime: string;
      timestamp: Date;
    }>
  > {
    try {
      const snapshot = await admin
        .firestore()
        .collection("studySessions")
        .where("userId", "==", userId)
        .where("timestamp", ">=", startDate)
        .where("timestamp", "<=", endDate)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          sessionDurationMinutes: data.sessionDurationMinutes || 0,
          cardsReviewed: data.cardsReviewed || 0,
          accuracyCount: data.accuracyCount || 0,
          totalAnswers: data.totalAnswers || 0,
          studyTime: data.studyTime || "afternoon",
          timestamp: data.timestamp?.toDate?.() || data.timestamp || new Date(),
        };
      });
    } catch (error) {
      console.error("Erro ao buscar sessões de estudo:", error);
      return [];
    }
  }

  async getUserFcmToken(userId: string): Promise<string | null> {
    try {
      const snapshot = await this.collections.userDoc(userId).get();
      if (!snapshot.exists) {
        return null;
      }
      const data = snapshot.data();
      return data?.fcmToken || null;
    } catch (error) {
      console.error(`Erro ao buscar FCM token para usuário ${userId}:`, error);
      return null;
    }
  }

  async getAllFcmTokens(): Promise<string[]> {
    try {
      const snapshot = await this.collections
        .users()
        .where("fcmToken", "!=", null)
        .get();

      const tokens: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fcmToken && typeof data.fcmToken === "string") {
          tokens.push(data.fcmToken);
        }
      });

      return tokens;
    } catch (error) {
      console.error("Erro ao buscar todos os tokens FCM:", error);
      return [];
    }
  }

  private mapUserProgress(userId: string, data: DocumentData): UserProgress {
    const progress: UserProgress = {
      userId,
      level: Number(data.level ?? DEFAULT_USER_PROGRESS.level),
      currentXP: Number(data.currentXP ?? DEFAULT_USER_PROGRESS.currentXP),
      totalXP: Number(data.totalXP ?? DEFAULT_USER_PROGRESS.totalXP),
      currentStreak: Number(
        data.currentStreak ?? DEFAULT_USER_PROGRESS.currentStreak
      ),
      longestStreak: Number(
        data.longestStreak ?? DEFAULT_USER_PROGRESS.longestStreak
      ),
      totalCardsReviewed: Number(
        data.totalCardsReviewed ?? DEFAULT_USER_PROGRESS.totalCardsReviewed
      ),
      lastActivityDate: data.lastActivityDate ?? null,
      achievements: Array.isArray(data.achievements)
        ? data.achievements.filter(
            (id: unknown): id is string => typeof id === "string"
          )
        : [],
      createdAt: data.createdAt ?? DEFAULT_USER_PROGRESS.createdAt,
    };

    return UserProgressHelpers.sanitize(progress);
  }

  private mapDailyProgress(
    userId: string,
    date: string,
    data: DocumentData
  ): DailyProgress {
    return {
      userId,
      date,
      cardsReviewed: Number(data.cardsReviewed ?? 0),
      goalMet: Boolean(data.goalMet ?? false),
      xpEarned: Number(data.xpEarned ?? 0),
      timestamp: data.timestamp ?? new Date(0),
    };
  }

  private mapXPTransaction(
    doc: FirebaseFirestore.QueryDocumentSnapshot<DocumentData>,
    userId: string
  ): XPTransaction {
    const data = doc.data();

    return {
      id: doc.id,
      userId,
      amount: Number(data.amount ?? 0),
      source: data.source,
      sourceId: data.sourceId ?? "",
      description: data.description ?? "",
      timestamp: data.timestamp ?? new Date(0),
    } as XPTransaction;
  }

  private mapAchievement(
    doc:
      | FirebaseFirestore.QueryDocumentSnapshot<DocumentData>
      | FirebaseFirestore.DocumentSnapshot<DocumentData>
  ): Achievement {
    const data = doc.data();

    if (!data) {
      throw new Error(`Documento de conquista "${doc.id}" sem dados.`);
    }

    if (!data.condition || typeof data.condition !== "object") {
      throw new Error(
        `Condição da conquista "${doc.id}" está ausente ou inválida.`
      );
    }

    const conditionRecord = data.condition as Record<string, unknown>;

    const achievement: Achievement = {
      id: doc.id,
      name: data.name ?? "",
      description: data.description ?? "",
      tier: data.tier,
      xpReward: Number(data.xpReward ?? 0),
      icon: data.icon ?? "",
      condition: {
        type: conditionRecord.type,
        target: Number(conditionRecord.target ?? 0),
        params:
          typeof conditionRecord.params === "object"
            ? (conditionRecord.params as Record<string, unknown>)
            : undefined,
      },
      createdAt: data.createdAt ?? new Date(0),
      updatedAt: data.updatedAt ?? undefined,
      isActive: data.isActive ?? true,
    } as Achievement;

    return normalizeAchievement(achievement);
  }

  private mapUserAchievement(
    userId: string,
    achievementId: string,
    data: DocumentData
  ): UserAchievementProgress {
    const progress: UserAchievementProgress = {
      userId,
      achievementId,
      unlockedAt: data.unlockedAt ?? null,
      progress: Number(data.progress ?? 0),
      claimed: Boolean(data.claimed ?? false),
      notificationSeen: Boolean(data.notificationSeen ?? false),
      updatedAt: data.updatedAt ?? null,
    };

    const normalized = normalizeUserAchievementProgress(progress);

    if (!isValidUserAchievementProgress(normalized)) {
      throw new Error(
        `Dados inválidos para conquista do usuário "${userId}" (${achievementId}).`
      );
    }

    return normalized;
  }

  private mapStreakData(userId: string, data: DocumentData): StreakData {
    const streak: StreakData = {
      userId,
      current: Number(data.current ?? 0),
      longest: Number(data.longest ?? 0),
      lastUpdate: data.lastUpdate ?? new Date(0),
      history: Array.isArray(data.history)
        ? data.history
            .map((item: unknown) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              const record = item as Record<string, unknown>;
              const date = typeof record.date === "string" ? record.date : null;
              const countValue = record.count;
              const count =
                typeof countValue === "number"
                  ? countValue
                  : Number.isFinite(Number(countValue))
                    ? Number(countValue)
                    : NaN;

              if (!date || Number.isNaN(count)) {
                return null;
              }

              return { date, count };
            })
            .filter(
              (entry): entry is { date: string; count: number } =>
                entry !== null
            )
        : [],
    };

    return {
      ...streak,
      history: sortStreakHistory(streak.history),
    };
  }

  private removeUndefined<T extends Record<string, unknown>>(object: T): T {
    const entries = Object.entries(object).filter(
      ([, value]) => value !== undefined
    );

    return Object.fromEntries(entries) as T;
  }
}

export const firestoreService = new FirestoreService();
