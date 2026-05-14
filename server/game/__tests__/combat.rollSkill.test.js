import { describe, it, expect } from 'vitest';
import { rollSkill } from '../combat.js';

describe('rollSkill', () => {
  it('calculates quality as effectiveSkill - d100 - fatigue', () => {
    // rng returns 0.49 → d100 = Math.floor(0.49 * 100) + 1 = 50
    const rng = () => 0.49;
    const result = rollSkill(60, 5, rng);
    expect(result.d100).toBe(50);
    expect(result.quality).toBe(60 - 50 - 5); // 5
    expect(result.success).toBe(true);
  });

  it('returns success: true when quality is exactly 0', () => {
    // rng returns 0.49 → d100 = 50
    const rng = () => 0.49;
    const result = rollSkill(50, 0, rng);
    expect(result.d100).toBe(50);
    expect(result.quality).toBe(0);
    expect(result.success).toBe(true);
  });

  it('returns success: false when quality is negative', () => {
    // rng returns 0.89 → d100 = Math.floor(0.89 * 100) + 1 = 90
    const rng = () => 0.89;
    const result = rollSkill(50, 10, rng);
    expect(result.d100).toBe(90);
    expect(result.quality).toBe(50 - 90 - 10); // -50
    expect(result.success).toBe(false);
  });

  it('produces d100 = 1 when rng returns 0', () => {
    const rng = () => 0;
    const result = rollSkill(99, 0, rng);
    expect(result.d100).toBe(1);
    expect(result.quality).toBe(98);
    expect(result.success).toBe(true);
  });

  it('produces d100 = 100 when rng returns 0.99', () => {
    const rng = () => 0.99;
    const result = rollSkill(1, 0, rng);
    expect(result.d100).toBe(100);
    expect(result.quality).toBe(1 - 100 - 0); // -99
    expect(result.success).toBe(false);
  });

  it('applies fatigue correctly for all fatigue values', () => {
    const rng = () => 0.49; // d100 = 50
    for (const fatigue of [0, 5, 10, 15, 20]) {
      const result = rollSkill(80, fatigue, rng);
      expect(result.quality).toBe(80 - 50 - fatigue);
    }
  });
});
