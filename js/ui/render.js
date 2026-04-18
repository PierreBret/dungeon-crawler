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
export function drawDungeon(ctx, dungeon, player, tileSize) {
  // sécurité
  if (!ctx || !dungeon || !player) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < dungeon.length; y++) {
    for (let x = 0; x < dungeon[y].length; x++) {
      if (dungeon[y][x] === 1) {
        ctx.fillStyle = "#555";
      } else {
        ctx.fillStyle = "#222";
      }

      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  // joueur
  ctx.fillStyle = "red";
  ctx.fillRect(
    player.x * tileSize,
    player.y * tileSize,
    tileSize,
    tileSize
  );
}
