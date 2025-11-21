import dotenv from "dotenv";
import "../config/firebase.config"; // Inicializa Firebase
import { FirestoreService } from "../services/firestore.service";
import {
  NotificationService,
  PushType,
} from "../services/notification.service";

dotenv.config();

async function runTest() {
  console.log("🚀 Iniciando teste de Broadcast Notification...");

  const firestoreService = new FirestoreService();
  const notificationService = new NotificationService();

  try {
    console.log("🔍 Buscando tokens FCM...");
    const tokens = await firestoreService.getAllFcmTokens();
    console.log(`✅ Encontrados ${tokens.length} tokens.`);

    if (tokens.length === 0) {
      console.warn("⚠️ Nenhum token encontrado. O teste de envio será pulado.");
      return;
    }

    console.log("📤 Enviando notificação de teste...");
    const result = await notificationService.sendBroadcastNotification(tokens, {
      title: "Teste de Broadcast 📢",
      body: "Esta é uma notificação de teste enviada pelo console.",
      pushType: PushType.NEWS_GENERAL, // Tipo 5 (News)
      additionalData: {
        test_id: "console_test_" + Date.now(),
      },
    });

    console.log("📊 Resultado do envio:");
    console.log(`   ✅ Sucessos: ${result.successCount}`);
    console.log(`   ❌ Falhas:   ${result.failureCount}`);

    console.log("🏁 Teste concluído!");
  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
}

runTest();
