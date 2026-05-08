import { describe, it, expect } from 'vitest';
import { chooseDefense } from '../combat.js';

// Helper: standard defender stats
function makeStats(overrides = {}) {
  return {
    vitesse: 12,
    adresse: 12,
    taille: 12,
    force: 12,
    volonté: 12,
    ...overrides
  };
}

describe('chooseDefense', () => {
  describe('Score calculation', () => {
    it('computes DodgeScore = vitesse*2 + adresse - taille + (5-eo) + (naEffectif-5) + (5-en)', () => {
      const stats = makeStats({ vitesse: 14, adresse: 10, taille: 8 });
      // BaseDodge = 14*2 + 10 - 8 = 30
      // DodgeScore = 30 + (5-5) + (5-5) + (5-5) = 30
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 50);
      expect(result.dodgeScore).toBe(30);
    });

    it('computes ParryScore = adresse + force + volonté + (5-eo) + (5-naEffectif) + (en-5)', () => {
      const stats = makeStats({ adresse: 14, force: 10, volonté: 8 });
      // BaseParry = 14 + 10 + 8 = 32
      // ParryScore = 32 + (5-5) + (5-5) + (5-5) = 32
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 50);
      expect(result.parryScore).toBe(32);
    });

    it('applies tactic modifiers correctly to DodgeScore', () => {
      const stats = makeStats({ vitesse: 14, adresse: 10, taille: 8 });
      // BaseDodge = 30
      // DodgeScore = 30 + (5-3) + (7-5) + (5-8) = 30 + 2 + 2 - 3 = 31
      const result = chooseDefense(stats, 3, 7, 8, 100, 10, 5, 50);
      expect(result.dodgeScore).toBe(31);
    });

    it('applies tactic modifiers correctly to ParryScore', () => {
      const stats = makeStats({ adresse: 14, force: 10, volonté: 8 });
      // BaseParry = 32
      // ParryScore = 32 + (5-3) + (5-7) + (8-5) = 32 + 2 - 2 + 3 = 35
      const result = chooseDefense(stats, 3, 7, 8, 100, 10, 5, 50);
      expect(result.parryScore).toBe(35);
    });

    it('supports volonte (without accent) as fallback', () => {
      const stats = { vitesse: 12, adresse: 12, taille: 12, force: 12, volonte: 10 };
      // BaseParry = 12 + 12 + 10 = 34
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 50);
      expect(result.parryScore).toBe(34);
    });
  });

  describe('Defense selection', () => {
    it('chooses esquive when DodgeScore > ParryScore', () => {
      // High vitesse, low force → dodge wins
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      // BaseDodge = 20*2 + 15 - 5 = 50
      // BaseParry = 15 + 3 + 3 = 21
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 1);
      expect(result.defenseType).toBe("esquive");
    });

    it('chooses parade when ParryScore > DodgeScore', () => {
      // High force/volonté, low vitesse → parry wins
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      // BaseDodge = 5*2 + 12 - 15 = 7
      // BaseParry = 12 + 20 + 20 = 52
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 1);
      expect(result.defenseType).toBe("parade");
    });

    it('chooses parade on tie (parade priority)', () => {
      // Craft stats so DodgeScore == ParryScore
      // BaseDodge = vitesse*2 + adresse - taille
      // BaseParry = adresse + force + volonté
      // With eo=5, naEffectif=5, en=5 → mods are 0
      // Need: vitesse*2 + adresse - taille = adresse + force + volonté
      // → vitesse*2 - taille = force + volonté
      // vitesse=10, taille=8 → 20-8=12; force=6, volonté=6 → 12. Equal!
      const stats = makeStats({ vitesse: 10, adresse: 12, taille: 8, force: 6, volonté: 6 });
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 1);
      expect(result.dodgeScore).toBe(result.parryScore);
      expect(result.defenseType).toBe("parade");
    });
  });

  describe('Degradation', () => {
    it('degrades esquive to parade when endurance < coutEsquive', () => {
      // Force esquive preference with high vitesse
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      const result = chooseDefense(stats, 5, 5, 5, 4, 10, 3, 1);
      // endurance=4 < coutEsquive=10, but endurance=4 >= coutParade=3
      expect(result.defenseType).toBe("parade");
      expect(result.degraded).toBe(true);
    });

    it('degrades parade to encaisse when endurance < coutParade', () => {
      // Force parade preference
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      const result = chooseDefense(stats, 5, 5, 5, 1, 10, 5, 1);
      // endurance=1 < coutParade=5
      expect(result.defenseType).toBe("encaisse");
      expect(result.degraded).toBe(true);
    });

    it('degrades esquive → parade → encaisse when endurance insufficient for both', () => {
      // Force esquive preference
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      const result = chooseDefense(stats, 5, 5, 5, 0, 10, 5, 1);
      // endurance=0 < coutEsquive=10 AND < coutParade=5
      expect(result.defenseType).toBe("encaisse");
      expect(result.degraded).toBe(true);
    });

    it('does not degrade when endurance is sufficient', () => {
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      const result = chooseDefense(stats, 5, 5, 5, 50, 10, 5, 1);
      expect(result.defenseType).toBe("esquive");
      expect(result.degraded).toBe(false);
    });
  });

  describe('Resolution', () => {
    it('esquive succeeds when DodgeScore - d100 >= 0', () => {
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      // DodgeScore = 20*2 + 15 - 5 + 0 + 0 + 0 = 50
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 50);
      expect(result.defenseType).toBe("esquive");
      expect(result.success).toBe(true);
      expect(result.defenseQuality).toBe(0); // 50 - 50 = 0
    });

    it('esquive fails when DodgeScore - d100 < 0', () => {
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      // DodgeScore = 50
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 51);
      expect(result.defenseType).toBe("esquive");
      expect(result.success).toBe(false);
      expect(result.defenseQuality).toBe(-1); // 50 - 51 = -1
    });

    it('parade succeeds when ParryScore - d100 >= 0', () => {
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      // ParryScore = 12 + 20 + 20 + 0 + 0 + 0 = 52
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 52);
      expect(result.defenseType).toBe("parade");
      expect(result.success).toBe(true);
      expect(result.defenseQuality).toBe(0); // 52 - 52 = 0
    });

    it('parade fails when ParryScore - d100 < 0', () => {
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      // ParryScore = 52
      const result = chooseDefense(stats, 5, 5, 5, 100, 10, 5, 53);
      expect(result.defenseType).toBe("parade");
      expect(result.success).toBe(false);
      expect(result.defenseQuality).toBe(-1); // 52 - 53 = -1
    });

    it('encaisse always fails with defenseQuality 0', () => {
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      const result = chooseDefense(stats, 5, 5, 5, 0, 10, 5, 1);
      expect(result.defenseType).toBe("encaisse");
      expect(result.success).toBe(false);
      expect(result.defenseQuality).toBe(0);
    });
  });

  describe('Phase increment and endurance cost', () => {
    it('esquive: phaseIncrement = 2, enduranceCost = coutEsquive', () => {
      const stats = makeStats({ vitesse: 20, adresse: 15, taille: 5, force: 3, volonté: 3 });
      const result = chooseDefense(stats, 5, 5, 5, 100, 8, 4, 1);
      expect(result.defenseType).toBe("esquive");
      expect(result.phaseIncrement).toBe(2);
      expect(result.enduranceCost).toBe(8);
    });

    it('parade: phaseIncrement = 1, enduranceCost = coutParade', () => {
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      const result = chooseDefense(stats, 5, 5, 5, 100, 8, 4, 1);
      expect(result.defenseType).toBe("parade");
      expect(result.phaseIncrement).toBe(1);
      expect(result.enduranceCost).toBe(4);
    });

    it('encaisse: phaseIncrement = 0, enduranceCost = 0', () => {
      const stats = makeStats({ vitesse: 5, adresse: 12, taille: 15, force: 20, volonté: 20 });
      const result = chooseDefense(stats, 5, 5, 5, 0, 10, 5, 1);
      expect(result.defenseType).toBe("encaisse");
      expect(result.phaseIncrement).toBe(0);
      expect(result.enduranceCost).toBe(0);
    });
  });
});
