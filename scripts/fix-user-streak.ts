import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";

/**
 * Script para corrigir o streak de um usuário específico
 *
 * Uso: npx tsx scripts/fix-user-streak.ts <userId> [streakValue]
 *
 * Exemplos:
 *   npx tsx scripts/fix-user-streak.ts 84        # Define streak como 1
 *   npx tsx scripts/fix-user-streak.ts 84 5      # Define streak como 5
 */

async function fixUserStreak(userId: string, streakValue: number = 1) {
  const fs = new FirestoreService(firestoreCollections);
  const today = new Date().toISOString().split("T")[0] as string;

  console.log(`\n=== CORRIGINDO STREAK DO USUÁRIO ${userId} ===\n`);

  // 1. Buscar dados atuais (se existirem)
  let currentLongest = 0;
  let currentHistory: Array<{ date: string; count: number }> = [];

  try {
    const currentData = await fs.getStreakData(userId);
    currentLongest = currentData.longest;
    currentHistory = currentData.history || [];
    console.log("📊 Dados atuais encontrados:");
    console.log(`   current: ${currentData.current}`);
    console.log(`   longest: ${currentData.longest}`);
  } catch {
    console.log("📊 Nenhum dado de streak existente");
  }

  // 2. Verificar se já existe entrada para hoje no histórico
  const hasToday = currentHistory.some((h) => h.date === today);
  if (!hasToday) {
    currentHistory.push({ date: today, count: streakValue });
  } else {
    // Atualizar entrada existente
    currentHistory = currentHistory.map((h) =>
      h.date === today ? { ...h, count: streakValue } : h
    );
  }

  // 3. Atualizar streak
  try {
    await fs.updateStreak(userId, {
      current: streakValue,
      longest: Math.max(streakValue, currentLongest),
      history: currentHistory,
      lastUpdate: new Date(),
    });
    console.log(`✅ Streak atualizado para ${streakValue}`);
  } catch (e) {
    console.log("❌ Erro ao atualizar streak:", (e as Error).message);
    return;
  }

  // 4. Atualizar UserProgress
  try {
    await fs.updateUserProgress(userId, {
      currentStreak: streakValue,
      longestStreak: Math.max(streakValue, currentLongest),
      lastActivityDate: new Date(),
    });
    console.log("✅ UserProgress atualizado");
  } catch (e) {
    console.log("❌ Erro ao atualizar UserProgress:", (e as Error).message);
    return;
  }

  // 5. Verificação final
  try {
    const streak = await fs.getStreakData(userId);
    const progress = await fs.getUserProgress(userId);

    console.log("\n📋 Verificação final:");
    console.log(`   StreakData.current: ${streak.current}`);
    console.log(`   StreakData.longest: ${streak.longest}`);
    console.log(`   UserProgress.currentStreak: ${progress.currentStreak}`);
    console.log(`   UserProgress.longestStreak: ${progress.longestStreak}`);
  } catch (e) {
    console.log("\n❌ Erro na verificação:", (e as Error).message);
  }

  console.log("\n✨ Concluído!\n");
}

// Executar
const userId = process.argv[2];
const streakValue = parseInt(process.argv[3] || "1", 10);

if (!userId) {
  console.log("Uso: npx tsx scripts/fix-user-streak.ts <userId> [streakValue]");
  console.log("");
  console.log("Exemplos:");
  console.log(
    "  npx tsx scripts/fix-user-streak.ts 84        # Define streak como 1"
  );
  console.log(
    "  npx tsx scripts/fix-user-streak.ts 84 5      # Define streak como 5"
  );
  process.exit(1);
}

fixUserStreak(userId, streakValue)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
