import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeVivacite, determineInitiative } from '../combat.js';

/**
 * Property 7: Initiative determination
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 *
 * For any two combatants with stats, NA_effectif, and injected d10 values:
 * - scoreVivacité = Math.floor(NA_effectif + vitesse × 0.6 + intelligence × 0.4 + d10 + 0)
 * - The combatant with the higher scoreVivacité SHALL be designated ATT
 * - On tie, the combatant with higher NA_effectif SHALL be ATT
 * - On double tie, a 50/50 coin flip SHALL decide
 */
describe('Property 7: Initiative determination', () => {

  // --- Generators ---

  /** NA_effectif range: 0-10 (capped by endurance and NA_tactique) */
  const arbNaEffectif = fc.integer({ min: 0, max: 10 });

  /** Stats relevant to vivacité: vitesse and intelligence in [3, 21] */
  const arbStats = fc.record({
    vitesse: fc.integer({ min: 3, max: 21 }),
    intelligence: fc.integer({ min: 3, max: 21 })
  });

  /** d10 roll: integer in [1, 10] */
  const arbD10 = fc.integer({ min: 1, max: 10 });

  /** Momentum: always 0 in this version (placeholder) */
  const arbMomentum = fc.constant(0);

  /** Tie breaker: boolean for 50/50 coin flip */
  const arbTieBreaker = fc.boolean();

  // --- Property: scoreVivacité matches the formula ---

  it('computeVivacite returns Math.floor(NA_effectif + vitesse × 0.6 + intelligence × 0.4 + d10 + momentum)', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbStats,
        arbMomentum,
        arbD10,
        function verifyVivaciteFormula(naEffectif, stats, momentum, d10) {
          const result = computeVivacite(naEffectif, stats, momentum, d10);
          const expected = Math.floor(naEffectif + stats.vitesse * 0.6 + stats.intelligence * 0.4 + d10 + momentum);
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Higher scoreVivacité designates ATT ---

  it('combatant with higher scoreVivacité is designated ATT', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbNaEffectif,
        arbStats,
        arbStats,
        arbD10,
        arbD10,
        arbTieBreaker,
        function verifyHigherVivaciteWins(naA, naB, statsA, statsB, d10A, d10B, tieBreaker) {
          const vivA = computeVivacite(naA, statsA, 0, d10A);
          const vivB = computeVivacite(naB, statsB, 0, d10B);

          // Only test when vivacités are different
          fc.pre(vivA !== vivB);

          const result = determineInitiative(vivA, vivB, naA, naB, tieBreaker);
          if (vivA > vivB) {
            expect(result).toBe("A");
          } else {
            expect(result).toBe("B");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: On vivacité tie, higher NA_effectif wins ---

  it('on scoreVivacité tie, combatant with higher NA_effectif is designated ATT', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbNaEffectif,
        fc.integer({ min: 0, max: 50 }),
        arbTieBreaker,
        function verifyNaEffectifTieBreaker(naA, naB, vivacite, tieBreaker) {
          // Force equal vivacité but different NA_effectif
          fc.pre(naA !== naB);

          const result = determineInitiative(vivacite, vivacite, naA, naB, tieBreaker);
          if (naA > naB) {
            expect(result).toBe("A");
          } else {
            expect(result).toBe("B");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: On double tie (vivacité and NA_effectif equal), coin flip decides ---

  it('on double tie (same scoreVivacité and same NA_effectif), tieBreaker decides 50/50', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        arbNaEffectif,
        arbTieBreaker,
        function verifyDoubleTieCoinFlip(vivacite, naEffectif, tieBreaker) {
          const result = determineInitiative(vivacite, vivacite, naEffectif, naEffectif, tieBreaker);
          if (tieBreaker) {
            expect(result).toBe("A");
          } else {
            expect(result).toBe("B");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: computeVivacite always returns an integer ---

  it('computeVivacite always returns an integer (Math.floor applied)', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbStats,
        arbMomentum,
        arbD10,
        function verifyVivaciteIsInteger(naEffectif, stats, momentum, d10) {
          const result = computeVivacite(naEffectif, stats, momentum, d10);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: determineInitiative always returns "A" or "B" ---

  it('determineInitiative always returns either "A" or "B"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        arbNaEffectif,
        arbNaEffectif,
        arbTieBreaker,
        function verifyAlwaysReturnsAOrB(vivA, vivB, naA, naB, tieBreaker) {
          const result = determineInitiative(vivA, vivB, naA, naB, tieBreaker);
          expect(["A", "B"]).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

});
