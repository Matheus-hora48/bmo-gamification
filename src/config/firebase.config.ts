import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const defaultServiceAccountPath = path.resolve(
  __dirname,
  "../../firebase-service-account.json"
);

function loadServiceAccount(): ServiceAccount | null {
  // 1. Tentar carregar das variáveis de ambiente (produção)
  const inlineCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (inlineCredentials) {
    try {
      return JSON.parse(inlineCredentials) as ServiceAccount;
    } catch (error) {
      console.warn("Erro ao parsear FIREBASE_SERVICE_ACCOUNT_JSON:", error);
    }
  }

  // 2. Tentar carregar do arquivo (desenvolvimento)
  const customPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const resolvedPath = customPath
    ? path.resolve(process.cwd(), customPath)
    : defaultServiceAccountPath;

  if (existsSync(resolvedPath)) {
    try {
      const fileContents = readFileSync(resolvedPath, "utf8");
      return JSON.parse(fileContents) as ServiceAccount;
    } catch (error) {
      console.warn(
        `Erro ao carregar arquivo Firebase em "${resolvedPath}":`,
        error
      );
    }
  }

  // 3. Se não conseguiu carregar de nenhuma forma
  console.warn(
    `Credenciais do Firebase não encontradas. Tentativas:\n` +
      `- Variável FIREBASE_SERVICE_ACCOUNT_JSON: ${inlineCredentials ? "Definida mas inválida" : "Não definida"}\n` +
      `- Arquivo em "${resolvedPath}": ${existsSync(resolvedPath) ? "Existe mas inválido" : "Não existe"}\n` +
      `Firebase será inicializado sem credenciais (modo compatibilidade).`
  );

  return null;
}

function initializeFirebase() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Modo compatibilidade - inicializar sem credenciais
    // Isso funcionará se as credenciais padrão do ambiente estiverem disponíveis
    console.log("Inicializando Firebase com credenciais padrão do ambiente...");
    return admin.initializeApp();
  }
}

const firebaseApp = initializeFirebase();

const firestore = admin.firestore(firebaseApp);
firestore.settings({ ignoreUndefinedProperties: true });

const usersCollection = firestore.collection("users");
const achievementsCollection = firestore.collection("achievements");
const userAchievementsCollection = firestore.collection("userAchievements");
const dailyProgressCollection = firestore.collection("dailyProgress");
const xpTransactionsCollection = firestore.collection("xpTransactions");
const streaksCollection = firestore.collection("streaks");
const userMetricsCollection = firestore.collection("userMetrics");

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
  userMetricsDoc: (userId: string) => userMetricsCollection.doc(userId),
} as const;

export { firebaseApp, firestore };
