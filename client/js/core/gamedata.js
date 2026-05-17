/*
  CLIENT/JS/CORE/GAMEDATA.JS

  Source de vérité côté client pour les données dynamiques.
  Chargé une seule fois au démarrage depuis l'API serveur.
  Ne jamais dupliquer ces données ailleurs dans le client.

  Usage :
    import { gameData } from "./gameData.js";
    const weapon = gameData.weapons.find(w => w.code === "SH");
*/

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