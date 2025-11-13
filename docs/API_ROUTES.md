# Documentação das Rotas - BMO Gamification API

## Visão Geral

A API de Gamificação do BMO fornece endpoints para gerenciar o sistema de conquistas, XP, níveis e streaks. Todas as rotas requerem autenticação via token e são protegidas por rate limiting.

**Base URL:** `http://localhost:3005/api` (desenvolvimento)

**Autenticação:** Header `x-api-token` ou `Authorization: Bearer <token>`

**Rate Limit:** 100 requisições por 15 minutos por IP

---

## Endpoints

### Health Check

#### `GET /health`

Verifica o status da API (não requer autenticação).

**Response:**

```json
{
  "status": "ok"
}
```

---

### Gamification Routes

Todas as rotas abaixo requerem autenticação e estão sob o prefixo `/api/gamification`.

---

#### `POST /process-review`

Processa uma revisão de card e adiciona XP baseado na dificuldade.

**Body:**

```json
{
  "userId": "string",
  "cardId": "string",
  "difficulty": "again" | "hard" | "good" | "easy"
}
```

**XP por dificuldade:**

- `again`: 5 XP
- `hard`: 10 XP
- `good`: 15 XP
- `easy`: 20 XP

**Response:**

```json
{
  "success": true,
  "data": {
    "userProgress": {
      "userId": "string",
      "totalXP": 150,
      "currentLevel": 2,
      "currentXP": 50,
      "cardsReviewed": 10,
      "cardsCreated": 5,
      "decksCreated": 2,
      "currentStreak": 7,
      "longestStreak": 10,
      "lastReviewDate": "2025-11-11T10:00:00Z"
    },
    "dailyProgress": {
      "userId": "string",
      "date": "2025-11-11",
      "cardsReviewed": 15,
      "goalCompleted": false,
      "xpEarned": 75
    },
    "newAchievements": [
      {
        "id": "first_10_reviews",
        "name": "Primeiras 10 Revisões",
        "description": "Complete 10 revisões de cards",
        "tier": "bronze",
        "xpReward": 50
      }
    ],
    "leveledUp": true
  }
}
```

---

#### `POST /card-created`

Registra a criação de um novo card e adiciona 25 XP.

**Body:**

```json
{
  "userId": "string",
  "cardId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userProgress": {
      /* UserProgress */
    },
    "newAchievements": [
      /* Achievement[] */
    ],
    "leveledUp": false
  }
}
```

---

#### `POST /deck-created`

Registra a criação de um novo deck e adiciona 50 XP.

**Body:**

```json
{
  "userId": "string",
  "deckId": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userProgress": {
      /* UserProgress */
    },
    "newAchievements": [
      /* Achievement[] */
    ],
    "leveledUp": false
  }
}
```

---

#### `GET /progress/:userId`

Retorna o progresso completo do usuário.

**Params:**

- `userId` (string): ID do usuário

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "string",
    "totalXP": 1500,
    "currentLevel": 5,
    "currentXP": 200,
    "cardsReviewed": 150,
    "cardsCreated": 50,
    "decksCreated": 10,
    "currentStreak": 14,
    "longestStreak": 30,
    "lastReviewDate": "2025-11-11T15:30:00Z"
  }
}
```

---

#### `GET /daily-progress/:userId`

Retorna o progresso diário do usuário para uma data específica.

**Params:**

- `userId` (string): ID do usuário

**Query:**

- `date` (string, opcional): Data no formato `YYYY-MM-DD` (padrão: hoje)

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "string",
    "date": "2025-11-11",
    "cardsReviewed": 18,
    "goalCompleted": false,
    "xpEarned": 135
  }
}
```

---

#### `GET /achievements/:userId`

Retorna todas as conquistas desbloqueadas pelo usuário.

**Params:**

- `userId` (string): ID do usuário

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "userId": "string",
      "achievementId": "first_10_reviews",
      "achievement": {
        "id": "first_10_reviews",
        "name": "Primeiras 10 Revisões",
        "description": "Complete 10 revisões de cards",
        "tier": "bronze",
        "type": "reviews_completed",
        "target": 10,
        "xpReward": 50,
        "icon": "📚"
      },
      "unlockedAt": "2025-11-11T10:30:00Z",
      "progress": 10,
      "completed": true
    }
  ]
}
```

---

#### `POST /check-achievements/:userId`

Força a verificação de conquistas pendentes.

**Params:**

- `userId` (string): ID do usuário

**Body (opcional):**

```json
{
  "types": ["reviews_completed", "cards_created"]
}
```

**Tipos de conquista disponíveis:**

- `reviews_completed`: Número de revisões completas
- `cards_created`: Número de cards criados
- `decks_created`: Número de decks criados
- `streak_days`: Dias consecutivos de meta completa
- `level_reached`: Nível alcançado
- `total_xp`: XP total acumulado

**Response:**

```json
{
  "success": true,
  "data": {
    "newAchievements": [
      {
        "id": "streak_7_days",
        "name": "Sequência de 7 Dias",
        "description": "Mantenha uma sequência de 7 dias",
        "tier": "silver",
        "xpReward": 200
      }
    ]
  }
}
```

---

## Códigos de Erro

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Token de autenticação ausente."
}
```

### 400 Bad Request

```json
{
  "success": false,
  "error": "Parâmetros inválidos",
  "details": [
    {
      "field": "difficulty",
      "message": "Expected 'again' | 'hard' | 'good' | 'easy', received 'invalid'"
    }
  ]
}
```

### 429 Too Many Requests

```json
{
  "success": false,
  "error": "Muitas requisições deste IP. Tente novamente mais tarde."
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Erro ao processar requisição"
}
```

---

## Exemplos de Uso

### cURL

```bash
# Process card review
curl -X POST http://localhost:3005/api/gamification/process-review \
  -H "x-api-token: your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "cardId": "card456",
    "difficulty": "good"
  }'

# Get user progress
curl -X GET http://localhost:3005/api/gamification/progress/user123 \
  -H "x-api-token: your_token_here"

# Get daily progress
curl -X GET "http://localhost:3005/api/gamification/daily-progress/user123?date=2025-11-11" \
  -H "x-api-token: your_token_here"
```

### JavaScript (Fetch)

```javascript
const API_TOKEN = "your_token_here";
const BASE_URL = "http://localhost:3005/api";

// Process card review
async function processReview(userId, cardId, difficulty) {
  const response = await fetch(`${BASE_URL}/gamification/process-review`, {
    method: "POST",
    headers: {
      "x-api-token": API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, cardId, difficulty }),
  });

  return response.json();
}

// Get user progress
async function getUserProgress(userId) {
  const response = await fetch(`${BASE_URL}/gamification/progress/${userId}`, {
    headers: {
      "x-api-token": API_TOKEN,
    },
  });

  return response.json();
}
```

### Dart (Flutter)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class GamificationApiService {
  static const String _baseUrl = 'http://localhost:3005/api';
  static const String _apiToken = 'your_token_here';

  static Future<Map<String, dynamic>> processCardReview({
    required String userId,
    required String cardId,
    required String difficulty,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/gamification/process-review'),
      headers: {
        'x-api-token': _apiToken,
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'userId': userId,
        'cardId': cardId,
        'difficulty': difficulty,
      }),
    );

    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getUserProgress(String userId) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/gamification/progress/$userId'),
      headers: {
        'x-api-token': _apiToken,
      },
    );

    return jsonDecode(response.body);
  }
}
```

---

## Postman Collection

Importe a collection do Postman localizada em `postman/BMO_Gamification_API.postman_collection.json` para testar os endpoints facilmente.

A collection inclui:

- Todas as rotas configuradas
- Variáveis de ambiente (BASE_URL, API_TOKEN, TEST_USER_ID)
- Exemplos de request e response
- Autenticação pré-configurada

---

## Middlewares

### Authentication Middleware

Todas as rotas de gamificação requerem um token de autenticação válido enviado via:

- Header `x-api-token: <token>`
- Header `Authorization: Bearer <token>`

### Rate Limiting Middleware

Protege a API contra abuso limitando:

- **Janela:** 15 minutos
- **Máximo:** 100 requisições por IP
- **Headers de resposta:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

---

## Notas Importantes

1. **Meta Diária:** O usuário precisa revisar 20 cards por dia para manter o streak e ganhar 100 XP de bônus.

2. **Streak:** É atualizado automaticamente à meia-noite (00:00 Brasília) via cron job. Se a meta diária não for atingida, o streak é resetado.

3. **Level Up:** Fórmula quadrática: `XP_necessário = 100 * level²`
   - Nível 1: 100 XP
   - Nível 2: 400 XP total (100 + 300)
   - Nível 3: 900 XP total (400 + 500)

4. **Conquistas:** São verificadas automaticamente após cada ação de XP e também via cron job a cada hora.

5. **Performance:** Use os endpoints GET com cache no cliente para reduzir carga na API.

---

## Suporte

Para dúvidas ou problemas, consulte a documentação completa do projeto ou entre em contato com a equipe de desenvolvimento.
