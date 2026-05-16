import { describe, it, expect } from 'vitest';
import { phaseInitiative, phaseRiposte } from '../combat.js';

/**
 * Unit tests for phaseInitiative and phaseRiposte
 *
 * Note: phaseInitiative appelle flushLogs() en cas de succès (les entrées vont dans state.log).
 * En cas d'échec, seul logDev est appelé (rien dans state.log en non-devMode, entrées dans logBuffer en devMode).
 *
 * phaseRiposte appelle flushLogs() en cas de succès (les entrées vont dans state.log).
 * En cas d'échec, log() est appelé mais pas flushLogs() (entrées dans logBuffer).
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
    riposteResult: null
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
    // flushLogs() est appelé → entrées dans state.log
    // log("enchaîne") + log("") = 2 entrées
    expect(result.log.length).toBe(2);
    expect(result.log[0].type).toBe('initiative');
    expect(result.log[0].text).toContain('enchaîne les attaques');
  });

  it('ATT loses initiative when roll fails (quality < 0)', () => {
    // rng returns 0.99 → d100 = floor(0.99*100)+1 = 100
    // quality = 50 - 100 - 0 = -50 < 0 → fail
    // Pseudo-code: only LogDev (no visible Log) when initiative fails
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    const rng = fixedRng([0.99]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
    expect(result.log.length).toBe(0); // no flushLogs called, logDev only
    expect(result.logBuffer.length).toBe(0); // devMode=false → nothing in buffer either
  });

  it('uses creature stats when creature is ATT', () => {
    // rng returns 0.1 → d100 = 11
    // creature initiative = 60, quality = 60 - 11 - 0 = 49 >= 0
    const state = makeState({ attacker: 'creature' });
    state.creature.effective.initiative = 60;
    const rng = fixedRng([0.1]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('kept');
    expect(result.log[0].text).toContain('Créature');
  });

  it('fatigue reduces quality and can cause failure', () => {
    // rng returns 0.3 → d100 = floor(0.3*100)+1 = 31
    // quality = 50 - 31 - 20 = -1 < 0 → fail (fatigue makes it fail)
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 20 });
    const rng = fixedRng([0.3]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
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
  });

  it('devMode: logDev entries appear in logBuffer when initiative fails', () => {
    const state = makeState({ attacker: 'player', playerInitiative: 50, playerFatigue: 0 });
    state.devMode = true;
    const rng = fixedRng([0.99]);

    const result = phaseInitiative(state, rng);

    expect(result.initiativeResult).toBe('lost');
    expect(result.log.length).toBe(0); // no flushLogs called
    expect(result.logBuffer.length).toBe(1); // logDev entry in buffer
    expect(result.logBuffer[0].type).toBe('debug');
  });
});

describe('phaseRiposte', () => {
  it('skips riposte when initiativeResult is not "lost"', () => {
    const state = makeState({ attacker: 'player' });
    state.initiativeResult = 'kept';
    const rng = fixedRng([0.5]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBeNull();
    expect(result.log.length).toBe(0);
    expect(result.logBuffer.length).toBe(0);
    expect(result.attacker).toBe('player');
  });

  it('DEF riposte succeeds and inverts roles', () => {
    // ATT is player, DEF is creature
    // rng returns 0.1 → d100 = 11
    // creature riposte = 50, quality = 50 - 11 - 0 = 39 >= 0 → success
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 0 });
    state.initiativeResult = 'lost';
    const rng = fixedRng([0.1]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('success');
    expect(result.attacker).toBe('creature'); // roles inverted
    // flushLogs() appelé → entrées dans state.log
    expect(result.log.some(l => l.type === 'riposte' && l.text.includes('contre-attaque'))).toBe(true);
  });

  it('DEF riposte fails and tempo ends', () => {
    // ATT is player, DEF is creature
    // rng returns 0.99 → d100 = 100
    // creature riposte = 50, quality = 50 - 100 - 0 = -50 < 0 → fail
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 0 });
    state.initiativeResult = 'lost';
    const rng = fixedRng([0.99]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('fail');
    expect(result.attacker).toBe('player'); // roles NOT inverted
    // Pas de flushLogs() → entrées dans logBuffer
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
    state.initiativeResult = 'lost';
    const rng = fixedRng([0.1]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('success');
    expect(result.attacker).toBe('player'); // player takes over as ATT
    expect(result.log.some(l => l.text.includes('Joueur'))).toBe(true);
  });

  it('fatigue affects riposte roll', () => {
    // ATT is player, DEF is creature
    // rng returns 0.3 → d100 = 31
    // creature riposte = 50, fatigue = 20, quality = 50 - 31 - 20 = -1 < 0 → fail
    const state = makeState({ attacker: 'player', creatureRiposte: 50, creatureFatigue: 20 });
    state.initiativeResult = 'lost';
    const rng = fixedRng([0.3]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBe('fail');
    expect(result.attacker).toBe('player');
  });

  it('does nothing when initiativeResult is null', () => {
    const state = makeState({ attacker: 'player' });
    state.initiativeResult = null;
    const rng = fixedRng([0.5]);

    const result = phaseRiposte(state, rng);

    expect(result.riposteResult).toBeNull();
    expect(result.log.length).toBe(0);
  });
});
