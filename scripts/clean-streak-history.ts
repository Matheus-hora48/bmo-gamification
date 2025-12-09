import "dotenv/config";
import { firestoreCollections } from "../src/config/firebase.config";
import { FirestoreService } from "../src/services/firestore.service";

/**
 * Script para limpar histórico de streak duplicado
 *
 * Remove entradas duplicadas do histórico, mantendo apenas a última de cada dia
 *
 * Uso: npx tsx scripts/clean-streak-history.ts <userId>
 */

async function cleanStreakHistory(userId: string) {
  const fs = new FirestoreService(firestoreCollections);

  console.log(`\n=== LIMPANDO HISTÓRICO DE STREAK DO USUÁRIO ${userId} ===\n`);

  // 1. Buscar dados atuais
  let streakData;
  try {
    streakData = await fs.getStreakData(userId);
    console.log("📊 Dados atuais:");
    console.log(`   current: ${streakData.current}`);
    console.log(`   longest: ${streakData.longest}`);
    console.log(`   histórico (${streakData.history?.length ?? 0} entradas):`);
    streakData.history?.forEach((h, i) => {
      console.log(`     ${i}: ${h.date} -> count ${h.count}`);
    });
  } catch (e) {
    console.log("❌ Erro ao buscar streak:", (e as Error).message);
    return;
  }

  if (!streakData.history || streakData.history.length === 0) {
    console.log("\n✅ Histórico vazio, nada a limpar");
    return;
  }

  // 2. Remover duplicatas (manter apenas a última entrada de cada dia)
  const historyByDate = new Map<string, { date: string; count: number }>();

  for (const entry of streakData.history) {
    // Se já existe uma entrada para este dia, manter a com maior count
    const existing = historyByDate.get(entry.date);
    if (!existing || entry.count > existing.count) {
      historyByDate.set(entry.date, entry);
    }
  }

  // Converter de volta para array e ordenar por data
  const cleanedHistory = Array.from(historyByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 3. Verificar se houve mudança
  const removedCount = streakData.history.length - cleanedHistory.length;

  if (removedCount === 0) {
    console.log("\n✅ Nenhuma duplicata encontrada");
    return;
  }

  console.log(`\n🔄 Encontradas ${removedCount} entradas duplicadas`);
  console.log("\n📋 Histórico limpo:");
  cleanedHistory.forEach((h, i) => {
    console.log(`   ${i}: ${h.date} -> count ${h.count}`);
  });

  // 4. Recalcular o streak atual baseado no histórico limpo
  // O streak atual deve ser o count da última entrada
  const lastEntry = cleanedHistory[cleanedHistory.length - 1];
  const correctCurrent = lastEntry?.count ?? 0;
  const correctLongest = Math.max(
    ...cleanedHistory.map((h) => h.count),
    streakData.longest
  );

  console.log(`\n📈 Valores corrigidos:`);
  console.log(`   current: ${streakData.current} -> ${correctCurrent}`);
  console.log(`   longest: ${streakData.longest} -> ${correctLongest}`);

  // 5. Salvar
  try {
    await fs.updateStreak(userId, {
      current: correctCurrent,
      longest: correctLongest,
      history: cleanedHistory,
      lastUpdate: new Date(),
    });
    console.log("\n✅ Streak atualizado com sucesso!");

    // Atualizar também o UserProgress
    await fs.updateUserProgress(userId, {
      currentStreak: correctCurrent,
      longestStreak: correctLongest,
    });
    console.log("✅ UserProgress sincronizado!");
  } catch (e) {
    console.log("❌ Erro ao salvar:", (e as Error).message);
    return;
  }

  // 6. Verificar resultado
  try {
    const updated = await fs.getStreakData(userId);
    console.log("\n📋 Verificação final:");
    console.log(`   current: ${updated.current}`);
    console.log(`   longest: ${updated.longest}`);
    console.log(`   histórico: ${updated.history?.length} entradas`);
  } catch (e) {
    console.log("❌ Erro na verificação:", (e as Error).message);
  }

  console.log("\n✨ Concluído!\n");
}

// Executar
const userId = process.argv[2];

if (!userId) {
  console.log("Uso: npx tsx scripts/clean-streak-history.ts <userId>");
  console.log("");
  console.log("Exemplo:");
  console.log("  npx tsx scripts/clean-streak-history.ts 84");
  process.exit(1);
}

cleanStreakHistory(userId)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
