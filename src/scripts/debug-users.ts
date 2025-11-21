import dotenv from "dotenv";
import "../config/firebase.config";
import { firestoreCollections } from "../config/firebase.config";

dotenv.config();

async function debugUsers() {
  console.log("🔍 Iniciando diagnóstico da coleção 'users'...");

  try {
    // 1. Tentar ler o documento específico mencionado pelo usuário (ID 84)
    console.log("\n--- Verificando usuário ID '84' ---");
    const user84Doc = await firestoreCollections.userDoc("84").get();
    if (user84Doc.exists) {
      console.log("✅ Usuário 84 encontrado!");
      console.log("Dados:", JSON.stringify(user84Doc.data(), null, 2));
    } else {
      console.log("❌ Usuário 84 NÃO encontrado.");
    }

    // 2. Listar os primeiros 5 usuários da coleção para ver a estrutura
    console.log("\n--- Listando amostra da coleção 'users' ---");
    const snapshot = await firestoreCollections.users().limit(5).get();
    
    if (snapshot.empty) {
      console.log("⚠️ A coleção 'users' está vazia ou inacessível.");
    } else {
      console.log(`Encontrados ${snapshot.size} documentos.`);
      snapshot.forEach(doc => {
        console.log(`\nID: ${doc.id}`);
        const data = doc.data();
        // Mostrar apenas chaves ou dados relevantes para não poluir
        console.log("Campos:", Object.keys(data).join(", "));
        if (data.fcmToken) {
          console.log("✅ fcmToken encontrado:", data.fcmToken);
        } else {
          console.log("❌ fcmToken AUSENTE ou nulo");
        }
      });
    }

  } catch (error) {
    console.error("❌ Erro ao acessar Firestore:", error);
  }
}

debugUsers();
