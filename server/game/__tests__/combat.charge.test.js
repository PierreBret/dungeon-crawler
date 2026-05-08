import { describe, it, expect } from 'vitest';
import { computeCharge, computePortage, computeSurcoutEndurance } from '../combat.js';

describe('computeCharge', () => {
  it('returns weapon weight when no shield and no armor', () => {
    const weaponDef = { weight: 5 };
    const equipment = null;
    expect(computeCharge(weaponDef, equipment)).toBe(5);
  });

  it('adds shield weight from equipment.leftHand', () => {
    const weaponDef = { weight: 3 };
    const equipment = { leftHand: { weight: 4 } };
    expect(computeCharge(weaponDef, equipment)).toBe(7);
  });

  it('defaults weapon weight to 0 when weaponDef is null', () => {
    expect(computeCharge(null, null)).toBe(0);
  });

  it('defaults weapon weight to 0 when weight field is absent', () => {
    const weaponDef = { code: "DA" };
    expect(computeCharge(weaponDef, null)).toBe(0);
  });

  it('defaults shield weight to 0 when leftHand is null', () => {
    const weaponDef = { weight: 6 };
    const equipment = { leftHand: null };
    expect(computeCharge(weaponDef, equipment)).toBe(6);
  });

  it('defaults shield weight to 0 when leftHand has no weight', () => {
    const weaponDef = { weight: 2 };
    const equipment = { leftHand: {} };
    expect(computeCharge(weaponDef, equipment)).toBe(2);
  });

  it('uses Math.floor on the total (integer inputs stay integer)', () => {
    const weaponDef = { weight: 7 };
    const equipment = { leftHand: { weight: 3 } };
    expect(computeCharge(weaponDef, equipment)).toBe(10);
  });
});

describe('computePortage', () => {
  it('calculates portage as Math.floor(force + Math.floor(taille / 2))', () => {
    const stats = { force: 12, taille: 10 };
    // Math.floor(12 + Math.floor(10 / 2)) = Math.floor(12 + 5) = 17
    expect(computePortage(stats)).toBe(17);
  });

  it('floors taille / 2 for odd taille values', () => {
    const stats = { force: 10, taille: 7 };
    // Math.floor(10 + Math.floor(7 / 2)) = Math.floor(10 + 3) = 13
    expect(computePortage(stats)).toBe(13);
  });

  it('handles low stats', () => {
    const stats = { force: 3, taille: 3 };
    // Math.floor(3 + Math.floor(3 / 2)) = Math.floor(3 + 1) = 4
    expect(computePortage(stats)).toBe(4);
  });

  it('handles high stats', () => {
    const stats = { force: 21, taille: 21 };
    // Math.floor(21 + Math.floor(21 / 2)) = Math.floor(21 + 10) = 31
    expect(computePortage(stats)).toBe(31);
  });
});

describe('computeSurcoutEndurance', () => {
  it('returns 0 when charge <= portage', () => {
    expect(computeSurcoutEndurance(5, 10)).toBe(0);
    expect(computeSurcoutEndurance(10, 10)).toBe(0);
  });

  it('calculates surcoût when charge > portage', () => {
    // Math.floor(Math.max(0, 15 - 10) * 10 / 26) = Math.floor(50 / 26) = Math.floor(1.923) = 1
    expect(computeSurcoutEndurance(15, 10)).toBe(1);
  });

  it('calculates larger surcoût for bigger overload', () => {
    // Math.floor(Math.max(0, 26 - 10) * 10 / 26) = Math.floor(160 / 26) = Math.floor(6.15) = 6
    expect(computeSurcoutEndurance(26, 10)).toBe(6);
  });

  it('returns exact value for 26 overload', () => {
    // Math.floor(Math.max(0, 36 - 10) * 10 / 26) = Math.floor(260 / 26) = 10
    expect(computeSurcoutEndurance(36, 10)).toBe(10);
  });

  it('returns 0 when charge equals portage', () => {
    expect(computeSurcoutEndurance(12, 12)).toBe(0);
  });
});
