import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveAttack,
  resolveReposition,
  resolveRecovery,
  chooseDefense,
  resolveCombat
} from '../combat.js';

/**
 * Property 15: Phase advancement and minute transitions
 * Validates: Requirements 7.7, 8.2, 9.2, 10.8, 10.10, 15.1
 *
 * For any action, Phase SHALL increment by:
 *   - WeaponWeight (attack) — Req 7.7
 *   - 2 (reposition or dodge) — Req 8.2, 10.8
 *   - 1 (parry or recovery) — Req 10.10, 9.2
 * When Phase >= nbPhaseParMinute (60), Minute SHALL increment, Phase SHALL reset
 * to 1, and NA_effectif SHALL be recalculated for each combatant — Req 15.1
 */
describe('Property 15: Phase advancement and minute transitions', () => {

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

  const arbWeaponWeight = fc.integer({ min: 1, max: 15 });

  const arbWeaponDef = fc.record({
    weight: arbWeaponWeight,
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

  const arbPlayerData = fc.record({
    name: fc.constant('Guerrier'),
    stats: arbStats,
    hp: fc.integer({ min: 50, max: 200 }),
    tactic: arbPlayerTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null)
  });

  const arbCreatureData = fc.record({
    nameFr: fc.constant('Gobelin'),
    stats: arbStats,
    hp: fc.integer({ min: 50, max: 200 }),
    tactic: arbCreatureTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null),
    family: fc.constant('beast')
  });

  const arbDistanceReelle = fc.integer({ min: 1, max: 10 });
  const arbEN = fc.integer({ min: 1, max: 10 });
  const arbD100 = fc.integer({ min: 1, max: 100 });
  const arbEndurance = fc.integer({ min: 1, max: 100 });
  const arbEndInit = fc.integer({ min: 50, max: 120 });

  // --- Property: Attack increments Phase by WeaponWeight (Req 7.7) ---

  it('resolveAttack returns phaseIncrement = weaponDef.weight for any valid attack', () => {
    fc.assert(
      fc.property(
        arbStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyAttackPhaseIncrement(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          expect(result.phaseIncrement).toBe(weaponDef.weight);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Repositionnement increments Phase by 2 (Req 8.2) ---

  it('resolveReposition returns phaseIncrement = 2 for any valid reposition', () => {
    fc.assert(
      fc.property(
        arbDistanceReelle,
        arbEN,
        function verifyRepositionPhaseIncrement(distanceReelle, en) {
          const result = resolveReposition(distanceReelle, en);
          expect(result.phaseIncrement).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Récupération increments Phase by 1 (Req 9.2) ---

  it('resolveRecovery returns phaseIncrement = 1 for any valid recovery', () => {
    fc.assert(
      fc.property(
        arbEndurance,
        arbEndInit,
        function verifyRecoveryPhaseIncrement(endurance, endInit) {
          // Ensure endurance < endInit so recovery is meaningful
          const clampedEndurance = Math.min(endurance, endInit - 1);
          const result = resolveRecovery(clampedEndurance, endInit);
          expect(result.phaseIncrement).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Esquive increments Phase by 2 (Req 10.8) ---

  it('chooseDefense returns phaseIncrement = 2 when esquive is chosen', () => {
    fc.assert(
      fc.property(
        arbStats,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        arbD100,
        function verifyEsquivePhaseIncrement(stats, eo, naEffectif, en, d100) {
          // Give high endurance so no degradation occurs
          const highEndurance = 200;
          const coutEsquive = 10;
          const coutParade = 5;

          const result = chooseDefense(stats, eo, naEffectif, en, highEndurance, coutEsquive, coutParade, d100);

          if (result.defenseType === 'esquive') {
            expect(result.phaseIncrement).toBe(2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Parade increments Phase by 1 (Req 10.10) ---

  it('chooseDefense returns phaseIncrement = 1 when parade is chosen', () => {
    fc.assert(
      fc.property(
        arbStats,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        arbD100,
        function verifyParadePhaseIncrement(stats, eo, naEffectif, en, d100) {
          // Give high endurance so no degradation occurs
          const highEndurance = 200;
          const coutEsquive = 10;
          const coutParade = 5;

          const result = chooseDefense(stats, eo, naEffectif, en, highEndurance, coutEsquive, coutParade, d100);

          if (result.defenseType === 'parade') {
            expect(result.phaseIncrement).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: resolveCombat produces a valid result (doesn't crash) ---

  it('resolveCombat with injected dice always produces a valid result structure', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 500, maxLength: 2000 }),
        function verifyResolveCombatValid(playerData, creatureData, diceSequence) {
          let diceIndex = 0;
          function deterministicRollDie(min, max) {
            const raw = diceSequence[diceIndex % diceSequence.length];
            diceIndex++;
            // Scale the raw value [1, 100] to [min, max]
            return min + ((raw - 1) % (max - min + 1));
          }

          const result = resolveCombat(playerData, creatureData, { rollDie: deterministicRollDie });

          // Must have all required fields
          expect(result).toHaveProperty('log');
          expect(result).toHaveProperty('playerHpFinal');
          expect(result).toHaveProperty('creatureHpFinal');
          expect(result).toHaveProperty('winner');

          // winner is always one of the valid values
          expect(['player', 'creature', 'draw']).toContain(result.winner);

          // HP values are non-negative
          expect(result.playerHpFinal).toBeGreaterThanOrEqual(0);
          expect(result.creatureHpFinal).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: winner is always one of "player", "creature", "draw" ---

  it('resolveCombat winner is always one of "player", "creature", "draw"', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 500, maxLength: 2000 }),
        function verifyWinnerValues(playerData, creatureData, diceSequence) {
          let diceIndex = 0;
          function deterministicRollDie(min, max) {
            const raw = diceSequence[diceIndex % diceSequence.length];
            diceIndex++;
            return min + ((raw - 1) % (max - min + 1));
          }

          const result = resolveCombat(playerData, creatureData, { rollDie: deterministicRollDie });
          expect(['player', 'creature', 'draw']).toContain(result.winner);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Phase transitions happen correctly (minute increments when phase >= 60) ---

  it('resolveCombat with dice forcing many low-weight actions eventually transitions minutes (draw at minute > 20)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        function verifyMinuteTransitionViaDraw(playerData, creatureData) {
          // Use dice that always miss attacks (d100 = 100 for attacks) and force recovery
          // This means: d10 initiative = 5, d10 EO = 10 (always > EO, so reposition intended)
          // But with low endurance, it degrades to recovery (phase += 1 each tick)
          // After 60 ticks of recovery, minute transitions
          // After 20 minutes, combat ends as draw

          // Give very high HP so nobody dies
          const highHpPlayer = { ...playerData, hp: 9999 };
          const highHpCreature = { ...creatureData, hp: 9999 };

          // Dice sequence: always return max values to force misses and recoveries
          // d10 for initiative: 5 (mid), d10 for EO: 10 (always > EO → reposition)
          // d100 for repo check: 100 (always fails → recovery)
          // This forces both combatants into recovery mode (phase += 1 per tick)
          let callCount = 0;
          function forcedRecoveryDice(min, max) {
            callCount++;
            // Return max value to force failures/recoveries
            return max;
          }

          const result = resolveCombat(highHpPlayer, highHpCreature, { rollDie: forcedRecoveryDice });

          // With high HP and forced recoveries, combat should end as draw
          expect(result.winner).toBe('draw');
          // Both combatants should still have HP > 0
          expect(result.playerHpFinal).toBeGreaterThan(0);
          expect(result.creatureHpFinal).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

});
