import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveAttack } from '../combat.js';

/**
 * Property 9: Attack score and hit determination
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 *
 * For any attacker with stats and weapon at distance d from target with weapon range WeaponEN:
 * - BaseAttack = Math.floor((adresse × 0.5 + vitesse × 0.3 + intelligence × 0.2) × 4)
 * - modEN = Math.floor(|d - WeaponEN| × 2)
 * - AttackScore = BaseAttack - modEN
 * - AttackQuality = AttackScore - D100
 * - The attack hits if and only if AttackQuality >= 0
 * - phaseIncrement = weaponDef.weight ?? 0
 * - Throws error when weaponDef is null or missing dist
 */
describe('Property 9: Attack score and hit determination', () => {

  // --- Generators ---

  /** Attacker stats relevant to attack: adresse, vitesse, intelligence in [3, 21] */
  const arbAttackerStats = fc.record({
    adresse: fc.integer({ min: 3, max: 21 }),
    vitesse: fc.integer({ min: 3, max: 21 }),
    intelligence: fc.integer({ min: 3, max: 21 })
  });

  /** Weapon definition with dist (range) in [1, 10] and weight in [1, 15] */
  const arbWeaponDef = fc.record({
    dist: fc.integer({ min: 1, max: 10 }),
    weight: fc.integer({ min: 1, max: 15 })
  });

  /** Distance réelle: integer in [1, 10] */
  const arbDistanceReelle = fc.integer({ min: 1, max: 10 });

  /** D100 roll: integer in [1, 100] */
  const arbD100 = fc.integer({ min: 1, max: 100 });

  // --- Property: baseAttack matches the formula ---

  it('baseAttack = Math.floor((adresse × 0.5 + vitesse × 0.3 + intelligence × 0.2) × 4)', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyBaseAttackFormula(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          const expected = Math.floor((stats.adresse * 0.5 + stats.vitesse * 0.3 + stats.intelligence * 0.2) * 4);
          expect(result.baseAttack).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: modEN matches the formula ---

  it('modEN = Math.floor(|distanceReelle - weaponDef.dist| × 2)', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyModENFormula(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          const expected = Math.floor(Math.abs(distance - weaponDef.dist) * 2);
          expect(result.modEN).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: attackScore = baseAttack - modEN ---

  it('attackScore = baseAttack - modEN', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyAttackScoreFormula(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          expect(result.attackScore).toBe(result.baseAttack - result.modEN);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: attackQuality = attackScore - d100 ---

  it('attackQuality = attackScore - d100', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyAttackQualityFormula(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          expect(result.attackQuality).toBe(result.attackScore - d100);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: hit is true iff attackQuality >= 0 ---

  it('hit is true if and only if attackQuality >= 0', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyHitDetermination(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          expect(result.hit).toBe(result.attackQuality >= 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: phaseIncrement = weaponDef.weight ?? 0 ---

  it('phaseIncrement = weaponDef.weight ?? 0', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbWeaponDef,
        arbDistanceReelle,
        arbD100,
        function verifyPhaseIncrement(stats, weaponDef, distance, d100) {
          const result = resolveAttack(stats, weaponDef, distance, d100);
          expect(result.phaseIncrement).toBe(weaponDef.weight ?? 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: phaseIncrement defaults to 0 when weight is undefined ---

  it('phaseIncrement defaults to 0 when weaponDef.weight is undefined', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        fc.integer({ min: 1, max: 10 }),
        arbDistanceReelle,
        arbD100,
        function verifyPhaseIncrementDefault(stats, dist, distance, d100) {
          const weaponDefNoWeight = { dist };
          const result = resolveAttack(stats, weaponDefNoWeight, distance, d100);
          expect(result.phaseIncrement).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: throws error when weaponDef is null or missing dist ---

  it('throws error when weaponDef is null', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        arbDistanceReelle,
        arbD100,
        function verifyThrowsOnNull(stats, distance, d100) {
          expect(() => resolveAttack(stats, null, distance, d100))
            .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
        }
      ),
      { numRuns: 100 }
    );
  });

  it('throws error when weaponDef is missing dist field', () => {
    fc.assert(
      fc.property(
        arbAttackerStats,
        fc.integer({ min: 1, max: 15 }),
        arbDistanceReelle,
        arbD100,
        function verifyThrowsOnMissingDist(stats, weight, distance, d100) {
          const weaponDefNoDist = { weight };
          expect(() => resolveAttack(stats, weaponDefNoDist, distance, d100))
            .toThrow("resolveCombat: champ 'dist' manquant dans weaponDef");
        }
      ),
      { numRuns: 100 }
    );
  });

});
