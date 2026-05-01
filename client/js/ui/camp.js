/*
  CAMP.JS
  Interface du mode CAMP.
*/

import { CAMP_OPTIONS }        from "../core/constants.js";
import { drawPlayerCard }      from "./components/characterCard.js";
import { gameData, MATERIALS } from "../core/gameData.js";

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

  const MODE_LABELS = {
    menu:      "Campement",
    rest:      "Repos",
    inventory: "Inventaire",
    equip:     "Équiper"
  };

  ctx.fillStyle = "white";
  ctx.font      = "bold 30px Arial";
  ctx.fillText(MODE_LABELS[campState.mode] ?? "Camp", x + padding, padding);

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
    case "equip":
      drawEquipPanel(ctx, campState, x + padding, contentY, width - padding * 2);
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

  const lineHeight   = 40;
  const optionWidth  = 300;
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

  ctx.fillStyle = "#555";
  ctx.font      = "14px Arial";
  ctx.fillText("Échap retour", x, y + 40);
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

  ctx.font = "18px Arial";
  const lineHeight = 32;
  const maxHeight  = 500; // Hauteur maximale de la zone visible
  const maxItems   = Math.floor(maxHeight / lineHeight); // Nombre d'items visibles
  const scroll     = campState.inventoryScroll ?? 0;

  // Calcule l'offset de scroll pour garder l'item sélectionné visible
  const selectedIndex = campState.inventoryIndex ?? 0;
  let newScroll = scroll;
  if (selectedIndex < newScroll) {
    newScroll = selectedIndex;
  } else if (selectedIndex >= newScroll + maxItems) {
    newScroll = selectedIndex - maxItems + 1;
  }
  campState.inventoryScroll = newScroll;

  // Zone visible avec bordure
  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x - 8, y - 4, width + 16, maxHeight);

  // Clipping pour limiter le rendu à la zone visible
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, y - 4, width + 16, maxHeight);
  ctx.clip();

  let itemY = y;
  for (let i = newScroll; i < Math.min(newScroll + maxItems, inventory.length); i++) {
    const item       = inventory[i];
    const isSelected = i === selectedIndex;

    if (isSelected) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 8, itemY - 4, width + 16, lineHeight - 4);
      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = item.equipped ? "#7ec8e3" : "white";
    }

    // Nom lisible depuis gameData — pas de duplication
    let label = getItemLabel(item);

    if (item.equipped) label += " ✓";

    ctx.fillText(label, x, itemY);
    itemY += lineHeight;
  }

  ctx.restore();

  // Indicateur de scroll
  if (inventory.length > maxItems) {
    const scrollY = y + (newScroll / inventory.length) * maxHeight;
    const scrollHeight = (maxItems / inventory.length) * maxHeight;
    ctx.fillStyle = "#666";
    ctx.fillRect(x + width + 10, scrollY, 4, scrollHeight);
  }

  ctx.fillStyle = "#555";
  ctx.font      = "14px Arial";
  ctx.fillText("↑↓ naviguer  •  Entrée jeter (non équippé)  •  Échap retour", x, y + maxHeight + 20);
}

// ─── Équiper ──────────────────────────────────────────────────────────────────

function drawEquipPanel(ctx, campState, x, y, width) {
  const inventory = campState.inventory ?? [];

  // Afficher les mains
  ctx.fillStyle = "white";
  ctx.font      = "20px Arial";

  const rightHand = inventory.find(item => item.equippedSlot === "rightHand");
  const leftHand  = inventory.find(item => item.equippedSlot === "leftHand");

  const rightLabel = rightHand ? getItemLabel(rightHand) : "Vide";
  const leftLabel  = leftHand ? getItemLabel(leftHand) : "Vide";

  const handY = y;
  ctx.fillText(`Main droite: ${rightLabel}`, x, handY);
  ctx.fillText(`Main gauche: ${leftLabel}`, x, handY + 30);

  // Sélection de main
  const selectedHand = campState.equipSelectedHand ?? "right";
  const handIndex = selectedHand === "right" ? 0 : 1;
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;
  const rectY = handY + handIndex * 30 - 5;
  ctx.strokeRect(x - 10, rectY, width, 25);

  // Liste des armes
  const listY = handY + 80;
  ctx.fillStyle = "white";
  ctx.font      = "18px Arial";
  ctx.fillText("Armes disponibles:", x, listY);

  const weapons = inventory.filter(item => item.itemType === "weapon");
  if (weapons.length === 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("Aucune arme", x, listY + 30);
    return;
  }

  const lineHeight = 32;
  const maxHeight  = 500; // Hauteur maximale de la zone visible
  const maxItems   = Math.floor(maxHeight / lineHeight); // Nombre d'items visibles
  const scroll     = campState.equipScroll ?? 0;

  // Calcule l'offset de scroll pour garder l'item sélectionné visible
  const selectedIndex = campState.equipIndex ?? 0;
  let newScroll = scroll;
  if (selectedIndex < newScroll) {
    newScroll = selectedIndex;
  } else if (selectedIndex >= newScroll + maxItems) {
    newScroll = selectedIndex - maxItems + 1;
  }
  campState.equipScroll = newScroll;

  // Zone visible avec bordure
  const listContentY = listY + 40;
  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x - 8, listContentY - 4, width + 16, maxHeight);

  // Clipping pour limiter le rendu à la zone visible
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, listContentY - 4, width + 16, maxHeight);
  ctx.clip();

  let itemY = listContentY;
  for (let i = newScroll; i < Math.min(newScroll + maxItems, weapons.length); i++) {
    const item       = weapons[i];
    const isSelected = i === selectedIndex;

    if (isSelected) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 8, itemY - 4, width + 16, lineHeight - 4);
      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = item.equipped ? "#7ec8e3" : "white";
    }

    const label = getItemLabel(item);
    ctx.fillText(label, x, itemY);
    itemY += lineHeight;
  }

  ctx.restore();

  // Indicateur de scroll
  if (weapons.length > maxItems) {
    const scrollY = listContentY + (newScroll / weapons.length) * maxHeight;
    const scrollHeight = (maxItems / weapons.length) * maxHeight;
    ctx.fillStyle = "#666";
    ctx.fillRect(x + width + 10, scrollY, 4, scrollHeight);
  }

  ctx.fillStyle = "#555";
  ctx.font      = "14px Arial";
  ctx.fillText("Tab changer main  •  ↑↓ naviguer  •  Entrée équiper  •  Échap retour", x, listContentY + maxHeight + 20);
}

function getItemLabel(item) {
  if (item.itemType === "weapon") {
    const weaponDef  = gameData.weapons.find(w => w.code === item.itemCode);
    const modelIndex = item.tier - 1;
    const weaponName = weaponDef?.models?.[modelIndex] ?? item.itemCode;
    const matName    = MATERIALS[item.material] ?? "?";
    return `${weaponName} en ${matName}`;
  }
  return `${item.slot ?? "?"} T${item.tier}`;
}