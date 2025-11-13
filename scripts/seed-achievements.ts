import "dotenv/config";
import admin from "firebase-admin";
import {
  firebaseApp,
  firestoreCollections,
} from "../src/config/firebase.config";
import {
  AchievementTier,
  AchievementType,
  type Achievement,
  isValidAchievement,
  normalizeAchievement,
} from "../src/models/Achievement";

const { FieldValue } = admin.firestore;

type SeedAchievement = Omit<Achievement, "createdAt" | "updatedAt">;

const ACHIEVEMENTS: SeedAchievement[] = [
  {
    id: "first_card",
    name: "Primeira Carta",
    description: "Crie sua primeira carta de estudo.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_first_card",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 1,
    },
  },
  {
    id: "first_deck",
    name: "Primeiro Deck",
    description: "Crie seu primeiro deck de estudo.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_first_deck",
    condition: {
      type: AchievementType.DECK_CREATED,
      target: 1,
    },
  },
  {
    id: "first_review",
    name: "Primeira Revisão",
    description: "Complete sua primeira revisão de carta.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_first_review",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 1,
    },
  },
  {
    id: "five_reviews",
    name: "Primeiros Passos",
    description: "Complete 5 revisões de cartas.",
    tier: AchievementTier.BRONZE,
    xpReward: 75,
    icon: "bronze_five_reviews",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 5,
    },
  },
  {
    id: "study_three_decks",
    name: "Explorador",
    description: "Estude 3 decks diferentes.",
    tier: AchievementTier.BRONZE,
    xpReward: 75,
    icon: "bronze_explorer",
    condition: {
      type: AchievementType.CUSTOM,
      target: 3,
      params: { metric: "unique_decks_studied" },
    },
  },
  {
    id: "ten_cards_created",
    name: "Aprendiz",
    description: "Crie 10 cartas.",
    tier: AchievementTier.BRONZE,
    xpReward: 100,
    icon: "bronze_ten_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 10,
    },
  },
  {
    id: "streak_three_days",
    name: "Consistente",
    description: "Mantenha streak de 3 dias.",
    tier: AchievementTier.BRONZE,
    xpReward: 100,
    icon: "bronze_three_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 3,
    },
  },
  {
    id: "use_all_difficulties",
    name: "Curioso",
    description: "Use os 4 níveis de dificuldade disponíveis nas revisões.",
    tier: AchievementTier.BRONZE,
    xpReward: 75,
    icon: "bronze_all_difficulties",
    condition: {
      type: AchievementType.CUSTOM,
      target: 4,
      params: { metric: "difficulty_levels_used", requiredLevels: 4 },
    },
  },
  {
    id: "marketplace_first_deck",
    name: "Colecionador Iniciante",
    description: "Adicione um deck do marketplace à sua biblioteca.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_marketplace_one",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "marketplace_decks_added" },
    },
  },
  {
    id: "daily_goal_five_days",
    name: "Cinco Dias",
    description: "Complete a meta diária por 5 dias seguidos.",
    tier: AchievementTier.BRONZE,
    xpReward: 100,
    icon: "bronze_five_day_goal",
    condition: {
      type: AchievementType.DAILY_GOAL,
      target: 5,
      params: { consecutive: true },
    },
  },
  {
    id: "complete_profile",
    name: "Perfil Completo",
    description: "Preencha 100% do seu perfil.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_complete_profile",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "profile_completed" },
    },
  },
  {
    id: "share_deck_once",
    name: "Social",
    description: "Compartilhe um deck com a comunidade.",
    tier: AchievementTier.BRONZE,
    xpReward: 75,
    icon: "bronze_share_once",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "decks_shared" },
    },
  },
  {
    id: "rate_one_deck",
    name: "Avaliador",
    description: "Deixe uma avaliação em um deck.",
    tier: AchievementTier.BRONZE,
    xpReward: 50,
    icon: "bronze_rate_once",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "deck_reviews_submitted" },
    },
  },
  {
    id: "twenty_cards_in_day",
    name: "Velocista",
    description: "Complete 20 cartas em um único dia.",
    tier: AchievementTier.BRONZE,
    xpReward: 100,
    icon: "bronze_twenty_cards_day",
    condition: {
      type: AchievementType.CUSTOM,
      target: 20,
      params: { metric: "cards_reviewed_single_day" },
    },
  },
  {
    id: "study_before_eight",
    name: "Madrugador",
    description: "Inicie uma sessão de estudo antes das 8h.",
    tier: AchievementTier.BRONZE,
    xpReward: 75,
    icon: "bronze_early_bird",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "study_sessions_before_hour", hour: 8 },
    },
  },
  {
    id: "create_fifty_cards",
    name: "Criador",
    description: "Crie 50 cartas de estudo.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_fifty_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 50,
    },
  },
  {
    id: "active_five_decks",
    name: "Biblioteca",
    description: "Mantenha 5 decks ativos na sua biblioteca.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_five_active_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 5,
      params: { metric: "active_decks" },
    },
  },
  {
    id: "streak_seven_days",
    name: "Semana Completa",
    description: "Mantenha uma sequência de 7 dias estudando.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_seven_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 7,
    },
  },
  {
    id: "complete_hundred_reviews",
    name: "Mestre das Revisões",
    description: "Complete 100 revisões de cartas.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_hundred_reviews",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 100,
    },
  },
  {
    id: "study_ten_decks",
    name: "Diversificado",
    description: "Estude 10 decks diferentes.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_ten_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 10,
      params: { metric: "unique_decks_studied" },
    },
  },
  {
    id: "daily_goal_fifteen_times",
    name: "Disciplinado",
    description: "Complete a meta diária 15 vezes.",
    tier: AchievementTier.SILVER,
    xpReward: 250,
    icon: "silver_fifteen_daily_goals",
    condition: {
      type: AchievementType.DAILY_GOAL,
      target: 15,
      params: { consecutive: false },
    },
  },
  {
    id: "easy_cards_streak_twenty",
    name: "Eficiente",
    description: "Acerte 20 cartas com dificuldade 'Fácil' seguidas.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_easy_streak",
    condition: {
      type: AchievementType.CUSTOM,
      target: 20,
      params: { metric: "easy_cards_streak" },
    },
  },
  {
    id: "thirty_cards_five_days",
    name: "Dedicado",
    description: "Estude 30 cartas por dia durante 5 dias consecutivos.",
    tier: AchievementTier.SILVER,
    xpReward: 300,
    icon: "silver_thirty_cards_five_days",
    condition: {
      type: AchievementType.CUSTOM,
      target: 5,
      params: {
        metric: "minimum_cards_consecutive_days",
        consecutiveDays: 5,
        minimumCardsPerDay: 30,
      },
    },
  },
  {
    id: "create_hundred_cards",
    name: "100 Cartas",
    description: "Crie 100 cartas de estudo.",
    tier: AchievementTier.SILVER,
    xpReward: 250,
    icon: "silver_hundred_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 100,
    },
  },
  {
    id: "study_after_twenty_two",
    name: "Noturno",
    description: "Registre uma sessão de estudo depois das 22h.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_night_owl",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "study_sessions_after_hour", hour: 22 },
    },
  },
  {
    id: "complete_fifty_hard_cards",
    name: "Desafio Aceito",
    description: "Complete 50 cartas marcadas como 'Difícil'.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_hard_cards",
    condition: {
      type: AchievementType.CUSTOM,
      target: 50,
      params: { metric: "hard_cards_completed" },
    },
  },
  {
    id: "share_three_decks",
    name: "Mentor",
    description: "Compartilhe 3 decks públicos.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_share_three",
    condition: {
      type: AchievementType.CUSTOM,
      target: 3,
      params: { metric: "decks_shared" },
    },
  },
  {
    id: "marketplace_five_decks",
    name: "Colecionador",
    description: "Adicione 5 decks do marketplace.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_marketplace_five",
    condition: {
      type: AchievementType.CUSTOM,
      target: 5,
      params: { metric: "marketplace_decks_added" },
    },
  },
  {
    id: "review_ten_decks",
    name: "Crítico",
    description: "Deixe 10 avaliações em decks.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_ten_reviews",
    condition: {
      type: AchievementType.CUSTOM,
      target: 10,
      params: { metric: "deck_reviews_submitted" },
    },
  },
  {
    id: "streak_fourteen_days",
    name: "Duas Semanas",
    description: "Mantenha uma sequência de 14 dias estudando.",
    tier: AchievementTier.SILVER,
    xpReward: 300,
    icon: "silver_fourteen_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 14,
    },
  },
  {
    id: "fifty_cards_in_day",
    name: "Maratonista",
    description: "Complete 50 cartas em um único dia.",
    tier: AchievementTier.SILVER,
    xpReward: 250,
    icon: "silver_fifty_cards_day",
    condition: {
      type: AchievementType.CUSTOM,
      target: 50,
      params: { metric: "cards_reviewed_single_day" },
    },
  },
  {
    id: "complete_one_deck",
    name: "Finalizador",
    description: "Complete 100% de um deck.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_complete_deck",
    condition: {
      type: AchievementType.CUSTOM,
      target: 1,
      params: { metric: "decks_completed" },
    },
  },
  {
    id: "create_thirty_cards_week",
    name: "Produtivo",
    description: "Crie 30 cartas em uma semana.",
    tier: AchievementTier.SILVER,
    xpReward: 250,
    icon: "silver_thirty_cards_week",
    condition: {
      type: AchievementType.CUSTOM,
      target: 30,
      params: { metric: "cards_created_in_week", timeframe: "rolling_week" },
    },
  },
  {
    id: "review_same_card_ten_times",
    name: "Revisor",
    description: "Revise a mesma carta 10 vezes.",
    tier: AchievementTier.SILVER,
    xpReward: 150,
    icon: "silver_ten_iterations",
    condition: {
      type: AchievementType.CUSTOM,
      target: 10,
      params: { metric: "card_review_iterations" },
    },
  },
  {
    id: "study_three_decks_same_day",
    name: "Multi-tarefa",
    description: "Estude 3 decks diferentes no mesmo dia.",
    tier: AchievementTier.SILVER,
    xpReward: 200,
    icon: "silver_three_decks_day",
    condition: {
      type: AchievementType.CUSTOM,
      target: 3,
      params: { metric: "decks_studied_same_day" },
    },
  },
  {
    id: "create_250_cards",
    name: "Mestre",
    description: "Crie 250 cartas de estudo.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_two_fifty_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 250,
    },
  },
  {
    id: "active_15_decks",
    name: "Biblioteca Completa",
    description: "Mantenha 15 decks ativos na sua biblioteca.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_fifteen_active_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 15,
      params: { metric: "active_decks" },
    },
  },
  {
    id: "streak_30_days",
    name: "Mês Perfeito",
    description: "Mantenha uma sequência de 30 dias estudando.",
    tier: AchievementTier.GOLD,
    xpReward: 600,
    icon: "gold_thirty_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 30,
    },
  },
  {
    id: "complete_500_reviews",
    name: "Especialista",
    description: "Complete 500 revisões de cartas.",
    tier: AchievementTier.GOLD,
    xpReward: 500,
    icon: "gold_five_hundred_reviews",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 500,
    },
  },
  {
    id: "study_25_decks",
    name: "Enciclopédia",
    description: "Estude 25 decks diferentes.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_twentyfive_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 25,
      params: { metric: "unique_decks_studied" },
    },
  },
  {
    id: "daily_goal_30_times",
    name: "Guerreiro",
    description: "Complete a meta diária 30 vezes.",
    tier: AchievementTier.GOLD,
    xpReward: 600,
    icon: "gold_thirty_daily_goals",
    condition: {
      type: AchievementType.DAILY_GOAL,
      target: 30,
      params: { consecutive: false },
    },
  },
  {
    id: "hundred_cards_in_day",
    name: "Cem Por Dia",
    description: "Complete 100 cartas em um único dia.",
    tier: AchievementTier.GOLD,
    xpReward: 500,
    icon: "gold_hundred_cards_day",
    condition: {
      type: AchievementType.CUSTOM,
      target: 100,
      params: { metric: "cards_reviewed_single_day" },
    },
  },
  {
    id: "create_500_cards",
    name: "500 Cartas",
    description: "Crie 500 cartas de estudo.",
    tier: AchievementTier.GOLD,
    xpReward: 600,
    icon: "gold_five_hundred_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 500,
    },
  },
  {
    id: "share_10_decks",
    name: "Influenciador",
    description: "Compartilhe 10 decks públicos.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_share_ten",
    condition: {
      type: AchievementType.CUSTOM,
      target: 10,
      params: { metric: "decks_shared" },
    },
  },
  {
    id: "marketplace_15_decks",
    name: "Comunidade",
    description: "Adicione 15 decks do marketplace.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_marketplace_fifteen",
    condition: {
      type: AchievementType.CUSTOM,
      target: 15,
      params: { metric: "marketplace_decks_added" },
    },
  },
  {
    id: "streak_45_days",
    name: "45 Dias",
    description: "Mantenha uma sequência de 45 dias estudando.",
    tier: AchievementTier.GOLD,
    xpReward: 600,
    icon: "gold_fortyfive_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 45,
    },
  },
  {
    id: "complete_five_decks",
    name: "Dominador de Deck",
    description: "Complete 5 decks em 100%.",
    tier: AchievementTier.GOLD,
    xpReward: 500,
    icon: "gold_five_decks_completed",
    condition: {
      type: AchievementType.CUSTOM,
      target: 5,
      params: { metric: "decks_completed" },
    },
  },
  {
    id: "create_50_cards_week",
    name: "Criador Prolífico",
    description: "Crie 50 cartas em uma semana.",
    tier: AchievementTier.GOLD,
    xpReward: 500,
    icon: "gold_fifty_cards_week",
    condition: {
      type: AchievementType.CUSTOM,
      target: 50,
      params: { metric: "cards_created_in_week", timeframe: "rolling_week" },
    },
  },
  {
    id: "complete_100_expert_cards",
    name: "Mestre da Dificuldade",
    description: "Complete 100 cartas marcadas como 'Expert'.",
    tier: AchievementTier.GOLD,
    xpReward: 600,
    icon: "gold_expert_cards",
    condition: {
      type: AchievementType.CUSTOM,
      target: 100,
      params: { metric: "expert_cards_completed" },
    },
  },
  {
    id: "review_same_card_25_times",
    name: "Revisor Completo",
    description: "Revise a mesma carta 25 vezes.",
    tier: AchievementTier.GOLD,
    xpReward: 400,
    icon: "gold_twentyfive_iterations",
    condition: {
      type: AchievementType.CUSTOM,
      target: 25,
      params: { metric: "card_review_iterations" },
    },
  },
  {
    id: "create_1000_cards",
    name: "Lenda",
    description: "Crie 1000 cartas de estudo.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1000,
    icon: "platinum_thousand_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 1000,
    },
  },
  {
    id: "streak_60_days",
    name: "Bimestre",
    description: "Mantenha uma sequência de 60 dias estudando.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1200,
    icon: "platinum_sixty_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 60,
    },
  },
  {
    id: "complete_1000_reviews",
    name: "Mestre das Revisões",
    description: "Complete 1000 revisões de cartas.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1000,
    icon: "platinum_thousand_reviews",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 1000,
    },
  },
  {
    id: "active_30_decks",
    name: "Universidade",
    description: "Mantenha 30 decks ativos na sua biblioteca.",
    tier: AchievementTier.PLATINUM,
    xpReward: 800,
    icon: "platinum_thirty_active_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 30,
      params: { metric: "active_decks" },
    },
  },
  {
    id: "daily_goal_60_times",
    name: "Meta Diária 60x",
    description: "Complete a meta diária 60 vezes.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1200,
    icon: "platinum_sixty_daily_goals",
    condition: {
      type: AchievementType.DAILY_GOAL,
      target: 60,
      params: { consecutive: false },
    },
  },
  {
    id: "share_25_decks",
    name: "Influencer",
    description: "Compartilhe 25 decks públicos.",
    tier: AchievementTier.PLATINUM,
    xpReward: 800,
    icon: "platinum_share_twentyfive",
    condition: {
      type: AchievementType.CUSTOM,
      target: 25,
      params: { metric: "decks_shared" },
    },
  },
  {
    id: "hundred_fifty_cards_day",
    name: "150 Cards/Dia",
    description: "Complete 150 cartas em um único dia.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1000,
    icon: "platinum_onefifty_cards_day",
    condition: {
      type: AchievementType.CUSTOM,
      target: 150,
      params: { metric: "cards_reviewed_single_day" },
    },
  },
  {
    id: "streak_90_days",
    name: "Trimestre",
    description: "Mantenha uma sequência de 90 dias estudando.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1200,
    icon: "platinum_ninety_day_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 90,
    },
  },
  {
    id: "complete_ten_decks",
    name: "10 Decks Completos",
    description: "Complete 10 decks em 100%.",
    tier: AchievementTier.PLATINUM,
    xpReward: 1000,
    icon: "platinum_ten_decks_completed",
    condition: {
      type: AchievementType.CUSTOM,
      target: 10,
      params: { metric: "decks_completed" },
    },
  },
  {
    id: "study_50_decks",
    name: "Sabedoria",
    description: "Estude 50 decks diferentes.",
    tier: AchievementTier.PLATINUM,
    xpReward: 800,
    icon: "platinum_fifty_decks",
    condition: {
      type: AchievementType.CUSTOM,
      target: 50,
      params: { metric: "unique_decks_studied" },
    },
  },
  {
    id: "streak_365_days",
    name: "Imortal",
    description: "Mantenha uma sequência de 365 dias estudando.",
    tier: AchievementTier.DIAMOND,
    xpReward: 5000,
    icon: "diamond_year_streak",
    condition: {
      type: AchievementType.STREAK,
      target: 365,
    },
  },
  {
    id: "create_5000_cards",
    name: "Divindade",
    description: "Crie 5000 cartas de estudo.",
    tier: AchievementTier.DIAMOND,
    xpReward: 5000,
    icon: "diamond_five_thousand_cards",
    condition: {
      type: AchievementType.CARDS_CREATED,
      target: 5000,
    },
  },
  {
    id: "complete_5000_reviews",
    name: "Mestre Supremo",
    description: "Complete 5000 revisões de cartas.",
    tier: AchievementTier.DIAMOND,
    xpReward: 5000,
    icon: "diamond_five_thousand_reviews",
    condition: {
      type: AchievementType.REVIEWS_COMPLETED,
      target: 5000,
    },
  },
  {
    id: "daily_goal_100_times",
    name: "Cenário Completo",
    description: "Complete a meta diária 100 vezes.",
    tier: AchievementTier.DIAMOND,
    xpReward: 2000,
    icon: "diamond_hundred_daily_goals",
    condition: {
      type: AchievementType.DAILY_GOAL,
      target: 100,
      params: { consecutive: false },
    },
  },
];

const EXPECTED_COUNTS: Record<AchievementTier, number> = {
  [AchievementTier.BRONZE]: 15,
  [AchievementTier.SILVER]: 20,
  [AchievementTier.GOLD]: 15,
  [AchievementTier.PLATINUM]: 10,
  [AchievementTier.DIAMOND]: 4,
};

const TIER_XP_LIMITS: Record<AchievementTier, { min: number; max: number }> = {
  [AchievementTier.BRONZE]: { min: 50, max: 100 },
  [AchievementTier.SILVER]: { min: 150, max: 300 },
  [AchievementTier.GOLD]: { min: 400, max: 600 },
  [AchievementTier.PLATINUM]: { min: 800, max: 1200 },
  [AchievementTier.DIAMOND]: { min: 2000, max: 5000 },
};

function validateDataset(seeds: SeedAchievement[]): void {
  if (seeds.length !== 64) {
    throw new Error(`Esperava 64 conquistas, mas recebi ${seeds.length}.`);
  }

  const tierCounts: Record<AchievementTier, number> = {
    [AchievementTier.BRONZE]: 0,
    [AchievementTier.SILVER]: 0,
    [AchievementTier.GOLD]: 0,
    [AchievementTier.PLATINUM]: 0,
    [AchievementTier.DIAMOND]: 0,
  };

  const seenIds = new Set<string>();

  for (const seed of seeds) {
    if (seenIds.has(seed.id)) {
      throw new Error(`ID de conquista duplicado detectado: ${seed.id}`);
    }
    seenIds.add(seed.id);

    tierCounts[seed.tier] += 1;

    const xpRange = TIER_XP_LIMITS[seed.tier];
    if (seed.xpReward < xpRange.min || seed.xpReward > xpRange.max) {
      throw new Error(
        `XP da conquista ${seed.id} está fora do intervalo permitido para ${seed.tier}.`
      );
    }
  }

  for (const [tier, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    const actual = tierCounts[tier as AchievementTier];
    if (actual !== expectedCount) {
      throw new Error(
        `Contagem incorreta para ${tier}: esperado ${expectedCount}, encontrado ${actual}.`
      );
    }
  }
}

async function seedAchievements(): Promise<void> {
  validateDataset(ACHIEVEMENTS);

  let created = 0;
  let updated = 0;

  for (const seed of ACHIEVEMENTS) {
    const normalized = normalizeAchievement({
      ...seed,
      createdAt: new Date(),
    });

    if (!isValidAchievement(normalized)) {
      throw new Error(`Conquista inválida detectada: ${seed.id}`);
    }

    const {
      createdAt: _placeholder,
      updatedAt: _ignored,
      ...payload
    } = normalized;
    const document = firestoreCollections.achievementDoc(seed.id);
    const existing = await document.get();

    if (existing.exists) {
      await document.set(
        {
          ...payload,
          isActive: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      updated += 1;
      console.log(`[UPDATED] achievements/${seed.id}`);
    } else {
      await document.set({
        ...payload,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created += 1;
      console.log(`[CREATED] achievements/${seed.id}`);
    }
  }

  console.log(
    `Seed finalizado: ${created} conquistas criadas e ${updated} atualizadas (total definido: ${ACHIEVEMENTS.length}).`
  );
}

seedAchievements()
  .catch((error) => {
    console.error("Falha ao popular conquistas no Firestore:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await firebaseApp.delete().catch(() => undefined);
  });
