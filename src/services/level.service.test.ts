import { describe, it, expect } from "vitest";
import { LevelService } from "./level.service";

describe("LevelService", () => {
  const levelService = new LevelService();

  describe("xpForLevel", () => {
    it("deve calcular corretamente o XP necessário para o nível 1", () => {
      expect(levelService.xpForLevel(1)).toBe(100);
    });

    it("deve calcular corretamente o XP necessário para o nível 2", () => {
      expect(levelService.xpForLevel(2)).toBe(400);
    });

    it("deve calcular corretamente o XP necessário para o nível 3", () => {
      expect(levelService.xpForLevel(3)).toBe(900);
    });

    it("deve calcular corretamente o XP necessário para o nível 5", () => {
      expect(levelService.xpForLevel(5)).toBe(2500);
    });

    it("deve calcular corretamente o XP necessário para o nível 10", () => {
      expect(levelService.xpForLevel(10)).toBe(10000);
    });

    it("deve calcular corretamente o XP necessário para o nível 20", () => {
      expect(levelService.xpForLevel(20)).toBe(40000);
    });

    it("deve lançar erro para nível inválido (0)", () => {
      expect(() => levelService.xpForLevel(0)).toThrow(
        "Nível inválido. Deve ser um número maior ou igual a 1."
      );
    });

    it("deve lançar erro para nível negativo", () => {
      expect(() => levelService.xpForLevel(-1)).toThrow(
        "Nível inválido. Deve ser um número maior ou igual a 1."
      );
    });

    it("deve lançar erro para nível não numérico", () => {
      expect(() => levelService.xpForLevel(NaN)).toThrow(
        "Nível inválido. Deve ser um número maior ou igual a 1."
      );
    });
  });

  describe("calculateLevel", () => {
    it("deve retornar nível 0 quando XP total é 0", () => {
      expect(levelService.calculateLevel(0)).toBe(0);
    });

    it("deve retornar nível 0 quando XP total é menor que 100", () => {
      expect(levelService.calculateLevel(50)).toBe(0);
      expect(levelService.calculateLevel(99)).toBe(0);
    });

    it("deve retornar nível 1 quando XP total é exatamente 100", () => {
      expect(levelService.calculateLevel(100)).toBe(1);
    });

    it("deve retornar nível 1 quando XP total está entre 100 e 399", () => {
      expect(levelService.calculateLevel(150)).toBe(1);
      expect(levelService.calculateLevel(200)).toBe(1);
      expect(levelService.calculateLevel(399)).toBe(1);
    });

    it("deve retornar nível 2 quando XP total é exatamente 400", () => {
      expect(levelService.calculateLevel(400)).toBe(2);
    });

    it("deve retornar nível 2 quando XP total está entre 400 e 899", () => {
      expect(levelService.calculateLevel(500)).toBe(2);
      expect(levelService.calculateLevel(700)).toBe(2);
      expect(levelService.calculateLevel(899)).toBe(2);
    });

    it("deve retornar nível 3 quando XP total é exatamente 900", () => {
      expect(levelService.calculateLevel(900)).toBe(3);
    });

    it("deve retornar nível 5 quando XP total é exatamente 2500", () => {
      expect(levelService.calculateLevel(2500)).toBe(5);
    });

    it("deve retornar nível 10 quando XP total é 10000", () => {
      expect(levelService.calculateLevel(10000)).toBe(10);
    });

    it("deve retornar nível 10 quando XP total está entre 10000 e 12100", () => {
      expect(levelService.calculateLevel(11000)).toBe(10);
      expect(levelService.calculateLevel(12099)).toBe(10);
    });

    it("deve lançar erro para XP total negativo", () => {
      expect(() => levelService.calculateLevel(-1)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para XP total não numérico", () => {
      expect(() => levelService.calculateLevel(NaN)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    });
  });

  describe("getCurrentXP", () => {
    it("deve retornar todo o XP quando está no nível 0", () => {
      expect(levelService.getCurrentXP(50, 0)).toBe(50);
      expect(levelService.getCurrentXP(99, 0)).toBe(99);
    });

    it("deve retornar 0 quando acabou de alcançar o nível 1", () => {
      expect(levelService.getCurrentXP(100, 1)).toBe(0);
    });

    it("deve retornar o XP atual corretamente para nível 1", () => {
      expect(levelService.getCurrentXP(150, 1)).toBe(50);
      expect(levelService.getCurrentXP(200, 1)).toBe(100);
      expect(levelService.getCurrentXP(399, 1)).toBe(299);
    });

    it("deve retornar 0 quando acabou de alcançar o nível 2", () => {
      expect(levelService.getCurrentXP(400, 2)).toBe(0);
    });

    it("deve retornar o XP atual corretamente para nível 2", () => {
      expect(levelService.getCurrentXP(500, 2)).toBe(100);
      expect(levelService.getCurrentXP(700, 2)).toBe(300);
      expect(levelService.getCurrentXP(899, 2)).toBe(499);
    });

    it("deve retornar o XP atual corretamente para nível 5", () => {
      expect(levelService.getCurrentXP(2500, 5)).toBe(0);
      expect(levelService.getCurrentXP(2700, 5)).toBe(200);
      expect(levelService.getCurrentXP(3000, 5)).toBe(500);
    });

    it("deve retornar o XP atual corretamente para nível 10", () => {
      expect(levelService.getCurrentXP(10000, 10)).toBe(0);
      expect(levelService.getCurrentXP(11000, 10)).toBe(1000);
    });

    it("deve lançar erro para XP total negativo", () => {
      expect(() => levelService.getCurrentXP(-100, 1)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para nível negativo", () => {
      expect(() => levelService.getCurrentXP(100, -1)).toThrow(
        "Nível inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para valores não numéricos", () => {
      expect(() => levelService.getCurrentXP(NaN, 1)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
      expect(() => levelService.getCurrentXP(100, NaN)).toThrow(
        "Nível inválido. Deve ser um número maior ou igual a 0."
      );
    });
  });

  describe("checkLevelUp", () => {
    it("deve detectar level up do nível 0 para 1", () => {
      const result = levelService.checkLevelUp(50, 150);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 0,
        newLevel: 1,
        levelsGained: 1,
      });
    });

    it("deve detectar level up do nível 1 para 2", () => {
      const result = levelService.checkLevelUp(200, 500);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
        levelsGained: 1,
      });
    });

    it("deve detectar múltiplos level ups de uma vez", () => {
      const result = levelService.checkLevelUp(300, 1000);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 3,
        levelsGained: 2,
      });
    });

    it("deve detectar 3 níveis ganhos de uma vez", () => {
      const result = levelService.checkLevelUp(100, 2500);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 5,
        levelsGained: 4,
      });
    });

    it("não deve detectar level up quando permanece no mesmo nível", () => {
      const result = levelService.checkLevelUp(200, 250);
      expect(result).toEqual({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        levelsGained: 0,
      });
    });

    it("não deve detectar level up quando XP não muda", () => {
      const result = levelService.checkLevelUp(500, 500);
      expect(result).toEqual({
        leveledUp: false,
        oldLevel: 2,
        newLevel: 2,
        levelsGained: 0,
      });
    });

    it("não deve detectar level up quando está próximo do limite mas não atinge", () => {
      const result = levelService.checkLevelUp(350, 399);
      expect(result).toEqual({
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
        levelsGained: 0,
      });
    });

    it("deve detectar level up quando atinge exatamente o XP necessário", () => {
      const result = levelService.checkLevelUp(350, 400);
      expect(result).toEqual({
        leveledUp: true,
        oldLevel: 1,
        newLevel: 2,
        levelsGained: 1,
      });
    });

    it("deve lançar erro quando novo XP é menor que o antigo", () => {
      expect(() => levelService.checkLevelUp(500, 300)).toThrow(
        "O novo XP total não pode ser menor que o XP total antigo."
      );
    });

    it("deve lançar erro para XP total antigo negativo", () => {
      expect(() => levelService.checkLevelUp(-100, 200)).toThrow(
        "XP total antigo inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para XP total novo negativo", () => {
      expect(() => levelService.checkLevelUp(100, -200)).toThrow(
        "XP total novo inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para valores não numéricos", () => {
      expect(() => levelService.checkLevelUp(NaN, 200)).toThrow(
        "XP total antigo inválido. Deve ser um número maior ou igual a 0."
      );
      expect(() => levelService.checkLevelUp(100, NaN)).toThrow(
        "XP total novo inválido. Deve ser um número maior ou igual a 0."
      );
    });
  });

  describe("xpForNextLevel", () => {
    it("deve calcular corretamente o XP para o próximo nível a partir do nível 0", () => {
      expect(levelService.xpForNextLevel(0)).toBe(100);
    });

    it("deve calcular corretamente o XP para o próximo nível a partir do nível 1", () => {
      expect(levelService.xpForNextLevel(1)).toBe(400);
    });

    it("deve calcular corretamente o XP para o próximo nível a partir do nível 5", () => {
      expect(levelService.xpForNextLevel(5)).toBe(3600);
    });

    it("deve calcular corretamente o XP para o próximo nível a partir do nível 10", () => {
      expect(levelService.xpForNextLevel(10)).toBe(12100);
    });

    it("deve lançar erro para nível negativo", () => {
      expect(() => levelService.xpForNextLevel(-1)).toThrow(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para nível não numérico", () => {
      expect(() => levelService.xpForNextLevel(NaN)).toThrow(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    });
  });

  describe("xpToNextLevel", () => {
    it("deve calcular corretamente quanto XP falta para o nível 1", () => {
      expect(levelService.xpToNextLevel(50, 0)).toBe(50);
      expect(levelService.xpToNextLevel(99, 0)).toBe(1);
    });

    it("deve retornar 0 quando acabou de alcançar o nível", () => {
      expect(levelService.xpToNextLevel(100, 0)).toBe(0);
    });

    it("deve calcular corretamente quanto XP falta para o nível 2", () => {
      expect(levelService.xpToNextLevel(150, 1)).toBe(250);
      expect(levelService.xpToNextLevel(200, 1)).toBe(200);
      expect(levelService.xpToNextLevel(399, 1)).toBe(1);
    });

    it("deve calcular corretamente quanto XP falta para o nível 3", () => {
      expect(levelService.xpToNextLevel(500, 2)).toBe(400);
      expect(levelService.xpToNextLevel(700, 2)).toBe(200);
    });

    it("deve calcular corretamente quanto XP falta para o nível 6", () => {
      expect(levelService.xpToNextLevel(2700, 5)).toBe(900);
      expect(levelService.xpToNextLevel(3000, 5)).toBe(600);
    });

    it("deve lançar erro para XP total negativo", () => {
      expect(() => levelService.xpToNextLevel(-100, 1)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para nível negativo", () => {
      expect(() => levelService.xpToNextLevel(100, -1)).toThrow(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    });

    it("deve lançar erro para valores não numéricos", () => {
      expect(() => levelService.xpToNextLevel(NaN, 1)).toThrow(
        "XP total inválido. Deve ser um número maior ou igual a 0."
      );
      expect(() => levelService.xpToNextLevel(100, NaN)).toThrow(
        "Nível atual inválido. Deve ser um número maior ou igual a 0."
      );
    });
  });
});
