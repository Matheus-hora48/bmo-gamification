import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const defaultServiceAccountPath = path.resolve(
  __dirname,
  "../../firebase-service-account.json"
);

function loadServiceAccount(): ServiceAccount {
  const inlineCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (inlineCredentials) {
    return JSON.parse(inlineCredentials) as ServiceAccount;
  }

  const customPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const resolvedPath = customPath
    ? path.resolve(process.cwd(), customPath)
    : defaultServiceAccountPath;

  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Arquivo de credenciais do Firebase não encontrado em "${resolvedPath}". ` +
        "Defina FIREBASE_SERVICE_ACCOUNT_PATH ou FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  const fileContents = readFileSync(resolvedPath, "utf8");

  try {
    return JSON.parse(fileContents) as ServiceAccount;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Não foi possível interpretar o arquivo de credenciais do Firebase. Motivo: ${message}`
    );
  }
}

const firebaseApp = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
    });

const firestore = admin.firestore(firebaseApp);
firestore.settings({ ignoreUndefinedProperties: true });

const usersCollection = firestore.collection("users");
const achievementsCollection = firestore.collection("achievements");
const userAchievementsCollection = firestore.collection("userAchievements");
const dailyProgressCollection = firestore.collection("dailyProgress");
const xpTransactionsCollection = firestore.collection("xpTransactions");
const streaksCollection = firestore.collection("streaks");

export const firestoreCollections = {
  users: () => usersCollection,
  userDoc: (userId: string) => usersCollection.doc(userId),
  userProfileCollection: (userId: string) =>
    usersCollection.doc(userId).collection("profile"),
  userProfileDoc: (userId: string) =>
    usersCollection.doc(userId).collection("profile").doc("profile"),
  achievements: () => achievementsCollection,
  achievementDoc: (achievementId: string) =>
    achievementsCollection.doc(achievementId),
  userAchievementsRoot: () => userAchievementsCollection,
  userAchievementsDoc: (userId: string) =>
    userAchievementsCollection.doc(userId),
  userAchievementEntry: (userId: string, entryId: string) =>
    userAchievementsCollection
      .doc(userId)
      .collection("achievements")
      .doc(entryId),
  userAchievementEntries: (userId: string) =>
    userAchievementsCollection.doc(userId).collection("achievements"),
  dailyProgressDoc: (userId: string) => dailyProgressCollection.doc(userId),
  dailyProgressEntries: (userId: string) =>
    dailyProgressCollection.doc(userId).collection("days"),
  dailyProgressEntry: (userId: string, date: string) =>
    dailyProgressCollection.doc(userId).collection("days").doc(date),
  xpTransactionsDoc: (userId: string) => xpTransactionsCollection.doc(userId),
  xpTransactionEntries: (userId: string) =>
    xpTransactionsCollection.doc(userId).collection("transactions"),
  xpTransactionEntry: (userId: string, entryId: string) =>
    xpTransactionsCollection
      .doc(userId)
      .collection("transactions")
      .doc(entryId),
  streaksDoc: (userId: string) => streaksCollection.doc(userId),
} as const;

export { firebaseApp, firestore };
