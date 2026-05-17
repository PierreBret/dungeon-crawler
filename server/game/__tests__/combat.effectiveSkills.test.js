import { describe, it, expect } from 'vitest';
import { computeEffectiveSkills } from '../combat.js';
import { COMBAT } from '../variables.js';

describe('computeEffectiveSkills', () => {
  const neutralPercentages = {
    vivacite: 50,
    initiative: 50,
    attaque: 50,
    esquive: 50,
    parade: 50,
    riposte: 50
  };

  it('returns unchanged percentages for non-distance skills when all tactics are neutral (EO=NA=EN=5)', () => {
    const tactics = { EO: 5, NA: 5, EN: 5 };
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);

    // Non-distance skills have zero adjustment at neutral
    expect(result.vivacite).toBe(50);
    expect(result.initiative).toBe(50);
    expect(result.esquive).toBe(50);
    expect(result.parade).toBe(50);
    expect(result.riposte).toBe(50);

    // Attaque has distance factor: (5 - |5-5|)*2 = 10 bonus at optimal distance
    expect(result.attaque).toBe(60);
  });

  it('applies vivacite formula: (EO-5)*2 + (NA-5)', () => {
    const tactics = { EO: 8, NA: 7, EN: 5 };
    // vivacite_eff = 50 + (8-5)*2 + (7-5) = 50 + 6 + 2 = 58
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    expect(result.vivacite).toBe(58);
  });

  it('applies initiative formula: (EO-5) + (NA-5) + (EN-5)', () => {
    const tactics = { EO: 8, NA: 7, EN: 9 };
    // initiative_eff = 50 + (8-5) + (7-5) + (9-5) = 50 + 3 + 2 + 4 = 59
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    expect(result.initiative).toBe(59);
  });

  it('applies attaque formula: (EO-5) + (5-|weaponDist-distance|)*2', () => {
    const tactics = { EO: 8, NA: 5, EN: 5 };
    // attaque_eff = 50 + (8-5) + (5-|3-7|)*2 = 50 + 3 + (5-4)*2 = 50 + 3 + 2 = 55
    const result = computeEffectiveSkills(neutralPercentages, tactics, 7, 3, COMBAT);
    expect(result.attaque).toBe(55);
  });

  it('applies esquive formula: (5-EO) + (NA-5) + (5-EN)', () => {
    const tactics = { EO: 3, NA: 8, EN: 2 };
    // esquive_eff = 50 + (5-3) + (8-5) + (5-2) = 50 + 2 + 3 + 3 = 58
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    expect(result.esquive).toBe(58);
  });

  it('applies parade formula: (5-EO) + (5-NA) + (5-EN)', () => {
    const tactics = { EO: 2, NA: 3, EN: 1 };
    // parade_eff = 50 + (5-2) + (5-3) + (5-1) = 50 + 3 + 2 + 4 = 59
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    expect(result.parade).toBe(59);
  });

  it('applies riposte formula: (5-EO) + (5-NA) + (EN-5)*2', () => {
    const tactics = { EO: 2, NA: 3, EN: 9 };
    // riposte_eff = 50 + (5-2) + (5-3) + (9-5)*2 = 50 + 3 + 2 + 8 = 63
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    expect(result.riposte).toBe(63);
  });

  it('clamps results to minimum 1', () => {
    const lowPercentages = {
      vivacite: 12.5,
      initiative: 12.5,
      attaque: 12.5,
      esquive: 12.5,
      parade: 12.5,
      riposte: 12.5
    };
    // With extreme offensive tactics, defensive skills should be clamped to 1
    const tactics = { EO: 10, NA: 10, EN: 10 };
    const result = computeEffectiveSkills(lowPercentages, tactics, 5, 5, COMBAT);

    // parade_eff = 12.5 + (5-10) + (5-10) + (5-10) = 12.5 - 15 = -2.5 → clamped to 1
    expect(result.parade).toBe(1);
  });

  it('clamps results to maximum 99', () => {
    const highPercentages = {
      vivacite: 87.5,
      initiative: 87.5,
      attaque: 87.5,
      esquive: 87.5,
      parade: 87.5,
      riposte: 87.5
    };
    // With extreme offensive tactics, offensive skills could exceed 99
    const tactics = { EO: 10, NA: 10, EN: 10 };
    const result = computeEffectiveSkills(highPercentages, tactics, 5, 5, COMBAT);

    // vivacite_eff = 87.5 + (10-5)*2 + (10-5) = 87.5 + 10 + 5 = 102.5 → clamped to 99
    expect(result.vivacite).toBe(99);
  });

  it('attaque bonus is maximized when distance equals weaponDist', () => {
    const tactics = { EO: 5, NA: 5, EN: 5 };
    // When distance == weaponDist: (5 - |0|) * 2 = 10
    const atDist = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, COMBAT);
    // When distance != weaponDist by 3: (5 - 3) * 2 = 4
    const farDist = computeEffectiveSkills(neutralPercentages, tactics, 8, 5, COMBAT);

    expect(atDist.attaque).toBeGreaterThan(farDist.attaque);
  });

  it('uses config.tacticNeutral as the neutral value', () => {
    const customConfig = { ...COMBAT, tacticNeutral: 3, effectiveMin: 1, effectiveMax: 99 };
    const tactics = { EO: 3, NA: 3, EN: 3 };
    // With neutral=3 and all tactics at 3, adjustments should be zero
    const result = computeEffectiveSkills(neutralPercentages, tactics, 5, 5, customConfig);

    // attaque: 50 + (3-3) + (3 - |5-5|)*2 = 50 + 0 + 6 = 56
    // vivacite: 50 + 0 + 0 = 50
    expect(result.vivacite).toBe(50);
  });
});
