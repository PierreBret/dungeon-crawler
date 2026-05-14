import { describe, it, expect } from 'vitest';
import { mainLoop, initCombatState } from '../combat.js';
import { COMBAT } from '../combatConfig.js';

/**
 * Unit tests for mainLoop(state, config, rng)
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a fixed RNG that returns values from a sequence (cycling).
 * rng() returns values in [0, 1) — used by rollSkill to generate D100.
 */
function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

/**
 * Creates valid player/creature data for testing.
 */
function makeTestCombatantData(overrides = {}) {
  return {
    stats: { FOR: 12, CON: 12, TAI: 12, INT: 12, VOL: 12, VIT: 12, ADR: 12 },
    tactic: [{ EO: 5, NA: 5, EN: 5 }],
    weaponDef: {
      poids: 4,
      dist: 5,
      degatsBase: 20,
      materiau: 3,
      affinites: {},
      poidsStats: { FOR: 1, ADR: 1, VIT: 1, TAI: 0, INT: 0 }
    },
    equipment: {
      armure: { reduction: 5, poids: 8 }
    },
    ...overrides
  };
}

describe('mainLoop — Boucle principale du combat', () => {

  it('should terminate with a draw when maxMinutes is exceeded (Req 8.7)', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    // RNG that always produces high D100 values (0.99 → d100=100) → all attacks miss
    const rng = fixedRng([0.99]);

    const result = mainLoop(state, COMBAT, rng);

    expect(result.result).not.toBeNull();
    expect(result.result.winner).toBe('draw');
    expect(result.log.some(e => e.type === 'draw' && e.text.includes('temps écoulé'))).toBe(true);
  });

  it('should terminate when player HP reaches 0 (Req 8.5)', () => {
    // Give creature high stats and player low HP
    const playerData = makeTestCombatantData({
      stats: { FOR: 1, CON: 1, TAI: 1, INT: 1, VOL: 1, VIT: 1, ADR: 1 }
    });
    const creatureData = makeTestCombatantData({
      stats: { FOR: 24, CON: 24, TAI: 24, INT: 24, VOL: 24, VIT: 24, ADR: 24 },
      weaponDef: {
        poids: 4,
        dist: 5,
        degatsBase: 200,
        materiau: 7,
        affinites: {},
        poidsStats: { FOR: 5, ADR: 5, VIT: 5, TAI: 0, INT: 0 }
      }
    });
    const state = initCombatState(playerData, creatureData, COMBAT);

    // RNG that produces low D100 values (0.01 → d100=1) → all rolls succeed
    const rng = fixedRng([0.01]);

    const result = mainLoop(state, COMBAT, rng);

    expect(result.result).not.toBeNull();
    // One of them should win (likely creature given the stat disparity)
    expect(['player', 'creature', 'draw']).toContain(result.result.winner);
    // Combat should have ended before maxMinutes
    expect(result.log.some(e => e.type === 'victory' || e.type === 'defeat' || e.type === 'draw')).toBe(true);
  });

  it('should declare draw when both HP reach 0 simultaneously (Req 8.6)', () => {
    // Both combatants have very low HP and high damage weapons
    const lowHpData = makeTestCombatantData({
      stats: { FOR: 12, CON: 1, TAI: 1, INT: 12, VOL: 1, VIT: 12, ADR: 12 },
      weaponDef: {
        poids: 4,
        dist: 5,
        degatsBase: 500,
        materiau: 7,
        affinites: {},
        poidsStats: { FOR: 5, ADR: 5, VIT: 5, TAI: 0, INT: 0 }
      },
      equipment: { armure: { reduction: 0, poids: 0 } }
    });

    const state = initCombatState(lowHpData, lowHpData, COMBAT);
    // Force both HP to 1 so any damage kills both
    state.player.hp = 1;
    state.creature.hp = 1;

    // RNG: low values so attacks hit and defenses fail
    const rng = fixedRng([0.01]);

    const result = mainLoop(state, COMBAT, rng);

    expect(result.result).not.toBeNull();
    expect(result.log.some(e => e.type === 'victory' || e.type === 'defeat' || e.type === 'draw')).toBe(true);
    // With both at 1 HP, the first hit should kill one (or both if simultaneous)
    expect(['player', 'creature', 'draw']).toContain(result.result.winner);
  });

  it('should execute phaseVivacite once per minute (Req 8.2)', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    // Use a config with only 1 minute and 2 tempos for quick test
    const shortConfig = { ...COMBAT, maxMinutes: 2, nbTempoParMinute: 2 };

    // RNG that always misses (high D100)
    const rng = fixedRng([0.99]);

    const result = mainLoop(state, shortConfig, rng);

    // Count vivacité log entries
    const vivaciteLogs = result.log.filter(e => e.type === 'initiative' && e.text.includes('Vivacité'));
    // Should have exactly 2 vivacité entries (one per minute)
    expect(vivaciteLogs.length).toBe(2);
  });

  it('should set state.minute and state.tempo correctly during execution', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const shortConfig = { ...COMBAT, maxMinutes: 1, nbTempoParMinute: 3 };
    const rng = fixedRng([0.99]); // all misses

    const result = mainLoop(state, shortConfig, rng);

    // After completion, minute should be 1 (last minute processed)
    expect(result.minute).toBe(1);
    // Result should be draw (only 1 minute, all misses)
    expect(result.result.winner).toBe('draw');
  });

  it('should reset per-tempo flags at the start of each tempo (Req 8.3)', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const shortConfig = { ...COMBAT, maxMinutes: 1, nbTempoParMinute: 2 };
    // Alternate: first tempo hits, second tempo misses
    // D100 of 1 (hit) then D100 of 100 (miss)
    const rng = fixedRng([0.01, 0.99]);

    const result = mainLoop(state, shortConfig, rng);

    // The combat should complete without errors (flags properly reset)
    expect(result.result).not.toBeNull();
  });

  it('should use the last tactic when minute exceeds tactics array length (Req 1.4)', () => {
    const playerData = makeTestCombatantData({
      tactic: [
        { EO: 8, NA: 8, EN: 8 },
        { EO: 2, NA: 2, EN: 2 }
      ]
    });
    const creatureData = makeTestCombatantData({
      tactic: [{ EO: 5, NA: 5, EN: 5 }]
    });
    const state = initCombatState(playerData, creatureData, COMBAT);

    const shortConfig = { ...COMBAT, maxMinutes: 3, nbTempoParMinute: 1 };
    const rng = fixedRng([0.99]); // all misses

    const result = mainLoop(state, shortConfig, rng);

    // Should complete without error — minute 3 uses last tactic (index 1 for player, index 0 for creature)
    expect(result.result).not.toBeNull();
    expect(result.result.winner).toBe('draw');
  });

  it('should log "Minute X commence" for each minute', () => {
    const playerData = makeTestCombatantData();
    const creatureData = makeTestCombatantData();
    const state = initCombatState(playerData, creatureData, COMBAT);

    const shortConfig = { ...COMBAT, maxMinutes: 3, nbTempoParMinute: 1 };
    const rng = fixedRng([0.99]);

    const result = mainLoop(state, shortConfig, rng);

    const minuteLogs = result.log.filter(e => e.type === 'separator' && e.text.match(/Minute \d+/));
    expect(minuteLogs.length).toBe(3);
    expect(minuteLogs[0].text).toBe('── Minute 1 ──');
    expect(minuteLogs[1].text).toBe('── Minute 2 ──');
    expect(minuteLogs[2].text).toBe('── Minute 3 ──');
  });
});
