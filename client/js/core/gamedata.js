/*
  CLIENT/JS/CORE/GAMEDATA.JS

  Source de vérité côté client pour les données statiques.
  Chargé une seule fois au démarrage depuis l'API serveur.
  Ne jamais dupliquer ces données ailleurs dans le client.

  Usage :
    import { gameData, MATERIALS } from "./gameData.js";
    const weapon = gameData.weapons.find(w => w.code === "SH");
    const matName = MATERIALS[item.material];
*/

// Matériaux — liste fixe définie dans le GAME_DESIGN
export const MATERIALS = [
  "Bois",       // 0
  "Cuivre",     // 1
  "Étain",      // 2
  "Bronze",     // 3
  "Fer",        // 4
  "Fonte",      // 5
  "Acier",      // 6
  "Acier damascène" // 7
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