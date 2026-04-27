/*
  PLAYER.JS

  Logique métier du joueur.
  Indépendant de l'affichage, ce module gère tout ce qui concerne le joueur.

  Rôle :
  - Création du joueur
  - Gestion des déplacements
  - Stockage des stats (HP, attaque, etc.)
*/

const STATS_CONFIG = {
  dice: {
    count: 3,
    faces: 7
  },
  total: {
    min: 77,
    max: 91
  },
  maxAttempts: 1000 // sécurité anti boucle infinie
};

function getDiceRoll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDice(count, faces) {
  let total = 0;

  for (let i = 0; i < count; i++) {
    total += getDiceRoll(1, faces);
  }

  return total;
}

function getRandomName() {

  const prefixes = [
    "Ar", "Ka", "Vel", "Mor", "Al", "Bel", "Zar", "Kor",
    "Mal", "Nor", "Var", "El", "Tor", "Sar", "Mar", "Leo",
    "La", "El", "Pel", "Par", "Hei"
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

  const d4 = getDiceRoll(1, 4);

  const p = () => prefixes[Math.floor(Math.random() * prefixes.length)];
  const r = () => roots[Math.floor(Math.random() * roots.length)];
  const s = () => suffixes[Math.floor(Math.random() * suffixes.length)];

  if (d4 === 1) return capitalize(p() + r());
  if (d4 === 2) return capitalize(r() + s());
  if (d4 === 3) return capitalize(p() + s());
  if (d4 === 4) return capitalize(p() + r() + s());
}

import { getRandomAvatarPaths } from "./assets.js";

function generateStatsRaw() {
  return {
    force: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    constitution: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    taille: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    intelligence: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    volonté: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    vitesse: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    adresse: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces)
  };
}

function isStatsValid(stats) {
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);

  return (
    total >= STATS_CONFIG.total.min &&
    total <= STATS_CONFIG.total.max
  );
}

function generateStats() {
  let attempts = 0;

  while (attempts < STATS_CONFIG.maxAttempts) {
    const stats = generateStatsRaw();
    if (isStatsValid(stats)) {
      return stats;
    }
    attempts++;
  }

  // fallback (important pour robustesse)
  console.warn("Stats générées hors contrainte après maxAttempts");

  return generateStatsRaw();
}

function generateRandomCandidate() {
  return {
    name: getRandomName(),
    avatarPath: null,
    stats: generateStats()
  };
}

export function generateCandidates(n) {
  const candidates = [];

  // on récupère N avatars uniques
  const avatarPaths = getRandomAvatarPaths(n);

  for (let i = 0; i < n; i++) {
    const candidate = generateRandomCandidate();

    // on assigne l’avatar
    candidate.avatarPath = avatarPaths[i];

    candidates.push(candidate);
  }

  return candidates;
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

export function createPlayer(candidate, dungeon) {
  const position = getStartingPosition(dungeon);

  return {
    ...candidate, // 🔥 on garde stats + nom
    x: position.x,
    y: position.y
  };
}

export function movePlayer(player, dungeon, dx, dy) {
  const newX = player.x + dx;
  const newY = player.y + dy;

  // sécurité limites
  if (
    newY < 0 ||
    newY >= dungeon.length ||
    newX < 0 ||
    newX >= dungeon[0].length
  ) {
    return;
  }

  // collision
  if (dungeon[newY][newX] === 0) {
    player.x = newX;
    player.y = newY;
  }
}
