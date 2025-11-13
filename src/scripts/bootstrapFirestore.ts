import admin from "firebase-admin";
import { firebaseApp, firestoreCollections } from "../config/firebase.config";

const { FieldValue } = admin.firestore;

type DocumentData = FirebaseFirestore.DocumentData;
type DocumentReference = FirebaseFirestore.DocumentReference<DocumentData>;

async function ensureDocument(
  reference: DocumentReference,
  data: DocumentData
): Promise<boolean> {
  const snapshot = await reference.get();

  if (snapshot.exists) {
    return false;
  }

  await reference.set(data);
  return true;
}

async function main() {
  const templateUserId = process.env.FIREBASE_TEMPLATE_USER_ID ?? "_template";
  const creationLogs: string[] = [];

  const userDocCreated = await ensureDocument(
    firestoreCollections.userDoc(templateUserId),
    {
      displayName: "Template User",
      level: 1,
      xp: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${userDocCreated ? "[CREATED]" : "[SKIPPED]"} users/${templateUserId}`
  );

  const userProfileCreated = await ensureDocument(
    firestoreCollections.userProfileDoc(templateUserId),
    {
      bio: "Atualize este perfil com dados reais.",
      avatarUrl: null,
      preferences: {},
      updatedAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${userProfileCreated ? "[CREATED]" : "[SKIPPED]"} users/${templateUserId}/profile/profile`
  );

  const achievementDocCreated = await ensureDocument(
    firestoreCollections.achievementDoc("__template__"),
    {
      name: "Defina conquistas reais",
      description: "Substitua este documento por uma conquista verdadeira.",
      category: "general",
      points: 0,
      createdAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${achievementDocCreated ? "[CREATED]" : "[SKIPPED]"} achievements/__template__`
  );

  const userAchievementsDocCreated = await ensureDocument(
    firestoreCollections.userAchievementsDoc(templateUserId),
    {
      userId: templateUserId,
      createdAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${userAchievementsDocCreated ? "[CREATED]" : "[SKIPPED]"} userAchievements/${templateUserId}`
  );

  const userAchievementEntryCreated = await ensureDocument(
    firestoreCollections.userAchievementEntry(templateUserId, "__template__"),
    {
      achievementId: "__template__",
      status: "locked",
      progress: 0,
      unlockedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${userAchievementEntryCreated ? "[CREATED]" : "[SKIPPED]"} userAchievements/${templateUserId}/achievements/__template__`
  );

  const dailyProgressDocCreated = await ensureDocument(
    firestoreCollections.dailyProgressDoc(templateUserId),
    {
      lastCompletedAt: FieldValue.serverTimestamp(),
      currentDay: 0,
      streak: 0,
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${dailyProgressDocCreated ? "[CREATED]" : "[SKIPPED]"} dailyProgress/${templateUserId}`
  );

  const xpTransactionsDocCreated = await ensureDocument(
    firestoreCollections.xpTransactionsDoc(templateUserId),
    {
      userId: templateUserId,
      balance: 0,
      createdAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${xpTransactionsDocCreated ? "[CREATED]" : "[SKIPPED]"} xpTransactions/${templateUserId}`
  );

  const xpTransactionEntryCreated = await ensureDocument(
    firestoreCollections.xpTransactionEntry(templateUserId, "__template__"),
    {
      amount: 0,
      reason: "placeholder",
      occurredAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${xpTransactionEntryCreated ? "[CREATED]" : "[SKIPPED]"} xpTransactions/${templateUserId}/transactions/__template__`
  );

  const streakDocCreated = await ensureDocument(
    firestoreCollections.streaksDoc(templateUserId),
    {
      current: 0,
      longest: 0,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      _scaffold: true,
    }
  );
  creationLogs.push(
    `${streakDocCreated ? "[CREATED]" : "[SKIPPED]"} streaks/${templateUserId}`
  );

  for (const log of creationLogs) {
    console.log(log);
  }
}

main()
  .then(() => {
    console.log("Firestore bootstrap finalizado.");
  })
  .catch((error) => {
    console.error("Falha ao criar coleções iniciais do Firestore:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await firebaseApp.delete().catch(() => undefined);
  });
