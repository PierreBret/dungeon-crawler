/*
  CLIENT/JS/UI/GAMEOVER.JS
  Écran de fin de partie (mort du joueur).

  Navigation :
    Entrée — retour à la création de personnage
*/

import { THEME } from "../core/theme.js";

export function drawGameOver(ctx, gameOverState, player) {
  if (!gameOverState) throw new Error("drawGameOver: gameOverState manquant");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  ctx.fillStyle = THEME.ui.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const cx = ctx.canvas.width  / 2;
  const cy = ctx.canvas.height / 2;

  ctx.textAlign = "center";

  ctx.font      = THEME.font.title;
  ctx.fillStyle = THEME.text.primary;
  ctx.fillText("Vous êtes mort.", cx, cy - 100);

  ctx.font      = THEME.font.body;
  ctx.fillStyle = THEME.text.secondary;
  ctx.fillText(
    `${player?.name ?? "Le héros"} a atteint le niveau ${gameOverState.etage ?? 1} du donjon.`,
    cx, cy - 40
  );

  ctx.font      = THEME.font.body;
  ctx.fillStyle = THEME.text.muted;
  ctx.fillText("Vous pouvez sûrement mieux faire.", cx, cy);

  ctx.font      = THEME.font.small;
  ctx.fillStyle = THEME.text.muted;
  ctx.fillText("Entrée — nouvelle partie", cx, ctx.canvas.height - 40);

  ctx.textAlign = "left";
}