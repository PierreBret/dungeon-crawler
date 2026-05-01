/*
  RENDER.JS

  Gestion de l'affichage du mode EXPLORATION.

  Rôle :
  - Dessiner la grille du donjon
  - Afficher le joueur
  - Afficher les créatures, forge, entraînement, sortie

  IMPORTANT :
  Aucun calcul de gameplay ici (uniquement affichage)
*/

// Emojis des éléments du donjon
const EMOJI = {
  player:   "🧙",
  creature: "👺",
  forge:    "⚒️",
  training: "🎯",
  exit:     "🔽"
};

export function drawDungeon(ctx, dungeon, player, config) {
  if (!ctx || !dungeon || !player || !config) return;

  const { grid, creatures, forge, training, exit } = dungeon;
  if (!grid) return;

  // Taille des tuiles calculée dynamiquement depuis la config serveur
  const tileSize = Math.min(
    Math.floor(ctx.canvas.width  / config.cols),
    Math.floor(ctx.canvas.height / config.rows)
  );

  // Fond noir
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Tuiles
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      ctx.fillStyle = grid[y][x] === 1 ? "#555" : "#222";
      ctx.fillRect((x - 1) * tileSize, (y - 1) * tileSize, tileSize, tileSize);
    }
  }

  // Fonction utilitaire pour dessiner un emoji centré sur une tuile
  function drawEmoji(emoji, x, y) {
    const px = (x - 1) * tileSize + tileSize / 2;
    const py = (y - 1) * tileSize + tileSize / 2;
    ctx.font         = `${Math.floor(tileSize * 0.7)}px serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, px, py);
  }

  // Forge
  if (forge) drawEmoji(EMOJI.forge, forge.x, forge.y);

  // Entraînement (grisé si déjà utilisé)
  if (training) {
    ctx.globalAlpha = training.used ? 0.3 : 1.0;
    drawEmoji(EMOJI.training, training.x, training.y);
    ctx.globalAlpha = 1.0;
  }

  // Sortie
  if (exit) drawEmoji(EMOJI.exit, exit.x, exit.y);

  // Créatures (grisées si vaincues)
  if (creatures) {
    for (const creature of creatures) {
      ctx.globalAlpha = creature.defeated ? 0.2 : 1.0;
      drawEmoji(EMOJI.creature, creature.x, creature.y);
    }
    ctx.globalAlpha = 1.0;
  }

  // Joueur — dessiné en dernier (par-dessus tout)
  drawEmoji(EMOJI.player, player.position.x, player.position.y);

  // Bord du donjon
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

  // Reset
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
}
