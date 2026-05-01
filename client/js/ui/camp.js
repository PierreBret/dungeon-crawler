/*
  CAMP.JS
  Interface du mode CAMP.
*/

import { CAMP_OPTIONS } from "../core/constants.js";
import { drawPlayerCard } from "./components/characterCard.js";

export function drawCamp(ctx, player, campState = {}) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  const leftWidth = 320;
  const padding   = 20;

  drawLeftPanel(ctx, player, leftWidth, padding);
  drawRightPanel(ctx, campState, leftWidth, padding, ctx.canvas.width, ctx.canvas.height);
}

// ─── Panneau gauche — carte joueur ───────────────────────────────────────────

function drawLeftPanel(ctx, player, width, padding) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, width, ctx.canvas.height);

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width, ctx.canvas.height);
  ctx.stroke();

  drawPlayerCard(ctx, player, padding, padding, width - padding * 2, true);
}

// ─── Panneau droit — contenu selon mode ──────────────────────────────────────

function drawRightPanel(ctx, campState, leftWidth, padding, canvasWidth, canvasHeight) {
  const x     = leftWidth;
  const width = canvasWidth - leftWidth;

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, 0, width, canvasHeight);

  // Titre
  const MODE_LABELS = {
    menu:      "Campement",
    rest:      "Repos",
    inventory: "Inventaire"
  };

  ctx.fillStyle = "white";
  ctx.font      = "bold 30px Arial";
  ctx.fillText(MODE_LABELS[campState.mode] ?? "Camp", x + padding, padding);

  // Séparateur
  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x + 20, padding + 40);
  ctx.lineTo(x + width - 20, padding + 40);
  ctx.stroke();

  const contentY = padding + 70;

  switch (campState.mode) {
    case "inventory":
      drawInventoryPanel(ctx, campState, x + padding, contentY, width - padding * 2);
      break;
    case "rest":
      drawRestPanel(ctx, x + padding, contentY);
      break;
    default:
      drawMainMenu(ctx, x + padding, contentY, campState);
      break;
  }
}

// ─── Menu principal ───────────────────────────────────────────────────────────

function drawMainMenu(ctx, x, y, campState) {
  ctx.font = "20px Arial";

  const lineHeight  = 40;
  const optionWidth = 300;
  const optionHeight = 30;

  for (let i = 0; i < CAMP_OPTIONS.length; i++) {
    const optionY = y + i * lineHeight;

    if (i === campState.selectedIndex) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 10, optionY - 5, optionWidth, optionHeight);
      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = "white";
    }

    ctx.fillText(CAMP_OPTIONS[i].label, x, optionY);
  }
}

// ─── Repos ────────────────────────────────────────────────────────────────────

function drawRestPanel(ctx, x, y) {
  ctx.fillStyle = "#888";
  ctx.font      = "18px Arial";
  ctx.fillText("Fonctionnalité à venir...", x, y);
}

// ─── Inventaire ───────────────────────────────────────────────────────────────

function drawInventoryPanel(ctx, campState, x, y, width) {
  const inventory = campState.inventory ?? [];

  if (inventory.length === 0) {
    ctx.fillStyle = "#888";
    ctx.font      = "18px Arial";
    ctx.fillText("Inventaire vide", x, y);
    return;
  }

  ctx.font = "16px Arial";

  const lineHeight = 30;
  const colWidth   = Math.floor(width / 2);

  // En-têtes
  ctx.fillStyle = "#aaa";
  ctx.fillText("Objet", x, y);
  ctx.fillText("Tier / Matériau", x + colWidth, y);
  y += lineHeight;

  // Séparateur
  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  y += 8;

  const MATERIALS = ["Bois", "Cuivre", "Étain", "Bronze", "Fer", "Fonte", "Acier", "Acier dam."];

  for (let i = 0; i < inventory.length; i++) {
    const item    = inventory[i];
    const isSelected = i === campState.inventoryIndex;

    if (isSelected) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 8, y - 4, width + 16, lineHeight - 4);
      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = item.equipped ? "#7ec8e3" : "white";
    }

    // Nom de l'objet
    const label = item.itemCode
      ? `${item.itemCode} T${item.tier}`
      : `${item.slot ?? "?"} T${item.tier}`;

    ctx.fillText(label + (item.equipped ? " ✓" : ""), x, y);

    // Matériau (armes uniquement)
    if (item.itemType === "weapon") {
      ctx.fillText(MATERIALS[item.material] ?? "?", x + colWidth, y);
    }

    y += lineHeight;
  }

  // Instruction
  ctx.fillStyle = "#555";
  ctx.font      = "14px Arial";
  ctx.fillText("↑↓ naviguer  •  Entrée équiper  •  Échap retour", x, y + 10);
}