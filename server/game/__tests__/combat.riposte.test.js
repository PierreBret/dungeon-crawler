import { describe, it, expect } from 'vitest';
import { resolveRiposte } from '../combat.js';

/**
 * Unit tests for resolveRiposte
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11
 */
describe('resolveRiposte', () => {

  const baseStats = { intelligence: 14, adresse: 12, vitesse: 10 };
  const weaponDef = { dist: 3, weight: 4 };

  describe('BaseRiposte calculation (Req 11.1)', () => {
    it('calculates BaseRiposte = Math.floor((intelligence + adresse*0.5 + vitesse*0.5) / 2)', () => {
      // BaseRiposte = Math.floor((14 + 12*0.5 + 10*0.5) / 2) = Math.floor((14 + 6 + 5) / 2) = Math.floor(25/2) = 12
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 1, 1);
      expect(result.baseRiposte).toBe(12);
    });

    it('uses Math.floor for non-integer results', () => {
      const stats = { intelligence: 15, adresse: 11, vitesse: 9 };
      // BaseRiposte = Math.floor((15 + 11*0.5 + 9*0.5) / 2) = Math.floor((15 + 5.5 + 4.5) / 2) = Math.floor(25/2) = 12
      const result = resolveRiposte(stats, 5, 3, 20, 5, weaponDef, 1, 1);
      expect(result.baseRiposte).toBe(12);
    });
  });

  describe('RiposteScore calculation (Req 11.2)', () => {
    it('calculates RiposteScore = BaseRiposte + (naEffectif - 5) - distanceReelle', () => {
      // BaseRiposte = 12, naEffectif = 7, distanceReelle = 3
      // RiposteScore = 12 + (7 - 5) - 3 = 12 + 2 - 3 = 11
      const result = resolveRiposte(baseStats, 7, 3, 20, 5, weaponDef, 1, 1);
      expect(result.riposteScore).toBe(11);
    });

    it('handles naEffectif < 5 (negative modifier)', () => {
      // BaseRiposte = 12, naEffectif = 3, distanceReelle = 5
      // RiposteScore = 12 + (3 - 5) - 5 = 12 - 2 - 5 = 5
      const result = resolveRiposte(baseStats, 3, 5, 20, 5, weaponDef, 1, 1);
      expect(result.riposteScore).toBe(5);
    });
  });

  describe('RiposteQuality calculation (Req 11.3)', () => {
    it('calculates RiposteQuality = RiposteScore - d100Riposte', () => {
      // RiposteScore = 12 + (5 - 5) - 3 = 9, d100Riposte = 5
      // RiposteQuality = 9 - 5 = 4
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 5, 1);
      expect(result.riposteQuality).toBe(4);
    });

    it('can produce negative RiposteQuality', () => {
      // RiposteScore = 12 + (5 - 5) - 3 = 9, d100Riposte = 50
      // RiposteQuality = 9 - 50 = -41
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 50, 1);
      expect(result.riposteQuality).toBe(-41);
    });
  });

  describe('Riposte authorization (Req 11.4)', () => {
    it('authorizes riposte when RiposteQuality >= 0', () => {
      // RiposteScore = 12 + (5 - 5) - 3 = 9, d100Riposte = 9 → quality = 0
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 9, 1);
      expect(result.riposteQuality).toBe(0);
      expect(result.riposteAuthorized).toBe(true);
    });

    it('denies riposte when RiposteQuality < 0', () => {
      // RiposteScore = 9, d100Riposte = 10 → quality = -1
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 10, 1);
      expect(result.riposteQuality).toBe(-1);
      expect(result.riposteAuthorized).toBe(false);
      expect(result.riposteHit).toBe(false);
    });
  });

  describe('Endurance check (Req 11.5)', () => {
    it('cancels riposte when endurance < coutAttaque even if RiposteQuality >= 0', () => {
      // RiposteScore = 9, d100Riposte = 1 → quality = 8 (>= 0)
      // But endurance = 4 < coutAttaque = 5
      const result = resolveRiposte(baseStats, 5, 3, 4, 5, weaponDef, 1, 1);
      expect(result.riposteQuality).toBeGreaterThanOrEqual(0);
      expect(result.riposteAuthorized).toBe(false);
      expect(result.riposteHit).toBe(false);
      expect(result.enduranceCost).toBe(0);
    });

    it('allows riposte when endurance >= coutAttaque', () => {
      // endurance = 5 >= coutAttaque = 5
      const result = resolveRiposte(baseStats, 5, 3, 5, 5, weaponDef, 1, 1);
      expect(result.riposteAuthorized).toBe(true);
      expect(result.enduranceCost).toBe(5);
    });
  });

  describe('Phase increment (Req 11.6)', () => {
    it('increments phase by weaponDef.weight when riposte is authorized', () => {
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 1, 1);
      expect(result.phaseIncrement).toBe(4); // weaponDef.weight = 4
    });

    it('uses 0 when weaponDef.weight is undefined', () => {
      const weaponNoWeight = { dist: 3 };
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponNoWeight, 1, 1);
      expect(result.phaseIncrement).toBe(0);
    });

    it('returns phaseIncrement = 0 when riposte is not authorized', () => {
      const result = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 100, 1);
      expect(result.phaseIncrement).toBe(0);
    });
  });

  describe('DistanceRiposte calculation (Req 11.7)', () => {
    it('calculates DistanceRiposte = Math.max(1, distanceReelle - 2)', () => {
      const result = resolveRiposte(baseStats, 5, 5, 20, 5, weaponDef, 1, 1);
      expect(result.distanceRiposte).toBe(3); // 5 - 2 = 3
    });

    it('clamps DistanceRiposte to minimum 1', () => {
      const result = resolveRiposte(baseStats, 5, 1, 20, 5, weaponDef, 1, 1);
      expect(result.distanceRiposte).toBe(1); // Math.max(1, 1 - 2) = 1
    });

    it('clamps DistanceRiposte to minimum 1 when distanceReelle = 2', () => {
      const result = resolveRiposte(baseStats, 5, 2, 20, 5, weaponDef, 1, 1);
      expect(result.distanceRiposte).toBe(1); // Math.max(1, 2 - 2) = 1
    });
  });

  describe('Riposte attack resolution (Req 11.8, 11.9, 11.10)', () => {
    it('resolves attack using standard formula at DistanceRiposte', () => {
      // distanceReelle = 5, DistanceRiposte = 3, weaponDef.dist = 3
      // BaseAttack = Math.floor((12*0.5 + 10*0.3 + 14*0.2) * 4) = Math.floor((6+3+2.8)*4) = Math.floor(47.2) = 47
      // modEN = Math.floor(|3 - 3| * 2) = 0
      // AttackScore = 47 - 0 = 47
      // d100Attack = 10 → AttackQuality = 47 - 10 = 37 >= 0 → hit
      const result = resolveRiposte(baseStats, 5, 5, 20, 5, weaponDef, 1, 10);
      expect(result.riposteAuthorized).toBe(true);
      expect(result.attackResult).not.toBeNull();
      expect(result.attackResult.baseAttack).toBe(47);
      expect(result.attackResult.modEN).toBe(0);
      expect(result.attackResult.hit).toBe(true);
      expect(result.riposteHit).toBe(true);
    });

    it('riposte attack can miss', () => {
      // d100Attack = 100 → AttackQuality = 47 - 100 = -53 < 0 → miss
      const result = resolveRiposte(baseStats, 5, 5, 20, 5, weaponDef, 1, 100);
      expect(result.riposteAuthorized).toBe(true);
      expect(result.riposteHit).toBe(false);
      expect(result.attackResult.hit).toBe(false);
    });

    it('applies modEN based on DistanceRiposte vs WeaponDist', () => {
      // distanceReelle = 10, DistanceRiposte = 8, weaponDef.dist = 3
      // modEN = Math.floor(|8 - 3| * 2) = 10
      const result = resolveRiposte(baseStats, 5, 10, 20, 5, weaponDef, 1, 1);
      expect(result.distanceRiposte).toBe(8);
      expect(result.attackResult.modEN).toBe(10);
    });
  });

  describe('riposteAttempted flag', () => {
    it('is always true (riposte is always attempted when ATT misses)', () => {
      const result1 = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 1, 1);
      const result2 = resolveRiposte(baseStats, 5, 3, 20, 5, weaponDef, 100, 1);
      expect(result1.riposteAttempted).toBe(true);
      expect(result2.riposteAttempted).toBe(true);
    });
  });

  describe('Return structure completeness', () => {
    it('returns all expected fields when riposte succeeds', () => {
      const result = resolveRiposte(baseStats, 5, 5, 20, 5, weaponDef, 1, 10);
      expect(result).toHaveProperty('riposteAttempted');
      expect(result).toHaveProperty('riposteAuthorized');
      expect(result).toHaveProperty('riposteHit');
      expect(result).toHaveProperty('riposteScore');
      expect(result).toHaveProperty('riposteQuality');
      expect(result).toHaveProperty('baseRiposte');
      expect(result).toHaveProperty('distanceRiposte');
      expect(result).toHaveProperty('attackResult');
      expect(result).toHaveProperty('phaseIncrement');
      expect(result).toHaveProperty('enduranceCost');
    });

    it('returns all expected fields when riposte fails', () => {
      const result = resolveRiposte(baseStats, 5, 5, 20, 5, weaponDef, 100, 1);
      expect(result).toHaveProperty('riposteAttempted');
      expect(result).toHaveProperty('riposteAuthorized');
      expect(result).toHaveProperty('riposteHit');
      expect(result).toHaveProperty('riposteScore');
      expect(result).toHaveProperty('riposteQuality');
      expect(result).toHaveProperty('baseRiposte');
      expect(result).toHaveProperty('distanceRiposte');
      expect(result).toHaveProperty('attackResult');
      expect(result).toHaveProperty('phaseIncrement');
      expect(result).toHaveProperty('enduranceCost');
      expect(result.attackResult).toBeNull();
    });
  });
});
