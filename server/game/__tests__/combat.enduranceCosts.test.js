import { describe, it, expect } from 'vitest';
import { computeAttackCost, computeDefenseCost } from '../combat.js';

/**
 * Unit tests for endurance cost functions.
 * Validates: Requirements 6.4, 6.5, 6.6
 */
describe('Endurance cost functions', () => {

  describe('computeAttackCost', () => {
    it('returns weaponWeight + na + surcout', () => {
      expect(computeAttackCost(5, 3, 2)).toBe(10);
    });

    it('handles minimum values (1, 1, 0)', () => {
      expect(computeAttackCost(1, 1, 0)).toBe(2);
    });

    it('handles maximum values (14, 10, 10)', () => {
      expect(computeAttackCost(14, 10, 10)).toBe(34);
    });

    it('handles zero surcout', () => {
      expect(computeAttackCost(8, 5, 0)).toBe(13);
    });
  });

  describe('computeDefenseCost', () => {
    it('returns na + surcout for esquive', () => {
      expect(computeDefenseCost(5, 3)).toBe(8);
    });

    it('returns na + surcout for parade (same formula)', () => {
      expect(computeDefenseCost(7, 2)).toBe(9);
    });

    it('handles minimum values (1, 0)', () => {
      expect(computeDefenseCost(1, 0)).toBe(1);
    });

    it('handles maximum values (10, 10)', () => {
      expect(computeDefenseCost(10, 10)).toBe(20);
    });
  });
});
