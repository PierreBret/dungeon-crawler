import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeCharge, computePortage, computeSurcoutEndurance } from '../combat.js';

/**
 * Property 3: Load and encumbrance calculation
 * Validates: Requirements 2.1, 2.2, 2.3
 *
 * For any combatant with weapon weight w, shield/left-hand weight s,
 * armor weight a (currently 0), force f, and taille t:
 *   Charge = Math.floor(w + s + Math.floor(a / 4))
 *   Portage = Math.floor(f + Math.floor(t / 2))
 *   Surcoût = Math.floor(Math.max(0, Charge - Portage) × 10 / 26)
 *   When Charge <= Portage, Surcoût SHALL be 0
 */
describe('Property 3: Load and encumbrance calculation', () => {

  // --- Generators ---

  const arbWeaponWeight = fc.integer({ min: 0, max: 30 });
  const arbShieldWeight = fc.integer({ min: 0, max: 20 });
  const arbStat = fc.integer({ min: 3, max: 21 });

  const arbWeaponDef = arbWeaponWeight.map(function toWeaponDef(w) {
    return { weight: w, dist: 3 };
  });

  const arbWeaponDefMissingWeight = fc.constant({ dist: 3 });

  const arbEquipmentWithShield = arbShieldWeight.map(function toEquipment(s) {
    return { leftHand: { weight: s } };
  });

  const arbStats = fc.record({
    force: arbStat,
    taille: arbStat,
  });

  // --- Property: computeCharge formula ---

  it('computeCharge equals Math.floor(w + s + Math.floor(0 / 4)) for any weapon and shield weights', () => {
    fc.assert(
      fc.property(
        arbWeaponWeight,
        arbShieldWeight,
        function verifyChargeFormula(w, s) {
          const weaponDef = { weight: w, dist: 3 };
          const equipment = { leftHand: { weight: s } };
          const expected = Math.floor(w + s + Math.floor(0 / 4));
          expect(computeCharge(weaponDef, equipment)).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: computeCharge defaults weapon weight to 0 when absent ---

  it('computeCharge uses WeaponWeight = 0 when weight field is absent', () => {
    fc.assert(
      fc.property(
        arbShieldWeight,
        function verifyDefaultWeaponWeight(s) {
          const weaponDef = { dist: 3 }; // no weight field
          const equipment = { leftHand: { weight: s } };
          const expected = Math.floor(0 + s + Math.floor(0 / 4));
          expect(computeCharge(weaponDef, equipment)).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: computeCharge with null equipment ---

  it('computeCharge treats null equipment as shield weight 0', () => {
    fc.assert(
      fc.property(
        arbWeaponWeight,
        function verifyNullEquipment(w) {
          const weaponDef = { weight: w, dist: 3 };
          const expected = Math.floor(w + 0 + Math.floor(0 / 4));
          expect(computeCharge(weaponDef, null)).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: computePortage formula ---

  it('computePortage equals Math.floor(force + Math.floor(taille / 2)) for any stats', () => {
    fc.assert(
      fc.property(
        arbStats,
        function verifyPortageFormula(stats) {
          const expected = Math.floor(stats.force + Math.floor(stats.taille / 2));
          expect(computePortage(stats)).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: computeSurcoutEndurance formula ---

  it('computeSurcoutEndurance equals Math.floor(Math.max(0, charge - portage) * 10 / 26) for any charge and portage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        function verifySurcoutFormula(charge, portage) {
          const expected = Math.floor(Math.max(0, charge - portage) * 10 / 26);
          expect(computeSurcoutEndurance(charge, portage)).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Surcoût is 0 when Charge <= Portage ---

  it('computeSurcoutEndurance returns 0 when charge <= portage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        function verifySurcoutZeroWhenNotOverloaded(portage, extraCapacity) {
          const charge = portage - extraCapacity; // charge <= portage
          if (charge < 0) return; // skip negative charge (not meaningful)
          expect(computeSurcoutEndurance(charge, portage)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: End-to-end charge/portage/surcoût integration ---

  it('end-to-end: Surcoût is 0 when computeCharge result <= computePortage result', () => {
    fc.assert(
      fc.property(
        arbWeaponWeight,
        arbShieldWeight,
        arbStats,
        function verifyEndToEndSurcout(w, s, stats) {
          const charge = computeCharge({ weight: w, dist: 3 }, { leftHand: { weight: s } });
          const portage = computePortage(stats);
          const surcout = computeSurcoutEndurance(charge, portage);

          if (charge <= portage) {
            expect(surcout).toBe(0);
          } else {
            const expected = Math.floor((charge - portage) * 10 / 26);
            expect(surcout).toBe(expected);
            expect(surcout).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

});
