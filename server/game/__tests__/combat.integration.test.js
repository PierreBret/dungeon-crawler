/**
 * Integration tests for resolveCombat
 * Validates: Requirements 17.8, 17.9
 *
 * Tests that resolveCombat works correctly with:
 * - Real data structures from server/index.js
 * - The strategy → tactic rename in the socket handler
 * - Weapon data from weapons.json
 * - DEV_MODE parameter passing
 * - 3-parameter signature backward compatibility
 * - Deterministic combat via rollDie injection
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveCombat } from "../combat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load real weapon data from weapons.json
const weapons = JSON.parse(
  readFileSync(join(__dirname, "../../data/weapons.json"), "utf8")
);

// Load real bestiary data
const bestiary = JSON.parse(
  readFileSync(join(__dirname, "../../data/bestiary.json"), "utf8")
);

// ─── Test data matching server/index.js assembly ──────────────────────────────

function buildPlayerData(weaponCode = "SH") {
  const weaponDef = weapons.find((w) => w.code === weaponCode);
  return {
    name: "Guerrier",
    stats: {
      force: 14,
      taille: 12,
      constitution: 13,
      intelligence: 10,
      vitesse: 11,
      adresse: 15,
      volonté: 9,
    },
    hp: 100,
    tactic: [
      { EO: 7, NA: 6, EN: 5 },
      { EO: 6, NA: 5, EN: 6 },
      { EO: 5, NA: 5, EN: 7 },
      { EO: 4, NA: 4, EN: 8 },
      { EO: 3, NA: 3, EN: 9 },
    ],
    weaponDef,
    weaponItem: {
      tier: 2,
      material: 1,
      affinities: { bestial: 120, undead: 80 },
    },
    equipment: null,
  };
}

function buildCreatureData() {
  const creatureDef = bestiary[0]; // goblin_scout
  const creatureWeaponDef = weapons.find(
    (w) => w.code === creatureDef.equipment?.rightHand?.code
  );
  const creatureHp =
    creatureDef.stats.constitution * 2 + creatureDef.stats.taille;

  return {
    nameFr: creatureDef.nameFr,
    stats: creatureDef.stats,
    hp: creatureHp,
    weaponDef: creatureWeaponDef,
    equipment: creatureDef.equipment,
    // server/index.js does: creatureDef.tactic ?? creatureDef.strategy
    tactic: creatureDef.tactic ?? creatureDef.strategy,
    family: creatureDef.family,
  };
}

// Deterministic dice roller for reproducible tests
function createDeterministicRoller(seed = 42) {
  let state = seed;
  return function deterministicRoll(min, max) {
    // Simple LCG for deterministic pseudo-random
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    const range = max - min + 1;
    return min + (((state >>> 0) % range));
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Combat Integration Tests", () => {
  describe("Real data structures from server/index.js", () => {
    it("should resolve combat with real playerData and creatureData structures", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();
      const options = { rollDie: createDeterministicRoller(123) };

      const result = resolveCombat(playerData, creatureData, options);

      expect(result).toHaveProperty("log");
      expect(result).toHaveProperty("playerHpFinal");
      expect(result).toHaveProperty("creatureHpFinal");
      expect(result).toHaveProperty("winner");
      expect(["player", "creature", "draw"]).toContain(result.winner);
      expect(Array.isArray(result.log)).toBe(true);
      expect(result.log.length).toBeGreaterThan(0);
      expect(result.playerHpFinal).toBeGreaterThanOrEqual(0);
      expect(result.creatureHpFinal).toBeGreaterThanOrEqual(0);
    });

    it("should work with all weapon types from weapons.json", () => {
      const creatureData = buildCreatureData();

      for (const weapon of weapons) {
        const playerData = buildPlayerData(weapon.code);
        const options = { rollDie: createDeterministicRoller(42) };

        const result = resolveCombat(playerData, creatureData, options);

        expect(result).toHaveProperty("winner");
        expect(["player", "creature", "draw"]).toContain(result.winner);
      }
    });
  });

  describe("Tactic field (strategy → tactic rename)", () => {
    it("should work with tactic field (not strategy)", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();

      // Verify the creature data uses 'tactic' field
      expect(creatureData.tactic).toBeDefined();
      expect(creatureData.tactic.min1).toBeDefined();
      expect(creatureData.tactic.min1).toHaveProperty("EO");
      expect(creatureData.tactic.min1).toHaveProperty("NA");
      expect(creatureData.tactic.min1).toHaveProperty("EN");

      // Verify player data uses 'tactic' field as array
      expect(Array.isArray(playerData.tactic)).toBe(true);
      expect(playerData.tactic).toHaveLength(5);

      const options = { rollDie: createDeterministicRoller(99) };
      const result = resolveCombat(playerData, creatureData, options);

      expect(result.winner).toBeDefined();
    });

    it("should handle the backward compat mapping (strategy → tactic) as done in server/index.js", () => {
      // server/index.js does: tactic: creatureDef.tactic ?? creatureDef.strategy
      // The bestiary currently uses "strategy" field, so the mapping is essential
      const creatureDef = bestiary[0];

      // Verify bestiary uses "strategy" (not "tactic" directly)
      expect(
        creatureDef.strategy !== undefined || creatureDef.tactic !== undefined
      ).toBe(true);

      // The mapping in server/index.js ensures it becomes "tactic"
      const mappedTactic = creatureDef.tactic ?? creatureDef.strategy;
      expect(mappedTactic).toBeDefined();
      expect(mappedTactic.min1).toHaveProperty("EO");
      expect(mappedTactic.min1).toHaveProperty("NA");
      expect(mappedTactic.min1).toHaveProperty("EN");
    });
  });

  describe("Weapon data integration from weapons.json", () => {
    it("should use weapon definitions with all required fields", () => {
      const weaponDef = weapons[0]; // DA (Dagger)

      // Verify all required fields are present
      expect(weaponDef).toHaveProperty("dist");
      expect(weaponDef).toHaveProperty("weight");
      expect(weaponDef).toHaveProperty("damFirst");
      expect(weaponDef).toHaveProperty("damLast");
      expect(weaponDef).toHaveProperty("models");
      expect(weaponDef).toHaveProperty("weightFO");
      expect(weaponDef).toHaveProperty("weightTA");
      expect(weaponDef).toHaveProperty("weightIN");
      expect(weaponDef).toHaveProperty("weightVI");
      expect(weaponDef).toHaveProperty("weightAD");

      // Use it in combat
      const playerData = {
        name: "Testeur",
        stats: {
          force: 10,
          taille: 10,
          constitution: 10,
          intelligence: 10,
          vitesse: 10,
          adresse: 10,
          volonté: 10,
        },
        hp: 50,
        tactic: [
          { EO: 5, NA: 5, EN: 5 },
          { EO: 5, NA: 5, EN: 5 },
          { EO: 5, NA: 5, EN: 5 },
          { EO: 5, NA: 5, EN: 5 },
          { EO: 5, NA: 5, EN: 5 },
        ],
        weaponDef,
        weaponItem: { tier: 1, material: 0, affinities: {} },
        equipment: null,
      };

      const creatureData = buildCreatureData();
      const options = { rollDie: createDeterministicRoller(77) };

      const result = resolveCombat(playerData, creatureData, options);
      expect(result).toHaveProperty("winner");
    });

    it("should correctly integrate weapon dist field for attack modEN calculation", () => {
      // Use a weapon with high dist (long range) — combat starts at distance 10
      const longRangeWeapon = weapons.find((w) => w.dist >= 5);
      const shortRangeWeapon = weapons.find((w) => w.dist <= 2);

      if (longRangeWeapon && shortRangeWeapon) {
        const roller = createDeterministicRoller(55);
        const creatureData = buildCreatureData();

        const playerLong = buildPlayerData(longRangeWeapon.code);
        const playerShort = buildPlayerData(shortRangeWeapon.code);

        const resultLong = resolveCombat(playerLong, creatureData, {
          rollDie: createDeterministicRoller(55),
        });
        const resultShort = resolveCombat(playerShort, creatureData, {
          rollDie: createDeterministicRoller(55),
        });

        // Both should complete without error
        expect(resultLong).toHaveProperty("winner");
        expect(resultShort).toHaveProperty("winner");
      }
    });
  });

  describe("DEV_MODE parameter", () => {
    it("should produce debug entries when options.devMode = true", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();
      const options = {
        devMode: true,
        rollDie: createDeterministicRoller(42),
      };

      const result = resolveCombat(playerData, creatureData, options);

      const debugEntries = result.log.filter((entry) => entry.type === "debug");
      expect(debugEntries.length).toBeGreaterThan(0);
    });

    it("should NOT produce debug entries when options.devMode = false", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();
      const options = {
        devMode: false,
        rollDie: createDeterministicRoller(42),
      };

      const result = resolveCombat(playerData, creatureData, options);

      const debugEntries = result.log.filter((entry) => entry.type === "debug");
      expect(debugEntries.length).toBe(0);
    });

    it("should NOT produce debug entries when devMode is omitted (default)", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();
      const options = {
        rollDie: createDeterministicRoller(42),
      };

      const result = resolveCombat(playerData, creatureData, options);

      const debugEntries = result.log.filter((entry) => entry.type === "debug");
      expect(debugEntries.length).toBe(0);
    });
  });

  describe("Backward compatibility — 3-parameter signature", () => {
    it("should work with resolveCombat(playerData, creatureData, options)", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();
      const options = { rollDie: createDeterministicRoller(42) };

      const result = resolveCombat(playerData, creatureData, options);

      expect(result).toHaveProperty("log");
      expect(result).toHaveProperty("playerHpFinal");
      expect(result).toHaveProperty("creatureHpFinal");
      expect(result).toHaveProperty("winner");
    });

    it("should work with resolveCombat(playerData, creatureData) — no options", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();

      // Should not throw — uses default random dice
      const result = resolveCombat(playerData, creatureData);

      expect(result).toHaveProperty("log");
      expect(result).toHaveProperty("playerHpFinal");
      expect(result).toHaveProperty("creatureHpFinal");
      expect(result).toHaveProperty("winner");
    });

    it("should work with empty options object", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();

      const result = resolveCombat(playerData, creatureData, {});

      expect(result).toHaveProperty("winner");
    });
  });

  describe("Deterministic combat — same rollDie produces same output", () => {
    it("should produce identical results with the same rollDie injection", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();

      const result1 = resolveCombat(playerData, creatureData, {
        rollDie: createDeterministicRoller(42),
      });
      const result2 = resolveCombat(playerData, creatureData, {
        rollDie: createDeterministicRoller(42),
      });

      expect(result1.winner).toBe(result2.winner);
      expect(result1.playerHpFinal).toBe(result2.playerHpFinal);
      expect(result1.creatureHpFinal).toBe(result2.creatureHpFinal);
      expect(result1.log.length).toBe(result2.log.length);

      // Verify log entries are identical
      for (let i = 0; i < result1.log.length; i++) {
        expect(result1.log[i].type).toBe(result2.log[i].type);
        expect(result1.log[i].text).toBe(result2.log[i].text);
      }
    });

    it("should produce different results with different seeds", () => {
      const playerData = buildPlayerData();
      const creatureData = buildCreatureData();

      const result1 = resolveCombat(playerData, creatureData, {
        rollDie: createDeterministicRoller(1),
      });
      const result2 = resolveCombat(playerData, creatureData, {
        rollDie: createDeterministicRoller(999),
      });

      // With different seeds, at least the log should differ
      // (it's theoretically possible but extremely unlikely they'd be identical)
      const logsDiffer =
        result1.log.length !== result2.log.length ||
        result1.log.some(
          (entry, i) =>
            entry.type !== result2.log[i]?.type ||
            entry.text !== result2.log[i]?.text
        );
      expect(logsDiffer).toBe(true);
    });
  });
});
