import { describe, it, expect } from 'vitest';
import { resolveCombat } from '../combat.js';

// ─── Helpers pour construire des données valides ──────────────────────────────

function validStats() {
  return {
    force: 12, taille: 12, constitution: 12,
    intelligence: 12, vitesse: 12, adresse: 12, volonté: 12
  };
}

function validPlayerTactic() {
  return [
    { EO: 5, NA: 5, EN: 5 },
    { EO: 5, NA: 5, EN: 5 },
    { EO: 5, NA: 5, EN: 5 },
    { EO: 5, NA: 5, EN: 5 },
    { EO: 5, NA: 5, EN: 5 },
  ];
}

function validCreatureTactic() {
  return {
    min1: { EO: 5, NA: 5, EN: 5 },
    min2: { EO: 5, NA: 5, EN: 5 },
    min3: { EO: 5, NA: 5, EN: 5 },
    min4: { EO: 5, NA: 5, EN: 5 },
    min5: { EO: 5, NA: 5, EN: 5 },
  };
}

function validWeaponDef() {
  return { dist: 2, weight: 3, damFirst: 5, damLast: 15, models: [1], weightFO: 1, weightTA: 0, weightIN: 0, weightVI: 0, weightAD: 1 };
}

function validPlayerData() {
  return {
    name: "Guerrier",
    stats: validStats(),
    hp: 50,
    tactic: validPlayerTactic(),
    weaponDef: validWeaponDef(),
    weaponItem: { tier: 1, material: 0 },
    equipment: null
  };
}

function validCreatureData() {
  return {
    nameFr: "Gobelin",
    stats: validStats(),
    hp: 30,
    tactic: validCreatureTactic(),
    weaponDef: validWeaponDef(),
    equipment: null,
    family: "goblinoid"
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateInputs (via resolveCombat)', () => {

  describe('playerData validation', () => {
    it('throws when playerData is null', () => {
      expect(() => resolveCombat(null, validCreatureData()))
        .toThrow("resolveCombat: playerData invalide");
    });

    it('throws when playerData is undefined', () => {
      expect(() => resolveCombat(undefined, validCreatureData()))
        .toThrow("resolveCombat: playerData invalide");
    });

    it('throws when playerData.stats is missing', () => {
      const pd = validPlayerData();
      delete pd.stats;
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: playerData invalide");
    });

    it('throws when playerData.hp is missing', () => {
      const pd = validPlayerData();
      delete pd.hp;
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: playerData invalide");
    });

    it('throws when playerData.tactic is missing', () => {
      const pd = validPlayerData();
      delete pd.tactic;
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: playerData invalide");
    });
  });

  describe('creatureData validation', () => {
    it('throws when creatureData is null', () => {
      expect(() => resolveCombat(validPlayerData(), null))
        .toThrow("resolveCombat: creatureData invalide");
    });

    it('throws when creatureData is undefined', () => {
      expect(() => resolveCombat(validPlayerData(), undefined))
        .toThrow("resolveCombat: creatureData invalide");
    });

    it('throws when creatureData.stats is missing', () => {
      const cd = validCreatureData();
      delete cd.stats;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: creatureData invalide");
    });

    it('throws when creatureData.hp is missing', () => {
      const cd = validCreatureData();
      delete cd.hp;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: creatureData invalide");
    });

    it('throws when creatureData.tactic is missing', () => {
      const cd = validCreatureData();
      delete cd.tactic;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: creatureData invalide");
    });
  });

  describe('playerData.tactic validation', () => {
    it('throws when tactic is not an array', () => {
      const pd = validPlayerData();
      pd.tactic = { min1: { EO: 5, NA: 5, EN: 5 } };
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
    });

    it('throws when tactic has fewer than 5 elements', () => {
      const pd = validPlayerData();
      pd.tactic = [{ EO: 5, NA: 5, EN: 5 }, { EO: 5, NA: 5, EN: 5 }];
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
    });

    it('throws when tactic element is missing EO', () => {
      const pd = validPlayerData();
      pd.tactic[2] = { NA: 5, EN: 5 };
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
    });

    it('throws when tactic element is missing NA', () => {
      const pd = validPlayerData();
      pd.tactic[0] = { EO: 5, EN: 5 };
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
    });

    it('throws when tactic element is missing EN', () => {
      const pd = validPlayerData();
      pd.tactic[4] = { EO: 5, NA: 5 };
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
    });
  });

  describe('creatureData.tactic validation', () => {
    it('throws when tactic is missing min1', () => {
      const cd = validCreatureData();
      delete cd.tactic.min1;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
    });

    it('throws when tactic is missing min3', () => {
      const cd = validCreatureData();
      delete cd.tactic.min3;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
    });

    it('throws when tactic min2 is missing EO', () => {
      const cd = validCreatureData();
      cd.tactic.min2 = { NA: 5, EN: 5 };
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
    });

    it('throws when tactic min5 is missing EN', () => {
      const cd = validCreatureData();
      cd.tactic.min5 = { EO: 5, NA: 5 };
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
    });
  });

  describe('weaponDef.dist validation', () => {
    it('throws when playerData.weaponDef is missing dist', () => {
      const pd = validPlayerData();
      delete pd.weaponDef.dist;
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
    });

    it('throws when creatureData.weaponDef is missing dist', () => {
      const cd = validCreatureData();
      delete cd.weaponDef.dist;
      expect(() => resolveCombat(validPlayerData(), cd))
        .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
    });

    it('throws when playerData.weaponDef is null', () => {
      const pd = validPlayerData();
      pd.weaponDef = null;
      expect(() => resolveCombat(pd, validCreatureData()))
        .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
    });
  });

  describe('valid inputs pass validation', () => {
    it('does not throw with valid playerData and creatureData', () => {
      // Should not throw — combat will proceed (may throw later due to rollDie, but not from validation)
      expect(() => resolveCombat(validPlayerData(), validCreatureData())).not.toThrow();
    });

    it('accepts hp = 0 as valid (hp is present)', () => {
      const pd = validPlayerData();
      pd.hp = 0;
      // hp=0 is valid input (field is present), combat just ends immediately
      expect(() => resolveCombat(pd, validCreatureData())).not.toThrow();
    });
  });
});
