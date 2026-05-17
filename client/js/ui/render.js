/*
  RENDER.JS

  Gestion de l'affichage du mode EXPLORATION.

  Rôle :
  - Dessiner la grille du donjon
  - Afficher le joueur
  - Afficher les créatures, forge, entraînement, sortie
  - Afficher le dialog de confirmation si case spéciale

  IMPORTANT :
  Aucun calcul de gameplay ici (uniquement affichage)
*/

const EMOJI = {
  player:   "🧙",
  creature: "👺",
  forge:    "⚒️",
  training: "🎯",
  exit:     "🔽",
  treasure: "💎"
};

// ─── Calcul de visibilité (fog of war) ────────────────────────────────────────

/**
 * Retourne un Set de clés "x,y" représentant les cases visibles par le joueur.
 * En DEV_MODE (devMode=true) : toutes les cases sont visibles.
 * Sinon : cases adjacentes (8 directions) + ligne droite dans les 4 directions
 * cardinales tant qu'un mur ne bloque pas la vision.
 */
function computeVisibility(grid, position, devMode) {
  const visible = new Set();
  const rows = grid.length;
  const cols = grid[0].length;

  // En mode dev, tout est visible
  if (devMode) {
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        visible.add(`${x},${y}`);
      }
    }
    return visible;
  }

  const px = position.x;
  const py = position.y;

  // Case du joueur toujours visible
  visible.add(`${px},${py}`);

  // Cases adjacentes (8 directions)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = px + dx;
      const ny = py + dy;
      if (nx >= 1 && nx < cols - 1 && ny >= 1 && ny < rows - 1) {
        visible.add(`${nx},${ny}`);
      }
    }
  }

  // Ligne droite dans les 4 directions cardinales
  const directions = [
    { dx: 0, dy: -1 }, // haut
    { dx: 0, dy:  1 }, // bas
    { dx: -1, dy: 0 }, // gauche
    { dx:  1, dy: 0 }, // droite
  ];

  for (const { dx, dy } of directions) {
    let cx = px + dx;
    let cy = py + dy;
    while (cx >= 1 && cx < cols - 1 && cy >= 1 && cy < rows - 1) {
      visible.add(`${cx},${cy}`);
      // Si c'est un mur, on le voit mais on s'arrête là
      if (grid[cy][cx] === 1) break;
      cx += dx;
      cy += dy;
    }
  }

  return visible;
}

export function drawDungeon(ctx, dungeon, player, config, treasureDrop, devMode) {
  if (!ctx || !dungeon || !player || !config) return;

  const { grid, creatures, forge, training, exit, treasure } = dungeon;
  if (!grid) return;

  const tileSize = Math.min(
    Math.floor(ctx.canvas.width  / config.cols),
    Math.floor(ctx.canvas.height / config.rows)
  );

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Calcul de la visibilité (fog of war) quand DEV_MODE est désactivé
  const visible = computeVisibility(grid, player.position, devMode);

  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      if (!visible.has(`${x},${y}`)) continue;
      ctx.fillStyle = grid[y][x] === 1 ? "#555" : "#222";
      ctx.fillRect((x - 1) * tileSize, (y - 1) * tileSize, tileSize, tileSize);
    }
  }

  function drawEmoji(emoji, x, y) {
    const px = (x - 1) * tileSize + tileSize / 2;
    const py = (y - 1) * tileSize + tileSize / 2;
    ctx.font         = `${Math.floor(tileSize * 0.7)}px serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, px, py);
  }

  if (forge && visible.has(`${forge.x},${forge.y}`)) {
    drawEmoji(EMOJI.forge, forge.x, forge.y);
  }

  if (training && visible.has(`${training.x},${training.y}`)) {
    ctx.globalAlpha = training.used ? 0.3 : 1.0;
    drawEmoji(EMOJI.training, training.x, training.y);
    ctx.globalAlpha = 1.0;
  }

  if (exit && visible.has(`${exit.x},${exit.y}`)) {
    drawEmoji(EMOJI.exit, exit.x, exit.y);
  }

  if (treasure && !treasure.looted && visible.has(`${treasure.x},${treasure.y}`)) {
    drawEmoji(EMOJI.treasure, treasure.x, treasure.y);
  }

  if (creatures) {
    for (const creature of creatures) {
      if (!visible.has(`${creature.x},${creature.y}`)) continue;
      ctx.globalAlpha = creature.defeated ? 0.2 : 1.0;
      drawEmoji(EMOJI.creature, creature.x, creature.y);
    }
    ctx.globalAlpha = 1.0;
  }

  drawEmoji(EMOJI.player, player.position.x, player.position.y);

  const borderWidth   = 4;
  const dungeonWidth  = config.cols * tileSize;
  const dungeonHeight = config.rows * tileSize;

  ctx.strokeStyle = "#de9308";
  ctx.lineWidth   = borderWidth;
  ctx.strokeRect(
    borderWidth / 2,
    borderWidth / 2,
    dungeonWidth  - borderWidth,
    dungeonHeight - borderWidth
  );

  ctx.textAlign    = "left";
  ctx.textBaseline = "top";

  // Dialog de confirmation si case spéciale détectée
  if (dungeon.pendingConfirm) {
    drawConfirmDialog(ctx, dungeon.pendingConfirm);
  }

  // Notification de trésor récupéré
  if (treasureDrop) {
    drawTreasureDropDialog(ctx, treasureDrop);
  }
}

// ─── Dialog de confirmation ───────────────────────────────────────────────────

function drawConfirmDialog(ctx, confirm) {
  if (!confirm?.label) {
    console.error("drawConfirmDialog: label manquant");
    return;
  }

  const w       = Math.min(500, ctx.canvas.width  * 0.5);
  const h       = 110;
  const x       = (ctx.canvas.width  - w) / 2;
  const y       = (ctx.canvas.height - h) / 2;
  const padding = 20;

  // Fond semi-transparent
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y, w, h);

  // Question
  ctx.fillStyle    = "white";
  ctx.font         = "14px monospace";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText(confirm.label, x + w / 2, y + padding);

  // Boutons
  const choice = confirm.choice ?? 1; // 0=Oui, 1=Non
  const btnW   = 80;
  const btnH   = 28;
  const btnY   = y + h - btnH - padding;
  const ouiX   = x + w / 2 - btnW - 12;
  const nonX   = x + w / 2 + 12;

  drawConfirmButton(ctx, "Oui", ouiX, btnY, btnW, btnH, choice === 0);
  drawConfirmButton(ctx, "Non", nonX, btnY, btnW, btnH, choice === 1);

  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
}

function drawConfirmButton(ctx, label, x, y, w, h, isSelected) {
  ctx.fillStyle   = isSelected ? "#1a1a00" : "#2a2a2a";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isSelected ? "#d4a017" : "#555";
  ctx.lineWidth   = isSelected ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle   = isSelected ? "#d4a017" : "#888";
  ctx.font        = "13px monospace";
  ctx.textAlign   = "center";
  ctx.fillText(label, x + w / 2, y + 7);
}

// ─── Dialog de trésor ─────────────────────────────────────────────────────────

function drawTreasureDropDialog(ctx, drop) {
  const w       = Math.min(500, ctx.canvas.width * 0.5);
  const h       = 130;
  const x       = (ctx.canvas.width  - w) / 2;
  const y       = (ctx.canvas.height - h) / 2;
  const padding = 16;

  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth   = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle    = "#d4a017";
  ctx.font         = "15px monospace";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.fillText("💎 Trésor trouvé !", x + w / 2, y + padding);

  const weaponName = drop.weaponDef?.models?.[drop.tier - 1] ?? drop.weaponDef?.typeArme ?? drop.itemCode ?? "?";
  const matName    = drop.matName ?? "?";

  ctx.fillStyle = "white";
  ctx.font      = "13px monospace";
  ctx.fillText(`${weaponName} ${matName}`, x + w / 2, y + padding + 28);

  ctx.fillStyle = "#888";
  ctx.font      = "12px monospace";
  ctx.fillText("[Entrée] pour continuer", x + w / 2, y + h - padding - 14);

  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
}