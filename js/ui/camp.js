/*
  CAMP.JS

  Interface du mode CAMP.

  Rôle :
  - Afficher les stats du joueur
  - Afficher les actions disponibles (soin, forge, repos...)
  - Interface de gestion hors exploration
*/

export function drawCamp(ctx, player) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";

  ctx.fillText("🏕 CAMP", 20, 40);

  ctx.fillText("HP: " + player.hp + " / " + player.maxHp, 20, 80);
  ctx.fillText("ATK: " + player.atk, 20, 110);

  ctx.fillText("Actions :", 20, 160);
  ctx.fillText("- C : retourner exploration", 20, 200);
  ctx.fillText("- (future) Soigner", 20, 230);
  ctx.fillText("- (future) Forger", 20, 260);
}
