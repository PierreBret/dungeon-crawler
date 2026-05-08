import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveReposition } from '../combat.js';

/**
 * Property 10: Repositioning formula (nouvelle logique ±2/±1)
 * 
 * DistCible = 11 - EN
 * SI DistCible + 2 <= DistanceRéelle → distance -= 2
 * SINON SI DistCible - 2 >= DistanceRéelle → distance += 2
 * SINON SI DistCible > DistanceRéelle → distance++
 * SINON SI DistCible < DistanceRéelle → distance--
 * Résultat clampé [1, 10], phaseIncrement = 2
 */
describe('Property 10: Repositioning formula (±2/±1)', () => {

  const arbDistance = fc.integer({ min: 1, max: 10 });
  const arbEN = fc.integer({ min: 1, max: 10 });

  it('formule ±2/±1 correcte', () => {
    fc.assert(
      fc.property(arbDistance, arbEN,
        function verifyFormula(distanceReelle, en) {
          const distCible = 11 - en;
          let expected = distanceReelle;

          if (distCible + 2 <= distanceReelle) {
            expected = distanceReelle - 2;
          } else if (distCible - 2 >= distanceReelle) {
            expected = distanceReelle + 2;
          } else if (distCible > distanceReelle) {
            expected = distanceReelle + 1;
          } else if (distCible < distanceReelle) {
            expected = distanceReelle - 1;
          }
          expected = Math.max(1, Math.min(10, expected));

          const result = resolveReposition(distanceReelle, en);
          expect(result.newDistance).toBe(expected);
        }
      ), { numRuns: 200 }
    );
  });

  it('résultat toujours dans [1, 10]', () => {
    fc.assert(
      fc.property(arbDistance, arbEN,
        function verifyClamped(distanceReelle, en) {
          const result = resolveReposition(distanceReelle, en);
          expect(result.newDistance).toBeGreaterThanOrEqual(1);
          expect(result.newDistance).toBeLessThanOrEqual(10);
        }
      ), { numRuns: 100 }
    );
  });

  it('phaseIncrement toujours 2', () => {
    fc.assert(
      fc.property(arbDistance, arbEN,
        function verifyPhase(distanceReelle, en) {
          const result = resolveReposition(distanceReelle, en);
          expect(result.phaseIncrement).toBe(2);
        }
      ), { numRuns: 100 }
    );
  });

  it('si déjà à distance cible, distance inchangée', () => {
    fc.assert(
      fc.property(arbEN,
        function verifyNoMove(en) {
          const distCible = 11 - en;
          fc.pre(distCible >= 1 && distCible <= 10);
          const result = resolveReposition(distCible, en);
          expect(result.newDistance).toBe(distCible);
        }
      ), { numRuns: 100 }
    );
  });

  it('distance se rapproche de la cible', () => {
    fc.assert(
      fc.property(arbDistance, arbEN,
        function verifyDirection(distanceReelle, en) {
          const distCible = 11 - en;
          const result = resolveReposition(distanceReelle, en);

          if (distanceReelle === distCible) {
            expect(result.newDistance).toBe(distanceReelle);
          } else if (distanceReelle > distCible) {
            expect(result.newDistance).toBeLessThan(distanceReelle);
          } else {
            expect(result.newDistance).toBeGreaterThan(distanceReelle);
          }
        }
      ), { numRuns: 100 }
    );
  });
});
