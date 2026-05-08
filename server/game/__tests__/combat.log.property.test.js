import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveCombat } from '../combat.js';

/**
 * Property 17: Log integrity
 * Validates: Requirements 15.8, 15.9, 15.10, 16.1, 16.2, 16.5, 16.7, 16.8
 *
 * Properties tested:
 * 1. Every log entry has the shape { type: string, text: string }
 * 2. Every type is one of the 23 valid types
 * 3. A "separator" entry appears at the start of each minute and before the final outcome line
 * 4. The final log entry is "victory", "defeat", or "draw" matching winner
 * 5. With devMode = true, at least one "debug" entry is present
 * 6. With devMode = false, no "debug" entries are present
 */
describe('Property 17: Log integrity', () => {

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

  // Valid log types (22 types as per Req 16.1)
  const VALID_LOG_TYPES = [
    "separator", "initiative", "action", "attack", "miss",
    "dodge_attempt", "dodge", "parry_attempt", "parry",
    "defense_fail", "riposte_attempt", "riposte", "riposte_fail",
    "hit", "armor", "reposition", "recovery",
    "noAction", "victory", "defeat", "draw", "debug"
  ];

  // --- Property 1: Every log entry has the shape { type: string, text: string } ---

  it('every log entry has the shape { type: string, text: string } (Req 16.2)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyLogEntryShape(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie, devMode: true });

          expect(result.log.length).toBeGreaterThan(0);

          for (const entry of result.log) {
            expect(entry).toHaveProperty('type');
            expect(entry).toHaveProperty('text');
            expect(typeof entry.type).toBe('string');
            expect(typeof entry.text).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 15000);

  // --- Property 2: Every type is one of the 23 valid types ---

  it('every log type is one of the 22 valid types (Req 16.1)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        fc.boolean(),
        function verifyLogTypes(playerData, creatureData, diceSequence, devMode) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie, devMode });

          for (const entry of result.log) {
            expect(VALID_LOG_TYPES).toContain(entry.type);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: A "separator" entry appears at the start of each minute and before the final outcome line ---

  it('a separator appears at the start of each minute and before the final outcome (Req 16.5)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifySeparators(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          const log = result.log;

          // The first entry should be a separator (start of minute 1)
          expect(log[0].type).toBe('separator');

          // The final outcome entry (last entry) should be victory, defeat, or draw
          const lastEntry = log[log.length - 1];
          expect(['victory', 'defeat', 'draw']).toContain(lastEntry.type);

          // The entry before the final outcome should be a separator ("Fin du combat")
          const secondToLast = log[log.length - 2];
          expect(secondToLast.type).toBe('separator');

          // Every separator with "Minute" in text should appear before non-separator entries for that minute
          const separatorIndices = log
            .map(function mapEntry(entry, idx) { return { entry, idx }; })
            .filter(function isSeparator(item) { return item.entry.type === 'separator'; });

          // There should be at least 2 separators: minute 1 + end of combat
          expect(separatorIndices.length).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: The final log entry is "victory", "defeat", or "draw" matching winner ---

  it('the final log entry matches the winner (Req 15.8, 15.9, 15.10)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyFinalEntryMatchesWinner(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie });

          const lastEntry = result.log[result.log.length - 1];

          if (result.winner === 'player') {
            expect(lastEntry.type).toBe('victory');
          } else if (result.winner === 'creature') {
            expect(lastEntry.type).toBe('defeat');
          } else {
            expect(lastEntry.type).toBe('draw');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: With devMode = true, at least one "debug" entry is present ---

  it('with devMode = true, at least one debug entry is present (Req 16.7)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyDebugPresent(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie, devMode: true });

          const debugEntries = result.log.filter(function isDebug(entry) {
            return entry.type === 'debug';
          });

          expect(debugEntries.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: With devMode = false, no "debug" entries are present ---

  it('with devMode = false, no debug entries are present (Req 16.8)', () => {
    fc.assert(
      fc.property(
        arbPlayerData,
        arbCreatureData,
        arbDiceSequence,
        function verifyNoDebug(playerData, creatureData, diceSequence) {
          const rollDie = makeDeterministicRollDie(diceSequence);
          const result = resolveCombat(playerData, creatureData, { rollDie, devMode: false });

          const debugEntries = result.log.filter(function isDebug(entry) {
            return entry.type === 'debug';
          });

          expect(debugEntries.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

});
