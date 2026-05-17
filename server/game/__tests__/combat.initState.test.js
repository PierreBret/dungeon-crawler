import { describe, it, expect } from 'vitest';
import { initCombatState } from '../combat.js';
import { COMBAT } from '../variables.js';

/**
 * Unit tests for initCombatState
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 8.1
 */

function makePlayerData(statsOverrides = {}, opts = {}) {
  const stats = {
    FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12,
    ...statsOverrides
  };
  return {
    stats,
    tactic: opts.tactic ?? [{ EO: 5, NA: 5, EN: 5 }],
    weaponDef: opts.weaponDef ?? { poids: 4, dist: 5, degatsBase: 10, materiau: 3, affinites: {}, poidsStats: {} },
    equipment: opts.equipment ?? { armure: { reduction: 5, poids: 8 } }
  };
}

describe('initCombatState', () => {
  it('should return a CombatState with correct top-level structure', () => {
    const player = makePlayerData();
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.minute).toBe(1);
    expect(state.tempo).toBe(1);
    expect(state.distance).toBe(COMBAT.distanceInitiale);
    expect(state.attacker).toBeNull();
    expect(state.log).toEqual([]);
    expect(state.result).toBeNull();
    expect(state.player).toBeDefined();
    expect(state.creature).toBeDefined();
  });

  it('should compute HPMAX correctly for mid-range stats', () => {
    // CON=12, TAI=12, VOL=12 → 12×19 + 12×5 + 12×2 = 228 + 60 + 24 = 312
    const player = makePlayerData({ CON: 12, TAI: 12, VOL: 12 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.hpMax).toBe(312);
    expect(state.player.hp).toBe(312);
  });

  it('should compute HPMAX minimum for stats all at 1', () => {
    // CON=1, TAI=1, VOL=1 → 1×19 + 1×5 + 1×2 = 26 → clamped to 78
    const player = makePlayerData({ FOR: 1, CON: 1, TAI: 1, INT: 1, VOL: 1, VIT: 1, ADR: 1 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    // Raw = 19 + 5 + 2 = 26, clamped to 78
    expect(state.player.hpMax).toBe(78);
    expect(state.player.hp).toBe(78);
  });

  it('should compute HPMAX maximum for stats all at 24', () => {
    // CON=24, TAI=24, VOL=24 → 24×19 + 24×5 + 24×2 = 456 + 120 + 48 = 624 → clamped to 546
    const player = makePlayerData({ FOR: 24, CON: 24, TAI: 24, INT: 24, VOL: 24, VIT: 24, ADR: 24 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.hpMax).toBe(546);
    expect(state.player.hp).toBe(546);
  });

  it('should compute ENDMAX correctly for mid-range stats', () => {
    // FOR=12, CON=12, VOL=12 → (12+12+12)×3 = 108
    const player = makePlayerData({ FOR: 12, CON: 12, VOL: 12 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.endMax).toBe(108);
    expect(state.player.endurance).toBe(108);
  });

  it('should compute ENDMAX minimum for stats all at 1', () => {
    // FOR=1, CON=1, VOL=1 → (1+1+1)×3 = 9 → clamped to 27
    const player = makePlayerData({ FOR: 1, CON: 1, TAI: 1, INT: 1, VOL: 1, VIT: 1, ADR: 1 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.endMax).toBe(27);
    expect(state.player.endurance).toBe(27);
  });

  it('should compute ENDMAX maximum for stats all at 24', () => {
    // FOR=24, CON=24, VOL=24 → (24+24+24)×3 = 216 → clamped to 189
    const player = makePlayerData({ FOR: 24, CON: 24, TAI: 24, INT: 24, VOL: 24, VIT: 24, ADR: 24 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.endMax).toBe(189);
    expect(state.player.endurance).toBe(189);
  });

  it('should compute Charge correctly', () => {
    // Poids_Arme=4, Poids_Armure=8 → 4 + Math.floor(8/4) = 4 + 2 = 6
    const player = makePlayerData({}, {
      weaponDef: { poids: 4, dist: 5, degatsBase: 10, materiau: 3, affinites: {}, poidsStats: {} },
      equipment: { armure: { reduction: 5, poids: 8 } }
    });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.charge).toBe(6);
  });

  it('should compute Portage correctly', () => {
    // FOR=12, TAI=12 → 12 + Math.floor(12/2) = 12 + 6 = 18
    const player = makePlayerData({ FOR: 12, TAI: 12 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.portage).toBe(18);
  });

  it('should compute Surcoût correctly when overloaded', () => {
    // Charge > Portage case:
    // FOR=1, TAI=1 → Portage = 1 + Math.floor(1/2) = 1 + 0 = 1
    // Poids_Arme=14, Poids_Armure=64 → Charge = 14 + Math.floor(64/4) = 14 + 16 = 30
    // Surcoût = Math.floor(Math.max(0, 30 - 1) × 10 / 26) = Math.floor(290/26) = Math.floor(11.15) = 11 → but max is 10
    // Actually the spec says range [0, 10] but the formula doesn't enforce a max.
    // Let's use a more reasonable case:
    // FOR=5, TAI=4 → Portage = 5 + Math.floor(4/2) = 5 + 2 = 7
    // Poids_Arme=10, Poids_Armure=12 → Charge = 10 + Math.floor(12/4) = 10 + 3 = 13
    // Surcoût = Math.floor(Math.max(0, 13 - 7) × 10 / 26) = Math.floor(60/26) = Math.floor(2.307) = 2
    const player = makePlayerData({ FOR: 5, TAI: 4 }, {
      weaponDef: { poids: 10, dist: 5, degatsBase: 10, materiau: 3, affinites: {}, poidsStats: {} },
      equipment: { armure: { reduction: 5, poids: 12 } }
    });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.portage).toBe(7);
    expect(state.player.charge).toBe(13);
    expect(state.player.surcout).toBe(2);
  });

  it('should compute Surcoût as 0 when Charge <= Portage', () => {
    // FOR=12, TAI=12 → Portage = 12 + 6 = 18
    // Poids_Arme=4, Poids_Armure=8 → Charge = 4 + 2 = 6
    // Surcoût = Math.floor(Math.max(0, 6 - 18) × 10 / 26) = Math.floor(0) = 0
    const player = makePlayerData({ FOR: 12, TAI: 12 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.surcout).toBe(0);
  });

  it('should compute derived skills for each combatant', () => {
    const player = makePlayerData({ FOR: 10, CON: 10, TAI: 10, INT: 10, VOL: 10, VIT: 10, ADR: 10 });
    const creature = makePlayerData({ FOR: 15, CON: 15, TAI: 15, INT: 15, VOL: 15, VIT: 15, ADR: 15 });
    const state = initCombatState(player, creature, COMBAT);

    // Player: Vivacité = TAI×6 + INT×12 + VIT×7 + ADR×8 = 60+120+70+80 = 330
    expect(state.player.skills.vivacite).toBe(330);
    // Creature: Vivacité = 15×6 + 15×12 + 15×7 + 15×8 = 90+180+105+120 = 495
    expect(state.creature.skills.vivacite).toBe(495);
  });

  it('should normalize skills to percentages', () => {
    const player = makePlayerData({ FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    // Vivacité = 12×6 + 12×12 + 12×7 + 12×8 = 72+144+84+96 = 396
    // Vivacité% = 396 × 50 / 396 = 50.00
    expect(state.player.percentages.vivacite).toBe(50);

    // All percentages should be in [12.5, 87.5]
    for (const name of Object.keys(state.player.percentages)) {
      expect(state.player.percentages[name]).toBeGreaterThanOrEqual(12.5);
      expect(state.player.percentages[name]).toBeLessThanOrEqual(87.5);
    }
  });

  it('should initialize fatigue to 0 and naCap to Infinity', () => {
    const player = makePlayerData();
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.fatigue).toBe(0);
    expect(state.player.naCap).toBe(Infinity);
    expect(state.creature.fatigue).toBe(0);
    expect(state.creature.naCap).toBe(Infinity);
  });

  it('should store tactics, weapon, and armor references', () => {
    const tactic = [{ EO: 3, NA: 7, EN: 2 }];
    const weaponDef = { poids: 6, dist: 3, degatsBase: 15, materiau: 5, affinites: {}, poidsStats: {} };
    const armure = { reduction: 8, poids: 12 };
    const player = makePlayerData({}, { tactic, weaponDef, equipment: { armure } });
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.tactics).toBe(tactic);
    expect(state.player.weapon).toBe(weaponDef);
    expect(state.player.armor).toBe(armure);
  });

  it('should initialize effective as empty object', () => {
    const player = makePlayerData();
    const creature = makePlayerData();
    const state = initCombatState(player, creature, COMBAT);

    expect(state.player.effective).toEqual({});
    expect(state.creature.effective).toEqual({});
  });
});
