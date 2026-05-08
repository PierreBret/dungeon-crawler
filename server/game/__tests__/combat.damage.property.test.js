import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeDamage } from '../combat.js';

/**
 * Property 14: Damage formula
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.9, 13.10
 *
 * For any successful hit with weapon definition (damFirst, damLast, nbTiers, tier, material,
 * stat weights) and attacker stats:
 *   baseArme = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))
 *   modMatériau from the discrete table [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0]
 *   coefStats = 1 + Σ((stat - 12) × 0.02 × weight)
 *   modAffinité = affinité / 100 (default 0 when targetFamily provided but missing)
 *   modAffinité = 1.0 when targetFamily is undefined (backward compat)
 *   modTypeDégâts = 1.0 always
 *   TotalDamage = Math.floor(baseArme × modMatériau × coefStats × modAffinité × modTypeDégâts)
 *   dégâtsFinaux = Math.max(0, TotalDamage - armorReduction)
 *   final >= 0 always (non-negative)
 *   When weaponDef is null → returns { raw: 0, final: 0, ... }
 */
describe('Property 14: Damage formula', () => {

  // --- Generators ---

  const MATERIALS_MOD = [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0];

  const arbWeaponDef = fc.record({
    damFirst: fc.integer({ min: 5, max: 30 }),
    damLast: fc.integer({ min: 30, max: 100 }),
    models: fc.array(fc.string(), { minLength: 1, maxLength: 7 }),
    weightFO: fc.integer({ min: 0, max: 5 }),
    weightTA: fc.integer({ min: 0, max: 5 }),
    weightIN: fc.integer({ min: 0, max: 5 }),
    weightVI: fc.integer({ min: 0, max: 5 }),
    weightAD: fc.integer({ min: 0, max: 5 }),
  });

  const arbFamilyName = fc.constantFrom('gobelin', 'dragon', 'undead', 'beast', 'demon', 'human', 'elemental', 'insect');

  const arbWeaponItem = fc.record({
    tier: fc.integer({ min: 1, max: 7 }),
    material: fc.integer({ min: 0, max: 7 }),
    affinities: fc.dictionary(
      arbFamilyName,
      fc.integer({ min: -100, max: 100 })
    ),
  });

  const arbAttackerStats = fc.record({
    force: fc.integer({ min: 3, max: 21 }),
    taille: fc.integer({ min: 3, max: 21 }),
    intelligence: fc.integer({ min: 3, max: 21 }),
    vitesse: fc.integer({ min: 3, max: 21 }),
    adresse: fc.integer({ min: 3, max: 21 }),
  });

  const arbTargetFamily = arbFamilyName;

  // --- Property 1: baseArme formula ---

  it('baseArme = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        function verifyBaseArmeFormula(weaponDef, weaponItem, attackerStats) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, undefined);
          const nbTiers = weaponDef.models.length;
          const expected = Math.floor(
            weaponDef.damFirst + (weaponDef.damLast - weaponDef.damFirst) * (weaponItem.tier - 1) / Math.max(nbTiers - 1, 1)
          );
          expect(result.baseArme).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 2: modMateriau from discrete table ---

  it('modMateriau is from table [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0] indexed by material', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        function verifyModMateriauTable(weaponDef, weaponItem, attackerStats) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, undefined);
          const expected = MATERIALS_MOD[weaponItem.material];
          expect(result.modMateriau).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: coefStats formula ---

  it('coefStats = 1 + Σ((stat - 12) × 0.02 × weight) for each stat', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        function verifyCoefStatsFormula(weaponDef, weaponItem, attackerStats) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, undefined);
          const expected = 1
            + (attackerStats.force - 12) * 0.02 * weaponDef.weightFO
            + (attackerStats.taille - 12) * 0.02 * weaponDef.weightTA
            + (attackerStats.intelligence - 12) * 0.02 * weaponDef.weightIN
            + (attackerStats.vitesse - 12) * 0.02 * weaponDef.weightVI
            + (attackerStats.adresse - 12) * 0.02 * weaponDef.weightAD;
          expect(result.coefStats).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: modAffinite = 1 + affinities[targetFamily] / 100 (default 1.0 when missing) ---

  it('modAffinite = 1 + affinities[targetFamily] / 100 when targetFamily is provided', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        arbTargetFamily,
        function verifyModAffiniteWithFamily(weaponDef, weaponItem, attackerStats, targetFamily) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, targetFamily);
          const affinityValue = weaponItem.affinities[targetFamily] ?? 0;
          const expected = 1 + affinityValue / 100;
          expect(result.modAffinite).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: modAffinite = 1.0 when targetFamily is undefined (backward compat) ---

  it('modAffinite = 1.0 when targetFamily is undefined (backward compatibility)', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        function verifyModAffiniteUndefined(weaponDef, weaponItem, attackerStats) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, undefined);
          expect(result.modAffinite).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: modTypeDegats = 1.0 always ---

  it('modTypeDegats = 1.0 always', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        fc.option(arbTargetFamily, { nil: undefined }),
        function verifyModTypeDegatsAlwaysOne(weaponDef, weaponItem, attackerStats, targetFamily) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, targetFamily);
          expect(result.modTypeDegats).toBe(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 7: raw = Math.floor(baseArme × modMateriau × coefStats × modAffinite × modTypeDegats) ---

  it('raw = Math.floor(baseArme × modMateriau × coefStats × modAffinite × modTypeDegats)', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        fc.option(arbTargetFamily, { nil: undefined }),
        function verifyRawFormula(weaponDef, weaponItem, attackerStats, targetFamily) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, targetFamily);
          const expected = Math.floor(
            result.baseArme * result.modMateriau * result.coefStats * result.modAffinite * result.modTypeDegats
          );
          expect(result.raw).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 8: final = Math.max(0, raw - armorReduction) ---

  it('final = Math.max(0, raw - armorReduction)', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        fc.option(arbTargetFamily, { nil: undefined }),
        function verifyFinalFormula(weaponDef, weaponItem, attackerStats, targetFamily) {
          // armorReduction is always 0 (armors not implemented)
          const armorReduction = 0;
          const result = computeDamage(weaponDef, weaponItem, attackerStats, armorReduction, targetFamily);
          const expected = Math.max(0, result.raw - armorReduction);
          expect(result.final).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 9: final >= 0 always (non-negative) ---

  it('final >= 0 always (non-negative)', () => {
    fc.assert(
      fc.property(
        arbWeaponDef,
        arbWeaponItem,
        arbAttackerStats,
        fc.option(arbTargetFamily, { nil: undefined }),
        function verifyFinalNonNegative(weaponDef, weaponItem, attackerStats, targetFamily) {
          const result = computeDamage(weaponDef, weaponItem, attackerStats, 0, targetFamily);
          expect(result.final).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 10: When weaponDef is null → returns { raw: 0, final: 0, ... } ---

  it('when weaponDef is null, returns raw: 0 and final: 0', () => {
    fc.assert(
      fc.property(
        arbWeaponItem,
        arbAttackerStats,
        fc.option(arbTargetFamily, { nil: undefined }),
        function verifyNullWeaponDef(weaponItem, attackerStats, targetFamily) {
          const result = computeDamage(null, weaponItem, attackerStats, 0, targetFamily);
          expect(result.raw).toBe(0);
          expect(result.final).toBe(0);
          expect(result.baseArme).toBe(0);
          expect(result.modMateriau).toBe(1);
          expect(result.coefStats).toBe(1);
          expect(result.modAffinite).toBe(1);
          expect(result.modTypeDegats).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

});
