/*
  CLIENT/JS/CORE/DAMAGECALC.JS

  Calcul des dégâts d'une arme pour affichage dans l'équipement.
  Implémente la formule du GAME_DESIGN côté client (lecture seule).
  La résolution authoritative reste côté serveur.

  Usage :
    import { WeaponDamage } from "./damagecalc.js";
    const dmg = WeaponDamage(WEAPON);
*/

/**
 * WeaponDamage — retourne les dégâts de base selon le tier et le matériau de l'arme.
 * WEAPON.tier     : indice entre 1 et Longueur(WEAPON.models)
 * WEAPON.materiau : indice entre 1 et 8
 * WEAPON.models doit contenir au moins 2 éléments
 *
 * @param {object} WEAPON - {tier, materiau, models, damFirst, damLast}
 * @returns {number} Dégâts de base
 */
export function WeaponDamage(WEAPON) {
  if (!WEAPON) return 0;
  const NBRTIERS = WEAPON.models.length;
  if (NBRTIERS < 2) throw new Error(`WeaponDamage: l'arme doit avoir au moins 2 modèles (reçu: ${NBRTIERS})`);
  const MODMATERIEL = 1 + (WEAPON.materiau - 1) * 0.150;
  const DAMAGE = (WEAPON.damFirst + (WEAPON.tier - 1) * (WEAPON.damLast - WEAPON.damFirst) / (NBRTIERS - 1)) * MODMATERIEL;
  return Math.floor(DAMAGE);
}

/**
 * Traduit un damageType anglais en libellé français.
 *
 * @param {string} damageType — "Edged" | "Piercing" | "Blunt" | "Impact"
 * @returns {string}
 */
export function getDamageTypeLabel(damageType) {
  const labels = {
    Edged:   "Tranchant",
    Piercing: "Perçant",
    Blunt:   "Contondant",
    Impact:  "Écrasant"
  };
  const label = labels[damageType];
  if (!label) console.error(`getDamageTypeLabel: type inconnu "${damageType}"`);
  return label ?? damageType;
}

/**
 * Traduit un index d'affinité en libellé français.
 *
 * @param {string} key — clé d'affinité (aff_bestial, aff_elementaire, etc.)
 * @returns {string}
 */
export function getAffinityLabel(key) {
  const labels = {
    aff_bestial:     "Bestial",
    aff_elementaire: "Élémentaire",
    aff_feerique:    "Féérique",
    aff_demoniaque:  "Démoniaque",
    aff_undead:      "Mort-vivant",
    aff_reptilien:   "Reptilien"
  };
  const label = labels[key];
  if (!label) console.error(`getAffinityLabel: clé inconnue "${key}"`);
  return label ?? key;
}

// Clés d'affinité dans l'ordre d'affichage
export const AFFINITY_KEYS = [
  "aff_bestial",
  "aff_elementaire",
  "aff_feerique",
  "aff_demoniaque",
  "aff_undead",
  "aff_reptilien"
];
