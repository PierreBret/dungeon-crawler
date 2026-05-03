/*
  SERVER/GAME/WORLD.JS
  Génération du donjon, déplacements, collisions.

  Algorithme : Recursive Backtracking + passages supplémentaires
  generateDungeon() retourne un objet enrichi :
  {
    grid,       // grille 2D (0=passage, 1=mur)
    creatures,  // 4 créatures placées aléatoirement
    forge,      // position de la forge
    training,   // position du terrain d'entraînement
    exit        // position du passage vers l'étage suivant
  }

  Déplacement :
  - move       : tente le déplacement, retourne confirm si case spéciale
  - move:confirm : confirme le déplacement après dialog côté client
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
    { dx: 2, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: 0, dy: -2 }
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        neighbors.push({
          x: nx, y: ny,
          between: { x: current.x + dx / 2, y: current.y + dy / 2 }
        });
      }
    }

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[next.between.y][next.between.x] = 0;
    grid[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }

  // Passages supplémentaires
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

function placeElements(grid) {
  const tiles = shuffle(getWalkableTiles(grid));

  if (tiles.length < 7) {
    console.warn("Donjon trop petit pour placer tous les éléments");
  }

  let idx = 0;

  const creatures = [];
  for (let i = 0; i < 4; i++) {
    creatures.push({ x: tiles[idx].x, y: tiles[idx].y, defeated: false });
    idx++;
  }

  const forge    = { x: tiles[idx].x, y: tiles[idx].y }; idx++;
  const training = { x: tiles[idx].x, y: tiles[idx].y, used: false }; idx++;
  const exit     = { x: tiles[idx].x, y: tiles[idx].y };

  return { creatures, forge, training, exit };
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function generateDungeon() {
  const { rows, cols, extraPaths } = DUNGEON_CONFIG;
  const grid = generateGrid(rows, cols, extraPaths);
  const { creatures, forge, training, exit } = placeElements(grid);
  return { grid, creatures, forge, training, exit };
}

// ─── Détection case spéciale ──────────────────────────────────────────────────

/**
 * Retourne les infos de confirmation si la case (x, y) est spéciale.
 * Retourne null si la case est ordinaire.
 */
function getSpecialTile(dungeon, x, y) {
  const { creatures, forge, training, exit } = dungeon;

  // Créature vivante
  const creature = creatures?.find(c => !c.defeated && c.x === x && c.y === y);
  if (creature) {
    return {
      type:    "creature",
      label:   "Êtes-vous sûr de vouloir affronter cette créature ?",
      data:    { creature }
    };
  }

  // Forge
  if (forge && forge.x === x && forge.y === y) {
    return {
      type:  "forge",
      label: "Êtes-vous sûr de vouloir utiliser la forge ?",
      data:  {}
    };
  }

  // Terrain d'entraînement
  if (training && training.x === x && training.y === y) {
    return {
      type:  "training",
      label: "Êtes-vous sûr de vouloir aller au terrain d'entraînement ?",
      data:  { used: training.used }
    };
  }

  // Sortie
  if (exit && exit.x === x && exit.y === y) {
    return {
      type:  "exit",
      label: "Êtes-vous sûr de vouloir passer à l'étage suivant ?",
      data:  {}
    };
  }

  return null;
}

// ─── Déplacement (validation serveur) ────────────────────────────────────────

function movePlayer(session, dx, dy) {
  if (!session?.player) throw new Error("movePlayer: session.player manquant");
  if (!session?.dungeon) throw new Error("movePlayer: session.dungeon manquant");

  const { player, dungeon } = session;
  const newX = player.position.x + dx;
  const newY = player.position.y + dy;

  if (newY < 0 || newY >= dungeon.grid.length)    return { ok: false, error: "Hors limites" };
  if (newX < 0 || newX >= dungeon.grid[0].length) return { ok: false, error: "Hors limites" };
  if (dungeon.grid[newY][newX] !== 0)             return { ok: false, error: "Mur" };

  // Vérifier si la case de destination est spéciale
  const special = getSpecialTile(dungeon, newX, newY);
  if (special) {
    // Ne pas déplacer — demander confirmation au client
    return {
      ok:      true,
      confirm: {
        type:      special.type,
        label:     special.label,
        data:      special.data,
        direction: { dx, dy }  // mémorisé pour move:confirm
      }
    };
  }

  // Case ordinaire — déplacer directement
  player.position.x = newX;
  player.position.y = newY;
  session.turn++;

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

  // Retourner le type de case pour que le client lance la bonne action
  const special = getSpecialTile(dungeon, newX, newY);
  return { ok: true, specialType: special?.type ?? null };
}

// ─── Dispatcher des actions joueur ───────────────────────────────────────────

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
      if (!action.dx && action.dx !== 0) return { ok: false, error: "dx manquant" };
      if (!action.dy && action.dy !== 0) return { ok: false, error: "dy manquant" };
      return confirmMove(session, action.dx, action.dy);
    }

    case "attack":
      return { ok: false, error: "Système de combat pas encore implémenté" };

    default:
      return { ok: false, error: `Action inconnue : ${action.type}` };
  }
}