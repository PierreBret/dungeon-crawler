import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { clampEndurance, computeScores } from '../combat.js';

/**
 * Property 5: Endurance invariant
 * Validates: Requirements 3.7
 *
 * For any sequence of combat actions, the endurance of each combatant
 * SHALL remain within [0, EndInit] at all times.
 * After every modification, endurance = Math.max(0, Math.min(EndInit, endurance)).
 */
describe('Property 5: Endurance invariant', () => {

  // --- Generators ---

  const arbStat = fc.integer({ min: 3, max: 21 });

  const arbStats = fc.record({
    force: arbStat,
    taille: arbStat,
    constitution: arbStat,
    intelligence: arbStat,
    vitesse: arbStat,
    adresse: arbStat,
    volonté: arbStat,
  });

  // EndInit range: Math.floor((3+3+10)*2)=32 to Math.floor((21+21+10)*2)=104
  const arbEndInit = fc.integer({ min: 1, max: 104 });

  // Arbitrary endurance value (including out-of-bounds values)
  const arbEndurance = fc.integer({ min: -200, max: 300 });

  // Action cost (positive = deduction, negative = recovery)
  const arbActionCost = fc.integer({ min: -10, max: 50 });

  // Sequence of action costs to simulate multiple actions
  const arbActionSequence = fc.array(fc.integer({ min: -10, max: 50 }), { minLength: 1, maxLength: 20 });

  // --- Property: clampEndurance always produces a value in [0, EndInit] ---

  it('clampEndurance always returns a value in [0, EndInit] for any endurance and EndInit', () => {
    fc.assert(
      fc.property(
        arbEndurance,
        arbEndInit,
        function verifyClampBounds(endurance, endInit) {
          const result = clampEndurance(endurance, endInit);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(endInit);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: clampEndurance is idempotent ---

  it('clampEndurance is idempotent: clamping an already-clamped value returns the same value', () => {
    fc.assert(
      fc.property(
        arbEndurance,
        arbEndInit,
        function verifyClampIdempotent(endurance, endInit) {
          const clamped = clampEndurance(endurance, endInit);
          const doubleClamped = clampEndurance(clamped, endInit);
          expect(doubleClamped).toBe(clamped);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: clampEndurance preserves values already in [0, EndInit] ---

  it('clampEndurance preserves values already within [0, EndInit]', () => {
    fc.assert(
      fc.property(
        arbEndInit,
        fc.integer({ min: 0, max: 104 }),
        function verifyClampPreservesValid(endInit, rawEndurance) {
          const endurance = Math.min(rawEndurance, endInit); // ensure in range
          const result = clampEndurance(endurance, endInit);
          expect(result).toBe(endurance);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: after any action cost deduction, clamped endurance stays in [0, EndInit] ---

  it('after any action cost deduction from valid endurance, clamped result stays in [0, EndInit]', () => {
    fc.assert(
      fc.property(
        arbEndInit,
        arbActionCost,
        function verifyClampAfterDeduction(endInit, cost) {
          // Start with a valid endurance in [0, EndInit]
          const startEndurance = Math.floor(endInit / 2); // mid-range starting point
          const afterAction = startEndurance - cost;
          const clamped = clampEndurance(afterAction, endInit);
          expect(clamped).toBeGreaterThanOrEqual(0);
          expect(clamped).toBeLessThanOrEqual(endInit);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: for any sequence of actions, endurance remains in [0, EndInit] at all times ---

  it('for any sequence of action costs, endurance remains in [0, EndInit] after each step', () => {
    fc.assert(
      fc.property(
        arbEndInit,
        arbActionSequence,
        function verifySequenceInvariant(endInit, costs) {
          let endurance = endInit; // start at full endurance
          for (const cost of costs) {
            endurance = endurance - cost;
            endurance = clampEndurance(endurance, endInit);
            expect(endurance).toBeGreaterThanOrEqual(0);
            expect(endurance).toBeLessThanOrEqual(endInit);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: EndInit computed from stats always produces valid clamping bounds ---

  it('EndInit from computeScores always produces a positive clamping bound', () => {
    fc.assert(
      fc.property(
        arbStats,
        function verifyEndInitPositive(stats) {
          const { enduranceInit } = computeScores(stats);
          // EndInit = Math.floor((constitution + volonté + 10) * 2)
          // With stats in [3, 21]: min = Math.floor((3+3+10)*2) = 32
          expect(enduranceInit).toBeGreaterThanOrEqual(32);
          expect(enduranceInit).toBeLessThanOrEqual(104);
          // Clamping with this EndInit always works
          const clamped = clampEndurance(enduranceInit, enduranceInit);
          expect(clamped).toBe(enduranceInit);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: negative endurance is clamped to 0 ---

  it('any negative endurance value is clamped to 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        arbEndInit,
        function verifyNegativeClampedToZero(negativeEndurance, endInit) {
          const result = clampEndurance(negativeEndurance, endInit);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: endurance above EndInit is clamped to EndInit ---

  it('any endurance value above EndInit is clamped to EndInit', () => {
    fc.assert(
      fc.property(
        arbEndInit,
        fc.integer({ min: 1, max: 200 }),
        function verifyOverflowClampedToEndInit(endInit, excess) {
          const overEndurance = endInit + excess;
          const result = clampEndurance(overEndurance, endInit);
          expect(result).toBe(endInit);
        }
      ),
      { numRuns: 100 }
    );
  });

});
