import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";
import { AchievementService } from "../src/services/achievement.service";
import { AchievementType } from "../src/models/Achievement";

async function testProfileComplete(userId: string) {
  const firestoreService = new FirestoreService(firestoreCollections);
  const achievementService = new AchievementService(firestoreService);

  console.log("1. Marcando perfil como completo...");
  await firestoreService.setProfileCompleted(userId, true);

  console.log("2. Verificando conquistas CUSTOM...");
  const newAchievements = await achievementService.checkAchievements(userId, [AchievementType.CUSTOM]);
  
  console.log(`   Novas conquistas: ${newAchievements.length}`);
  newAchievements.forEach(a => console.log(`   - ${a.name}`));

  console.log("\n3. Verificando métricas atualizadas...");
  const metrics = await firestoreService.getUserMetrics(userId);
  console.log("   profileCompleted:", metrics.profileCompleted);
}

testProfileComplete("64").then(() => process.exit(0)).catch(console.error);
