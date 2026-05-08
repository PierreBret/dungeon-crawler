import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveCombat } from '../combat.js';

/**
 * Property 16: Combat termination conditions
 * Validates: Requirements 15.4, 15.5, 15.6, 15.7
 *
 * Properties tested:
 * 1. When a combatant's HP reaches 0, combat ends immediately (no further ticks)
 * 2. When Minute > 20 at a minute transition, combat ends as draw
 * 3. Return value always contains { log, playerHpFinal, creatureHpFinal, winner }
 * 4. winner is always one of "player", "creature", "draw"
 * 5. If winner === "player" then creatureHpFinal === 0 and playerHpFinal > 0
 * 6. If winner === "creature" then playerHpFinal === 0 and creatureHpFinal > 0
 * 7. If winner === "draw" then both playerHpFinal > 0 and creatureHpFinal > 0
 */
describe('Property 16: Combat termination conditions', () => {

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
    hp: fc.integer({ min: 10, max: 200 }),
    tactic: arbPlayerTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null)
  });

  const arbCreatureData = fc.record({
    nameFr: fc.constant('Gobelin'),
    stats: arbStats,
    hp: fc.integer({ min: 10, max: 200 }),
    tactic: arbCreatureTactic,
    weaponDef: arbWeaponDef,
    weaponItem: arbWeaponItem,
    equipment: fc.constant(null),
    family: fc.constant('beast')
  });

  // Dice sequence generator for deterministic combat
  const arbDiceSequence = fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 500, maxLength: 2000 });

  // Helper: create a deterministic rollDie from a dice sequence
  function makeDeterministicRollDie(diceSequence) {
    let diceIndex = 0;
    return function deterministicRollDie(min, max) {
      const raw = diceSequence[diceIndex % diceSequence.length];
      diceIndex++;
      return min + ((raw - 1) % (max - min + 1));
    };
  }

  // --- Property 1: When a combatant's HP reaches 0, combat ends immediately (no further ticks) ---

  it('when a combatant HP reaches 0, no further ticks are executed (Req 15.5)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyImmediateEndOnDeath(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          if (result.winner === 'player') {
            // Creature HP reached 0 — combat ended immediately
            expect(result.creatureHpFinal).toBe(0);
            // No log entries after the final hit that brought creature to 0
            // The last "hit" entry targeting the creature should show HP: 0
            const hitEntries = result.log.filter(function isCreatureHit(entry) {
              return entry.type === 'hit' && entry.text.includes('Gobelin');
            });
            if (hitEntries.length > 0) {
              const lastHit = hitEntries[hitEntries.length - 1];
              expect(lastHit.text).toContain('HP: 0');
            }
          } else if (result.winner === 'creature') {
            // Player HP reached 0 — combat ended immediately
            expect(result.playerHpFinal).toBe(0);
            const hitEntries = result.log.filter(function isPlayerHit(entry) {
              return entry.type === 'hit' && entry.text.includes('Guerrier');
            });
            if (hitEntries.length > 0) {
              const lastHit = hitEntries[hitEntries.length - 1];
              expect(lastHit.text).toContain('HP: 0');
            }
          }
          // draw case: no HP reached 0, which is fine
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 2: When Minute > 20 at a minute transition, combat ends as draw (Req 15.6) ---

  it('when Minute > 20 at minute transition, combat ends as draw (Req 15.6)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        function verifyDrawAtMinute20(playerData, creatureData) {
          // Give very high HP so nobody dies — forces draw at minute > 20
          const highHpPlayer = { ...playerData, hp: 99999 };
          const highHpCreature = { ...creatureData, hp: 99999 };

          // Dice that always return max → attacks always miss, forces recovery/reposition
          function forcedMissDice(min, max) {
            return max;
          }

          const result = resolveCombat(highHpPlayer, highHpCreature, { rollDie: forcedMissDice });

          // With very high HP and all misses, combat must end as draw
          expect(result.winner).toBe('draw');
          expect(result.playerHpFinal).toBeGreaterThan(0);
          expect(result.creatureHpFinal).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: Return value always contains { log, playerHpFinal, creatureHpFinal, winner } (Req 15.7) ---

  it('return value always contains { log, playerHpFinal, creatureHpFinal, winner } (Req 15.7)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyReturnStructure(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          expect(result).toHaveProperty('log');
          expect(result).toHaveProperty('playerHpFinal');
          expect(result).toHaveProperty('creatureHpFinal');
          expect(result).toHaveProperty('winner');

          // log is an array of objects with type and text
          expect(Array.isArray(result.log)).toBe(true);
          expect(result.log.length).toBeGreaterThan(0);

          // playerHpFinal and creatureHpFinal are numbers
          expect(typeof result.playerHpFinal).toBe('number');
          expect(typeof result.creatureHpFinal).toBe('number');
          expect(result.playerHpFinal).toBeGreaterThanOrEqual(0);
          expect(result.creatureHpFinal).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: winner is always one of "player", "creature", "draw" (Req 15.7) ---

  it('winner is always one of "player", "creature", "draw" (Req 15.7)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyWinnerDomain(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          expect(['player', 'creature', 'draw']).toContain(result.winner);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: If winner === "player" then creatureHpFinal === 0 and playerHpFinal > 0 (Req 15.4) ---

  it('if winner === "player" then creatureHpFinal === 0 and playerHpFinal > 0 (Req 15.4)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyPlayerWinCondition(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          if (result.winner === 'player') {
            expect(result.creatureHpFinal).toBe(0);
            expect(result.playerHpFinal).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: If winner === "creature" then playerHpFinal === 0 and creatureHpFinal > 0 (Req 15.4) ---

  it('if winner === "creature" then playerHpFinal === 0 and creatureHpFinal > 0 (Req 15.4)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyCreatureWinCondition(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          if (result.winner === 'creature') {
            expect(result.playerHpFinal).toBe(0);
            expect(result.creatureHpFinal).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 7: If winner === "draw" then both playerHpFinal > 0 and creatureHpFinal > 0 (Req 15.6) ---

  it('if winner === "draw" then both playerHpFinal > 0 and creatureHpFinal > 0 (Req 15.6)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyDrawCondition(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          if (result.winner === 'draw') {
            expect(result.playerHpFinal).toBeGreaterThan(0);
            expect(result.creatureHpFinal).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

});
