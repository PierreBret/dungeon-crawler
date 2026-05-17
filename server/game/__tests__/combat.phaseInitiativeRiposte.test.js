import { describe, it, expect } from 'vitest';
import { phaseInitiative, phaseRiposte } from '../combat.js';

/**
 * Unit tests for phaseInitiative and phaseRiposte
 *
 * Conformes au pseudo-code :
 * - phaseInitiative appelle toujours log("") + flushlogs() (les deux cas).
 * - phaseRiposte appelle toujours log("") + flushlogs() (les deux cas).
 * - phaseRiposte n'a plus de garde sur initiativeResult.
 */

/**
 * Helper: creates a minimal CombatState for testing initiative/riposte phases.
 */
function makeState({ attacker = 'player', playerInitiative = 50, creatureRiposte = 50, playerFatigue = 0, creatureFatigue = 0 } = {}) {
  return {
    attacker,
    devMode: false,
    player: {
      name: 'Joueur',
      effective: { initiative: playerInitiative, riposte: 50 },
      fatigue: playerFatigue
    },
    creature: {
      name: 'Créature',
      effective: { initiative: 50, riposte: creatureRiposte },
      fatigue: creatureFatigue
    },
    log: [],
    logBuffer: [],
    initiativeResult: null,
    riposteResult: null,
    nextPhase: null
  };
}

/**
 * Helper: creates a fixed RNG that returns values from a sequence.
 * Each call to rng() returns the next value in the sequence (cycling).
 */
function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('phaseInitiative', () => {
  it('ATT keeps initiative when roll succeeds (quality >= 0)', () => {
    // rng returns 0.1 → d100 = floor(0.1*100)+1 = 11
    // quality = 50 - 11 - 0 = 39 >= 0 → success
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    const rng = fixedRng([0.1]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('kept');
    expect(result.nextPhase).toBe('attaque');
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.some(l => l.type === 'initiative' && l.text.includes('enchaîne les attaques'))).toBe(true);
  });

  it('ATT loses initiative when roll fails (quality < 0)', () => {
    // rng returns 0.99 → d100 = floor(0.99*100)+1 = 100
    // quality = 50 - 100 - 0 = -50 < 0 → fail
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    const rng = fixedRng([0.99]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
    expect(result.nextPhase).toBeNull();
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.some(l => l.type === 'initiative' && l.text.includes('cherche une ouverture'))).toBe(true);
  });

  it('uses creature stats when creature is ATT', () => {
    // rng returns 0.1 → d100 = 11
    // creature initiative = 60, quality = 60 - 11 - 0 = 49 >= 0
    const state = makeState({ attacker: 'creature' });
    state.creature.effective.initiative = 60;
    const rng = fixedRng([0.1]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('kept');
    expect(result.logBuffer.some(l => l.text.includes('Créature'))).toBe(true);
  });

  it('fatigue reduces quality and can cause failure', () => {
    // rng returns 0.3 → d100 = floor(0.3*100)+1 = 31
    // quality = 50 - 31 - 20 = -1 < 0 → fail (fatigue makes it fail)
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 20 });
    const rng = fixedRng([0.3]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
    expect(result.logBuffer.some(l => l.text.includes('cherche une ouverture'))).toBe(true);
  });

  it('boundary: quality exactly 0 means success', () => {
    // We need effectiveSkill - d100 - fatigue = 0
    // effectiveSkill = 50, fatigue = 0, need d100 = 50
    // rng returns 0.49 → d100 = floor(0.49*100)+1 = 50
    // quality = 50 - 50 - 0 = 0 >= 0 → success
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    const rng = fixedRng([0.49]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('kept');
    expect(result.nextPhase).toBe('attaque');
  });

  it('devMode: logDev entries appear in logBuffer after phase', () => {
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    state.devMode = true;
    const rng = fixedRng([0.99]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
    // Pas de flushLogs → tout dans logBuffer
    expect(result.log.length).toBe(0);
    // logDev (debug) + log("cherche une ouverture") + log("") = 3 entrées dans logBuffer
    expect(result.logBuffer.length).toBe(3);
    expect(result.logBuffer[0].type).toBe('debug');
    expect(result.logBuffer[1].text).toContain('cherche une ouverture');
    expect(result.logBuffer[2].text).toBe('');
  });
});

describe('phaseRiposte', () => {
  it('DEF riposte succeeds and inverts roles', () => {
    // ATT is player, DEF is creature
    // rng returns 0.1 → d100 = 11
    // creature riposte = 50, quality = 50 - 11 - 0 = 39 >= 0 → success
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 0 });
    const rng = fixedRng([0.1]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('success');
    expect(result.attacker).toBe('creature'); // roles inverted (Swap)
    expect(result.nextPhase).toBe('attaque');
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.some(l => l.type === 'riposte' && l.text.includes('contre-attaque'))).toBe(true);
  });

  it('DEF riposte fails', () => {
    // ATT is player, DEF is creature
    // rng returns 0.99 → d100 = 100
    // creature riposte = 50, quality = 50 - 100 - 0 = -50 < 0 → fail
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 0 });
    const rng = fixedRng([0.99]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('fail');
    expect(result.attacker).toBe('player'); // roles NOT inverted
    expect(result.nextPhase).toBeNull();
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.some(l => l.type === 'riposte' && l.text.includes('rate'))).toBe(true);
  });

  it('uses player as DEF when creature is ATT', () => {
    // ATT is creature, DEF is player
    // rng returns 0.1 → d100 = 11
    // player riposte = 50, quality = 50 - 11 - 0 = 39 >= 0 → success
    const state = makeState({ attacker: 'creature' });
    state.player.effective.riposte = 50;
    state.player.fatigue = 0;
    const rng = fixedRng([0.1]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('success');
    expect(result.attacker).toBe('player'); // player takes over as ATT
    // Pas de flushLogs → entrées dans logBuffer
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.some(l => l.text.includes('Joueur'))).toBe(true);
  });

  it('fatigue affects riposte roll', () => {
    // ATT is player, DEF is creature
    // rng returns 0.3 → d100 = 31
    // creature riposte = 50, fatigue = 20, quality = 50 - 31 - 20 = -1 < 0 → fail
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 20 });
    const rng = fixedRng([0.3]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('fail');
    expect(result.attacker).toBe('player');
  });

  it('boundary: quality exactly 0 means success', () => {
    // creature riposte = 50, fatigue = 0, need d100 = 50
    // rng returns 0.49 → d100 = floor(0.49*100)+1 = 50
    // quality = 50 - 50 - 0 = 0 >= 0 → success
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 0 });
    const rng = fixedRng([0.49]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('success');
    expect(result.attacker).toBe('creature');
    expect(result.nextPhase).toBe('attaque');
  });
});
