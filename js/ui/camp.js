/*
  CAMP.JS

  Interface du mode CAMP.

  Rôle :
  - Afficher les stats du joueur
  - Afficher les actions disponibles (soin, forge, repos...)
  - Interface de gestion hors exploration
*/
import { drawPlayerCard } from "./components/characterCard.js";

export function drawCamp(ctx, player) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.textBaseline = "top";

  ctx.fillStyle = "white";
  ctx.font = "26px Arial";

  ctx.fillText("🏕 CAMP", 50, 30);

  // --- JOUEUR ---
  const blockWidth = 300;
  const centerX = ctx.canvas.width / 2;

  drawPlayerCard(
    ctx,
    player,
    centerX - blockWidth / 2,
    100,
    blockWidth,
    true
  );

  // --- ACTIONS ---
  ctx.font = "20px Arial";

  ctx.fillText("Actions :", 50, 500);
  ctx.fillText("C : Continuer exploration", 50, 540);
  ctx.fillText("A : Abandonner", 50, 570);
}