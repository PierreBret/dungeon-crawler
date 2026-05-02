/*
  CLIENT/JS/CORE/DAMAGECALC.JS

  Calcul des dégâts d'une arme pour affichage dans l'inventaire/équipement.
  Implémente la formule du GAME_DESIGN côté client (lecture seule).
  La résolution authoritative reste côté serveur.

  Formule :
    dégâts = baseArme × modMatériau × coefStats
    (modAffinité et modTypeDégâts dépendent de l'adversaire — exclus ici)

  Usage :
    import { computeWeaponDamage } from "./damageCalc.js";
    const dmg = computeWeaponDamage(item, weaponDef, material, playerStats);
*/

/**
 * Calcule les dégâts de base d'une arme sans modificateurs adversaire.
 *
 * @param {object} item        — item inventaire (tier, material, affinités)
 * @param {object} weaponDef   — définition arme depuis weapons.json
 * @param {object} material    — entrée MATERIALS[item.material] ({ name, modMat })
 * @param {object} playerStats — stats du joueur ({ force, taille, intelligence, vitesse, adresse })
 * @returns {number} dégâts arrondis au sol (Math.floor)
 */
export function computeWeaponDamage(item, weaponDef, material, playerStats) {
  if (!item)        throw new Error("computeWeaponDamage: item manquant");
  if (!weaponDef)   throw new Error("computeWeaponDamage: weaponDef manquant");
  if (!material)    throw new Error("computeWeaponDamage: material manquant");
  if (!playerStats) throw new Error("computeWeaponDamage: playerStats manquant");

  // ─── baseArme ─────────────────────────────────────────────────────────────
  // nbTiers déduit du nombre de modèles
  const nbTiers  = weaponDef.models?.length ?? 1;
  const tier     = item.tier ?? 1;
  const baseArme = weaponDef.damFirst +
    (weaponDef.damLast - weaponDef.damFirst) * (tier - 1) / Math.max(nbTiers - 1, 1);

  // ─── modMatériau ──────────────────────────────────────────────────────────
  const modMat = material.modMat ?? 1.0;

  // ─── coefStats ────────────────────────────────────────────────────────────
  // Formule GAME_DESIGN — influence modérée (plage 0.8 → 1.2)
  const { force, taille, intelligence, vitesse, adresse } = playerStats;
  const coefStats = 1
    + (force        - 12) * 0.02 * (weaponDef.weightFO ?? 0)
    + (taille       - 12) * 0.02 * (weaponDef.weightTA ?? 0)
    + (intelligence - 12) * 0.02 * (weaponDef.weightIN ?? 0)
    + (vitesse      - 12) * 0.02 * (weaponDef.weightVI ?? 0)
    + (adresse      - 12) * 0.02 * (weaponDef.weightAD ?? 0);

  const dmg = baseArme * modMat * coefStats;
  return Math.floor(dmg);
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
