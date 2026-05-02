/*
  CLIENT/JS/CORE/GAMEDATA.JS

  Source de vérité côté client pour les données statiques.
  Chargé une seule fois au démarrage depuis l'API serveur.
  Ne jamais dupliquer ces données ailleurs dans le client.

  Usage :
    import { gameData, MATERIALS, getMaterialMod } from "./gameData.js";
    const weapon  = gameData.weapons.find(w => w.code === "SH");
    const matName = MATERIALS[item.material].name;
    const modMat  = MATERIALS[item.material].modMat;
*/

// Matériaux — index = valeur stockée en BDD (0-7)
export const MATERIALS = [
  { name: "Bois",             modMat: 1.000 },  // 0
  { name: "Cuivre",           modMat: 1.250 },  // 1
  { name: "Étain",            modMat: 1.375 },  // 2
  { name: "Bronze",           modMat: 1.500 },  // 3
  { name: "Fer",              modMat: 1.625 },  // 4
  { name: "Fonte",            modMat: 1.750 },  // 5
  { name: "Acier",            modMat: 1.875 },  // 6
  { name: "Acier damascène",  modMat: 2.000 },  // 7
];

export const gameData = {
  weapons:  [],
  armors:   {},
  shields:  [],
  bestiary: []
};

export async function loadGameData() {
  const [weapons, armors, shields, bestiary] = await Promise.all([
    fetch("/api/data/weapons").then(r  => r.json()),
    fetch("/api/data/armors").then(r   => r.json()),
    fetch("/api/data/shields").then(r  => r.json()),
    fetch("/api/data/bestiary").then(r => r.json())
  ]);

  gameData.weapons  = weapons;
  gameData.armors   = armors;
  gameData.shields  = shields;
  gameData.bestiary = bestiary;

  console.log("[gameData] Données statiques chargées");
}