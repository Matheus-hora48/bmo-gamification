#!/usr/bin/env node

/**
 * Script para gerar a variável FIREBASE_SERVICE_ACCOUNT_JSON para o Render
 * 
 * Execute: node scripts/generate-firebase-env.js
 */

const fs = require('fs');
const path = require('path');

const firebaseConfigPath = path.join(__dirname, '..', 'firebase-service-account.json');

if (!fs.existsSync(firebaseConfigPath)) {
  console.error('❌ Arquivo firebase-service-account.json não encontrado!');
  console.log('📍 Certifique-se de que o arquivo existe em:', firebaseConfigPath);
  process.exit(1);
}

try {
  const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  const configJson = JSON.parse(configContent);
  
  // Minificar o JSON (remover espaços e quebras de linha)
  const minifiedJson = JSON.stringify(configJson);
  
  console.log('✅ Firebase config carregado com sucesso!');
  console.log('📋 Copie a linha abaixo e cole no Render como valor da variável FIREBASE_SERVICE_ACCOUNT_JSON:\n');
  console.log('FIREBASE_SERVICE_ACCOUNT_JSON=' + minifiedJson);
  console.log('\n🎯 Ou apenas o valor (sem o FIREBASE_SERVICE_ACCOUNT_JSON=):');
  console.log(minifiedJson);
  
} catch (error) {
  console.error('❌ Erro ao processar arquivo Firebase:', error.message);
  process.exit(1);
}