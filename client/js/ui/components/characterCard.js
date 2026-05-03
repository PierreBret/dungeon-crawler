/*
  CHARACTER CARD
  Affiche la carte d'un personnage (nom, avatar, stats).
  Les labels de stats restent en français (affichage jeu).
*/

import { loadAvatar } from "../../core/assets.js";
import { THEME }      from "../../core/theme.js";

export function drawPlayerCard(ctx, player, frameX, frameY, blockWidth, isSelected = false) {
  ctx.textBaseline = "top";

  const padding       = 20;
  const lineHeight    = 26;
  const avatarSize    = 150;
  const avatarSpacing = 15;

  const contentX = frameX + padding;
  let   currentY = frameY + padding;

  // --- CADRE ---
  if (isSelected) {
    ctx.fillStyle   = "#333";
    ctx.fillRect(frameX, frameY, blockWidth, 400);
    ctx.strokeStyle = THEME.text.accent;
    ctx.lineWidth   = 3;
    ctx.strokeRect(frameX, frameY, blockWidth, 400);
  } else {
    ctx.strokeStyle = THEME.ui.border;
    ctx.lineWidth   = 1;
    ctx.strokeRect(frameX, frameY, blockWidth, 400);
  }

  // --- NOM ---
  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.heading;
  ctx.textAlign = "left";
  ctx.fillText(player.name, contentX, currentY);
  currentY += lineHeight;

  // --- AVATAR ---
  if (!player.avatarImage) {
    loadAvatar(player.avatarPath).then(img => { player.avatarImage = img; });
  }

  const avatarX = frameX + (blockWidth - avatarSize) / 2;

  if (player.avatarImage) {
    ctx.drawImage(player.avatarImage, avatarX, currentY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = THEME.ui.bgItem;
    ctx.fillRect(avatarX, currentY, avatarSize, avatarSize);
  }

  currentY += avatarSize + avatarSpacing;

  // --- STATS ---
  const stats = player.stats;
  const statsList = [
    ["FORCE",        stats.force],
    ["CONSTITUTION", stats.constitution],
    ["TAILLE",       stats.taille],
    ["INTELLIGENCE", stats.intelligence],
    ["VOLONTÉ",      stats.volonté],
    ["VITESSE",      stats.vitesse],
    ["ADRESSE",      stats.adresse],
  ];

  for (const [label, value] of statsList) {
    ctx.font      = THEME.components.statLabel.font;
    ctx.fillStyle = THEME.components.statLabel.color;
    ctx.textAlign = "left";
    ctx.fillText(label, contentX, currentY);

    ctx.font      = THEME.components.statValue.font;
    ctx.fillStyle = THEME.components.statValue.color;
    ctx.textAlign = "right";
    ctx.fillText(String(value), frameX + blockWidth - padding, currentY);

    currentY += lineHeight;
  }

  ctx.textAlign = "left";
}