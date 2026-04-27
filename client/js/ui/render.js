/*
  RENDER.JS

  Gestion de l'affichage du mode EXPLORATION.

  Rôle :
  - Dessiner le donjon
  - Afficher le joueur
  - Gérer le rendu visuel de la grille

  IMPORTANT :
  Aucun calcul de gameplay ici (uniquement affichage)
*/

export function drawDungeon(ctx, dungeon, player, config) {
  if (!ctx || !dungeon || !player || !config) return;

  // Taille des tuiles calculée dynamiquement depuis la config serveur
  const tileSize = Math.min(
    Math.floor(ctx.canvas.width  / config.cols),
    Math.floor(ctx.canvas.height / config.rows)
  );

  // Fond noir — couvre tout le canvas proprement
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Tuiles
  for (let y = 1; y < dungeon.length - 1; y++) {
    for (let x = 1; x < dungeon[y].length - 1; x++) {
      ctx.fillStyle = dungeon[y][x] === 1 ? "#555" : "#222";
      // Décale d'une tuile pour compenser la bordure cachée
      ctx.fillRect((x - 1) * tileSize, (y - 1) * tileSize, tileSize, tileSize);
    }
  }

  // Joueur
  ctx.fillStyle = "red";
  ctx.fillRect(
    (player.position.x - 1) * tileSize,
    (player.position.y - 1) * tileSize,
    tileSize,
    tileSize
  );

  // Bord du donjon — dessiné en dernier pour être visible par-dessus tout
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
}
