import { describe, it, expect } from 'vitest';
import { phaseAttaque, initCombatState, computeEffectiveSkills } from '../combat.js';
import { COMBAT } from '../variables.js';

// ─── phaseAttaque ──────────────────────────────────────────────────────────────

describe('phaseAttaque', () => {
  function makeState(overrides = {}) {
    const playerData = {
      stats: { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 },
      tactic: [{ EO: 5, NA: 5, EN: 5 }],
      weaponDef: { poids: 4, dist: 5, degatsBase: 10, materiau: 0, affinites: {}, poidsStats: {} },
      equipment: { armure: { reduction: 2, poids: 4 } }
    };
    const creatureData = {
      stats: { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 },
      tactic: [{ EO: 5, NA: 5, EN: 5 }],
      weaponDef: { poids: 4, dist: 5, degatsBase: 10, materiau: 0, affinites: {}, poidsStats: {} },
      equipment: { armure: { reduction: 2, poids: 4 } }
    };

    const state = initCombatState(playerData, creatureData, COMBAT);
    state.attacker = 'player';

    // Compute effective skills for both combatants
    const playerTactics = state.player.tactics[0];
    state.player.effective = computeEffectiveSkills(
      state.player.percentages, playerTactics, state.distance, state.player.weapon.dist, COMBAT
    );
    const creatureTactics = state.creature.tactics[0];
    state.creature.effective = computeEffectiveSkills(
      state.creature.percentages, creatureTactics, state.distance, state.creature.weapon.dist, COMBAT
    );

    return { ...state, ...overrides };
  }

  it('triggers recovery when endurance is insufficient (flushLogs called)', () => {
    const state = makeState();
    state.player.endurance = 1; // Not enough for attack cost (poids=4 + NA=5 + surcout)
    const rng = () => 0.5;
    const result = phaseAttaque(state, rng);
    expect(result.skipToNextTempo).toBe(true);
    // flushLogs() est appelé dans ce cas → entrées dans state.log
    expect(result.log.some(l => l.type === 'recovery')).toBe(true);
  });

  it('deducts attack cost from endurance on attack', () => {
    const state = makeState();
    const initialEnd = state.player.endurance;
    const rng = () => 0.01; // low roll → attack succeeds
    phaseAttaque(state, rng);
    expect(state.player.endurance).toBeLessThan(initialEnd);
  });

  it('sets attackResult to hit when roll succeeds', () => {
    const state = makeState();
    // rng returns 0.01 → d100 = 2, quality = attaque_eff - 2 (should be positive)
    const rng = () => 0.01;
    const result = phaseAttaque(state, rng);
    expect(result.attackResult).toBe('hit');
  });

  it('sets attackResult to miss when roll fails', () => {
    const state = makeState();
    // rng returns 0.99 → d100 = 100, quality = attaque_eff - 100 (should be negative)
    const rng = () => 0.99;
    const result = phaseAttaque(state, rng);
    expect(result.attackResult).toBe('miss');
  });

  it('logs attack in logBuffer (no flushLogs on hit/miss)', () => {
    const state = makeState();
    const rng = () => 0.5;
    const result = phaseAttaque(state, rng);
    // Pas de flushLogs() pour hit/miss → entrées dans logBuffer
    expect(result.logBuffer.some(l => l.type === 'attack' || l.type === 'miss')).toBe(true);
  });

  it('increments tempo by weapon dist on attack', () => {
    const state = makeState();
    const initialTempo = state.tempo;
    const rng = () => 0.01;
    phaseAttaque(state, rng);
    expect(state.tempo).toBe(initialTempo + state.player.weapon.dist);
  });
});
