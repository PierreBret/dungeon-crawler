/*
  SERVER/GAME/FORGE.JS
  Logique de calcul de fusion pour la forge.
  Toute la logique est côté serveur — le client envoie les IDs, reçoit le résultat.
*/

import { readFileSync }  from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(__dirname, "..", "data", filename), "utf8"));
}

const items  = loadJSON("items.json");
const armors = loadJSON("armors.json");

// Mapping slot → code d'armure dans armors.json
const slotToCode = { corps: "BO", tete: "HE", bras: "AR", jambes: "LE" };

/**
 * Retourne la définition d'un item par son code (cherche dans items puis armors).
 */
function getItemDef(code) {
  return items.find(i => i.code === code) ?? armors.find(a => a.code === code) ?? null;
}

// ─── Vérification de compatibilité ───────────────────────────────────────────

export function areCompatible(itemA, itemB) {
  if (itemA.itemType !== itemB.itemType) return false;
  if (itemA.itemType === "weapon") {
    return itemA.itemCode === itemB.itemCode;
  }
  if (itemA.itemType === "armor") {
    return itemA.slot === itemB.slot;
  }
  // shield : même type suffit
  return true;
}

// ─── Calcul du tier résultant — Armes ─────────────────────────────────────────

function computeWeaponTier(tierA, tierB, maxTier) {
  // Recettes valides : T(n) + T(n+1) = T(n+2)
  if (tierB - tierA === 1) {
    return Math.min(tierA + 2, maxTier);
  }
  if (tierA - tierB === 1) {
    return Math.min(tierB + 2, maxTier);
  }
  // Exception : T(max-1) + T(max-1) = T(max)
  if (tierA === maxTier - 1 && tierB === maxTier - 1) {
    return maxTier;
  }
  // Recette non définie
  return Math.min(Math.floor((tierA + tierB) / 2), maxTier);
}

// ─── Calcul du tier résultant — Armures et Boucliers ──────────────────────────

function computeArmorTier(tierA, tierB, maxTier) {
  // Recettes valides : T(n) + T(n+1) = T(n+2) jusqu'à T(maxTier-3)
  if (tierA + 1 === tierB && tierA + 2 <= maxTier - 2) {
    return Math.min(tierA + 2, maxTier);
  }
  if (tierB + 1 === tierA && tierB + 2 <= maxTier - 2) {
    return Math.min(tierB + 2, maxTier);
  }
  // T(maxTier-2) + T(maxTier-2) = T(maxTier-1)
  if (tierA === maxTier - 2 && tierB === maxTier - 2) {
    return maxTier - 1;
  }
  // T(maxTier-1) + T(maxTier-1) = T(maxTier)
  if (tierA === maxTier - 1 && tierB === maxTier - 1) {
    return maxTier;
  }
  // Recette non définie
  return Math.min(Math.floor((tierA + tierB) / 2), maxTier);
}

// ─── Calcul du matériau résultant ─────────────────────────────────────────────

function computeMaterial(matA, matB) {
  // Recettes valides (symétriques)
  const recipes = [
    [0, 1, 2],  // Bois + Cuivre = Étain
    [1, 2, 3],  // Cuivre + Étain = Bronze
    [2, 3, 4],  // Étain + Bronze = Fer
    [4, 4, 5],  // Fer + Fer = Fonte
    [5, 3, 6],  // Fonte + Bronze = Acier
    [6, 6, 7],  // Acier + Acier = Acier damascène
  ];

  for (const [a, b, result] of recipes) {
    if ((matA === a && matB === b) || (matA === b && matB === a)) {
      return result;
    }
  }

  // Recette non définie
  return Math.floor((matA + matB) / 2);
}

// ─── Calcul des affinités résultantes ─────────────────────────────────────────

function computeAffinities(affA, affB) {
  return {
    bestial:      Math.floor(((affA.bestial ?? 0) + (affB.bestial ?? 0)) / 2),
    elementaire:  Math.floor(((affA.elementaire ?? 0) + (affB.elementaire ?? 0)) / 2),
    gigante:      Math.floor(((affA.gigante ?? 0) + (affB.gigante ?? 0)) / 2),
    theriomorphe: Math.floor(((affA.theriomorphe ?? 0) + (affB.theriomorphe ?? 0)) / 2),
    reptilien:    Math.floor(((affA.reptilien ?? 0) + (affB.reptilien ?? 0)) / 2),
    eidolon:      Math.floor(((affA.eidolon ?? 0) + (affB.eidolon ?? 0)) / 2),
    primordial:   Math.floor(((affA.primordial ?? 0) + (affB.primordial ?? 0)) / 2),
  };
}

// ─── Prévisualisation de la fusion ────────────────────────────────────────────

export function computeFusionPreview(itemA, itemB) {
  if (!areCompatible(itemA, itemB)) {
    return { ok: false, error: "Fusion impossible" };
  }

  if (itemA.itemType === "weapon") {
    return computeWeaponFusion(itemA, itemB);
  }

  if (itemA.itemType === "armor") {
    return computeArmorFusion(itemA, itemB);
  }

  if (itemA.itemType === "shield") {
    return computeShieldFusion(itemA, itemB);
  }

  return { ok: false, error: "Type d'objet inconnu" };
}

// ─── Fusion d'armes ───────────────────────────────────────────────────────────

function computeWeaponFusion(itemA, itemB) {
  // Le résultat prend le type d'arme de l'objet A (premier sélectionné)
  const weaponDef = getItemDef(itemA.itemCode);
  if (!weaponDef) return { ok: false, error: `Arme inconnue: ${itemA.itemCode}` };

  const maxTier = weaponDef.models.length;
  const tierA   = itemA.tier ?? 1;
  const tierB   = itemB.tier ?? 1;

  const tierResult = computeWeaponTier(tierA, tierB, maxTier);

  const matA = itemA.material ?? 0;
  const matB = itemB.material ?? 0;
  const materialResult = computeMaterial(matA, matB);

  const affA = {
    bestial:      itemA.aff_bestial ?? 0,
    elementaire:  itemA.aff_elementaire ?? 0,
    gigante:      itemA.aff_gigante ?? 0,
    theriomorphe: itemA.aff_theriomorphe ?? 0,
    reptilien:    itemA.aff_reptilien ?? 0,
    eidolon:      itemA.aff_eidolon ?? 0,
    primordial:   itemA.aff_primordial ?? 0,
  };
  const affB = {
    bestial:      itemB.aff_bestial ?? 0,
    elementaire:  itemB.aff_elementaire ?? 0,
    gigante:      itemB.aff_gigante ?? 0,
    theriomorphe: itemB.aff_theriomorphe ?? 0,
    reptilien:    itemB.aff_reptilien ?? 0,
    eidolon:      itemB.aff_eidolon ?? 0,
    primordial:   itemB.aff_primordial ?? 0,
  };
  const affinitiesResult = computeAffinities(affA, affB);

  const modelName = weaponDef.models[tierResult - 1] ?? weaponDef.typeArme;

  return {
    ok: true,
    result: {
      itemType:   "weapon",
      itemCode:   itemA.itemCode,
      tier:       tierResult,
      material:   materialResult,
      affinities: affinitiesResult,
      name:       modelName
    }
  };
}

// ─── Fusion d'armures ─────────────────────────────────────────────────────────

function computeArmorFusion(itemA, itemB) {
  const tierA = itemA.tier ?? 1;
  const tierB = itemB.tier ?? 1;
  const slot  = itemA.slot;

  const code = slotToCode[slot];
  if (!code) return { ok: false, error: `Slot d'armure inconnu: ${slot}` };

  const def = getItemDef(code);
  const maxTier = def?.models.length ?? 16;
  const tierResult = computeArmorTier(tierA, tierB, maxTier);

  const name = def?.models[tierResult - 1] ?? `Armure T${tierResult}`;

  return {
    ok: true,
    result: {
      itemType: "armor",
      slot,
      tier:     tierResult,
      name
    }
  };
}

// ─── Fusion de boucliers ──────────────────────────────────────────────────────

function computeShieldFusion(itemA, itemB) {
  const tierA = itemA.tier ?? 1;
  const tierB = itemB.tier ?? 1;

  const def  = getItemDef(itemA.itemCode);
  const maxTier = def?.models.length ?? 6;
  const tierResult = computeArmorTier(tierA, tierB, maxTier);

  const name = def?.models[tierResult - 1] ?? `Bouclier T${tierResult}`;

  return {
    ok: true,
    result: {
      itemType:  "shield",
      itemCode:  itemA.itemCode,
      tier:      tierResult,
      name
    }
  };
}
