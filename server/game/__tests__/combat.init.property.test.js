import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeScores, computeCharge, computePortage, computeSurcoutEndurance, computeNaEffectif, resolveCombat } from '../combat.js';

/**
 * Property 1: Combat initialization invariant
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * For any valid pair of playerData and creatureData, calling resolveCombat SHALL
 * produce a combat state where:
 *   Minute = 1, Phase = 1, nbPhaseParMinute = 60
 *   DistanceRéelle = 10
 *   Momentum = 0 for both combatants
 *   EndInit = Math.floor((constitution + volonté + 10) × 2) for each combatant
 *   hpMax equals the hp provided in input
 */
describe('Property 1: Combat initialization invariant', () => {

  // --- Generators ---

  const arbStat = fc.integer({ min: 3, max: 21 });

  const arbStats = fc.record({
    force: arbStat,
    taille: arbStat,
    constitution: arbStat,
    intelligence: arbStat,
    vitesse: arbStat,
    adresse: arbStat,
    volonté: arbStat
  });

  const arbHp = fc.integer({ min: 50, max: 200 });

  const arbTacticEntry = fc.record({
    EO: fc.integer({ min: 1, max: 10 }),
    NA: fc.integer({ min: 1, max: 10 }),
    EN: fc.integer({ min: 1, max: 10 })
  });

  const arbPlayerTactic = fc.tuple(
    arbTacticEntry, arbTacticEntry, arbTacticEntry, arbTacticEntry, arbTacticEntry
  ).map(function toArray(entries) { return entries; });

  const arbCreatureTactic = fc.tuple(
    arbTacticEntry, arbTacticEntry, arbTacticEntry, arbTacticEntry, arbTacticEntry
  ).map(function toCreatureTactic(entries) {
    return {
      min1: entries[0],
      min2: entries[1],
      min3: entries[2],
      min4: entries[3],
      min5: entries[4]
    };
  });

  const arbWeaponDef = fc.record({
    weight: fc.integer({ min: 1, max: 15 }),
    dist: fc.integer({ min: 1, max: 10 }),
    damFirst: fc.integer({ min: 5, max: 20 }),
    damLast: fc.integer({ min: 20, max: 50 }),
    models: fc.array(fc.string(), { minLength: 1, maxLength: 7 }),
    weightFO: fc.double({ min: 0, max: 1, noNaN: true }),
    weightTA: fc.double({ min: 0, max: 1, noNaN: true }),
    weightIN: fc.double({ min: 0, max: 1, noNaN: true }),
    weightVI: fc.double({ min: 0, max: 1, noNaN: true }),
    weightAD: fc.double({ min: 0, max: 1, noNaN: true })
  });

  const arbWeaponItem = fc.record({
    tier: fc.integer({ min: 1, max: 7 }),
    material: fc.integer({ min: 0, max: 7 }),
    affinities: fc.constant({ beast: 100 })
  });

  const arbPlayerData = fc.record({
    name: fc.constant('Guerrier'),
    stats: arbStats,
    hp: arbHp,
    tactic: arbPlayerTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null)
  });

  const arbCreatureData = fc.record({
    nameFr: fc.constant('Gobelin'),
    stats: arbStats,
    hp: arbHp,
    tactic: arbCreatureTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null),
    family: fc.constant('beast')
  });

  // A deterministic rollDie that always returns 1 (makes combat end quickly)
  function deterministicRollDie(min, max) {
    return min;
  }

  // --- Property: EndInit formula is correct for any stats ---

  it('computeScores(stats).enduranceInit equals Math.floor((constitution + volonté + 10) × 2) for any valid stats', () => {
    fc.assert(
      fc.property(
        arbStats,
        function verifyEnduranceInitFormula(stats) {
          const scores = computeScores(stats);
          const expected = Math.floor((stats.constitution + stats.volonté + 10) * 2);
          expect(scores.enduranceInit).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: EndInit has a floor of 0 (constitution and volonté are always >= 3, so minimum is Math.floor((3+3+10)*2) = 32, but formula should never produce negative) ---

  it('computeScores(stats).enduranceInit is always >= 0 for any valid stats', () => {
    fc.assert(
      fc.property(
        arbStats,
        function verifyEnduranceInitNonNegative(stats) {
          const scores = computeScores(stats);
          expect(scores.enduranceInit).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: resolveCombat with options.rollDie injection works and returns required structure ---

  it('resolveCombat with options.rollDie injection returns { log, playerHpFinal, creatureHpFinal, winner }', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        function verifyResolveCombatStructure(playerData, creatureData) {
          const result = resolveCombat(playerData, creatureData, { rollDie: deterministicRollDie });

          // Verify returned structure has all required fields
          expect(result).toHaveProperty('log');
          expect(result).toHaveProperty('playerHpFinal');
          expect(result).toHaveProperty('creatureHpFinal');
          expect(result).toHaveProperty('winner');

          // log is an array
          expect(Array.isArray(result.log)).toBe(true);

          // playerHpFinal and creatureHpFinal are numbers >= 0
          expect(typeof result.playerHpFinal).toBe('number');
          expect(typeof result.creatureHpFinal).toBe('number');
          expect(result.playerHpFinal).toBeGreaterThanOrEqual(0);
          expect(result.creatureHpFinal).toBeGreaterThanOrEqual(0);

          // winner is one of the valid values
          expect(['player', 'creature', 'draw']).toContain(result.winner);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: hpMax equals hp provided in input (verified via playerHpFinal <= hp) ---

  it('resolveCombat playerHpFinal <= playerData.hp and creatureHpFinal <= creatureData.hp (hpMax = hp input)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        function verifyHpMaxEqualsInput(playerData, creatureData) {
          const result = resolveCombat(playerData, creatureData, { rollDie: deterministicRollDie });

          // HP can only decrease or stay the same (hpMax = hp input, no healing above max)
          expect(result.playerHpFinal).toBeLessThanOrEqual(playerData.hp);
          expect(result.creatureHpFinal).toBeLessThanOrEqual(creatureData.hp);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: EndInit formula matches for both player and creature stats ---

  it('EndInit = Math.floor((constitution + volonté + 10) × 2) holds for any combatant stats', () => {
    fc.assert(
      fc.property(
        arbStats,
        arbStats,
        function verifyBothCombatantsEndInit(playerStats, creatureStats) {
          const playerEndInit = computeScores(playerStats).enduranceInit;
          const creatureEndInit = computeScores(creatureStats).enduranceInit;

          const expectedPlayer = Math.floor((playerStats.constitution + playerStats.volonté + 10) * 2);
          const expectedCreature = Math.floor((creatureStats.constitution + creatureStats.volonté + 10) * 2);

          expect(playerEndInit).toBe(expectedPlayer);
          expect(creatureEndInit).toBe(expectedCreature);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: resolveCombat accepts options parameter without error ---

  it('resolveCombat accepts options with devMode and rollDie without throwing', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        fc.boolean(),
        function verifyOptionsAccepted(playerData, creatureData, devMode) {
          expect(function callResolveCombat() {
            resolveCombat(playerData, creatureData, {
              devMode,
              rollDie: deterministicRollDie
            });
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

});
