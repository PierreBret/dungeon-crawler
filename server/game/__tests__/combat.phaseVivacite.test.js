import { describe, it, expect } from 'vitest';
import { phaseVivacite } from '../combat.js';

/**
 * Helper: creates a minimal CombatState for phaseVivacite testing.
 */
function makeState(playerVivacite, playerFatigue, creatureVivacite, creatureFatigue) {
  return {
    minute: 1,
    tempo: 1,
    distance: 5,
    attacker: null,
    devMode: false,
    player: {
      name: 'Joueur',
      effective: { vivacite: playerVivacite },
      fatigue: playerFatigue
    },
    creature: {
      name: 'Créature',
      effective: { vivacite: creatureVivacite },
      fatigue: creatureFatigue
    },
    log: [],
    result: null
  };
}

/**
 * Helper: creates a deterministic rng from a sequence of values.
 */
function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('phaseVivacite', () => {
  it('designates player as ATT when player quality is higher', () => {
    // Player: effective=80, fatigue=0, rng=0.1 → d100=11, quality=80-11-0=69
    // Creature: effective=40, fatigue=0, rng=0.9 → d100=91, quality=40-91-0=-51
    const state = makeState(80, 0, 40, 0);
    const rng = fixedRng([0.1, 0.9]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
    expect(result.log).toHaveLength(1);
    expect(result.log[0].type).toBe('initiative');
    expect(result.log[0].text).toContain('Joueur');
  });

  it('designates creature as ATT when creature quality is higher', () => {
    // Player: effective=30, fatigue=10, rng=0.5 → d100=51, quality=30-51-10=-31
    // Creature: effective=70, fatigue=0, rng=0.1 → d100=11, quality=70-11-0=59
    const state = makeState(30, 10, 70, 0);
    const rng = fixedRng([0.5, 0.1]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('creature');
    expect(result.log[0].text).toContain('Créature');
  });

  it('uses random tiebreak when qualities are equal — player wins', () => {
    // Both: effective=50, fatigue=0, same rng → same d100 → same quality
    // Tiebreak rng: 0.3 < 0.5 → player
    const state = makeState(50, 0, 50, 0);
    const rng = fixedRng([0.5, 0.5, 0.3]); // d100 for player, d100 for creature, tiebreak

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
  });

  it('uses random tiebreak when qualities are equal — creature wins', () => {
    // Both: effective=50, fatigue=0, same rng → same d100 → same quality
    // Tiebreak rng: 0.7 >= 0.5 → creature
    const state = makeState(50, 0, 50, 0);
    const rng = fixedRng([0.5, 0.5, 0.7]); // d100 for player, d100 for creature, tiebreak

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('creature');
  });

  it('returns the modified state object', () => {
    const state = makeState(60, 0, 40, 0);
    const rng = fixedRng([0.2, 0.8]);

    const result = phaseVivacite(state, rng);

    expect(result).toBe(state); // same reference (mutated in place)
  });

  it('accounts for fatigue in the roll', () => {
    // Player: effective=50, fatigue=20, rng=0.3 → d100=31, quality=50-31-20=-1
    // Creature: effective=50, fatigue=0, rng=0.3 → d100=31, quality=50-31-0=19
    const state = makeState(50, 20, 50, 0);
    const rng = fixedRng([0.3, 0.3]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('creature');
  });

  it('works when both qualities are negative (highest still wins)', () => {
    // Player: effective=20, fatigue=10, rng=0.8 → d100=81, quality=20-81-10=-71
    // Creature: effective=20, fatigue=10, rng=0.9 → d100=91, quality=20-91-10=-81
    // Player quality (-71) > Creature quality (-81) → player is ATT
    const state = makeState(20, 10, 20, 10);
    const rng = fixedRng([0.8, 0.9]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
  });
});
