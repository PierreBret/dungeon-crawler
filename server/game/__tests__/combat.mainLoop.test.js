import { describe, it, expect } from 'vitest';
import { mainLoop, initCombatState } from '../combat.js';
import { COMBAT } from '../variables.js';

/**
 * Unit tests for mainLoop(state, config, rng)
 *
 * Ces tests utilisent Math.random pour éviter les boucles infinies
 * causées par des rng déterministes mal calibrés.
 */

function makeTestCombatantData(overrides = {}) {
  return {
    stats: { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 },
    tactic: [{ EO: 5, NA: 5, EN: 5 }],
    weaponDef: {
      poids: 4,
      dist: 5,
      damFirst: 5,
      damLast: 15,
      models: ['Épée', 'Épée+1', 'Épée+2'],
      tier: 1,
      materiau: 1,
      weightFO: 1,
      weightTA: 0,
      weightIN: 0,
      weightVI: 0,
      weightAD: 1,
      aff_bestial: 0,
      aff_elementaire: 0,
      aff_feerique: 0,
      aff_demoniaque: 0,
      aff_undead: 0,
      aff_reptilien: 0
    },
    equipment: {
      armure: { reduction: 2, poids: 4 }
    },
    ...overrides
  };
}

describe('mainLoop — Boucle principale du combat', () => {

  it('should terminate with a result (draw or winner)', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const result = mainLoop(state, COMBAT, Math.random);

    expect(result.result).not.toBeNull();
    expect(['player', 'creature', 'draw']).toContain(result.result.winner);
  });

  it('should produce log entries', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const result = mainLoop(state, COMBAT, Math.random);

    expect(result.log.length).toBeGreaterThan(0);
  });

  it('should log "=== Minute 1 ===" at the start', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const result = mainLoop(state, COMBAT, Math.random);

    const minuteLogs = result.log.filter(e => e.type === 'separator' && e.text.includes('Minute 1'));
    expect(minuteLogs.length).toBeGreaterThanOrEqual(1);
    expect(minuteLogs[0].text).toBe('=== Minute 1 ===');
  });
});
