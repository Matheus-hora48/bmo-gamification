import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";
import { DAILY_GOAL_TARGET } from "../src/config/constants";

/**
 * Script para recalcular o streak de um usuário com base no histórico real de dailyProgress
 */
async function recalculateStreak(userId: string) {
  const firestoreService = new FirestoreService(firestoreCollections);

  console.log(`\n===== RECALCULANDO STREAK DO USUÁRIO ${userId} =====\n`);

  // Buscar todos os dailyProgress do usuário usando dailyProgressEntries
  const snapshot = await firestoreCollections.dailyProgressEntries(userId)
    .orderBy("date", "desc")
    .limit(60)
    .get();

  if (snapshot.empty) {
    console.log("Nenhum registro de progresso diário encontrado.");
    return;
  }

  // Mapear os dias com meta atingida
  const daysWithGoalMet: string[] = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.goalMet && data.cardsReviewed >= DAILY_GOAL_TARGET) {
      daysWithGoalMet.push(data.date);
    }
  });

  console.log("Dias com meta atingida:", daysWithGoalMet.sort().reverse());

  // Calcular streak consecutivo a partir de hoje
  const today = new Date();
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Verificar se hoje atingiu a meta
  const todayStr = formatDate(checkDate);
  if (daysWithGoalMet.includes(todayStr)) {
    currentStreak = 1;
    checkDate.setDate(checkDate.getDate() - 1);

    // Continuar verificando dias anteriores
    while (true) {
      const dateStr = formatDate(checkDate);
      if (daysWithGoalMet.includes(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    // Se hoje não atingiu, verificar se ontem atingiu (streak em risco)
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = formatDate(checkDate);
    
    if (daysWithGoalMet.includes(yesterdayStr)) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);

      while (true) {
        const dateStr = formatDate(checkDate);
        if (daysWithGoalMet.includes(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  // Buscar o longest streak atual
  let longestStreak = currentStreak;
  try {
    const streakData = await firestoreService.getStreakData(userId);
    longestStreak = Math.max(currentStreak, streakData.longest);
  } catch (e) {
    // Primeiro streak
  }

  console.log(`\nStreak correto calculado: ${currentStreak}`);
  console.log(`Longest streak: ${longestStreak}`);

  // Atualizar no Firestore
  console.log("\nAtualizando streak no Firestore...");

  // Atualizar StreakData
  await firestoreService.updateStreak(userId, {
    current: currentStreak,
    longest: longestStreak,
    lastUpdate: new Date(),
  });

  // Atualizar UserProgress
  await firestoreService.updateUserProgress(userId, {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
  });

  console.log("\n✅ Streak atualizado com sucesso!");

  // Verificar resultado
  const updatedProgress = await firestoreService.getUserProgress(userId);
  console.log("\nUserProgress atualizado:");
  console.log("  currentStreak:", updatedProgress.currentStreak);
  console.log("  longestStreak:", updatedProgress.longestStreak);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

recalculateStreak("64").then(() => process.exit(0)).catch(console.error);
