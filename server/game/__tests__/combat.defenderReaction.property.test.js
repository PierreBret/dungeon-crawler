import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveDefenderReaction, resolveReposition } from '../combat.js';

/**
 * Property 13: Defender reaction when ATT does not attack
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 *
 * For any tick where ATT repositions or recovers: a dedicated D10_EO_DEF roll
 * determines DEF's intention. If D10 <= EO_DEF and endurance is sufficient,
 * DEF attacks. If endurance is insufficient, DEF's action degrades.
 * If D10 > EO_DEF and DistanceRéelle != Distance_Souhaitée_DEF, DEF attempts
 * repositioning with ScoreRepo = Math.floor((vitesse × 0.6 + intelligence × 0.4) × 5);
 * success if ScoreRepo - D100 >= 0. If at desired distance or reposition fails, DEF recovers.
 */
describe('Property 13: Defender reaction when ATT does not attack', () => {

  // --- Generators ---

  /** defenderStats: stats object with values in [3, 21] */
  const arbDefenderStats = fc.record({
    vitesse: fc.integer({ min: 3, max: 21 }),
    intelligence: fc.integer({ min: 3, max: 21 }),
    adresse: fc.integer({ min: 3, max: 21 }),
    force: fc.integer({ min: 3, max: 21 }),
    taille: fc.integer({ min: 3, max: 21 }),
    volonté: fc.integer({ min: 3, max: 21 })
  });

  /** eoDefender: integer [1, 10] */
  const arbEoDefender = fc.integer({ min: 1, max: 10 });

  /** enDefender: integer [1, 10] */
  const arbEnDefender = fc.integer({ min: 1, max: 10 });

  /** endurance: integer [0, 50] */
  const arbEndurance = fc.integer({ min: 0, max: 50 });

  /** coutAttaque: integer [1, 20] */
  const arbCoutAttaque = fc.integer({ min: 1, max: 20 });

  /** coutRepo: integer [1, 10] */
  const arbCoutRepo = fc.integer({ min: 1, max: 10 });

  /** distanceReelle: integer [1, 10] */
  const arbDistanceReelle = fc.integer({ min: 1, max: 10 });

  /** weaponDef: { dist: [1, 10], weight: [1, 15] } */
  const arbWeaponDef = fc.record({
    dist: fc.integer({ min: 1, max: 10 }),
    weight: fc.integer({ min: 1, max: 15 })
  });

  /** d10EO: integer [1, 10] */
  const arbD10EO = fc.integer({ min: 1, max: 10 });

  /** d100Repo: integer [1, 100] */
  const arbD100Repo = fc.integer({ min: 1, max: 100 });

  // --- Property 1: attackIntended = (d10EO <= eoDefender) — Req 12.1 ---

  it('attackIntended equals (d10EO <= eoDefender)', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyAttackIntended(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.attackIntended).toBe(d10EO <= eoDefender);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 2: If attackIntended AND endurance >= coutAttaque → action = "attaque" — Req 12.2 ---

  it('if attackIntended and endurance >= coutAttaque, action is "attaque"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyAttackWhenIntendedAndAffordable(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO <= eoDefender);
          fc.pre(endurance >= coutAttaque);

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.action).toBe("attaque");
          expect(result.degraded).toBe(false);
          expect(result.enduranceCost).toBe(coutAttaque);
          expect(result.phaseIncrement).toBe(weaponDef.weight);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: If attackIntended AND endurance < coutAttaque → degradation chain — Req 12.3 ---

  it('if attackIntended and endurance < coutAttaque, action degrades (repositionnement or recuperation)', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyDegradationWhenAttackUnaffordable(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO <= eoDefender);
          fc.pre(endurance < coutAttaque);

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.degraded).toBe(true);

          if (endurance >= coutRepo) {
            expect(result.action).toBe("repositionnement");
            expect(result.enduranceCost).toBe(coutRepo);
            expect(result.phaseIncrement).toBe(2);
            expect(result.newDistance).not.toBeNull();
          } else {
            expect(result.action).toBe("recuperation");
            expect(result.enduranceCost).toBe(-1);
            expect(result.phaseIncrement).toBe(1);
            expect(result.newDistance).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: If NOT attackIntended AND distanceReelle != 11 - enDefender → repo attempted with scoreRepo formula — Req 12.4 ---

  it('if not attackIntended and distance != distanceSouhaitee, repo is attempted with correct scoreRepo', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyRepoAttemptedWithCorrectScore(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO > eoDefender);
          const distanceSouhaitee = 11 - enDefender;
          fc.pre(distanceReelle !== distanceSouhaitee);

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          const expectedScoreRepo = Math.floor((defenderStats.vitesse * 0.6 + defenderStats.intelligence * 0.4) * 5);

          expect(result.attackIntended).toBe(false);
          expect(result.repoAttempted).toBe(true);
          expect(result.scoreRepo).toBe(expectedScoreRepo);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: If scoreRepo - d100Repo >= 0 AND endurance >= coutRepo → repo success — Req 12.5 ---

  it('if scoreRepo - d100Repo >= 0 and endurance >= coutRepo, repositionnement succeeds', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyRepoSuccess(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO > eoDefender);
          const distanceSouhaitee = 11 - enDefender;
          fc.pre(distanceReelle !== distanceSouhaitee);
          const scoreRepo = Math.floor((defenderStats.vitesse * 0.6 + defenderStats.intelligence * 0.4) * 5);
          fc.pre(scoreRepo - d100Repo >= 0);
          fc.pre(endurance >= coutRepo);

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.action).toBe("repositionnement");
          expect(result.repoSuccess).toBe(true);
          expect(result.phaseIncrement).toBe(2);
          expect(result.enduranceCost).toBe(coutRepo);
          // Verify newDistance matches resolveReposition logic
          const { newDistance } = resolveReposition(distanceReelle, enDefender);
          expect(result.newDistance).toBe(newDistance);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: If distanceReelle == 11 - enDefender → recovery — Req 12.6 ---

  it('if distance equals distanceSouhaitee, DEF recovers', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyRecoveryAtDesiredDistance(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO > eoDefender);
          const distanceSouhaitee = 11 - enDefender;
          // distanceSouhaitee is always in [1, 10] since enDefender is in [1, 10]
          const distanceReelle = distanceSouhaitee;

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.action).toBe("recuperation");
          expect(result.repoAttempted).toBe(false);
          expect(result.repoSuccess).toBe(false);
          expect(result.newDistance).toBeNull();
          expect(result.phaseIncrement).toBe(1);
          expect(result.enduranceCost).toBe(-1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 7: If repo fails → recovery — Req 12.7 ---

  it('if repositionnement fails (scoreRepo - d100Repo < 0 or endurance < coutRepo), DEF recovers', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyRecoveryOnRepoFailure(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          fc.pre(d10EO > eoDefender);
          const distanceSouhaitee = 11 - enDefender;
          fc.pre(distanceReelle !== distanceSouhaitee);
          const scoreRepo = Math.floor((defenderStats.vitesse * 0.6 + defenderStats.intelligence * 0.4) * 5);
          // Precondition: repo fails (either score too low or endurance insufficient)
          fc.pre(scoreRepo - d100Repo < 0 || endurance < coutRepo);

          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(result.action).toBe("recuperation");
          expect(result.repoAttempted).toBe(true);
          expect(result.repoSuccess).toBe(false);
          expect(result.newDistance).toBeNull();
          expect(result.phaseIncrement).toBe(1);
          expect(result.enduranceCost).toBe(-1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 8: Return action is always one of "attaque", "repositionnement", "recuperation" ---

  it('return action is always one of "attaque", "repositionnement", "recuperation"', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbEoDefender,
        arbEnDefender,
        arbEndurance,
        arbCoutAttaque,
        arbCoutRepo,
        arbDistanceReelle,
        arbWeaponDef,
        arbD10EO,
        arbD100Repo,
        function verifyValidActionValues(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
          const result = resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo);
          expect(["attaque", "repositionnement", "recuperation"]).toContain(result.action);
        }
      ),
      { numRuns: 100 }
    );
  });

});
