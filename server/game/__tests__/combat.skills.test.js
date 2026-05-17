/**
 * Unit tests for computeDerivedSkills
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
import { describe, it, expect } from 'vitest';
import { computeDerivedSkills } from '../combat.js';
import { COMBAT } from '../variables.js';

describe('computeDerivedSkills', () => {
  it('calculates all 6 derived skills for minimum stats (all 1)', () => {
    const stats = { FOR: 1, CON: 1, TAI: 1, INT: 1, VOL: 1, VIT: 1, ADR: 1 };
    const skills = computeDerivedSkills(stats, COMBAT);

    // Vivacité = TAI×6 + INT×12 + VIT×7 + ADR×8 = 6+12+7+8 = 33
    expect(skills.vivacite).toBe(33);
    // Initiative = INT×4 + VOL×6 + VIT×9 = 4+6+9 = 19
    expect(skills.initiative).toBe(19);
    // Attaque = FOR×6 + INT×10 + VOL×6 + ADR×10 = 6+10+6+10 = 32
    expect(skills.attaque).toBe(32);
    // Parade = FOR×6 + VOL×6 + ADR×10 + (24-TAI)×6 = 6+6+10+(23×6) = 6+6+10+138 = 160
    expect(skills.parade).toBe(160);
    // Esquive = INT×10 + VOL×6 + VIT×5 + ADR×10 + (24-TAI)×6 = 10+6+5+10+138 = 169
    expect(skills.esquive).toBe(169);
    // Riposte = INT×6 + VIT×10 + ADR×10 = 6+10+10 = 26
    expect(skills.riposte).toBe(26);
  });

  it('calculates all 6 derived skills for maximum stats (all 24)', () => {
    const stats = { FOR: 24, CON: 24, TAI: 24, INT: 24, VOL: 24, VIT: 24, ADR: 24 };
    const skills = computeDerivedSkills(stats, COMBAT);

    // Vivacité = 24×6 + 24×12 + 24×7 + 24×8 = 144+288+168+192 = 792
    expect(skills.vivacite).toBe(792);
    // Initiative = 24×4 + 24×6 + 24×9 = 96+144+216 = 456
    expect(skills.initiative).toBe(456);
    // Attaque = 24×6 + 24×10 + 24×6 + 24×10 = 144+240+144+240 = 768
    expect(skills.attaque).toBe(768);
    // Parade = 24×6 + 24×6 + 24×10 + (24-24)×6 = 144+144+240+0 = 528
    expect(skills.parade).toBe(528);
    // Esquive = 24×10 + 24×6 + 24×5 + 24×10 + (24-24)×6 = 240+144+120+240+0 = 744
    expect(skills.esquive).toBe(744);
    // Riposte = 24×6 + 24×10 + 24×10 = 144+240+240 = 624
    expect(skills.riposte).toBe(624);
  });

  it('correctly handles TAI_INV term for Parade (high TAI reduces parade)', () => {
    const statsLowTAI = { FOR: 12, CON: 12, TAI: 1, INT: 12, VOL: 12, VIT: 12, ADR: 12 };
    const statsHighTAI = { FOR: 12, CON: 12, TAI: 24, INT: 12, VOL: 12, VIT: 12, ADR: 12 };

    const skillsLow = computeDerivedSkills(statsLowTAI, COMBAT);
    const skillsHigh = computeDerivedSkills(statsHighTAI, COMBAT);

    // Higher TAI → lower (24-TAI) → lower Parade
    expect(skillsLow.parade).toBeGreaterThan(skillsHigh.parade);
    // Difference should be (24-1)×6 - (24-24)×6 = 138 - 0 = 138
    expect(skillsLow.parade - skillsHigh.parade).toBe(138);
  });

  it('correctly handles TAI_INV term for Esquive (high TAI reduces esquive)', () => {
    const statsLowTAI = { FOR: 12, CON: 12, TAI: 1, INT: 12, VOL: 12, VIT: 12, ADR: 12 };
    const statsHighTAI = { FOR: 12, CON: 12, TAI: 24, INT: 12, VOL: 12, VIT: 12, ADR: 12 };

    const skillsLow = computeDerivedSkills(statsLowTAI, COMBAT);
    const skillsHigh = computeDerivedSkills(statsHighTAI, COMBAT);

    // Higher TAI → lower (24-TAI) → lower Esquive
    expect(skillsLow.esquive).toBeGreaterThan(skillsHigh.esquive);
    // Difference should be (24-1)×6 - (24-24)×6 = 138 - 0 = 138
    expect(skillsLow.esquive - skillsHigh.esquive).toBe(138);
  });

  it('uses config coefficients (not hardcoded values)', () => {
    const stats = { FOR: 10, CON: 10, TAI: 10, INT: 10, VOL: 10, VIT: 10, ADR: 10 };

    // Custom config with different coefficients
    const customConfig = {
      skills: {
        vivacite:   { TAI: 1, INT: 1, VIT: 1, ADR: 1 },
        initiative: { INT: 1, VOL: 1, VIT: 1 },
        attaque:    { FOR: 1, INT: 1, VOL: 1, ADR: 1 },
        parade:     { FOR: 1, VOL: 1, ADR: 1, TAI_INV: 1 },
        esquive:    { INT: 1, VOL: 1, VIT: 1, ADR: 1, TAI_INV: 1 },
        riposte:    { INT: 1, VIT: 1, ADR: 1 }
      }
    };

    const skills = computeDerivedSkills(stats, customConfig);

    // With all coefficients = 1 and all stats = 10:
    // Vivacité = 10+10+10+10 = 40
    expect(skills.vivacite).toBe(40);
    // Initiative = 10+10+10 = 30
    expect(skills.initiative).toBe(30);
    // Attaque = 10+10+10+10 = 40
    expect(skills.attaque).toBe(40);
    // Parade = 10+10+10+(24-10)×1 = 30+14 = 44
    expect(skills.parade).toBe(44);
    // Esquive = 10+10+10+10+(24-10)×1 = 40+14 = 54
    expect(skills.esquive).toBe(54);
    // Riposte = 10+10+10 = 30
    expect(skills.riposte).toBe(30);
  });

  it('produces deterministic results (same input → same output)', () => {
    const stats = { FOR: 15, CON: 8, TAI: 20, INT: 5, VOL: 18, VIT: 3, ADR: 22 };
    const skills1 = computeDerivedSkills(stats, COMBAT);
    const skills2 = computeDerivedSkills(stats, COMBAT);

    expect(skills1).toEqual(skills2);
  });

  it('returns integer values for all skills', () => {
    const stats = { FOR: 7, CON: 13, TAI: 19, INT: 3, VOL: 21, VIT: 11, ADR: 5 };
    const skills = computeDerivedSkills(stats, COMBAT);

    expect(Number.isInteger(skills.vivacite)).toBe(true);
    expect(Number.isInteger(skills.initiative)).toBe(true);
    expect(Number.isInteger(skills.attaque)).toBe(true);
    expect(Number.isInteger(skills.parade)).toBe(true);
    expect(Number.isInteger(skills.esquive)).toBe(true);
    expect(Number.isInteger(skills.riposte)).toBe(true);
  });

  it('computes a mid-range example correctly', () => {
    const stats = { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 };
    const skills = computeDerivedSkills(stats, COMBAT);

    // Vivacité = 12×6 + 12×12 + 12×7 + 12×8 = 72+144+84+96 = 396
    expect(skills.vivacite).toBe(396);
    // Initiative = 12×4 + 12×6 + 12×9 = 48+72+108 = 228
    expect(skills.initiative).toBe(228);
    // Attaque = 12×6 + 12×10 + 12×6 + 12×10 = 72+120+72+120 = 384
    expect(skills.attaque).toBe(384);
    // Parade = 12×6 + 12×6 + 12×10 + (24-12)×6 = 72+72+120+72 = 336
    expect(skills.parade).toBe(336);
    // Esquive = 12×10 + 12×6 + 12×5 + 12×10 + (24-12)×6 = 120+72+60+120+72 = 444
    expect(skills.esquive).toBe(444);
    // Riposte = 12×6 + 12×10 + 12×10 = 72+120+120 = 312
    expect(skills.riposte).toBe(312);
  });
});
