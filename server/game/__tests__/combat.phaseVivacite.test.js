import { describe, it, expect } from 'vitest';
import { phaseVivacite } from '../combat.js';

/**
 * Unit tests for phaseVivacite.
 *
 * Note: phaseVivacite ne fait PAS de flushLogs() quand un gagnant est déterminé.
 * Les entrées de log restent dans state.logBuffer.
 * flushLogs() n'est appelé que quand les deux qualités sont < 0 (retry).
 *
 * Pseudo-code: si C1.VIVACITYQUALITY >= C2.VIVACITYQUALITY → ATT = C1
 * (égalité va au joueur, pas de tirage aléatoire)
 */

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
    logBuffer: [],
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
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.logBuffer.some(l => l.type === 'initiative' && l.text.includes('Joueur'))).toBe(true);
  });

  it('designates creature as ATT when creature quality is higher', () => {
    // Player: effective=30, fatigue=10, rng=0.5 → d100=51, quality=30-51-10=-31
    // Creature: effective=70, fatigue=0, rng=0.1 → d100=11, quality=70-11-0=59
    const state = makeState(30, 10, 70, 0);
    const rng = fixedRng([0.5, 0.1]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('creature');
    expect(result.logBuffer.some(l => l.text.includes('Créature'))).toBe(true);
  });

  it('player wins on tie (C1.QUALITY >= C2.QUALITY)', () => {
    // Both: effective=80, fatigue=0, same rng → same d100 → same quality
    // rng=0.1 → d100=11, quality=80-11-0=69 for both → tie → player wins
    const state = makeState(80, 0, 80, 0);
    const rng = fixedRng([0.1, 0.1]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
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

  it('retries with flushLogs when both qualities are negative', () => {
    // First iteration: both negative → flushLogs + retry
    // Second iteration: player wins
    const state = makeState(50, 0, 50, 0);
    let i = 0;
    // Non-cycling: iteration 1 gives both negative, iteration 2 gives player positive
    const values = [0.99, 0.99, 0.1, 0.8];
    const rng = () => {
      if (i >= values.length) return 0.1; // safety fallback
      return values[i++];
    };

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
    // First iteration flushed to state.log
    expect(result.log.some(l => l.text.includes('cherchent une ouverture'))).toBe(true);
  });

  it('alternance bonus applied to non-ATT when attacker is set', () => {
    // attacker = 'player' → creature gets +30 bonus
    // Player: effective=50, rng=0.1 → d100=11, quality=50-11-0=39
    // Creature: effective=20, rng=0.5 → d100=51, quality=20-51-0=-31, +30 = -1
    // Player (39) > Creature (-1) → player wins
    const state = makeState(50, 0, 20, 0);
    state.attacker = 'player';
    const rng = fixedRng([0.1, 0.5]);

    const result = phaseVivacite(state, rng);

    expect(result.attacker).toBe('player');
  });
});
