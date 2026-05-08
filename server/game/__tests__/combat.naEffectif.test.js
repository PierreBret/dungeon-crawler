import { describe, it, expect } from 'vitest';
import { computeNaEffectif } from '../combat.js';

/**
 * Unit tests for computeNaEffectif
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * NA_effectif = Math.min(NA_tactique, Math.floor(Endurance / 2))
 * Si endurance <= 0, NA_effectif = 0
 * Fixé une seule fois en début de minute (pas de recalcul en cours de minute)
 */
describe('computeNaEffectif', () => {

  it('returns 0 when endurance is 0', () => {
    expect(computeNaEffectif(5, 0)).toBe(0);
    expect(computeNaEffectif(10, 0)).toBe(0);
    expect(computeNaEffectif(1, 0)).toBe(0);
  });

  it('returns 0 when endurance is negative', () => {
    expect(computeNaEffectif(5, -1)).toBe(0);
    expect(computeNaEffectif(10, -10)).toBe(0);
  });

  it('returns NA_tactique when endurance is high enough', () => {
    // Math.floor(100 / 2) = 50, which is > 5, so min(5, 50) = 5
    expect(computeNaEffectif(5, 100)).toBe(5);
    // Math.floor(20 / 2) = 10, which is >= 10, so min(10, 10) = 10
    expect(computeNaEffectif(10, 20)).toBe(10);
  });

  it('returns Math.floor(endurance / 2) when it is less than NA_tactique', () => {
    // Math.floor(6 / 2) = 3, which is < 8, so min(8, 3) = 3
    expect(computeNaEffectif(8, 6)).toBe(3);
    // Math.floor(1 / 2) = 0, which is < 5, so min(5, 0) = 0
    expect(computeNaEffectif(5, 1)).toBe(0);
    // Math.floor(9 / 2) = 4, which is < 7, so min(7, 4) = 4
    expect(computeNaEffectif(7, 9)).toBe(4);
  });

  it('handles the boundary where endurance / 2 equals NA_tactique', () => {
    // Math.floor(10 / 2) = 5, min(5, 5) = 5
    expect(computeNaEffectif(5, 10)).toBe(5);
    // Math.floor(14 / 2) = 7, min(7, 7) = 7
    expect(computeNaEffectif(7, 14)).toBe(7);
  });

  it('uses Math.floor for odd endurance values', () => {
    // Math.floor(7 / 2) = 3, min(5, 3) = 3
    expect(computeNaEffectif(5, 7)).toBe(3);
    // Math.floor(11 / 2) = 5, min(10, 5) = 5
    expect(computeNaEffectif(10, 11)).toBe(5);
  });

});
