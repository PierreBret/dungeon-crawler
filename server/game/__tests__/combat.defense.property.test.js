import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { chooseDefense } from '../combat.js';

/**
 * Property 11: Defense selection and resolution
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9, 10.11, 10.12, 10.13
 *
 * For any DEF with stats, tactical params (EO, NA_effectif, EN), and endurance:
 * - BaseDodge = vitesse × 2 + adresse - taille
 * - DodgeScore = BaseDodge + (5 - EO) + (NA_effectif - 5) + (5 - EN)
 * - BaseParry = adresse + force + volonté
 * - ParryScore = BaseParry + (5 - EO) + (5 - NA_effectif) + (EN - 5)
 * - The defense with the highest score SHALL be chosen (Parry wins ties).
 * - If the chosen defense is unaffordable, it SHALL fall back (Dodge → Parry → encaisse).
 * - A defense succeeds if Score - D100 >= 0; on success, no damage is applied; on failure, damage is applied.
 */
describe('Property 11: Defense selection and resolution', () => {

  // --- Generators ---

  /** defenderStats: stats with values in [3, 21] */
  const arbDefenderStats = fc.record({
    vitesse: fc.integer({ min: 3, max: 21 }),
    adresse: fc.integer({ min: 3, max: 21 }),
    taille: fc.integer({ min: 3, max: 21 }),
    force: fc.integer({ min: 3, max: 21 }),
    volonté: fc.integer({ min: 3, max: 21 })
  });

  /** EO, NA_effectif, EN: integer [1, 10] */
  const arbEO = fc.integer({ min: 1, max: 10 });
  const arbNaEffectif = fc.integer({ min: 1, max: 10 });
  const arbEN = fc.integer({ min: 1, max: 10 });

  /** Endurance: integer [0, 50] */
  const arbEndurance = fc.integer({ min: 0, max: 50 });

  /** Coût d'esquive: integer [3, 15] */
  const arbCoutEsquive = fc.integer({ min: 3, max: 15 });

  /** Coût de parade: integer [2, 10] */
  const arbCoutParade = fc.integer({ min: 2, max: 10 });

  /** d100: integer [1, 100] */
  const arbD100 = fc.integer({ min: 1, max: 100 });

  // --- Helper: compute expected scores ---

  function expectedDodgeScore(stats, eo, naEffectif, en) {
    const baseDodge = stats.vitesse * 2 + stats.adresse - stats.taille;
    return baseDodge + (5 - eo) + (naEffectif - 5) + (5 - en);
  }

  function expectedParryScore(stats, eo, naEffectif, en) {
    const vol = stats.volonté ?? 0;
    const baseParry = stats.adresse + stats.force + vol;
    return baseParry + (5 - eo) + (5 - naEffectif) + (en - 5);
  }

  // --- Property 1: DodgeScore formula ---

  it('DodgeScore = BaseDodge + (5-eo) + (naEffectif-5) + (5-en)', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          const expected = expectedDodgeScore(stats, eo, naEffectif, en);
          expect(result.dodgeScore).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 2: ParryScore formula ---

  it('ParryScore = BaseParry + (5-eo) + (5-naEffectif) + (en-5)', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          const expected = expectedParryScore(stats, eo, naEffectif, en);
          expect(result.parryScore).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: If DodgeScore > ParryScore → defenseType is "esquive" (when affordable) ---

  it('if DodgeScore > ParryScore and endurance >= coutEsquive, defenseType is "esquive"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
          const parryScore = expectedParryScore(stats, eo, naEffectif, en);
          fc.pre(dodgeScore > parryScore);
          fc.pre(endurance >= coutEsquive);

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("esquive");
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: If ParryScore >= DodgeScore → defenseType is "parade" (parade wins ties, when affordable) ---

  it('if ParryScore >= DodgeScore and endurance >= coutParade, defenseType is "parade"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
          const parryScore = expectedParryScore(stats, eo, naEffectif, en);
          fc.pre(parryScore >= dodgeScore);
          fc.pre(endurance >= coutParade);

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("parade");
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: Degradation: esquive → parade → encaisse when endurance insufficient ---

  it('if preferred is esquive but endurance < coutEsquive and endurance >= coutParade, degrades to "parade"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
          const parryScore = expectedParryScore(stats, eo, naEffectif, en);
          fc.pre(dodgeScore > parryScore); // esquive preferred
          fc.pre(endurance < coutEsquive); // can't afford esquive
          fc.pre(endurance >= coutParade); // can afford parade

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("parade");
          expect(result.degraded).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if endurance < coutParade and endurance < coutEsquive, degrades to "encaisse"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          fc.pre(endurance < coutEsquive); // can't afford esquive
          fc.pre(endurance < coutParade);  // can't afford parade
          // Regardless of preferred defense, both are unaffordable → encaisse

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("encaisse");
          expect(result.degraded).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: Esquive succeeds iff DodgeScore - d100 >= 0; Parade succeeds iff ParryScore - d100 >= 0 ---

  it('esquive succeeds iff dodgeScore - d100 >= 0', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
          const parryScore = expectedParryScore(stats, eo, naEffectif, en);
          fc.pre(dodgeScore > parryScore); // esquive preferred
          fc.pre(endurance >= coutEsquive); // can afford esquive

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("esquive");
          expect(result.success).toBe(dodgeScore - d100 >= 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parade succeeds iff parryScore - d100 >= 0', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
          const parryScore = expectedParryScore(stats, eo, naEffectif, en);
          fc.pre(parryScore >= dodgeScore); // parade preferred
          fc.pre(endurance >= coutParade); // can afford parade

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("parade");
          expect(result.success).toBe(parryScore - d100 >= 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 7: On success → success = true; on failure → success = false ---

  it('on successful defense, success is true', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          if (result.defenseType === "esquive") {
            const dodgeScore = expectedDodgeScore(stats, eo, naEffectif, en);
            expect(result.success).toBe(dodgeScore - d100 >= 0);
          } else if (result.defenseType === "parade") {
            const parryScore = expectedParryScore(stats, eo, naEffectif, en);
            expect(result.success).toBe(parryScore - d100 >= 0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 8: Encaisse always has success = false ---

  it('encaisse always has success = false', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          // For encaisse to be reached, both esquive and parade must be unaffordable
          fc.pre(endurance < coutEsquive); // can't afford esquive
          fc.pre(endurance < coutParade);  // can't afford parade

          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          expect(result.defenseType).toBe("encaisse");
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 9: Phase increment: esquive = 2, parade = 1, encaisse = 0 ---

  it('phaseIncrement is 2 for esquive, 1 for parade, 0 for encaisse', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          if (result.defenseType === "esquive") {
            expect(result.phaseIncrement).toBe(2);
          } else if (result.defenseType === "parade") {
            expect(result.phaseIncrement).toBe(1);
          } else {
            expect(result.phaseIncrement).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 10: EnduranceCost: esquive = coutEsquive, parade = coutParade, encaisse = 0 ---

  it('enduranceCost is coutEsquive for esquive, coutParade for parade, 0 for encaisse', () => {
    fc.assert(
      fc.property(
        arbDefenderStats, arbEO, arbNaEffectif, arbEN, arbEndurance, arbCoutEsquive, arbCoutParade, arbD100,
        (stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) => {
          const result = chooseDefense(stats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100);
          if (result.defenseType === "esquive") {
            expect(result.enduranceCost).toBe(coutEsquive);
          } else if (result.defenseType === "parade") {
            expect(result.enduranceCost).toBe(coutParade);
          } else {
            expect(result.enduranceCost).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

});
