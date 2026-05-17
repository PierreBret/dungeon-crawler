/*
  CLIENT/JS/CORE/GAMEDATA.JS

  Source de vérité côté client pour les données dynamiques.
  Chargé une seule fois au démarrage depuis l'API serveur.
  Ne jamais dupliquer ces données ailleurs dans le client.

  Usage :
    import { gameData, getItemDef, getArmorName, getShieldName } from "./gameData.js";
    const weapon = gameData.weapons.find(w => w.code === "SH");
    const armorName = getArmorName("corps", 3); // → "Padded Leather"
*/

// Mapping slot → code d'item dans items.json
const slotToCode = { corps: "BO", tete: "HE", bras: "AR", jambes: "LE" };

export const gameData = {
  items:    [],
  weapons:  [],
  bestiary: []
};

/**
 * Retourne la définition d'un item par son code.
 */
export function getItemDef(code) {
  return gameData.items.find(i => i.code === code) ?? null;
}

/**
 * Retourne le nom d'une armure à partir de son slot et tier.
 */
export function getArmorName(slot, tier) {
  const code = slotToCode[slot];
  if (!code) return null;
  const def = getItemDef(code);
  return def?.models[(tier ?? 1) - 1] ?? null;
}

/**
 * Retourne le nom d'un bouclier à partir de son itemCode et tier.
 */
export function getShieldName(itemCode, tier) {
  const def = getItemDef(itemCode);
  return def?.models[(tier ?? 1) - 1] ?? null;
}

export async function loadGameData() {
  const [items, bestiary] = await Promise.all([
    fetch("/api/data/items").then(r    => r.json()),
    fetch("/api/data/bestiary").then(r => r.json())
  ]);

  gameData.items = items;

  // Armes + boucliers (tout sauf les armures BO/HE/AR/LE)
  const armorCodes = ["BO", "HE", "AR", "LE"];
  gameData.weapons = items.filter(i => !armorCodes.includes(i.code));

  gameData.bestiary = bestiary;

  console.log("[gameData] Données statiques chargées");
}
