import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { chooseAction } from '../combat.js';

/**
 * Property 8: Action selection (nouvelle logique)
 * 
 * SI EO >= D10 → intention attaque
 *   SI endurance suffisante → attaque
 *   SINON → tombe dans branche non-attaque
 * SINON (intention non-attaque)
 *   SI distance != distanceSouhaitée ET endurance suffisante → repositionnement
 *   SINON → récupération
 */
describe('Property 8: Action selection', () => {

  const arbEO = fc.integer({ min: 1, max: 10 });
  const arbD10EO = fc.integer({ min: 1, max: 10 });
  const arbEndurance = fc.integer({ min: 0, max: 50 });
  const arbCoutAttaque = fc.integer({ min: 1, max: 20 });
  const arbCoutRepo = fc.integer({ min: 1, max: 10 });
  const arbDistance = fc.integer({ min: 1, max: 10 });
  const arbEN = fc.integer({ min: 1, max: 10 });

  it('si d10EO <= eo et endurance >= coutAttaque → action "attaque"', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbDistance, arbEN,
        function verifyAttaque(eo, d10EO, endurance, coutAttaque, coutRepo, distance, en) {
          fc.pre(d10EO <= eo);
          fc.pre(endurance >= coutAttaque);
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distance, en);
          expect(result.action).toBe("attaque");
          expect(result.fatigueMessage).toBeNull();
        }
      ), { numRuns: 100 }
    );
  });

  it('si d10EO <= eo et endurance < coutAttaque → pas attaque, message fatigue', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbDistance, arbEN,
        function verifyFatigueAttaque(eo, d10EO, endurance, coutAttaque, coutRepo, distance, en) {
          fc.pre(d10EO <= eo);
          fc.pre(endurance < coutAttaque);
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distance, en);
          expect(result.action).not.toBe("attaque");
          expect(result.fatigueMessage).not.toBeNull();
        }
      ), { numRuns: 100 }
    );
  });

  it('si d10EO > eo et distance != distanceSouhaitée et endurance >= coutRepo → repositionnement', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbDistance, arbEN,
        function verifyRepo(eo, d10EO, endurance, coutAttaque, coutRepo, distance, en) {
          fc.pre(d10EO > eo);
          fc.pre(distance !== 11 - en);
          fc.pre(endurance >= coutRepo);
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distance, en);
          expect(result.action).toBe("repositionnement");
        }
      ), { numRuns: 100 }
    );
  });

  it('si d10EO > eo et distance == distanceSouhaitée → récupération', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbEN,
        function verifyRecupAtDistance(eo, d10EO, endurance, coutAttaque, coutRepo, en) {
          fc.pre(d10EO > eo);
          const distanceSouhaitee = 11 - en;
          fc.pre(distanceSouhaitee >= 1 && distanceSouhaitee <= 10);
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distanceSouhaitee, en);
          expect(result.action).toBe("recuperation");
        }
      ), { numRuns: 100 }
    );
  });

  it('si endurance < coutRepo et pas attaque → récupération', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbDistance, arbEN,
        function verifyRecupFatigue(eo, d10EO, endurance, coutAttaque, coutRepo, distance, en) {
          fc.pre(d10EO > eo);
          fc.pre(distance !== 11 - en);
          fc.pre(endurance < coutRepo);
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distance, en);
          expect(result.action).toBe("recuperation");
        }
      ), { numRuns: 100 }
    );
  });

  it('action retournée est toujours une des 3 valeurs valides', () => {
    fc.assert(
      fc.property(arbEO, arbD10EO, arbEndurance, arbCoutAttaque, arbCoutRepo, arbDistance, arbEN,
        function verifyValidAction(eo, d10EO, endurance, coutAttaque, coutRepo, distance, en) {
          const result = chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distance, en);
          expect(["attaque", "repositionnement", "recuperation"]).toContain(result.action);
        }
      ), { numRuns: 100 }
    );
  });
});
