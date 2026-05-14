/**
 * COMBAT CONFIG — Configuration externalisée du moteur de combat.
 *
 * Toutes les constantes, formules et tables utilisées par le système de combat
 * sont centralisées ici. Modifier ces valeurs pour ajuster l'équilibrage
 * sans toucher à la logique de combat.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

export const COMBAT = {
  // ─── Boucle principale ──────────────────────────────────────────────────────
  nbTempoParMinute: 20,       // Tempos (échanges) par minute
  maxMinutes: 20,             // Nombre max de minutes avant match nul
  distanceInitiale: 10,       // Distance de départ entre combattants
  distanceMin: 1,             // Distance minimale
  distanceMax: 10,            // Distance maximale
  alternance: 30,             // Bonus de vivacité pour le non-ATT (alternance)

  // ─── Phases (séquence configurable) ─────────────────────────────────────────
  phases: ['attaque', 'defense', 'resolutionDegats', 'initiative', 'riposte'],

  // ─── Compétences dérivées — coefficients ────────────────────────────────────
  skills: {
    vivacite:   { TAI: 6, INT: 12, VIT: 7, ADR: 8 },
    initiative: { INT: 4, VOL: 6, VIT: 9 },
    attaque:    { FOR: 6, INT: 10, VOL: 6, ADR: 10 },
    parade:     { FOR: 6, VOL: 6, ADR: 10, TAI_INV: 6 },   // (24-TAI)×6
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

  // ─── Ajustements tactiques — formules ───────────────────────────────────────
  tacticalAdjustments: {
    vivacite:   { EO: 2, NA: 1 },           // (EO-5)×2 + (NA-5)×1
    initiative: { EO: 1, NA: 1, EN: 1 },    // (EO-5) + (NA-5) + (EN-5)
    attaque:    { EO: 1, distFactor: 2 },    // (EO-5) + (5-|dist|)×2
    esquive:    { EO: -1, NA: 1, EN: -1 },   // (5-EO) + (NA-5) + (5-EN)
    parade:     { EO: -1, NA: -1, EN: -1 },  // (5-EO) + (5-NA) + (5-EN)
    riposte:    { EO: -1, NA: -1, EN: 2 }    // (5-EO) + (5-NA) + (EN-5)×2
  },
  tacticNeutral: 5,

  // ─── HP et Endurance ────────────────────────────────────────────────────────
  hpFormula: { CON: 19, TAI: 5, VOL: 2, divisor: 3 },
  endFormula: { multiplier: 3 },  // (FOR + CON + VOL) × 3

  // ─── Fatigue — seuils d'endurance ─────────────────────────────────────────────
  seuilEndurance1: 40,
  seuilEndurance2: 30,
  seuilEndurance3: 20,
  seuilEndurance4: 10,

  // ─── Endurance — coûts et récupération ──────────────────────────────────────
  gainRecuperation: 1,
  surcoutDiviseur: 26,
  surcoutMultiplier: 10
};
