/*
  SERVER/GAME/LOOT.JS
  Système de drop (butin) — logique unique pour combats et trésors.

  Principes :
  - Tiers = models : le tableau `models` de chaque item dans items.json représente ses tiers.
  - Drop pondéré : la probabilité de drop d'un type d'item est proportionnelle à models.length.
  - Pool unique : armes, boucliers et armures sont dans le même pool pondéré.
  - Séquence : 1) type d'item (pondéré) → 2) tier (uniforme) → 3) matériau (indépendant du tier).
  - Matériau indépendant du tier.
*/

import { rollDie } from "./player.js";

// ─── Codes des armures (pour distinguer arme/bouclier vs armure) ──────────────
const ARMOR_CODES = ["BO", "HE", "AR", "LE"];

// ─── Mapping code armure → slot ───────────────────────────────────────────────
const ARMOR_SLOT_MAP = {
  BO: "corps",
  HE: "tete",
  AR: "bras",
  LE: "jambes"
};

/**
 * Construit la table de drop pondérée à partir de items.json.
 * Appelé une seule fois au démarrage du serveur.
 *
 * Chaque entrée dans la table a un poids = models.length.
 * Le total des poids sert de plafond pour le tirage.
 *
 * @param {Array} items - Tableau complet de items.json
 * @returns {{ entries: Array, totalWeight: number }}
 */
export function buildDropTable(items) {
  if (!items || !Array.isArray(items)) {
    throw new Error("buildDropTable: items manquant ou invalide");
  }

  const entries = [];
  let totalWeight = 0;

  for (const item of items) {
    if (item.natural) continue;    // Armes naturelles (monstres) = jamais droppables
    const tierCount = item.models ? item.models.length : 0;
    if (tierCount === 0) continue; // Pas de models = pas droppable

    entries.push({
      code:       item.code,
      isArmor:    ARMOR_CODES.includes(item.code),
      slot:       ARMOR_SLOT_MAP[item.code] ?? null,
      tierCount:  tierCount,
      weight:     tierCount
    });
    totalWeight += tierCount;
  }

  return { entries, totalWeight };
}

/**
 * Génère un drop aléatoire selon la table pondérée.
 *
 * @param {{ entries: Array, totalWeight: number }} dropTable - Table construite par buildDropTable
 * @returns {{ itemType: string, itemCode: string, slot: string|null, tier: number, material: number, affinities: object }}
 */
export function generateDrop(dropTable) {
  if (!dropTable || !dropTable.entries || !dropTable.totalWeight) {
    throw new Error("generateDrop: dropTable manquant ou invalide");
  }

  // 1) Tirage du type d'item (pondéré par nombre de tiers)
  const roll = rollDie(0, dropTable.totalWeight - 1);
  let cumulative = 0;
  let selected = null;

  for (const entry of dropTable.entries) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      selected = entry;
      break;
    }
  }

  // Sécurité (ne devrait jamais arriver)
  if (!selected) {
    console.error("generateDrop: aucun item sélectionné, roll =", roll);
    selected = dropTable.entries[dropTable.entries.length - 1];
  }

  // 2) Tirage du tier (uniforme entre 1 et tierCount)
  const tier = rollDie(1, selected.tierCount);

  // 3) Tirage du matériau (indépendant du tier)
  //    Pour les armures : matériau = 0 (pas de matériau)
  //    Pour les armes/boucliers : tirage entre 0 et 1 (à ajuster selon progression future)
  const material = selected.isArmor ? 0 : rollDie(0, 1);

  // 4) Construction de l'objet drop
  const drop = {
    itemType:   selected.isArmor ? "armor" : "weapon",
    itemCode:   selected.code,
    tier:       tier,
    material:   material,
    affinities: { bestial: 0, elementaire: 0, feerique: 0, demoniaque: 0, undead: 0, reptilien: 0 }
  };

  // Ajout du slot pour les armures
  if (selected.isArmor) {
    drop.slot = selected.slot;
  }

  return drop;
}
