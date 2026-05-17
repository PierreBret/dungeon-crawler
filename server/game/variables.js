/*
  SERVER/GAME/VARIABLES.JS
  Variables globales du jeu — fichier unique de configuration.
*/

// ─── Mode développement ───────────────────────────────────────────────────────
export const DEV_MODE = false;

// ─── Configuration du combat ──────────────────────────────────────────────────
export const COMBAT = {
  // ─── Variables configurables (pseudo-code) ──────────────────────────────────
  nbTempoParMinute: 20,       // NBTEMPOPARMMINUTE
  distanceInitiale: 10,       // DISTANCE
  alternance: 30,             // Alternance
  seuilEndurance1: 40,        // seuilEndurance1
  seuilEndurance2: 30,        // seuilEndurance2
  seuilEndurance3: 20,        // seuilEndurance3
  seuilEndurance4: 10,        // seuilEndurance4

  // ─── Sécurité boucle principale ────────────────────────────────────────────
  maxMinutes: 20,             // Nombre max de minutes avant match nul

  // ─── Compétences dérivées — coefficients ────────────────────────────────────
  skills: {
    vivacite:   { TAI: 6, INT: 12, VIT: 7, ADR: 8 },
    initiative: { INT: 4, VOL: 6, VIT: 9 },
    attaque:    { FOR: 6, INT: 10, VOL: 6, ADR: 10 },
    parade:     { FOR: 6, VOL: 6, ADR: 10, TAI_INV: 6 },
    esquive:    { INT: 10, VOL: 6, VIT: 5, ADR: 10, TAI_INV: 6 },
    riposte:    { INT: 6, VIT: 10, ADR: 10 }
  },

  // ─── Normalisation — multiplicateurs par compétence ─────────────────────────
  normalization: {
    vivacite: 100,
    initiative: 100,
    attaque: 90,
    esquive: 30,
    parade: 30,
    riposte: 30
  },
  percentMin: 12,
  percentMax: 87,
  effectiveMin: 1,
  effectiveMax: 99,

  // ─── Ajustements tactiques ──────────────────────────────────────────────────
  tacticNeutral: 5,

  // ─── HP et Endurance ────────────────────────────────────────────────────────
  hpFormula: { CON: 19, TAI: 5, VOL: 2, divisor: 4 },
  endFormula: { multiplier: 3 },

  // ─── Endurance — coûts et récupération ──────────────────────────────────────
  gainRecuperation: 1,
  surcoutDiviseur: 26,
  surcoutMultiplier: 10,

  // ─── Matériaux — noms par index (materiau 1-8 → index 0-7) ─────────────────
  materials: ["Bois", "Cuivre", "Étain", "Bronze", "Fer", "Fonte", "Acier", "Acier damascène"]
};
