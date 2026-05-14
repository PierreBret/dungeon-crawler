import { describe, it, expect } from 'vitest';
import { validateInputs } from '../combat.js';

// ─── Helpers pour construire des données valides (nouveau format) ──────────────

function validStats() {
  return { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 };
}

function validTactic() {
  return [{ EO: 5, NA: 5, EN: 5 }];
}

function validWeaponDef() {
  return { poids: 5, dist: 3, degatsBase: 10, materiau: 2, affinites: {}, poidsStats: {} };
}

function validEquipment() {
  return { armure: { reduction: 5, poids: 8 } };
}

function validCombatant() {
  return {
    stats: validStats(),
    tactic: validTactic(),
    weaponDef: validWeaponDef(),
    equipment: validEquipment()
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateInputs (nouveau format CombatantInput)', () => {

  describe('entrées valides', () => {
    it('ne lève pas d\'erreur avec des données valides', () => {
      expect(() => validateInputs(validCombatant(), validCombatant())).not.toThrow();
    });

    it('accepte des statistiques aux bornes min (1)', () => {
      const data = validCombatant();
      data.stats = { FOR: 1, CON: 1, TAI: 1, INT: 1, VOL: 1, VIT: 1, ADR: 1 };
      expect(() => validateInputs(data, validCombatant())).not.toThrow();
    });

    it('accepte des statistiques aux bornes max (24)', () => {
      const data = validCombatant();
      data.stats = { FOR: 24, CON: 24, TAI: 24, INT: 24, VOL: 24, VIT: 24, ADR: 24 };
      expect(() => validateInputs(data, validCombatant())).not.toThrow();
    });

    it('accepte des tactiques aux bornes (1 et 10)', () => {
      const data = validCombatant();
      data.tactic = [{ EO: 1, NA: 1, EN: 1 }, { EO: 10, NA: 10, EN: 10 }];
      expect(() => validateInputs(data, validCombatant())).not.toThrow();
    });

    it('accepte plusieurs tactiques', () => {
      const data = validCombatant();
      data.tactic = [
        { EO: 3, NA: 7, EN: 5 },
        { EO: 8, NA: 2, EN: 9 },
        { EO: 5, NA: 5, EN: 5 },
      ];
      expect(() => validateInputs(data, validCombatant())).not.toThrow();
    });
  });

  describe('validation des statistiques primaires', () => {
    it('rejette une statistique à 0', () => {
      const data = validCombatant();
      data.stats.FOR = 0;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Statistique invalide: FOR = 0 (attendu: 1-24)');
    });

    it('rejette une statistique à 25', () => {
      const data = validCombatant();
      data.stats.ADR = 25;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Statistique invalide: ADR = 25 (attendu: 1-24)');
    });

    it('rejette une statistique négative', () => {
      const data = validCombatant();
      data.stats.INT = -5;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Statistique invalide: INT = -5 (attendu: 1-24)');
    });

    it('rejette une statistique manquante (undefined)', () => {
      const data = validCombatant();
      delete data.stats.VOL;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Statistique invalide: VOL = undefined (attendu: 1-24)');
    });

    it('rejette une statistique non-entière', () => {
      const data = validCombatant();
      data.stats.VIT = 5.5;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Statistique invalide: VIT = 5.5 (attendu: 1-24)');
    });

    it('valide le deuxième combattant aussi', () => {
      const creature = validCombatant();
      creature.stats.CON = 30;
      expect(() => validateInputs(validCombatant(), creature))
        .toThrow('Statistique invalide: CON = 30 (attendu: 1-24)');
    });
  });

  describe('validation des tactiques', () => {
    it('rejette un combattant sans tactique (tableau vide)', () => {
      const data = validCombatant();
      data.tactic = [];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique manquante pour le combattant');
    });

    it('rejette un combattant sans tactique (null)', () => {
      const data = validCombatant();
      data.tactic = null;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique manquante pour le combattant');
    });

    it('rejette un combattant sans tactique (undefined)', () => {
      const data = validCombatant();
      delete data.tactic;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique manquante pour le combattant');
    });

    it('rejette EO = 0', () => {
      const data = validCombatant();
      data.tactic = [{ EO: 0, NA: 5, EN: 5 }];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique invalide: EO = 0 (attendu: 1-10)');
    });

    it('rejette NA = 11', () => {
      const data = validCombatant();
      data.tactic = [{ EO: 5, NA: 11, EN: 5 }];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique invalide: NA = 11 (attendu: 1-10)');
    });

    it('rejette EN négatif', () => {
      const data = validCombatant();
      data.tactic = [{ EO: 5, NA: 5, EN: -1 }];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique invalide: EN = -1 (attendu: 1-10)');
    });

    it('rejette une tactique avec EO manquant', () => {
      const data = validCombatant();
      data.tactic = [{ NA: 5, EN: 5 }];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique invalide: EO = undefined (attendu: 1-10)');
    });

    it('rejette une entrée null dans le tableau de tactiques', () => {
      const data = validCombatant();
      data.tactic = [null];
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Tactique manquante pour le combattant');
    });
  });

  describe('validation de l\'équipement', () => {
    it('rejette un combattant sans weaponDef', () => {
      const data = validCombatant();
      delete data.weaponDef;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Équipement incomplet: arme ou armure manquante');
    });

    it('rejette un combattant sans equipment', () => {
      const data = validCombatant();
      delete data.equipment;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Équipement incomplet: arme ou armure manquante');
    });

    it('rejette un combattant sans armure dans equipment', () => {
      const data = validCombatant();
      data.equipment = {};
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Équipement incomplet: arme ou armure manquante');
    });

    it('rejette une arme sans champ dist', () => {
      const data = validCombatant();
      delete data.weaponDef.dist;
      expect(() => validateInputs(data, validCombatant()))
        .toThrow("Champ 'dist' manquant dans weaponDef");
    });

    it('rejette une armure sans champ reduction', () => {
      const data = validCombatant();
      data.equipment.armure = { poids: 8 };
      expect(() => validateInputs(data, validCombatant()))
        .toThrow('Équipement incomplet: arme ou armure manquante');
    });
  });
});
