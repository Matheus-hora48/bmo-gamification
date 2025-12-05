import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { AchievementService } from "../src/services/achievement.service";
import { FirestoreService } from "../src/services/firestore.service";
import { AchievementType } from "../src/models/Achievement";

async function debugAchievements(userId: string) {
  const firestoreService = new FirestoreService(firestoreCollections);
  const achievementService = new AchievementService(firestoreService);

  console.log(`\n===== DEBUG CONQUISTAS USUÁRIO ${userId} =====\n`);

  // Verificar a conquista twenty_cards_in_day
  const allAchievements = await firestoreService.getAllAchievements();
  const twentyCardsAchievement = allAchievements.find(
    (a) => a.id === "twenty_cards_in_day"
  );
  console.log(
    "📋 Conquista twenty_cards_in_day:",
    twentyCardsAchievement ? "existe" : "NÃO EXISTE"
  );

  if (twentyCardsAchievement) {
    console.log(
      "   Condição:",
      JSON.stringify(twentyCardsAchievement.condition)
    );

    // Verificar se atende a condição
    const metrics = await firestoreService.getUserMetrics(userId);
    console.log(
      `   maxCardsInSingleDay do usuário: ${metrics.maxCardsInSingleDay}`
    );
    console.log(`   Target: ${twentyCardsAchievement.condition.target}`);
    console.log(
      `   Atende? ${metrics.maxCardsInSingleDay >= twentyCardsAchievement.condition.target}`
    );
  }

  // Verificar conquistas já desbloqueadas
  const userAchievements = await firestoreService.getUserAchievements(userId);
  console.log(
    `\n🏆 Conquistas do usuário: ${userAchievements?.achievements?.length || 0}`
  );
  userAchievements?.achievements?.forEach((a) => {
    console.log(`   - ${a.achievementId}`);
  });

  // Verificar se twenty_cards_in_day está desbloqueada
  const hasTwentyCards =
    userAchievements?.achievements?.some(
      (a) => a.achievementId === "twenty_cards_in_day"
    ) || false;
  console.log(
    `\n   twenty_cards_in_day desbloqueada? ${hasTwentyCards ? "SIM" : "NÃO"}`
  );

  // Tentar verificar e desbloquear conquistas CUSTOM
  console.log("\n🔍 Verificando conquistas CUSTOM...");
  const newAchievements = await achievementService.checkAchievements(userId, [
    AchievementType.CUSTOM,
  ]);
  console.log(`   Novas conquistas desbloqueadas: ${newAchievements.length}`);
  newAchievements.forEach((a) => console.log(`   - ${a.name}`));
}

debugAchievements("64")
  .then(() => process.exit(0))
  .catch(console.error);
