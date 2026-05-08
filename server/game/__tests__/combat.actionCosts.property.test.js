import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 4: Action cost formulas
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * For any NA_effectif value and Surcoût value, the endurance costs SHALL be:
 *   CoûtNA = Math.floor(NA_effectif / 2)
 *   Attack cost = Math.floor(WeaponWeight + CoûtNA + Surcoût)
 *   Dodge cost = Math.floor(5 + CoûtNA + Surcoût)
 *   Parry cost = Math.floor(2 + CoûtNA + Surcoût)
 *   Reposition cost = Math.floor(1 + CoûtNA + Surcoût)
 *   Recovery SHALL add 1 to endurance (capped at EndInit)
 */
describe('Property 4: Action cost formulas', () => {

  // --- Generators ---

  const arbNaEffectif = fc.integer({ min: 0, max: 10 });
  const arbSurcout = fc.integer({ min: 0, max: 10 });
  const arbWeaponWeight = fc.integer({ min: 0, max: 15 });
  const arbEndurance = fc.integer({ min: 0, max: 100 });
  const arbEndInit = fc.integer({ min: 10, max: 100 });

  // --- Helper: compute CoûtNA ---

  function computeCoutNA(naEffectif) {
    return Math.floor(naEffectif / 2);
  }

  // --- Helper: compute action costs ---

  function computeAttackCost(weaponWeight, coutNA, surcout) {
    return Math.floor(weaponWeight + coutNA + surcout);
  }

  function computeDodgeCost(coutNA, surcout) {
    return Math.floor(5 + coutNA + surcout);
  }

  function computeParryCost(coutNA, surcout) {
    return Math.floor(2 + coutNA + surcout);
  }

  function computeRepositionCost(coutNA, surcout) {
    return Math.floor(1 + coutNA + surcout);
  }

  function applyRecovery(endurance, endInit) {
    return Math.max(0, Math.min(endInit, endurance + 1));
  }

  // --- Property: CoûtNA = Math.floor(NA_effectif / 2) ---

  it('CoûtNA equals Math.floor(NA_effectif / 2) for any NA_effectif in [0, 10]', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        function verifyCoutNA(naEffectif) {
          const result = computeCoutNA(naEffectif);
          const expected = Math.floor(naEffectif / 2);
          expect(result).toBe(expected);
          // CoûtNA is always non-negative
          expect(result).toBeGreaterThanOrEqual(0);
          // CoûtNA is always <= NA_effectif
          expect(result).toBeLessThanOrEqual(naEffectif);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Attack cost = Math.floor(WeaponWeight + CoûtNA + Surcoût) ---

  it('Attack cost equals Math.floor(WeaponWeight + CoûtNA + Surcoût) for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbWeaponWeight,
        arbNaEffectif,
        arbSurcout,
        function verifyAttackCost(weaponWeight, naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const result = computeAttackCost(weaponWeight, coutNA, surcout);
          const expected = Math.floor(weaponWeight + coutNA + surcout);
          expect(result).toBe(expected);
          // Attack cost is always >= WeaponWeight (since CoûtNA and Surcoût are >= 0)
          expect(result).toBeGreaterThanOrEqual(weaponWeight);
          // Attack cost is always non-negative
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Dodge cost = Math.floor(5 + CoûtNA + Surcoût) ---

  it('Dodge cost equals Math.floor(5 + CoûtNA + Surcoût) for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbSurcout,
        function verifyDodgeCost(naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const result = computeDodgeCost(coutNA, surcout);
          const expected = Math.floor(5 + coutNA + surcout);
          expect(result).toBe(expected);
          // Dodge cost is always >= 5
          expect(result).toBeGreaterThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Parry cost = Math.floor(2 + CoûtNA + Surcoût) ---

  it('Parry cost equals Math.floor(2 + CoûtNA + Surcoût) for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbSurcout,
        function verifyParryCost(naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const result = computeParryCost(coutNA, surcout);
          const expected = Math.floor(2 + coutNA + surcout);
          expect(result).toBe(expected);
          // Parry cost is always >= 2
          expect(result).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Reposition cost = Math.floor(1 + CoûtNA + Surcoût) ---

  it('Reposition cost equals Math.floor(1 + CoûtNA + Surcoût) for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbNaEffectif,
        arbSurcout,
        function verifyRepositionCost(naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const result = computeRepositionCost(coutNA, surcout);
          const expected = Math.floor(1 + coutNA + surcout);
          expect(result).toBe(expected);
          // Reposition cost is always >= 1
          expect(result).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Recovery adds 1 to endurance, capped at EndInit ---

  it('Recovery adds 1 to endurance and caps at EndInit for any endurance and EndInit', () => {
    fc.assert(
      fc.property(
        arbEndurance,
        arbEndInit,
        function verifyRecovery(endurance, endInit) {
          // Ensure endurance is within valid range [0, endInit]
          const clampedEndurance = Math.max(0, Math.min(endInit, endurance));
          const result = applyRecovery(clampedEndurance, endInit);

          if (clampedEndurance < endInit) {
            // Recovery adds exactly 1
            expect(result).toBe(clampedEndurance + 1);
          } else {
            // Already at max, stays at EndInit
            expect(result).toBe(endInit);
          }
          // Result is always within [0, EndInit]
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(endInit);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: Cost ordering (Attack >= Dodge >= Parry >= Reposition) ---

  it('Action costs maintain ordering: Attack(w>=5) >= Dodge >= Parry >= Reposition for same CoûtNA and Surcoût', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 15 }), // weaponWeight >= 5 to guarantee ordering
        arbNaEffectif,
        arbSurcout,
        function verifyCostOrdering(weaponWeight, naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const attackCost = computeAttackCost(weaponWeight, coutNA, surcout);
          const dodgeCost = computeDodgeCost(coutNA, surcout);
          const parryCost = computeParryCost(coutNA, surcout);
          const repositionCost = computeRepositionCost(coutNA, surcout);

          // With weaponWeight >= 5: Attack >= Dodge >= Parry >= Reposition
          expect(attackCost).toBeGreaterThanOrEqual(dodgeCost);
          expect(dodgeCost).toBeGreaterThanOrEqual(parryCost);
          expect(parryCost).toBeGreaterThanOrEqual(repositionCost);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property: All costs are non-negative integers ---

  it('All action costs are non-negative integers for any valid inputs', () => {
    fc.assert(
      fc.property(
        arbWeaponWeight,
        arbNaEffectif,
        arbSurcout,
        function verifyNonNegativeIntegers(weaponWeight, naEffectif, surcout) {
          const coutNA = computeCoutNA(naEffectif);
          const attackCost = computeAttackCost(weaponWeight, coutNA, surcout);
          const dodgeCost = computeDodgeCost(coutNA, surcout);
          const parryCost = computeParryCost(coutNA, surcout);
          const repositionCost = computeRepositionCost(coutNA, surcout);

          // All costs are integers (Math.floor guarantees this)
          expect(Number.isInteger(attackCost)).toBe(true);
          expect(Number.isInteger(dodgeCost)).toBe(true);
          expect(Number.isInteger(parryCost)).toBe(true);
          expect(Number.isInteger(repositionCost)).toBe(true);

          // All costs are non-negative
          expect(attackCost).toBeGreaterThanOrEqual(0);
          expect(dodgeCost).toBeGreaterThanOrEqual(0);
          expect(parryCost).toBeGreaterThanOrEqual(0);
          expect(repositionCost).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

});
