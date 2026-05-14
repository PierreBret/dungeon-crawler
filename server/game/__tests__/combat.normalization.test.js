import { describe, it, expect } from 'vitest';
import { normalizeToPercent } from '../combat.js';
import { COMBAT } from '../combatConfig.js';

describe('normalizeToPercent', () => {
  it('applies the formula floor(skill × multiplier / divisor)', () => {
    // 200 × 50 / 400 = 25
    expect(normalizeToPercent(200, 50, 400, COMBAT)).toBe(25);
  });

  it('uses Math.floor (no decimals)', () => {
    // 100 × 50 / 396 = 12.626262... → floor = 12 → clamped to percentMin (12)
    expect(normalizeToPercent(100, 50, 396, COMBAT)).toBe(12);
  });

  it('clamps to percentMin (12) when result is below', () => {
    // 1 × 50 / 396 = 0.1262... → floor = 0 → clamped to 12
    expect(normalizeToPercent(1, 50, 396, COMBAT)).toBe(12);
  });

  it('clamps to percentMax (87) when result is above', () => {
    // 792 × 50 / 396 = 100 → floor = 100 → clamped to 87
    expect(normalizeToPercent(792, 50, 396, COMBAT)).toBe(87);
  });

  it('returns percentMin for very small rawSkill', () => {
    expect(normalizeToPercent(0, 50, 396, COMBAT)).toBe(12);
  });

  it('uses config.percentMin and config.percentMax for clamping', () => {
    const customConfig = { percentMin: 20, percentMax: 80 };
    // 100 × 50 / 100 = 50 → within [20, 80]
    expect(normalizeToPercent(100, 50, 100, customConfig)).toBe(50);
    // 10 × 50 / 100 = 5 → clamped to 20
    expect(normalizeToPercent(10, 50, 100, customConfig)).toBe(20);
    // 200 × 50 / 100 = 100 → clamped to 80
    expect(normalizeToPercent(200, 50, 100, customConfig)).toBe(80);
  });

  it('handles vivacite divisor (396)', () => {
    // Mid-range: 396 × 50 / 396 = 50
    expect(normalizeToPercent(396, 50, 396, COMBAT)).toBe(50);
  });

  it('handles initiative divisor (228)', () => {
    // Mid-range: 228 × 50 / 228 = 50
    expect(normalizeToPercent(228, 50, 228, COMBAT)).toBe(50);
  });

  it('handles attaque divisor (384)', () => {
    // Mid-range: 384 × 50 / 384 = 50
    expect(normalizeToPercent(384, 50, 384, COMBAT)).toBe(50);
  });

  it('handles esquive divisor (444)', () => {
    // Mid-range: 444 × 50 / 444 = 50
    expect(normalizeToPercent(444, 50, 444, COMBAT)).toBe(50);
  });

  it('handles parade divisor (336)', () => {
    // Mid-range: 336 × 50 / 336 = 50
    expect(normalizeToPercent(336, 50, 336, COMBAT)).toBe(50);
  });

  it('handles riposte divisor (312)', () => {
    // Mid-range: 312 × 50 / 312 = 50
    expect(normalizeToPercent(312, 50, 312, COMBAT)).toBe(50);
  });

  it('is monotone: higher rawSkill produces higher or equal percent', () => {
    const a = normalizeToPercent(100, 50, 396, COMBAT);
    const b = normalizeToPercent(200, 50, 396, COMBAT);
    const c = normalizeToPercent(300, 50, 396, COMBAT);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(c).toBeGreaterThanOrEqual(b);
  });

  it('allows different multipliers per skill', () => {
    // With multiplier 75 instead of 50: 200 × 75 / 396 = 37.87 → floor = 37
    expect(normalizeToPercent(200, 75, 396, COMBAT)).toBe(37);
    // With multiplier 30: 200 × 30 / 396 = 15.15 → floor = 15
    expect(normalizeToPercent(200, 30, 396, COMBAT)).toBe(15);
  });
});
