import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTacticForMinute } from '../combat.js';

/**
 * Property 18: Tactic selection by minute
 * Validates: Requirements 15.2, 15.3
 *
 * For any combat minute m:
 *   - If m <= 5, the tactic parameters EO/NA/EN for that minute SHALL be read
 *     from index m-1 of the tactic array (player) or key min{m} (creature).
 *   - If m > 5, the parameters of minute 5 SHALL be used.
 */
describe('Property 18: Tactic selection by minute', () => {

  // --- Generators ---

  const arbTacticParam = fc.integer({ min: 1, max: 10 });

  const arbTacticEntry = fc.record({
    EO: arbTacticParam,
    NA: arbTacticParam,
    EN: arbTacticParam
  });

  /** Player tactic: array of 5 elements */
  const arbPlayerTactic = fc.tuple(
    arbTacticEntry,
    arbTacticEntry,
    arbTacticEntry,
    arbTacticEntry,
    arbTacticEntry
  );

  /** Creature tactic: object with min1..min5 keys */
  const arbCreatureTactic = fc.record({
    min1: arbTacticEntry,
    min2: arbTacticEntry,
    min3: arbTacticEntry,
    min4: arbTacticEntry,
    min5: arbTacticEntry
  });

  /** Minute in range 1–5 (normal range) */
  const arbMinuteNormal = fc.integer({ min: 1, max: 5 });

  /** Minute > 5 (overflow range, uses minute 5 params) */
  const arbMinuteOverflow = fc.integer({ min: 6, max: 20 });

  // --- Property: Player tactic for minute <= 5 reads from index m-1 ---

  it('player tactic for minute m <= 5 reads from index m-1 of the tactic array', () => {
    fc.assert(
      fc.property(
        arbPlayerTactic,
        arbMinuteNormal,
        function verifyPlayerTacticNormal(tacticArray, minute) {
          const result = getTacticForMinute(tacticArray, minute, false);
          const expected = tacticArray[minute - 1];
          expect(result).toStrictEqual(expected);
          expect(result.EO).toBe(expected.EO);
          expect(result.NA).toBe(expected.NA);
          expect(result.EN).toBe(expected.EN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Player tactic for minute > 5 uses minute 5 (index 4) ---

  it('player tactic for minute m > 5 uses the parameters of minute 5 (index 4)', () => {
    fc.assert(
      fc.property(
        arbPlayerTactic,
        arbMinuteOverflow,
        function verifyPlayerTacticOverflow(tacticArray, minute) {
          const result = getTacticForMinute(tacticArray, minute, false);
          const expected = tacticArray[4]; // minute 5 = index 4
          expect(result).toStrictEqual(expected);
          expect(result.EO).toBe(expected.EO);
          expect(result.NA).toBe(expected.NA);
          expect(result.EN).toBe(expected.EN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Creature tactic for minute m <= 5 reads from key min{m} ---

  it('creature tactic for minute m <= 5 reads from key min{m} of the tactic object', () => {
    fc.assert(
      fc.property(
        arbCreatureTactic,
        arbMinuteNormal,
        function verifyCreatureTacticNormal(tacticObj, minute) {
          const result = getTacticForMinute(tacticObj, minute, true);
          const expected = tacticObj[`min${minute}`];
          expect(result).toStrictEqual(expected);
          expect(result.EO).toBe(expected.EO);
          expect(result.NA).toBe(expected.NA);
          expect(result.EN).toBe(expected.EN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Creature tactic for minute > 5 uses min5 ---

  it('creature tactic for minute m > 5 uses the parameters of min5', () => {
    fc.assert(
      fc.property(
        arbCreatureTactic,
        arbMinuteOverflow,
        function verifyCreatureTacticOverflow(tacticObj, minute) {
          const result = getTacticForMinute(tacticObj, minute, true);
          const expected = tacticObj.min5;
          expect(result).toStrictEqual(expected);
          expect(result.EO).toBe(expected.EO);
          expect(result.NA).toBe(expected.NA);
          expect(result.EN).toBe(expected.EN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: All minutes > 5 return the same tactic (stability) ---

  it('all minutes > 5 return the same tactic parameters (minute 5 is the cap)', () => {
    fc.assert(
      fc.property(
        arbPlayerTactic,
        arbCreatureTactic,
        arbMinuteOverflow,
        arbMinuteOverflow,
        function verifyStabilityBeyondMinute5(playerTactic, creatureTactic, m1, m2) {
          const playerResult1 = getTacticForMinute(playerTactic, m1, false);
          const playerResult2 = getTacticForMinute(playerTactic, m2, false);
          expect(playerResult1).toStrictEqual(playerResult2);

          const creatureResult1 = getTacticForMinute(creatureTactic, m1, true);
          const creatureResult2 = getTacticForMinute(creatureTactic, m2, true);
          expect(creatureResult1).toStrictEqual(creatureResult2);
        }
      ),
      { numRuns: 100 }
    );
  });

});
