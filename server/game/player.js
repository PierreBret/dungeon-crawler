/*
  SERVER/GAME/PLAYER.JS
  Logique métier du joueur — côté serveur uniquement.
*/

// ─── Configuration ────────────────────────────────────────────────────────────

const STATS_CONFIG = {
  dice:        { count: 3, faces: 7 },
  total:       { min: 70, max: 70 },
  maxAttempts: 10000
};

// ─── Dés ──────────────────────────────────────────────────────────────────────
export function rollDie(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollDice(count, faces) {
  let total = 0;
  for (let i = 0; i < count; i++) total += rollDie(1, faces);
  return total;
}

// ─── Noms aléatoires ──────────────────────────────────────────────────────────

const PREFIXES = ["Ar","Ka","Vel","Mor","Al","Bel","Zar","Kor","Mal","Nor","Var","El","Tor","Sar","Mar","Leo","La","Pel","Par","Hei"];
const ROOTS    = ["drak","mor","thal","vorn","mion","kar","lith","dun","gar","kor","vel","zar","grim","nor","hal","thorg","ram","con","dig","nid","cif","dor","ric","end","ronim"];
const SUFFIXES = ["os","ion","ar","us","en","or","ith","ael","ius","ic","al","ir","iam","an","ath","as","ian","il"];

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function randomName() {
  const p = () => PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const r = () => ROOTS[Math.floor(Math.random() * ROOTS.length)];
  const s = () => SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const d4 = rollDie(1, 4);
  if (d4 === 1) return capitalize(p() + r());
  if (d4 === 2) return capitalize(r() + s());
  if (d4 === 3) return capitalize(p() + s());
  return capitalize(p() + r() + s());
}

// ─── Caractéristiques ─────────────────────────────────────────────────────────

function generateStatsRaw() {
  return {
    force:        rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    constitution: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    taille:       rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    intelligence: rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    volonté:      rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    vitesse:      rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces),
    adresse:      rollDice(STATS_CONFIG.dice.count, STATS_CONFIG.dice.faces)
  };
}

function isStatsValid(stats) {
  const total = Object.values(stats).reduce((sum, v) => sum + v, 0);
  return total >= STATS_CONFIG.total.min && total <= STATS_CONFIG.total.max;
}

export function generateStats() {
  for (let i = 0; i < STATS_CONFIG.maxAttempts; i++) {
    const stats = generateStatsRaw();
    if (isStatsValid(stats)) return stats;
  }
  console.warn("Stats hors contrainte après maxAttempts");
  return generateStatsRaw();
}

// ─── Position de départ ───────────────────────────────────────────────────────

export function getStartingPosition(dungeon) {
  const walkable = [];
  for (let y = 0; y < dungeon.length; y++)
    for (let x = 0; x < dungeon[y].length; x++)
      if (dungeon[y][x] === 0) walkable.push({ x, y });

  if (!walkable.length) return { x: 1, y: 1 };
  return walkable[Math.floor(Math.random() * walkable.length)];
}

// ─── Création du joueur ───────────────────────────────────────────────────────

export function createPlayer(candidate, dungeon) {
  const pos   = getStartingPosition(dungeon);
  const stats = candidate.stats ?? generateStats();

  // Formules définies dans le GAME_DESIGN
  const hp        = stats.constitution * 2 + stats.taille;
  const endurance = stats.constitution + stats.volonté;

  return {
    name:       candidate.name       ?? randomName(),
    avatarPath: candidate.avatarPath ?? null,

    stats: {
      force:        stats.force,
      constitution: stats.constitution,
      taille:       stats.taille,
      intelligence: stats.intelligence,
      volonté:      stats.volonté,
      vitesse:      stats.vitesse,
      adresse:      stats.adresse
    },

    position: {
      x: pos.x,
      y: pos.y
    },

    // Ressources de combat
    hp,
    hpMax:        hp,
    endurance,
    enduranceMax: endurance
  };
}

export function generateCandidate() {
  return {
    name:       randomName(),
    avatarPath: null,
    stats:      generateStats()
  };
}
