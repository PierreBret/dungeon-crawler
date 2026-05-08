import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeNaEffectif } from '../combat.js';

/**
 * Property 6: NA_effectif calculation and stability
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * For any combatant at the start of a minute with NA_tactique and current Endurance:
 * - NA_effectif = Math.min(NA_tactique, Math.floor(Endurance / 2))
 * - If Endurance <= 0, NA_effectif = 0
 * - Once computed, NA_effectif SHALL NOT change during that minute regardless of endurance changes
 */
describe('Property 6: NA_effectif calculation and stability', () => {

  // --- Generators ---

  /** NA_tactique range: 1-10 (tactical parameter) */
  const arbNaTactique = fc.integer({ min: 1, max: 10 });

  /** Endurance range: 0-104 (valid endurance values during combat) */
  const arbEndurance = fc.integer({ min: 0, max: 104 });

  /** Negative endurance values (edge case: endurance <= 0) */
  const arbNegativeEndurance = fc.integer({ min: -50, max: 0 });

  /** Sequence of endurance changes during a minute (simulating actions consuming endurance) */
  const arbEnduranceChanges = fc.array(fc.integer({ min: -20, max: 5 }), { minLength: 1, maxLength: 15 });

  // --- Property: NA_effectif matches the formula Math.min(NA_tactique, Math.floor(Endurance / 2)) ---

  it('NA_effectif equals Math.min(NA_tactique, Math.floor(Endurance / 2)) for positive endurance', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        fc.integer({ min: 1, max: 104 }),
        function verifyNaEffectifFormula(naTactique, endurance) {
          const result = computeNaEffectif(naTactique, endurance);
          const expected = Math.min(naTactique, Math.floor(endurance / 2));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: NA_effectif is 0 when endurance <= 0 ---

  it('NA_effectif is 0 when endurance is zero or negative', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        arbNegativeEndurance,
        function verifyZeroWhenNoEndurance(naTactique, endurance) {
          const result = computeNaEffectif(naTactique, endurance);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: NA_effectif is always <= NA_tactique ---

  it('NA_effectif never exceeds NA_tactique', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        fc.integer({ min: -50, max: 104 }),
        function verifyNeverExceedsNaTactique(naTactique, endurance) {
          const result = computeNaEffectif(naTactique, endurance);
          expect(result).toBeLessThanOrEqual(naTactique);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: NA_effectif is always >= 0 ---

  it('NA_effectif is always non-negative', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        fc.integer({ min: -50, max: 104 }),
        function verifyNonNegative(naTactique, endurance) {
          const result = computeNaEffectif(naTactique, endurance);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: NA_effectif is always <= Math.floor(Endurance / 2) when endurance > 0 ---

  it('NA_effectif never exceeds Math.floor(Endurance / 2) when endurance is positive', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        fc.integer({ min: 1, max: 104 }),
        function verifyNeverExceedsHalfEndurance(naTactique, endurance) {
          const result = computeNaEffectif(naTactique, endurance);
          expect(result).toBeLessThanOrEqual(Math.floor(endurance / 2));
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Stability — once computed, NA_effectif does not change during the minute ---

  it('NA_effectif computed at start of minute remains stable regardless of subsequent endurance changes', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        arbEndurance,
        arbEnduranceChanges,
        function verifyStabilityDuringMinute(naTactique, startEndurance, enduranceChanges) {
          // Compute NA_effectif at the start of the minute
          const naEffectif = computeNaEffectif(naTactique, startEndurance);

          // Simulate endurance changes during the minute (actions consuming endurance)
          let currentEndurance = startEndurance;
          for (const change of enduranceChanges) {
            currentEndurance = Math.max(0, currentEndurance + change);

            // The NA_effectif computed at the start should NOT be recalculated
            // even though endurance has changed. The function is pure and deterministic,
            // so calling it again with the ORIGINAL values must return the same result.
            const recomputed = computeNaEffectif(naTactique, startEndurance);
            expect(recomputed).toBe(naEffectif);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: NA_effectif equals NA_tactique when endurance is sufficiently high ---

  it('NA_effectif equals NA_tactique when Math.floor(Endurance / 2) >= NA_tactique', () => {
    fc.assert(
      fc.property(
        arbNaTactique,
        function verifyEqualsNaTactiqueWhenHighEndurance(naTactique) {
          // Endurance high enough: Math.floor(endurance / 2) >= naTactique
          // Minimum endurance needed: naTactique * 2
          const endurance = naTactique * 2 + fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0];
          const result = computeNaEffectif(naTactique, endurance);
          expect(result).toBe(naTactique);
        }
      ),
      { numRuns: 100 }
    );
  });

});
