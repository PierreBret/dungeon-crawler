import { describe, it, expect } from 'vitest';
import { phaseDefense, computeDefenseCost } from '../combat.js';

/**
 * Tests for phaseDefense.
 *
 * Note: phaseDefense ne fait PAS de flushLogs(). Les entrées de log
 * restent dans state.logBuffer jusqu'au prochain flushLogs() dans la boucle principale.
 */

describe('phaseDefense', () => {
  // Helper to create a minimal combat state for testing
  function makeState(overrides = {}) {
    return {
      minute: 1,
      tempo: 1,
      distance: 5,
      attacker: 'player',
      attackResult: 'hit',
      devMode: false,
      player: {
        name: 'Joueur',
        hp: 200,
        hpMax: 200,
        endurance: 100,
        endMax: 100,
        fatigue: 0,
        naCap: Infinity,
        effective: { esquive: 50, parade: 40, attaque: 50, vivacite: 50, initiative: 50, riposte: 50 },
        tactics: [{ EO: 5, NA: 5, EN: 5 }],
        surcout: 0,
        weapon: { poids: 5, dist: 5 },
        armor: { reduction: 5 }
      },
      creature: {
        name: 'Créature',
        hp: 150,
        hpMax: 150,
        endurance: 80,
        endMax: 80,
        fatigue: 0,
        naCap: Infinity,
        effective: { esquive: 60, parade: 40, attaque: 50, vivacite: 50, initiative: 50, riposte: 50 },
        tactics: [{ EO: 5, NA: 5, EN: 5 }],
        surcout: 0,
        weapon: { poids: 4, dist: 4 },
        armor: { reduction: 3 }
      },
      log: [],
      logBuffer: [],
      result: null,
      ...overrides
    };
  }

  it('returns state unchanged when attackResult is not hit', () => {
    const state = makeState({ attackResult: 'miss' });
    const result = phaseDefense(state, Math.random);
    expect(result.defenseResult).toBeUndefined();
    expect(result.logBuffer).toHaveLength(0);
  });

  it('sets defenseResult to encaissement when DEF has no endurance', () => {
    const state = makeState();
    state.creature.endurance = 0;
    // scoreEsquive = 60 - 0 = 60, scoreParade = 40 - 0 = 40
    // esquive > Max(0, 40) mais END < coutEsquive → pas esquive
    // parade > 0 mais END < coutParade → pas parade
    // → encaissement
    const result = phaseDefense(state, Math.random);
    expect(result.defenseResult).toBe('encaissement');
    expect(result.logBuffer.some(l => l.text.includes('encaisse'))).toBe(true);
  });

  it('deducts endurance cost from DEF on defense attempt', () => {
    const state = makeState();
    state.creature.endurance = 80;
    // esquive: scoreEsquive=60 > Max(0, scoreParade=40) et END >= cout(5)
    const initialEndurance = state.creature.endurance;
    const rng = () => 0.01; // low roll → d100=2, defense succeeds
    phaseDefense(state, rng);
    expect(state.creature.endurance).toBe(initialEndurance - 5);
  });

  it('sets defenseResult to success when defense roll succeeds', () => {
    const state = makeState();
    // esquive: scoreEsquive=60, d100=1 → quality = 60 - 1 = 59 >= 0
    const rng = () => 0.001; // d100 = Math.floor(0.001*100)+1 = 1
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('success');
  });

  it('sets defenseResult to fail when defense roll fails', () => {
    const state = makeState();
    // esquive: scoreEsquive=60, d100=99 → quality = 60 - 99 = -39 < 0
    const rng = () => 0.98; // d100 = Math.floor(0.98*100)+1 = 99
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('fail');
  });

  it('selects parade when scoreParade > 0 and esquive condition not met', () => {
    const state = makeState();
    // scoreEsquive = 30 - 0 = 30, scoreParade = 70 - 0 = 70
    // esquive > Max(0, 70) → 30 > 70 → false → try parade
    // parade > 0 → true
    state.creature.effective.esquive = 30;
    state.creature.effective.parade = 70;
    const rng = () => 0.001; // d100=1, parade succeeds (70-1=69>=0)
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('success');
    expect(state.logBuffer.some(l => l.text.includes('parer'))).toBe(true);
  });

  it('encaissement when both defenses unaffordable', () => {
    const state = makeState();
    // cost = NA(5) + surcout(0) = 5
    state.creature.endurance = 4; // < 5 → both unaffordable
    phaseDefense(state, Math.random);
    expect(state.defenseResult).toBe('encaissement');
  });

  it('correctly identifies DEF when attacker is creature', () => {
    const state = makeState({ attacker: 'creature' });
    // DEF is player
    state.player.effective.esquive = 70;
    state.player.effective.parade = 30;
    const rng = () => 0.001; // d100=1, esquive succeeds
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('success');
    expect(state.logBuffer.some(l => l.text.includes('Joueur'))).toBe(true);
  });
});

describe('computeDefenseCost', () => {
  it('returns na + surcout', () => {
    expect(computeDefenseCost(5, 2)).toBe(7);
  });

  it('handles minimum values', () => {
    expect(computeDefenseCost(1, 0)).toBe(1);
  });

  it('handles maximum values', () => {
    expect(computeDefenseCost(10, 10)).toBe(20);
  });
});
