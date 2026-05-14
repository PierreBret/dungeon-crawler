import { describe, it, expect } from 'vitest';
import { selectDefense, phaseDefense, computeDefenseCost } from '../combat.js';

describe('selectDefense', () => {
  describe('preferred defense selection', () => {
    it('prefers esquive when esquiveEff > paradeEff and endurance sufficient', () => {
      const result = selectDefense(60, 40, 100, 8, 8);
      expect(result.type).toBe('esquive');
      expect(result.cost).toBe(8);
    });

    it('prefers parade when paradeEff >= esquiveEff and endurance sufficient', () => {
      const result = selectDefense(40, 60, 100, 8, 8);
      expect(result.type).toBe('parade');
      expect(result.cost).toBe(8);
    });

    it('prefers parade when paradeEff === esquiveEff (tie goes to parade)', () => {
      const result = selectDefense(50, 50, 100, 8, 8);
      expect(result.type).toBe('parade');
      expect(result.cost).toBe(8);
    });
  });

  describe('degradation when endurance insufficient', () => {
    it('degrades from esquive to parade when endurance < coutEsquive but >= coutParade', () => {
      const result = selectDefense(60, 40, 5, 8, 4);
      expect(result.type).toBe('parade');
      expect(result.cost).toBe(4);
    });

    it('degrades from parade to esquive when endurance < coutParade but >= coutEsquive', () => {
      const result = selectDefense(40, 60, 5, 4, 8);
      expect(result.type).toBe('esquive');
      expect(result.cost).toBe(4);
    });

    it('returns encaissement when neither defense is payable', () => {
      const result = selectDefense(60, 40, 3, 8, 8);
      expect(result.type).toBe('encaissement');
      expect(result.cost).toBe(0);
    });

    it('returns encaissement when endurance is 0', () => {
      const result = selectDefense(60, 40, 0, 1, 1);
      expect(result.type).toBe('encaissement');
      expect(result.cost).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('works with minimum effective skills (1)', () => {
      const result = selectDefense(1, 1, 100, 5, 5);
      expect(result.type).toBe('parade'); // tie goes to parade
      expect(result.cost).toBe(5);
    });

    it('works with maximum effective skills (99)', () => {
      const result = selectDefense(99, 99, 100, 5, 5);
      expect(result.type).toBe('parade'); // tie goes to parade
    });

    it('endurance exactly equal to cost of preferred', () => {
      const result = selectDefense(60, 40, 8, 8, 10);
      expect(result.type).toBe('esquive');
      expect(result.cost).toBe(8);
    });

    it('endurance exactly equal to cost of fallback', () => {
      const result = selectDefense(60, 40, 4, 8, 4);
      expect(result.type).toBe('parade');
      expect(result.cost).toBe(4);
    });
  });
});

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
    expect(result.log).toHaveLength(0);
  });

  it('sets defenseResult to encaissement when DEF has no endurance', () => {
    const state = makeState();
    state.creature.endurance = 0;
    const result = phaseDefense(state, Math.random);
    expect(result.defenseResult).toBe('encaissement');
    expect(result.log).toHaveLength(1);
    expect(result.log[0].type).toBe('noAction');
  });

  it('deducts endurance cost from DEF on defense attempt', () => {
    const state = makeState();
    state.creature.endurance = 80;
    // esquiveEff=60 > paradeEff=40, so esquive is preferred
    // cost = NA(5) + surcout(0) = 5
    const initialEndurance = state.creature.endurance;
    const rng = () => 0.01; // low roll → d100=1, defense succeeds
    phaseDefense(state, rng);
    expect(state.creature.endurance).toBe(initialEndurance - 5);
  });

  it('sets defenseResult to success when defense roll succeeds', () => {
    const state = makeState();
    // esquiveEff=60, fatigue=0, d100=1 → quality = 60 - 1 - 0 = 59 >= 0
    const rng = () => 0.001; // d100 = Math.floor(0.001*100)+1 = 1
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('success');
  });

  it('sets defenseResult to fail when defense roll fails', () => {
    const state = makeState();
    // esquiveEff=60, fatigue=0, d100=99 → quality = 60 - 99 - 0 = -39 < 0
    const rng = () => 0.98; // d100 = Math.floor(0.98*100)+1 = 99
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('fail');
  });

  it('updates fatigue tier after endurance deduction', () => {
    const state = makeState();
    // Set endurance to just above a fatigue threshold
    state.creature.endurance = 12; // After deducting 5, endurance = 7 → fatigue tier ≤10 → fatigue=20
    const rng = () => 0.001;
    phaseDefense(state, rng);
    expect(state.creature.fatigue).toBe(20);
    expect(state.creature.naCap).toBe(2);
  });

  it('selects parade when paradeEff > esquiveEff', () => {
    const state = makeState();
    state.creature.effective.esquive = 30;
    state.creature.effective.parade = 70;
    const rng = () => 0.001; // d100=1, parade succeeds (70-1-0=69>=0)
    phaseDefense(state, rng);
    expect(state.defenseResult).toBe('success');
    expect(state.log[0].text).toContain('parade');
  });

  it('degrades to fallback defense when preferred is too expensive', () => {
    const state = makeState();
    // esquiveEff=60 > paradeEff=40, so esquive preferred
    // Set endurance to 4 — cost is NA(5)+surcout(0)=5, so esquive unaffordable
    // But parade also costs 5, so both unaffordable → encaissement
    state.creature.endurance = 4;
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
    expect(state.log[0].text).toContain('Joueur');
  });

  it('uses correct tactic for minute > tactics array length', () => {
    const state = makeState();
    state.minute = 10; // tactics array has only 1 entry, so index = min(9, 0) = 0
    state.creature.tactics = [{ EO: 5, NA: 3, EN: 5 }];
    // NA=3, surcout=0 → cost = 3
    state.creature.endurance = 3; // exactly enough for defense
    const rng = () => 0.001;
    phaseDefense(state, rng);
    // Should have been able to afford defense (cost=3, endurance=3)
    expect(state.defenseResult).not.toBe('encaissement');
  });
});
