/*
  CAMP.JS

  Interface du mode CAMP.

  Rôle :
  - Afficher les stats du joueur
  - Afficher les actions disponibles (soin, forge, repos...)
  - Interface de gestion hors exploration
*/

import { CAMP_OPTIONS } from "../core/constants.js";
import { drawPlayerCard } from "./components/characterCard.js";

export function drawCamp(ctx, player, campState = {}) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.textBaseline = "top";

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  // 🔥 layout
  const leftWidth = 320;
  const padding = 20;

  // --- PANNEAU GAUCHE ---
  drawLeftPanel(ctx, player, leftWidth, padding);

  // --- PANNEAU DROIT ---
  drawRightPanel(ctx, campState, leftWidth, padding, canvasWidth, canvasHeight);
}

function drawLeftPanel(ctx, player, width, padding) {
  const x = 0;
  const y = 0;

  // fond
  ctx.fillStyle = "#111";
  ctx.fillRect(x, y, width, ctx.canvas.height);

  // séparation visuelle
  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width, ctx.canvas.height);
  ctx.stroke();

  // carte joueur
  drawPlayerCard(
    ctx,
    player,
    padding,
    padding,
    width - padding * 2,
    true
  );
}

function drawRightPanel(ctx, campState, leftWidth, padding, canvasWidth, canvasHeight) {
  const x = leftWidth;
  const width = canvasWidth - leftWidth;

  // --- FOND ---
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, 0, width, canvasHeight);

  // --- TITRE ---
  const MODE_LABELS = {
    menu:  "Campement",
    rest:  "Repos",      // ← déjà ok
    forge: "Forge"       // ← déjà ok
  };

  const title = MODE_LABELS[campState.mode] || "Camp";

  ctx.fillStyle = "white";
  ctx.font = "bold 30px Arial";
  ctx.fillText(title, x + padding, padding);

  // --- LIGNE DE SÉPARATION ---
  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(x + 20, padding + 40);
  ctx.lineTo(x + width - 20, padding + 40);
  ctx.stroke();

  // --- CONTENU ---
  const contentY = padding + 70;

  switch (campState.mode) {
    case "rest":
      drawRestPanel(ctx, x + padding, contentY);
      break;

    case "forge":
      drawForgePanel(ctx, x + padding, contentY);
      break;

    default:
      drawMainMenu(ctx, x + padding, contentY, campState);
      break;
  }
}

function drawMainMenu(ctx, x, y, campState) {
  ctx.font = "20px Arial";

  const lineHeight = 40;
  const optionWidth = 300;
  const optionHeight = 30;

  for (let i = 0; i < CAMP_OPTIONS.length; i++) {
    const option = CAMP_OPTIONS[i];
    const optionY = y + i * lineHeight;

    // --- FOND SELECTION ---
    if (i === campState.selectedIndex) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 10, optionY - 5, optionWidth, optionHeight);

      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = "white";
    }

    // --- TEXTE ---
    ctx.fillText(option.label, x, optionY);
  }
}

