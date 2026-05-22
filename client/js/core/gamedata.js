/*
  CLIENT/JS/CORE/GAMEDATA.JS

  Source de vérité côté client pour les données dynamiques.
  Chargé une seule fois au démarrage depuis l'API serveur.
  Ne jamais dupliquer ces données ailleurs dans le client.

  Usage :
    import { gameData, getItemDef, getArmorName, getArmorImagePath, getWeaponImagePath, getShieldName } from "./gameData.js";
    const weapon = gameData.weapons.find(w => w.code === "SH");
    const armorName = getArmorName("corps", 3); // → "Padded Leather"
    const imgPath = getArmorImagePath("corps", 3); // → "Armors/Armor/reinforced-leather-vest.png"
    const weaponImg = getWeaponImagePath("DA", 2); // → "steel-dagger.png"
*/

// Mapping slot → code d'item dans items.json
const slotToCode = { corps: "BO", tete: "HE", bras: "AR", jambes: "LE" };

export const gameData = {
  items:    [],
  weapons:  [],
  armors:   [],
  bestiary: []
};

/**
 * Retourne la définition d'un item par son code.
 */
export function getItemDef(code) {
  return gameData.items.find(i => i.code === code) ?? null;
}

/**
 * Retourne la définition d'armure par slot (depuis armors.json).
 */
export function getArmorDef(slot) {
  return gameData.armors.find(function findBySlot(a) { return a.slot === slot; }) ?? null;
}

/**
 * Retourne le nom d'une armure à partir de son slot et tier.
 */
export function getArmorName(slot, tier) {
  const def = getArmorDef(slot);
  if (!def) return null;
  return def.models[(tier ?? 1) - 1] ?? null;
}

/**
 * Retourne le chemin relatif de l'image d'une armure (depuis /assets/).
 * Ex: "Armors/Armor/chainmail-tunic.png"
 * Fallback : si pas d'image pour ce tier, utilise la dernière image disponible.
 */
export function getArmorImagePath(slot, tier) {
  const def = getArmorDef(slot);
  if (!def) return null;
  const image = def.images[(tier ?? 1) - 1];
  if (image) return `${def.imageDir}/${image}`;
  const lastImage = getLastDefinedImage(def.images);
  if (!lastImage) return null;
  return `${def.imageDir}/${lastImage}`;
}

/**
 * Retourne le chemin relatif de l'image d'une arme/bouclier (depuis /assets/weapons/).
 * Ex: "hunting-dagger.png" ou "Shields/steel-boss-round-shield.png"
 * Fallback : si pas d'image pour ce tier, utilise la dernière image disponible.
 */
export function getWeaponImagePath(itemCode, tier) {
  const def = gameData.weapons.find(function findByCode(w) { return w.code === itemCode; });
  if (!def) return null;
  const image = def.images?.[(tier ?? 1) - 1];
  if (image) return image;
  return getLastDefinedImage(def.images) ?? null;
}

/**
 * Retourne la dernière image non-null d'un tableau d'images.
 */
function getLastDefinedImage(images) {
  if (!images) return null;
  for (let i = images.length - 1; i >= 0; i--) {
    if (images[i]) return images[i];
  }
  return null;
}

/**
 * Retourne le nom d'un bouclier à partir de son itemCode et tier.
 */
export function getShieldName(itemCode, tier) {
  const def = getItemDef(itemCode);
  return def?.models[(tier ?? 1) - 1] ?? null;
}

export async function loadGameData() {
  const [items, armors, bestiary] = await Promise.all([
    fetch("/api/data/items").then(r    => r.json()),
    fetch("/api/data/armors").then(r   => r.json()),
    fetch("/api/data/bestiary").then(r => r.json())
  ]);

  gameData.items = items;
  gameData.armors = armors;

  // Armes + boucliers (tout sauf les armures BO/HE/AR/LE)
  const armorCodes = ["BO", "HE", "AR", "LE"];
  gameData.weapons = items.filter(i => !armorCodes.includes(i.code));

  gameData.bestiary = bestiary;

  console.log("[gameData] Données statiques chargées");
}
