import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveRiposte, resolveAttack } from '../combat.js';

/**
 * Property 12: Riposte resolution
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 11.10, 11.11
 *
 * For any DEF when ATT has missed:
 * - BaseRiposte = Math.floor((intelligence + adresse × 0.5 + vitesse × 0.5) / 2)
 * - RiposteScore = BaseRiposte + (naEffectif - 5) - distanceReelle
 * - RiposteQuality = RiposteScore - d100Riposte
 * - If RiposteQuality >= 0 AND endurance >= coutAttaque → riposteAuthorized = true
 * - If RiposteQuality < 0 → riposteAuthorized = false
 * - If RiposteQuality >= 0 AND endurance < coutAttaque → riposteAuthorized = false (cancelled)
 * - DistanceRiposte = Math.max(1, distanceReelle - 2) (when authorized)
 * - Riposte attack uses standard attack formula at DistanceRiposte
 * - phaseIncrement = weaponDef.weight ?? 0 (when authorized), 0 otherwise
 * - riposteAttempted is always true
 */
describe('Property 12: Riposte resolution', () => {

  // --- Generators ---

  const arbDefenderStats = fc.record({
    intelligence: fc.integer({ min: 3, max: 21 }),
    adresse: fc.integer({ min: 3, max: 21 }),
    vitesse: fc.integer({ min: 3, max: 21 })
  });

  const arbNaEffectif = fc.integer({ min: 0, max: 10 });
  const arbDistanceReelle = fc.integer({ min: 1, max: 10 });
  const arbEndurance = fc.integer({ min: 0, max: 50 });
  const arbCoutAttaque = fc.integer({ min: 1, max: 20 });
  const arbWeaponDef = fc.record({
    dist: fc.integer({ min: 1, max: 10 }),
    weight: fc.integer({ min: 1, max: 15 })
  });
  const arbD100 = fc.integer({ min: 1, max: 100 });

  // --- Property 1: BaseRiposte formula ---

  it('BaseRiposte = Math.floor((intelligence + adresse × 0.5 + vitesse × 0.5) / 2)', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyBaseRiposteFormula(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          const expected = Math.floor((stats.intelligence + stats.adresse * 0.5 + stats.vitesse * 0.5) / 2);
          expect(result.baseRiposte).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 2: RiposteScore formula ---

  it('RiposteScore = BaseRiposte + (naEffectif - 5) - distanceReelle', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteScoreFormula(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          const expectedBase = Math.floor((stats.intelligence + stats.adresse * 0.5 + stats.vitesse * 0.5) / 2);
          const expectedScore = expectedBase + (naEffectif - 5) - distance;
          expect(result.riposteScore).toBe(expectedScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 3: RiposteQuality formula ---

  it('RiposteQuality = RiposteScore - d100Riposte', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteQualityFormula(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          expect(result.riposteQuality).toBe(result.riposteScore - d100Riposte);
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 4: Riposte authorized when quality >= 0 AND endurance >= coutAttaque ---

  it('riposteAuthorized = true when RiposteQuality >= 0 AND endurance >= coutAttaque', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteAuthorizedWhenQualityAndEndurance(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteQuality >= 0 && endurance >= coutAttaque) {
            expect(result.riposteAuthorized).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 5: Riposte NOT authorized when quality < 0 ---

  it('riposteAuthorized = false when RiposteQuality < 0', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteNotAuthorizedWhenQualityNegative(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteQuality < 0) {
            expect(result.riposteAuthorized).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 6: Riposte cancelled when quality >= 0 but endurance < coutAttaque ---

  it('riposteAuthorized = false when RiposteQuality >= 0 AND endurance < coutAttaque', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteCancelledWhenInsufficientEndurance(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteQuality >= 0 && endurance < coutAttaque) {
            expect(result.riposteAuthorized).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 7: DistanceRiposte = Math.max(1, distanceReelle - 2) when authorized ---

  it('DistanceRiposte = Math.max(1, distanceReelle - 2) when riposte is authorized', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyDistanceRiposteFormula(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteAuthorized) {
            const expected = Math.max(1, distance - 2);
            expect(result.distanceRiposte).toBe(expected);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 8: Riposte attack uses standard attack formula at DistanceRiposte ---

  it('riposte attack uses standard attack formula at DistanceRiposte', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteAttackUsesStandardFormula(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteAuthorized) {
            const distanceRiposte = Math.max(1, distance - 2);
            const expectedAttack = resolveAttack(stats, weaponDef, distanceRiposte, d100Attack);
            expect(result.attackResult.baseAttack).toBe(expectedAttack.baseAttack);
            expect(result.attackResult.modEN).toBe(expectedAttack.modEN);
            expect(result.attackResult.attackScore).toBe(expectedAttack.attackScore);
            expect(result.attackResult.attackQuality).toBe(expectedAttack.attackQuality);
            expect(result.attackResult.hit).toBe(expectedAttack.hit);
            expect(result.riposteHit).toBe(expectedAttack.hit);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 9: phaseIncrement = weaponDef.weight ?? 0 when authorized, 0 otherwise ---

  it('phaseIncrement = weaponDef.weight ?? 0 when authorized, 0 otherwise', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyPhaseIncrement(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          if (result.riposteAuthorized) {
            expect(result.phaseIncrement).toBe(weaponDef.weight ?? 0);
          } else {
            expect(result.phaseIncrement).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Property 10: riposteAttempted is always true ---

  it('riposteAttempted is always true', () => {
    fc.assert(
      fc.property(
        arbDefenderStats,
        arbNaEffectif,
        arbDistanceReelle,
        arbEndurance,
        arbCoutAttaque,
        arbWeaponDef,
        arbD100,
        arbD100,
        function verifyRiposteAlwaysAttempted(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
          const result = resolveRiposte(stats, naEffectif, distance, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack);
          expect(result.riposteAttempted).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

});
