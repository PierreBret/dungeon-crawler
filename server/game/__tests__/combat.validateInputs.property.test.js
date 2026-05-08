import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveCombat } from '../combat.js';

/**
 * Property 2: Invalid input rejection
 * Validates: Requirements 1.6, 1.7, 17.4, 17.7
 *
 * For ANY playerData or creatureData that is null, undefined, or missing required
 * fields (stats, hp, tactic), resolveCombat throws an Error with a message
 * identifying the invalid parameter.
 *
 * For ANY tactic that is not an array of 5 elements each containing EO, NA, EN keys,
 * resolveCombat throws.
 */

// ─── Arbitraries ──────────────────────────────────────────────────────────────

function arbStats() {
  return fc.record({
    force: fc.integer({ min: 3, max: 21 }),
    taille: fc.integer({ min: 3, max: 21 }),
    constitution: fc.integer({ min: 3, max: 21 }),
    intelligence: fc.integer({ min: 3, max: 21 }),
    vitesse: fc.integer({ min: 3, max: 21 }),
    adresse: fc.integer({ min: 3, max: 21 }),
    volonté: fc.integer({ min: 3, max: 21 }),
  });
}

function arbTacticEntry() {
  return fc.record({
    EO: fc.integer({ min: 1, max: 10 }),
    NA: fc.integer({ min: 1, max: 10 }),
    EN: fc.integer({ min: 1, max: 10 }),
  });
}

function arbPlayerTactic() {
  return fc.tuple(
    arbTacticEntry(), arbTacticEntry(), arbTacticEntry(),
    arbTacticEntry(), arbTacticEntry()
  ).map(function tupleToArray(entries) { return entries; });
}

function arbCreatureTactic() {
  return fc.tuple(
    arbTacticEntry(), arbTacticEntry(), arbTacticEntry(),
    arbTacticEntry(), arbTacticEntry()
  ).map(function tupleToCreatureTactic([m1, m2, m3, m4, m5]) {
    return { min1: m1, min2: m2, min3: m3, min4: m4, min5: m5 };
  });
}

function arbWeaponDef() {
  return fc.record({
    dist: fc.integer({ min: 1, max: 10 }),
    weight: fc.integer({ min: 0, max: 10 }),
    damFirst: fc.integer({ min: 1, max: 20 }),
    damLast: fc.integer({ min: 10, max: 50 }),
    models: fc.constant([1]),
    weightFO: fc.integer({ min: 0, max: 3 }),
    weightTA: fc.integer({ min: 0, max: 3 }),
    weightIN: fc.integer({ min: 0, max: 3 }),
    weightVI: fc.integer({ min: 0, max: 3 }),
    weightAD: fc.integer({ min: 0, max: 3 }),
  });
}

function arbValidPlayerData() {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    stats: arbStats(),
    hp: fc.integer({ min: 1, max: 200 }),
    tactic: arbPlayerTactic(),
    weaponDef: arbWeaponDef(),
    weaponItem: fc.record({ tier: fc.integer({ min: 1, max: 7 }), material: fc.integer({ min: 0, max: 7 }) }),
    equipment: fc.constant(null),
  });
}

function arbValidCreatureData() {
  return fc.record({
    nameFr: fc.string({ minLength: 1, maxLength: 20 }),
    stats: arbStats(),
    hp: fc.integer({ min: 1, max: 200 }),
    tactic: arbCreatureTactic(),
    weaponDef: arbWeaponDef(),
    equipment: fc.constant(null),
    family: fc.constantFrom("goblinoid", "undead", "beast", "demon"),
  });
}

/** Generates null or undefined */
function arbNullish() {
  return fc.constantFrom(null, undefined);
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 2: Invalid input rejection', () => {

  describe('Req 1.6 — playerData null/undefined/missing required fields throws', () => {

    it('throws "playerData invalide" when playerData is null or undefined', () => {
      fc.assert(
        fc.property(
          arbNullish(),
          arbValidCreatureData(),
          function nullishPlayerDataThrows(nullishValue, creatureData) {
            expect(() => resolveCombat(nullishValue, creatureData))
              .toThrow("resolveCombat: playerData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "playerData invalide" when playerData is missing stats', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingStatsThrows(playerData, creatureData) {
            delete playerData.stats;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: playerData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "playerData invalide" when playerData is missing hp', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingHpThrows(playerData, creatureData) {
            delete playerData.hp;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: playerData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "playerData invalide" when playerData is missing tactic', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingTacticThrows(playerData, creatureData) {
            delete playerData.tactic;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: playerData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Req 1.7 — creatureData null/undefined/missing required fields throws', () => {

    it('throws "creatureData invalide" when creatureData is null or undefined', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbNullish(),
          function nullishCreatureDataThrows(playerData, nullishValue) {
            expect(() => resolveCombat(playerData, nullishValue))
              .toThrow("resolveCombat: creatureData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "creatureData invalide" when creatureData is missing stats', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingStatsThrows(playerData, creatureData) {
            delete creatureData.stats;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: creatureData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "creatureData invalide" when creatureData is missing hp', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingHpThrows(playerData, creatureData) {
            delete creatureData.hp;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: creatureData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws "creatureData invalide" when creatureData is missing tactic', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingTacticThrows(playerData, creatureData) {
            delete creatureData.tactic;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: creatureData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Req 17.7 — playerData.tactic must be array of 5 elements with EO, NA, EN', () => {

    it('throws when tactic is not an array (random truthy non-array values)', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.oneof(
            fc.string({ minLength: 1 }),
            fc.integer({ min: 1 }),
            fc.record({ min1: arbTacticEntry() }),
            fc.constant(true),
            fc.constant({ EO: 5, NA: 5, EN: 5 })
          ),
          function nonArrayTacticThrows(playerData, creatureData, badTactic) {
            playerData.tactic = badTactic;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when tactic array has wrong length (not 5)', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.integer({ min: 0, max: 10 }).filter(function notFive(n) { return n !== 5; }),
          function wrongLengthThrows(playerData, creatureData, length) {
            playerData.tactic = Array.from({ length }, function makeEntry() {
              return { EO: 5, NA: 5, EN: 5 };
            });
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when a tactic element is missing one of EO, NA, EN', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.integer({ min: 0, max: 4 }),
          fc.constantFrom("EO", "NA", "EN"),
          function missingKeyThrows(playerData, creatureData, index, keyToRemove) {
            delete playerData.tactic[index][keyToRemove];
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when a tactic element is null or undefined', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.integer({ min: 0, max: 4 }),
          arbNullish(),
          function nullElementThrows(playerData, creatureData, index, nullish) {
            playerData.tactic[index] = nullish;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Req 17.7 — creatureData.tactic must have min1..min5 with EO, NA, EN', () => {

    it('throws when creature tactic is missing one of min1..min5', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.constantFrom("min1", "min2", "min3", "min4", "min5"),
          function missingMinKeyThrows(playerData, creatureData, keyToRemove) {
            delete creatureData.tactic[keyToRemove];
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when a creature tactic entry is missing EO, NA, or EN', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.constantFrom("min1", "min2", "min3", "min4", "min5"),
          fc.constantFrom("EO", "NA", "EN"),
          function missingEntryKeyThrows(playerData, creatureData, minKey, keyToRemove) {
            delete creatureData.tactic[minKey][keyToRemove];
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when a creature tactic entry is null or undefined', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          fc.constantFrom("min1", "min2", "min3", "min4", "min5"),
          arbNullish(),
          function nullEntryThrows(playerData, creatureData, minKey, nullish) {
            creatureData.tactic[minKey] = nullish;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when creature tactic is null', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function nullTacticThrows(playerData, creatureData) {
            creatureData.tactic = null;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: creatureData invalide");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Req 17.4 — weaponDef.dist validation', () => {

    it('throws when playerData.weaponDef is missing dist', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingDistThrows(playerData, creatureData) {
            delete playerData.weaponDef.dist;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when creatureData.weaponDef is missing dist', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          function missingDistThrows(playerData, creatureData) {
            delete creatureData.weaponDef.dist;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when playerData.weaponDef is null or undefined', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          arbNullish(),
          function nullWeaponDefThrows(playerData, creatureData, nullish) {
            playerData.weaponDef = nullish;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws when creatureData.weaponDef is null or undefined', () => {
      fc.assert(
        fc.property(
          arbValidPlayerData(),
          arbValidCreatureData(),
          arbNullish(),
          function nullWeaponDefThrows(playerData, creatureData, nullish) {
            creatureData.weaponDef = nullish;
            expect(() => resolveCombat(playerData, creatureData))
              .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
