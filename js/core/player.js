/*
  PLAYER.JS

  Logique métier du joueur.
  Indépendant de l'affichage, ce module gère tout ce qui concerne le joueur.

  Rôle :
  - Création du joueur
  - Gestion des déplacements
  - Stockage des stats (HP, attaque, etc.)
*/

const prefixes = [
  "Ar", "Ka", "Vel", "Mor", "Al", "Bel", "Zar", "Kor",
  "Mal", "Nor", "Var", "El", "Tor", "Sar", "Mar", "Leo",
  "La", "El", "Pel", "Par", "An", "Hei"
];

const roots = [
  "drak", "mor", "thal", "vorn", "mion", "kar", "lith", "dun",
  "gar", "kor", "vel", "zar", "grim", "nor", "hal", "thorg",
  "ram", "con", "dig", "nid", "cif", "dor", "ric", "end",
  "ronim"
];

const suffixes = [
  "os", "ion", "ar", "us", "en", "or", "ith", "ael",
  "ius", "ic", "al", "ir", "iam", "an", "ath", "as", 
  "ian", "il"
];

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRandomName(size = 2) {
  if (size === 1) {
    const r = roots[Math.floor(Math.random() * roots.length)];
    return capitalize(r);
  }

  if (size === 2) {
    const usePatternA = Math.random() < 0.5;

    if (usePatternA) {
      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
      const r = roots[Math.floor(Math.random() * roots.length)];
      return capitalize(p + r);
    } else {
      const r = roots[Math.floor(Math.random() * roots.length)];
      const s = suffixes[Math.floor(Math.random() * suffixes.length)];
      return capitalize(r + s);
    }
  }

  // size >= 3 (par défaut)
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const r = roots[Math.floor(Math.random() * roots.length)];
  const s = suffixes[Math.floor(Math.random() * suffixes.length)];
  return capitalize(p + r + s);
}

export function getStartingPosition(dungeon) {
  if (!dungeon) {
    return { x: 1, y: 1 };
  }

  const walkableTiles = [];

  for (let y = 0; y < dungeon.length; y++) {
    for (let x = 0; x < dungeon[y].length; x++) {
      if (dungeon[y][x] === 0) {
        walkableTiles.push({ x, y });
      }
    }
  }

  if (walkableTiles.length === 0) {
    return { x: 1, y: 1 };
  }

  return walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
}

export function createPlayer(dungeon) {
  const size = Math.floor(Math.random() * 2) + 2; // 2 ou 3
  const position = getStartingPosition(dungeon);

  return {
    name: getRandomName(size),
    ...position
  };
}

export function movePlayer(player, dx, dy, dungeon) {
  const newX = player.x + dx;
  const newY = player.y + dy;

  if (dungeon[newY][newX] === 0) {
    player.x = newX;
    player.y = newY;
  }
}
