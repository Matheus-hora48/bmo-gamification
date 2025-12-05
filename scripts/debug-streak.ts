import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";

async function debugStreak(userId: string) {
  const firestoreService = new FirestoreService(firestoreCollections);

  console.log(`\n===== DEBUG STREAK USUÁRIO ${userId} =====\n`);

  // 1. Buscar StreakData
  console.log("1. StreakData:");
  try {
    const streakData = await firestoreService.getStreakData(userId);
    console.log("   current:", streakData.current);
    console.log("   longest:", streakData.longest);
    console.log("   lastUpdate:", streakData.lastUpdate);
    console.log("   history (últimos 5):", streakData.history.slice(-5));
  } catch (e) {
    console.log("   ERRO:", (e as Error).message);
  }

  // 2. Buscar UserProgress
  console.log("\n2. UserProgress:");
  try {
    const progress = await firestoreService.getUserProgress(userId);
    console.log("   currentStreak:", progress.currentStreak);
    console.log("   longestStreak:", progress.longestStreak);
    console.log("   lastActivityDate:", progress.lastActivityDate);
  } catch (e) {
    console.log("   ERRO:", (e as Error).message);
  }

  // 3. Buscar DailyProgress dos últimos 5 dias
  console.log("\n3. DailyProgress (últimos 5 dias):");
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    try {
      const daily = await firestoreService.getDailyProgress(userId, dateStr);
      console.log(`   ${dateStr}: ${daily.cardsReviewed} cards, goalMet: ${daily.goalMet}`);
    } catch (e) {
      console.log(`   ${dateStr}: Sem dados`);
    }
  }
}

debugStreak("64").then(() => process.exit(0)).catch(console.error);
