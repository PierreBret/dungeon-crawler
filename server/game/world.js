/*
  SERVER/GAME/WORLD.JS
  Génération du donjon, déplacements, collisions, déplacement des créatures.
*/

import { DUNGEON_CONFIG } from "../config.js";

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getWalkableTiles(grid) {
  const tiles = [];
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      if (grid[y][x] === 0) tiles.push({ x, y });
    }
  }
  return tiles;
}

// ─── Anti grandes salles ──────────────────────────────────────────────────────

function canCarveWithoutLargeRoom(dungeon, newOpens) {
  const rows = dungeon.length;
  const cols = dungeon[0].length;
  const simulated = new Set(newOpens.map((pos) => `${pos.x},${pos.y}`));

  const isOpen = (x, y) => {
    if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) return false;
    return dungeon[y][x] === 0 || simulated.has(`${x},${y}`);
  };

  const forbiddenRects = [
    { width: 3, height: 3 },
    { width: 4, height: 2 },
    { width: 2, height: 4 }
  ];

  for (const pos of newOpens) {
    for (const rect of forbiddenRects) {
      for (let startX = pos.x - rect.width + 1; startX <= pos.x; startX++) {
        for (let startY = pos.y - rect.height + 1; startY <= pos.y; startY++) {
          let fullOpen = true;
          for (let xx = startX; xx < startX + rect.width && fullOpen; xx++) {
            for (let yy = startY; yy < startY + rect.height && fullOpen; yy++) {
              if (!isOpen(xx, yy)) fullOpen = false;
            }
          }
          if (fullOpen) return false;
        }
      }
    }
  }

  return true;
}

// ─── Génération de la grille ──────────────────────────────────────────────────

function generateGrid(rows, cols, extraPaths) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

  if (rows < 3 || cols < 3) return grid;

  const startX = 1;
  const startY = 1;
  grid[startY][startX] = 0;

  const stack = [{ x: startX, y: startY }];
  const directions = [
    { dx: 2, dy: 0 }, { dx: -2, dy: 0 },
    { dx: 0, dy: 2 }, { dx: 0, dy: -2 }
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        neighbors.push({ x: nx, y: ny, between: { x: current.x + dx / 2, y: current.y + dy / 2 } });
      }
    }

    if (neighbors.length === 0) { stack.pop(); continue; }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[next.between.y][next.between.x] = 0;
    grid[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }

  const extraPassages = Math.floor((rows * cols) * extraPaths);
  for (let i = 0; i < extraPassages; i++) {
    const x = Math.floor(Math.random() * (cols - 2)) + 1;
    const y = Math.floor(Math.random() * (rows - 2)) + 1;

    if (grid[y][x] === 1) {
      const adjacentPaths = [];
      if (x > 1        && grid[y][x - 2] === 0) adjacentPaths.push({ x: x - 1, y });
      if (x < cols - 2 && grid[y][x + 2] === 0) adjacentPaths.push({ x: x + 1, y });
      if (y > 1        && grid[y - 2][x] === 0) adjacentPaths.push({ x, y: y - 1 });
      if (y < rows - 2 && grid[y + 2][x] === 0) adjacentPaths.push({ x, y: y + 1 });

      if (adjacentPaths.length >= 2) {
        const candidateOpens = [{ x, y }, ...adjacentPaths];
        if (canCarveWithoutLargeRoom(grid, candidateOpens)) {
          grid[y][x] = 0;
          for (const pos of adjacentPaths) grid[pos.y][pos.x] = 0;
        }
      }
    }
  }

  return grid;
}

// ─── Placement des éléments ───────────────────────────────────────────────────

/**
 * @param {Array} bestiary — liste des créatures du bestiary (filtrée par tier)
 */
function placeElements(grid, bestiary) {
  const tiles = shuffle(getWalkableTiles(grid));

  if (tiles.length < 8) {
    console.warn("Donjon trop petit pour placer tous les éléments");
  }

  let idx = 0;

  // 4 créatures — id assigné depuis le bestiary selon le tier du donjon
  const creatures = [];
  for (let i = 0; i < 4; i++) {
    // Sélection aléatoire dans le bestiary disponible
    const creatureDef = bestiary[Math.floor(Math.random() * bestiary.length)];
    creatures.push({
      x:        tiles[idx].x,
      y:        tiles[idx].y,
      prevX:    tiles[idx].x,
      prevY:    tiles[idx].y,
      lastKnownPlayerX: null,
      lastKnownPlayerY: null,
      stepCounter:      0,
      defeated:         false,
      state:            "random",   // "random" | "pursuing"
      id:       creatureDef.id   // référence vers bestiary.json
    });
    idx++;
  }

  const forge    = { x: tiles[idx].x, y: tiles[idx].y }; idx++;
  const training = { x: tiles[idx].x, y: tiles[idx].y, used: false }; idx++;
  const exit     = { x: tiles[idx].x, y: tiles[idx].y }; idx++;
  const treasure = { x: tiles[idx].x, y: tiles[idx].y, looted: false };

  return { creatures, forge, training, exit, treasure };
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * @param {Array} bestiary — chargé depuis bestiary.json côté serveur
 */
export function generateDungeon(bestiary) {
  if (!bestiary?.length) throw new Error("generateDungeon: bestiary manquant ou vide");
  const { rows, cols, extraPaths } = DUNGEON_CONFIG;
  const grid = generateGrid(rows, cols, extraPaths);
  const { creatures, forge, training, exit, treasure } = placeElements(grid, bestiary);
  return { grid, creatures, forge, training, exit, treasure };
}

// ─── Détection case spéciale ──────────────────────────────────────────────────

function getSpecialTile(dungeon, x, y, bestiary) {
  const { creatures, forge, training, exit, treasure } = dungeon;

  const creature = creatures?.find(c => !c.defeated && c.x === x && c.y === y);
  if (creature) {
    // Récupérer le nom de la créature pour le message de confirmation
    const def    = bestiary?.find(b => b.id === creature.id);
    const name   = def?.nameFr ?? "une créature";
    return {
      type:  "creature",
      label: `Êtes-vous sûr de vouloir affronter ${name} ?`,
      data:  { creature }
    };
  }

  if (forge && forge.x === x && forge.y === y) {
    return { type: "forge", label: "Êtes-vous sûr de vouloir utiliser la forge ?", data: {} };
  }

  if (training && training.x === x && training.y === y) {
    return { type: "training", label: "Êtes-vous sûr de vouloir aller au terrain d'entraînement ?", data: { used: training.used } };
  }

  if (treasure && !treasure.looted && treasure.x === x && treasure.y === y) {
    return { type: "treasure", label: "Êtes-vous sûr de vouloir ouvrir le trésor ?", data: {} };
  }

  if (exit && exit.x === x && exit.y === y) {
    return { type: "exit", label: "Êtes-vous sûr de vouloir passer à l'étage suivant ?", data: {} };
  }

  return null;
}

// ─── Déplacement des créatures ────────────────────────────────────────────────

/**
 * Vision en ligne droite — vérifie si le joueur est visible depuis (cx, cy).
 * Retourne la position du joueur si visible, null sinon.
 */
function creatureCanSeePlayer(grid, cx, cy, playerX, playerY) {
  const directions = [
    { dx: 0, dy: -1 }, // haut
    { dx: 0, dy:  1 }, // bas
    { dx: -1, dy: 0 }, // gauche
    { dx:  1, dy: 0 }  // droite
  ];

  for (const { dx, dy } of directions) {
    let x = cx + dx;
    let y = cy + dy;
    while (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
      if (grid[y][x] !== 0) break; // mur → arrêter
      if (x === playerX && y === playerY) return { x: playerX, y: playerY };
      x += dx;
      y += dy;
    }
  }
  return null;
}

/**
 * Vérifie si une case est accessible pour une créature (pas mur, pas autre créature).
 */
function canMoveTo(grid, creatures, x, y, creatureIdx) {
  if (y < 0 || y >= grid.length) return false;
  if (x < 0 || x >= grid[0].length) return false;
  if (grid[y][x] !== 0) return false;
  for (let i = 0; i < creatures.length; i++) {
    if (i === creatureIdx) continue;
    if (creatures[i].defeated) continue;
    if (creatures[i].x === x && creatures[i].y === y) return false;
  }
  return true;
}

/**
 * Retourne les cases adjacentes accessibles (mur et créatures exclues, joueur inclus).
 */
function getAdjacentMoves(grid, creatures, creature, creatureIdx, playerX, playerY) {
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy:  1 },
    { dx: -1, dy: 0 },
    { dx:  1, dy: 0 }
  ];
  const moves = [];
  for (const { dx, dy } of directions) {
    const nx = creature.x + dx;
    const ny = creature.y + dy;
    const isPlayerTile = (nx === playerX && ny === playerY);
    if (canMoveTo(grid, creatures, nx, ny, creatureIdx) || isPlayerTile) {
      moves.push({ x: nx, y: ny });
    }
  }
  return moves;
}

/**
 * Déplace la créature vers une cible par le chemin le plus direct (Manhattan).
 * Retourne "combat" si la créature atteint le joueur, true si déplacée, false sinon.
 */
function moveTowardsTarget(grid, creatures, creature, targetX, targetY, creatureIdx, playerX, playerY) {
  const adjacent = getAdjacentMoves(grid, creatures, creature, creatureIdx, playerX, playerY);
  if (adjacent.length === 0) return false;

  // Calculer la distance Manhattan de chaque case vers la cible
  const candidates = adjacent.map(p => ({
    x: p.x,
    y: p.y,
    dist: Math.abs(p.x - targetX) + Math.abs(p.y - targetY)
  }));

  // Trouver la distance minimale
  const minDist = Math.min(...candidates.map(c => c.dist));
  const best = candidates.filter(c => c.dist === minDist);

  // Choix aléatoire parmi les meilleures directions
  const choice = best[Math.floor(Math.random() * best.length)];

  // Vérifier si c'est la case du joueur → combat
  if (choice.x === playerX && choice.y === playerY) {
    applyMove(creature, choice.x, choice.y);
    return "combat";
  }

  applyMove(creature, choice.x, choice.y);
  return true;
}

/**
 * Applique le déplacement d'une créature en mettant à jour prevX/prevY.
 */
function applyMove(creature, newX, newY) {
  creature.prevX = creature.x;
  creature.prevY = creature.y;
  creature.x = newX;
  creature.y = newY;
}

/**
 * Déplace toutes les créatures non vaincues selon leur rythme (step) et les états A/B/C/D.
 * Retourne { combatTriggered, creatureIndex } si une créature atteint le joueur.
 */
export function moveCreatures(session) {
  const { dungeon, player, bestiary } = session;
  const { grid, creatures } = dungeon;
  const playerX = player.position.x;
  const playerY = player.position.y;

  for (let i = 0; i < creatures.length; i++) {
    const creature = creatures[i];
    if (creature.defeated) continue;

    // Récupérer la valeur "step" depuis le bestiary
    const def = bestiary.find(b => b.id === creature.id);
    const step = def?.step ?? 3;

    // Incrémenter le compteur de pas de cette créature
    creature.stepCounter++;
    if (creature.stepCounter < step) continue;

    // Reset du compteur — la créature va bouger
    creature.stepCounter = 0;

    // ─── Vision : le joueur est-il visible ? ─────────────────────────────
    const seen = creatureCanSeePlayer(grid, creature.x, creature.y, playerX, playerY);

    // ─── État A : Le joueur est visible ──────────────────────────────────
    if (seen) {
      creature.lastKnownPlayerX = seen.x;
      creature.lastKnownPlayerY = seen.y;
      creature.state = "pursuing";

      const result = moveTowardsTarget(grid, creatures, creature, playerX, playerY, i, playerX, playerY);
      if (result === "combat") {
        return { combatTriggered: true, creatureIndex: i };
      }
      // Déplacement effectué (ou bloqué) → passer à la créature suivante
      continue;
    }

    // ─── État B : Le joueur n'est pas visible mais position connue ────────
    if (creature.state === "pursuing" && creature.lastKnownPlayerX !== null) {
      // La créature est-elle arrivée à la dernière position connue ?
      if (creature.x === creature.lastKnownPlayerX && creature.y === creature.lastKnownPlayerY) {
        // Position atteinte sans revoir le joueur → passage en état C
        creature.state = "random";
        creature.lastKnownPlayerX = null;
        creature.lastKnownPlayerY = null;
        // Tomber dans l'état C ci-dessous
      } else {
        // Se diriger vers la dernière position connue
        const result = moveTowardsTarget(grid, creatures, creature, creature.lastKnownPlayerX, creature.lastKnownPlayerY, i, playerX, playerY);
        if (result === "combat") {
          return { combatTriggered: true, creatureIndex: i };
        }
        // Déplacement effectué → passer à la créature suivante
        continue;
      }
    }

    // ─── État C : Déplacement aléatoire ──────────────────────────────────
    const adjacent = getAdjacentMoves(grid, creatures, creature, i, playerX, playerY);

    // Exclure l'avant-dernière position (anti ping-pong)
    const filtered = adjacent.filter(p => !(p.x === creature.prevX && p.y === creature.prevY));

    if (filtered.length > 0) {
      const choice = filtered[Math.floor(Math.random() * filtered.length)];
      if (choice.x === playerX && choice.y === playerY) {
        applyMove(creature, choice.x, choice.y);
        return { combatTriggered: true, creatureIndex: i };
      }
      applyMove(creature, choice.x, choice.y);
    } else if (adjacent.length > 0) {
      // ─── État D : Demi-tour (seule option = avant-dernière position) ───
      // adjacent contient des cases mais toutes sont prevX/prevY → vrai cul-de-sac
      const choice = adjacent[Math.floor(Math.random() * adjacent.length)];
      if (choice.x === playerX && choice.y === playerY) {
        applyMove(creature, choice.x, choice.y);
        return { combatTriggered: true, creatureIndex: i };
      }
      applyMove(creature, choice.x, choice.y);
    }
    // Si adjacent.length === 0 → complètement bloqué, ne bouge pas

    // Après le déplacement, vérifier la vision depuis la nouvelle position
    const seenAfter = creatureCanSeePlayer(grid, creature.x, creature.y, playerX, playerY);
    if (seenAfter) {
      creature.lastKnownPlayerX = seenAfter.x;
      creature.lastKnownPlayerY = seenAfter.y;
      creature.state = "pursuing";
    }
  }

  return { combatTriggered: false };
}

/**
 * Met à jour la vision de toutes les créatures non vaincues.
 * Appelé à chaque pas du joueur, indépendamment du stepCounter.
 */
function updateCreaturesVision(session) {
  const { dungeon, player } = session;
  const { grid, creatures } = dungeon;
  const playerX = player.position.x;
  const playerY = player.position.y;

  for (const creature of creatures) {
    if (creature.defeated) continue;
    const seen = creatureCanSeePlayer(grid, creature.x, creature.y, playerX, playerY);
    if (seen) {
      creature.lastKnownPlayerX = seen.x;
      creature.lastKnownPlayerY = seen.y;
      creature.state = "pursuing";
    }
  }
}

// ─── Déplacement ─────────────────────────────────────────────────────────────

function movePlayer(session, dx, dy) {
  if (!session?.player) throw new Error("movePlayer: session.player manquant");
  if (!session?.dungeon) throw new Error("movePlayer: session.dungeon manquant");

  const { player, dungeon } = session;
  const newX = player.position.x + dx;
  const newY = player.position.y + dy;

  if (newY < 0 || newY >= dungeon.grid.length)    return { ok: false, error: "Hors limites" };
  if (newX < 0 || newX >= dungeon.grid[0].length) return { ok: false, error: "Hors limites" };
  if (dungeon.grid[newY][newX] !== 0)             return { ok: false, error: "Mur" };

  const special = getSpecialTile(dungeon, newX, newY, session.bestiary);
  if (special) {
    return {
      ok:      true,
      confirm: { type: special.type, label: special.label, data: special.data, direction: { dx, dy } }
    };
  }

  player.position.x = newX;
  player.position.y = newY;
  session.turn++;

  // Mise à jour de la vision de toutes les créatures (à chaque pas du joueur)
  updateCreaturesVision(session);

  // Déplacement des créatures après chaque pas du joueur
  const creaturesResult = moveCreatures(session);
  if (creaturesResult.combatTriggered) {
    return { ok: true, creatureCombat: creaturesResult.creatureIndex };
  }

  return { ok: true };
}

function confirmMove(session, dx, dy) {
  if (!session?.player) throw new Error("confirmMove: session.player manquant");

  const { player, dungeon } = session;
  const newX = player.position.x + dx;
  const newY = player.position.y + dy;

  if (newY < 0 || newY >= dungeon.grid.length)    return { ok: false, error: "Hors limites" };
  if (newX < 0 || newX >= dungeon.grid[0].length) return { ok: false, error: "Hors limites" };
  if (dungeon.grid[newY][newX] !== 0)             return { ok: false, error: "Mur" };

  player.position.x = newX;
  player.position.y = newY;
  session.turn++;

  // Mise à jour de la vision de toutes les créatures (à chaque pas du joueur)
  updateCreaturesVision(session);

  // Déplacement des créatures après chaque pas du joueur
  const creaturesResult = moveCreatures(session);

  const special = getSpecialTile(dungeon, newX, newY, session.bestiary);

  if (creaturesResult.combatTriggered) {
    return { ok: true, specialType: special?.type ?? null, creatureCombat: creaturesResult.creatureIndex };
  }

  return { ok: true, specialType: special?.type ?? null };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function handlePlayerAction(session, action) {
  switch (action.type) {

    case "move": {
      if (!action.direction) return { ok: false, error: "Direction manquante" };
      const directions = {
        up:    { dx:  0, dy: -1 },
        down:  { dx:  0, dy:  1 },
        left:  { dx: -1, dy:  0 },
        right: { dx:  1, dy:  0 }
      };
      const dir = directions[action.direction];
      if (!dir) return { ok: false, error: "Direction invalide" };
      return movePlayer(session, dir.dx, dir.dy);
    }

    case "move:confirm": {
      if (action.dx === undefined) return { ok: false, error: "dx manquant" };
      if (action.dy === undefined) return { ok: false, error: "dy manquant" };
      return confirmMove(session, action.dx, action.dy);
    }

    default:
      return { ok: false, error: `Action inconnue : ${action.type}` };
  }
}