import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";

async function debug(userId: string) {
  const firestoreService = new FirestoreService(firestoreCollections);

  console.log("1. getUserAchievements retorna:");
  const userAchievements = await firestoreService.getUserAchievements(userId);
  console.log("   Tipo:", typeof userAchievements);
  console.log("   É array?", Array.isArray(userAchievements));
  console.log("   Dados:", JSON.stringify(userAchievements, null, 2));

  console.log("\n2. getUserMetrics retorna:");
  const metrics = await firestoreService.getUserMetrics(userId);
  console.log("   maxCardsInSingleDay:", metrics.maxCardsInSingleDay);
  console.log("   profileCompleted:", metrics.profileCompleted);
  console.log("   marketplaceDecksAdded:", metrics.marketplaceDecksAdded?.length);
}

debug("64").then(() => process.exit(0)).catch(console.error);
