/**
 * Level Service
 *
 * Responsável por calcular níveis, XP necessário para cada nível,
 * e detectar quando um usuário sobe de nível (level up).
 *
 * Fórmula de XP: 100 * level²
 * Exemplo:
 * - Nível 1: 100 XP
 * - Nível 2: 400 XP
 * - Nível 3: 900 XP
 * - Nível 10: 10.000 XP
 */

export interface LevelUpResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
}

export class LevelService {
  /**
   * Calcula a quantidade de XP necessária para atingir um determinado nível.
   *
   * Fórmula: 100 * level²
   *
   * @param level - O nível para o qual calcular o XP necessário
   * @returns A quantidade total de XP necessária para atingir o nível
   *
   * @example
   * xpForLevel(1) // 100
   * xpForLevel(5) // 2500
   * xpForLevel(10) // 10000
   */
  xpForLevel(level: number): number {
    if (!Number.isFinite(level) || level < 1) {
      throw new Error("Nível inválido. Deve ser um número maior ou igual a 1.");
    }

    return 100 * level * level;
  }

  /**
   * Calcula o nível atual de um usuário com base no XP total acumulado.
   *
   * Itera pelos níveis até encontrar o nível máximo que o XP total permite atingir.
   *
   * @param totalXP - XP total acumulado pelo usuário
   * @returns O nível atual do usuário
   *
   * @example
   * calculateLevel(0) // 0
   * calculateLevel(99) // 0
   * calculateLevel(100) // 1
   * calculateLevel(500) // 2
   * calculateLevel(2500) // 5
   */
  calculateLevel(totalXP: number): number {
    if (!Number.isFinite(totalXP) || totalXP < 0) {
      throw new Error(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    }

    // Se não tem XP suficiente para o nível 1, está no nível 0
    if (totalXP < this.xpForLevel(1)) {
      return 0;
    }

    let level = 1;

    // Incrementa o nível enquanto o usuário tiver XP suficiente para o próximo
    while (totalXP >= this.xpForLevel(level + 1)) {
      level++;
    }

    return level;
  }

  /**
   * Calcula o XP atual dentro do nível (XP de progresso para o próximo nível).
   *
   * Retorna quanto XP o usuário já acumulou dentro do nível atual,
   * ou seja, o XP que não foi "consumido" pelos níveis anteriores.
   *
   * @param totalXP - XP total acumulado pelo usuário
   * @param level - Nível atual do usuário
   * @returns XP atual dentro do nível
   *
   * @example
   * getCurrentXP(150, 1) // 50 (150 - 100)
   * getCurrentXP(500, 2) // 100 (500 - 400)
   * getCurrentXP(100, 1) // 0 (acabou de alcançar o nível 1)
   */
  getCurrentXP(totalXP: number, level: number): number {
    if (!Number.isFinite(totalXP) || totalXP < 0) {
      throw new Error(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    }

    if (!Number.isFinite(level) || level < 0) {
      throw new Error("Nível inválido. Deve ser um número maior ou igual a 0.");
    }

    // Se está no nível 0, todo o XP é o XP atual
    if (level === 0) {
      return totalXP;
    }

    // XP atual = XP total - XP necessário para o nível atual
    const xpForCurrentLevel = this.xpForLevel(level);
    const currentXP = totalXP - xpForCurrentLevel;

    // Garante que nunca retorne um valor negativo
    return Math.max(0, currentXP);
  }

  /**
   * Verifica se houve level up comparando o XP total antes e depois de uma ação.
   *
   * Detecta se o usuário subiu de nível e quantos níveis foram ganhos.
   *
   * @param oldTotalXP - XP total antes da ação
   * @param newTotalXP - XP total depois da ação
   * @returns Objeto contendo informações sobre o level up
   *
   * @example
   * checkLevelUp(50, 150)
   * // { leveledUp: true, oldLevel: 0, newLevel: 1, levelsGained: 1 }
   *
   * checkLevelUp(200, 250)
   * // { leveledUp: false, oldLevel: 1, newLevel: 1, levelsGained: 0 }
   *
   * checkLevelUp(300, 1000)
   * // { leveledUp: true, oldLevel: 1, newLevel: 3, levelsGained: 2 }
   */
  checkLevelUp(oldTotalXP: number, newTotalXP: number): LevelUpResult {
    if (!Number.isFinite(oldTotalXP) || oldTotalXP < 0) {
      throw new Error(
        "XP total antigo inválido. Deve ser um número maior ou igual a 0."
      );
    }

    if (!Number.isFinite(newTotalXP) || newTotalXP < 0) {
      throw new Error(
        "XP total novo inválido. Deve ser um número maior ou igual a 0."
      );
    }

    if (newTotalXP < oldTotalXP) {
      throw new Error(
        "O novo XP total não pode ser menor que o XP total antigo."
      );
    }

    const oldLevel = this.calculateLevel(oldTotalXP);
    const newLevel = this.calculateLevel(newTotalXP);
    const levelsGained = newLevel - oldLevel;

    return {
      leveledUp: levelsGained > 0,
      oldLevel,
      newLevel,
      levelsGained,
    };
  }

  /**
   * Calcula o XP necessário para atingir o próximo nível a partir do nível atual.
   *
   * @param currentLevel - Nível atual do usuário
   * @returns XP necessário para o próximo nível
   *
   * @example
   * xpForNextLevel(1) // 400 (XP para nível 2)
   * xpForNextLevel(5) // 3600 (XP para nível 6)
   */
  xpForNextLevel(currentLevel: number): number {
    if (!Number.isFinite(currentLevel) || currentLevel < 0) {
      throw new Error(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    }

    return this.xpForLevel(currentLevel + 1);
  }

  /**
   * Calcula quanto XP falta para o usuário atingir o próximo nível.
   *
   * @param totalXP - XP total acumulado pelo usuário
   * @param currentLevel - Nível atual do usuário
   * @returns XP que falta para o próximo nível
   *
   * @example
   * xpToNextLevel(150, 1) // 250 (400 - 150)
   * xpToNextLevel(500, 2) // 400 (900 - 500)
   */
  xpToNextLevel(totalXP: number, currentLevel: number): number {
    if (!Number.isFinite(totalXP) || totalXP < 0) {
      throw new Error(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    }

    if (!Number.isFinite(currentLevel) || currentLevel < 0) {
      throw new Error(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    }

    const xpForNext = this.xpForNextLevel(currentLevel);
    const remaining = xpForNext - totalXP;

    return Math.max(0, remaining);
  }
}
