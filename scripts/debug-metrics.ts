import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";

async function debugUserMetrics(userId: string) {
  console.log(`\n===== DEBUG MÉTRICAS USUÁRIO ${userId} =====\n`);
  
  // Buscar métricas
  const metricsDoc = await firestoreCollections.userMetricsDoc(userId).get();
  if (!metricsDoc.exists) {
    console.log("❌ Documento userMetrics NÃO existe!");
  } else {
    console.log("✅ Documento userMetrics existe:");
    console.log(JSON.stringify(metricsDoc.data(), null, 2));
  }

  // Buscar progresso do usuário
  const progressDoc = await firestoreCollections.userProgressDoc(userId).get();
  if (!progressDoc.exists) {
    console.log("❌ Documento userProgress NÃO existe!");
  } else {
    console.log("\n✅ Documento userProgress existe:");
    console.log(JSON.stringify(progressDoc.data(), null, 2));
  }

  // Buscar XP Transactions
  const xpTransactions = await firestoreCollections.xpTransactionsCollection()
    .where("userId", "==", userId)
    .get();
  
  console.log(`\n📊 XP Transactions: ${xpTransactions.size} registros`);
  
  const deckCreationCount = xpTransactions.docs.filter(doc => doc.data().source === "deck_creation").length;
  console.log(`   - Deck Creation: ${deckCreationCount}`);

  // Buscar dailyProgress
  const dailyProgressDocs = await firestoreCollections.dailyProgressCollection()
    .doc(userId)
    .collection("days")
    .orderBy("date", "desc")
    .limit(5)
    .get();
  
  console.log(`\n📅 Últimos 5 dias de progresso diário:`);
  dailyProgressDocs.forEach(doc => {
    const data = doc.data();
    console.log(`   ${data.date}: ${data.cardsReviewed} cards revisados`);
  });

  // Buscar conquistas desbloqueadas
  const achievements = await firestoreCollections.userAchievementsDoc(userId).get();
  if (achievements.exists) {
    const data = achievements.data();
    console.log(`\n🏆 Conquistas desbloqueadas: ${data?.achievements?.length || 0}`);
    data?.achievements?.forEach((a: any) => {
      console.log(`   - ${a.achievementId} (${new Date(a.unlockedAt._seconds * 1000).toLocaleDateString()})`);
    });
  }
}

debugUserMetrics("64").then(() => process.exit(0)).catch(console.error);
