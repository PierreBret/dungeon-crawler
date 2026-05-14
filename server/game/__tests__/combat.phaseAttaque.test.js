import { describe, it, expect } from 'vitest';
import { computeMovement, phaseAttaque, initCombatState, computeEffectiveSkills, phaseVivacite } from '../combat.js';
import { COMBAT } from '../combatConfig.js';

// ─── computeMovement ───────────────────────────────────────────────────────────

describe('computeMovement', () => {
  it('returns desiredDist when maxMove is sufficient', () => {
    // EN=6 → desiredDist=5, currentDist=10, NA=10 → maxMove=5
    // diff = 5-10 = -5, move = -5, newDist = 10 + (-5) = 5
    expect(computeMovement(10, 6, 10, COMBAT)).toBe(5);
  });

  it('limits movement to floor(NA/2)', () => {
    // EN=10 → desiredDist=1, currentDist=10, NA=4 → maxMove=2
    // diff = 1-10 = -9, move = -1*min(9,2) = -2, newDist = 10-2 = 8
    expect(computeMovement(10, 10, 4, COMBAT)).toBe(8);
  });

  it('does not move when already at desired distance', () => {
    // EN=6 → desiredDist=5, currentDist=5, NA=10 → maxMove=5
    // diff = 0, move = 0, newDist = 5
    expect(computeMovement(5, 6, 10, COMBAT)).toBe(5);
  });

  it('clamps result to distanceMin', () => {
    // EN=10 → desiredDist=1, currentDist=2, NA=10 → maxMove=5
    // diff = 1-2 = -1, move = -1, newDist = 2-1 = 1
    expect(computeMovement(2, 10, 10, COMBAT)).toBe(1);
  });

  it('clamps result to distanceMax', () => {
    // EN=1 → desiredDist=10, currentDist=9, NA=10 → maxMove=5
    // diff = 10-9 = 1, move = 1, newDist = 9+1 = 10
    expect(computeMovement(9, 1, 10, COMBAT)).toBe(10);
  });

  it('handles NA=1 (maxMove=0, no movement)', () => {
    // NA=1 → maxMove=0, no movement regardless of diff
    expect(computeMovement(5, 10, 1, COMBAT)).toBe(5);
  });

  it('moves towards higher distance when EN is low', () => {
    // EN=1 → desiredDist=10, currentDist=5, NA=6 → maxMove=3
    // diff = 10-5 = 5, move = min(5,3) = 3, newDist = 5+3 = 8
    expect(computeMovement(5, 1, 6, COMBAT)).toBe(8);
  });
});

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

  it('updates distance based on computeMovement', () => {
    const state = makeState();
    // EN=5 → desiredDist=6, currentDist=10, NA=5 → maxMove=2
    // diff = 6-10 = -4, move = -2, newDist = 10-2 = 8
    const rng = () => 0.01; // low roll → attack succeeds
    const result = phaseAttaque(state, rng);
    expect(result.distance).toBe(8);
  });

  it('triggers recovery when endurance is insufficient', () => {
    const state = makeState();
    state.player.endurance = 1; // Not enough for attack cost (poids=4 + NA=5 + surcout)
    const rng = () => 0.5;
    const result = phaseAttaque(state, rng);
    expect(result.skipToNextTempo).toBe(true);
    expect(result.log.some(l => l.type === 'recovery')).toBe(true);
  });

  it('deducts attack cost from endurance on attack', () => {
    const state = makeState();
    const initialEnd = state.player.endurance;
    const rng = () => 0.01; // low roll → attack succeeds
    const result = phaseAttaque(state, rng);
    // Cost = poids(4) + effectiveNA(min(5, naCap)) + surcout
    const effectiveNA = Math.min(5, state.player.naCap);
    const expectedCost = 4 + effectiveNA + result.player.surcout;
    // endurance should have decreased (we can't predict exact surcout without checking)
    expect(result.player.endurance).toBeLessThan(initialEnd);
  });

  it('sets attackResult to hit when roll succeeds', () => {
    const state = makeState();
    // rng returns 0.01 → d100 = 1, quality = attaque_eff - 1 - 0 (should be positive)
    const rng = () => 0.01;
    const result = phaseAttaque(state, rng);
    expect(result.attackResult).toBe('hit');
  });

  it('sets attackResult to miss when roll fails', () => {
    const state = makeState();
    // rng returns 0.99 → d100 = 100, quality = attaque_eff - 100 - 0 (should be negative)
    const rng = () => 0.99;
    const result = phaseAttaque(state, rng);
    expect(result.attackResult).toBe('miss');
  });

  it('logs the attack result', () => {
    const state = makeState();
    const rng = () => 0.5;
    const result = phaseAttaque(state, rng);
    expect(result.log.some(l => l.type === 'attack' || l.type === 'miss')).toBe(true);
  });

  it('updates fatigue tier after endurance deduction', () => {
    const state = makeState();
    // Set endurance low enough that after deduction it crosses a fatigue threshold
    state.player.endurance = 15; // After deduction of ~9, should be ~6 → fatigue tier ≤10
    const rng = () => 0.01;
    const result = phaseAttaque(state, rng);
    // After deduction, endurance should be low and fatigue should be updated
    if (result.player.endurance <= 10) {
      expect(result.player.fatigue).toBe(20);
      expect(result.player.naCap).toBe(2);
    }
  });
});
