/*
  CAMP.JS
  Interface du mode CAMP.
*/

import { CAMP_OPTIONS }        from "../core/constants.js";
import { getLayout }           from "../core/constants.js";
import { drawPlayerCard }      from "./components/characterCard.js";
import { gameData, MATERIALS } from "../core/gameData.js";
import { drawEquipPanel }      from "./components/equipPanel.js";
import {
  computeWeaponDamage,
  getDamageTypeLabel,
  getAffinityLabel,
  AFFINITY_KEYS
} from "../core/damagecalc.js";
import { computeEquipMessages } from "../core/equipchecks.js";

export function drawCamp(ctx, player, campState = {}) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  const layout = getLayout(ctx.canvas.width, ctx.canvas.height);

  drawLeftPanel(ctx, player, layout);
  drawCenterPanel(ctx, campState, layout, player);
  drawRightPanel(ctx, layout, campState, player);
}

// ─── Panneau gauche — carte joueur ───────────────────────────────────────────

function drawLeftPanel(ctx, player, layout) {
  const { leftWidth, padding } = layout;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, leftWidth, ctx.canvas.height);

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(leftWidth, 0);
  ctx.lineTo(leftWidth, ctx.canvas.height);
  ctx.stroke();

  drawPlayerCard(ctx, player, padding, padding, leftWidth - padding * 2, true);
}

// ─── Panneau central — contenu selon mode ────────────────────────────────────

function drawCenterPanel(ctx, campState, layout, player) {
  const { centerX, centerWidth, padding } = layout;

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(centerX, 0, centerWidth, layout.height);

  const MODE_LABELS = {
    menu:      "Campement",
    rest:      "Repos",
    inventory: "Inventaire",
    equip:     "Équiper"
  };

  ctx.fillStyle = "white";
  ctx.font      = "bold 30px Arial";
  ctx.fillText(MODE_LABELS[campState.mode] ?? "Camp", centerX + padding, padding);

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(centerX + padding, padding + 40);
  ctx.lineTo(centerX + centerWidth - padding, padding + 40);
  ctx.stroke();

  const contentY = padding + 70;

  switch (campState.mode) {
    case "inventory":
      drawInventoryPanel(ctx, campState, centerX + padding, contentY,
        centerWidth - padding * 2, layout.height - contentY - padding, player);
      break;
    case "equip":
      drawEquipPanel(ctx, campState, centerX + padding, contentY, centerWidth - padding * 2);
      break;
    case "rest":
      drawRestPanel(ctx, centerX + padding, contentY);
      break;
    default:
      drawMainMenu(ctx, centerX + padding, contentY, campState);
      break;
  }
}

// ─── Panneau droit — messages équipement ─────────────────────────────────────

function drawRightPanel(ctx, layout, campState, player) {
  const { rightX, rightWidth, height, padding } = layout;

  ctx.fillStyle = "#161616";
  ctx.fillRect(rightX, 0, rightWidth, height);

  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 0);
  ctx.lineTo(rightX, height);
  ctx.stroke();

  // Affichage uniquement en mode équip avec joueur et inventaire disponibles
  if (campState.mode !== "equip" || !player?.stats || !campState.inventory) return;

  const inventory    = campState.inventory;
  const rightItem    = inventory.find(i => i.equippedSlot === "rightHand");
  const leftItem     = inventory.find(i => i.equippedSlot === "leftHand");

  const rightDef     = rightItem ? gameData.weapons.find(w => w.code === rightItem.itemCode) : null;
  const leftDef      = leftItem  ? gameData.weapons.find(w => w.code === leftItem.itemCode)  : null;
  const leftIsShield = leftDef ? (leftDef.damFirst === 0 && leftDef.damLast === 0) : false;

  if (!rightDef && !leftDef) return;

  const messages = computeEquipMessages(
    player.stats, player.name, rightDef, leftDef, leftIsShield
  );

  // ─── Titre ────────────────────────────────────────────────────────────────

  const x = rightX + padding;
  let   y = padding;

  ctx.fillStyle = "#888";
  ctx.font      = "13px monospace";
  ctx.fillText("Aptitude au combat", x, y);
  y += 8;

  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.lineTo(rightX + rightWidth - padding, y + 14);
  ctx.stroke();
  y += 28;

  // ─── Messages ─────────────────────────────────────────────────────────────

  const lineH  = 18;
  const maxW   = rightWidth - padding * 2;

  ctx.font = "12px monospace";

  for (const msg of messages) {
    ctx.fillStyle = "white";

    // Retour à la ligne automatique
    const words = msg.split(" ");
    let   line  = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        y    += lineH;
        line  = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
    y += 6; // espace entre messages
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

function drawInventoryPanel(ctx, campState, x, y, width, height, player) {
  const inventory = campState.inventory ?? [];
  const halfW     = Math.floor(width / 2) - 10;
  const detailX   = x + halfW + 20;
  const detailW   = width - halfW - 20;

  if (inventory.length === 0) {
    ctx.fillStyle = "#888";
    ctx.font      = "18px Arial";
    ctx.fillText("Inventaire vide", x, y);
    return;
  }

  // ─── Liste gauche ─────────────────────────────────────────────────────────

  ctx.font = "18px Arial";
  const lineHeight = 32;
  const maxHeight  = height - 60; // réserve pour légende
  const maxItems   = Math.floor(maxHeight / lineHeight);
  const scroll     = campState.inventoryScroll ?? 0;

  const selectedIndex = campState.inventoryIndex ?? 0;
  let newScroll = scroll;
  if (selectedIndex < newScroll) newScroll = selectedIndex;
  else if (selectedIndex >= newScroll + maxItems) newScroll = selectedIndex - maxItems + 1;
  campState.inventoryScroll = newScroll;

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x - 8, y - 4, halfW + 16, maxHeight);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, y - 4, halfW + 16, maxHeight);
  ctx.clip();

  let itemY = y;
  for (let i = newScroll; i < Math.min(newScroll + maxItems, inventory.length); i++) {
    const item       = inventory[i];
    const isSelected = i === selectedIndex;

    if (isSelected) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 8, itemY - 4, halfW + 16, lineHeight - 4);
      ctx.fillStyle = "yellow";
    } else {
      ctx.fillStyle = item.equippedSlot ? "#7ec8e3" : "white";
    }

    let label = getItemLabel(item);
    if (item.equippedSlot) label += " ✓";
    ctx.fillText(label, x, itemY);
    itemY += lineHeight;
  }

  ctx.restore();

  if (inventory.length > maxItems) {
    const scrollY      = y + (newScroll / inventory.length) * maxHeight;
    const scrollHeight = (maxItems / inventory.length) * maxHeight;
    ctx.fillStyle = "#666";
    ctx.fillRect(x + halfW + 10, scrollY, 4, scrollHeight);
  }

  // ─── Légende / dialog confirmation ────────────────────────────────────────

  const legendY = y + maxHeight + 10;

  if (campState.inventoryConfirm) {
    drawDeleteConfirm(ctx, campState, x, legendY, halfW);
  } else {
    ctx.fillStyle = "#555";
    ctx.font      = "13px Arial";
    ctx.fillText("↑↓ naviguer  •  Entrée supprimer  •  Échap retour", x, legendY);
  }

  // ─── Détail item droite ───────────────────────────────────────────────────

  const selectedItem = inventory[selectedIndex];
  if (selectedItem) {
    drawItemDetail(ctx, selectedItem, detailX, y, detailW, player);
  }
}

// ─── Détail item ──────────────────────────────────────────────────────────────

function drawItemDetail(ctx, item, x, y, width, player) {
  if (item.itemType !== "weapon") return;

  const weaponDef = gameData.weapons.find(w => w.code === item.itemCode);
  if (!weaponDef) {
    console.error(`drawItemDetail: aucune def pour itemCode="${item.itemCode}"`);
    return;
  }

  const material = MATERIALS[item.material];
  if (!material) {
    console.error(`drawItemDetail: matériau inconnu index=${item.material}`);
    return;
  }

  let currentY = y;
  const lineH  = 24;
  const imgSize = Math.min(width - 20, 140);

  // ─── Image ────────────────────────────────────────────────────────────────

  if (weaponDef.image) {
    const img = getOrLoadImage(weaponDef.image);
    if (img?.complete && img.naturalWidth > 0) {
      const ratio  = img.naturalWidth / img.naturalHeight;
      const drawH  = imgSize;
      const drawW  = Math.min(imgSize * ratio, width - 20);
      const drawX  = x + (width - drawW) / 2;
      ctx.drawImage(img, drawX, currentY, drawW, drawH);
      currentY += drawH + 16;
    } else {
      currentY += 20;
    }
  }

  // ─── Nom (modèle + matériau) ──────────────────────────────────────────────

  const modelIndex = (item.tier ?? 1) - 1;
  const modelName  = weaponDef.models?.[modelIndex] ?? weaponDef.typeArme;
  const matName    = material.name;

  ctx.fillStyle = "#d4a017";
  ctx.font      = "bold 15px monospace";
  ctx.fillText(`${modelName} en ${matName}`, x, currentY);
  currentY += lineH + 4;

  // ─── Infos ────────────────────────────────────────────────────────────────

  function drawLine(label, value) {
    ctx.fillStyle = "#888";
    ctx.font      = "13px monospace";
    ctx.fillText(label, x, currentY);
    ctx.fillStyle = "white";
    ctx.fillText(value, x + 140, currentY);
    currentY += lineH;
  }

  const hands    = weaponDef.hd === 2 ? "2 mains" : "1 main";
  const dmgType  = getDamageTypeLabel(weaponDef.damageType);
  const nbTiers  = weaponDef.models?.length ?? 1;
  const baseArme = weaponDef.damFirst +
    (weaponDef.damLast - weaponDef.damFirst) * ((item.tier ?? 1) - 1) / Math.max(nbTiers - 1, 1);

  drawLine("Type :",        weaponDef.typeArme);
  drawLine("Dégâts :",      getDamageTypeLabel(weaponDef.damageType));
  drawLine("Maniement :",   hands);

  // Dégâts calculés (sans modAffinité ni modTypeDégâts)
  const dmg = player?.stats
    ? computeWeaponDamage(item, weaponDef, material, player.stats)
    : Math.floor(baseArme * material.modMat);

  drawLine("Dégâts :",      `${dmg}`);

  currentY += 8;

  // ─── Séparateur ───────────────────────────────────────────────────────────

  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, currentY);
  ctx.lineTo(x + width - 10, currentY);
  ctx.stroke();
  currentY += 12;

  // ─── Affinités ────────────────────────────────────────────────────────────

  ctx.fillStyle = "#888";
  ctx.font      = "13px monospace";
  ctx.fillText("Affinités", x, currentY);
  currentY += lineH;

  for (const key of AFFINITY_KEYS) {
    const value = item[key] ?? 0;
    const label = getAffinityLabel(key);

    // Barre d'affinité (-100 à +100)
    const barW    = width - 20;
    const barH    = 8;
    const barX    = x;
    const barY    = currentY + 14;
    const midX    = barX + barW / 2;
    const fillW   = Math.abs(value) / 100 * (barW / 2);

    // Fond barre
    ctx.fillStyle = "#222";
    ctx.fillRect(barX, barY, barW, barH);

    // Ligne centrale
    ctx.strokeStyle = "#444";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(midX, barY);
    ctx.lineTo(midX, barY + barH);
    ctx.stroke();

    // Remplissage
    if (value !== 0) {
      ctx.fillStyle = value > 0 ? "#2a6e2a" : "#6e2a2a";
      if (value > 0) ctx.fillRect(midX, barY, fillW, barH);
      else           ctx.fillRect(midX - fillW, barY, fillW, barH);
    }

    // Label + valeur
    ctx.fillStyle = "#aaa";
    ctx.font      = "12px monospace";
    ctx.fillText(label, x, currentY);
    ctx.fillStyle = value > 0 ? "#4caf50" : value < 0 ? "#e57373" : "#555";
    ctx.textAlign = "right";
    ctx.fillText(value > 0 ? `+${value}` : `${value}`, x + width - 12, currentY);
    ctx.textAlign = "left";

    currentY += lineH + 6;
  }
}

// ─── Dialog confirmation suppression ─────────────────────────────────────────

function drawDeleteConfirm(ctx, campState, x, y, width) {
  if (!campState.inventoryConfirm) {
    console.error("drawDeleteConfirm: inventoryConfirm manquant");
    return;
  }

  const item  = campState.inventoryConfirm;
  const label = getItemLabel(item);

  const dialogH = 80;
  ctx.fillStyle = "#1e1000";
  ctx.fillRect(x - 8, y - 10, width + 16, dialogH);
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x - 8, y - 10, width + 16, dialogH);

  ctx.fillStyle = "white";
  ctx.font      = "13px monospace";
  ctx.fillText(`Détruire "${label}" ?`, x, y + 4);

  const confirmChoice = campState.inventoryConfirmChoice ?? 1;
  const btnY          = y + 34;
  const btnW          = 70;
  const btnH          = 26;
  const ouiX          = x + width / 2 - btnW - 12;
  const nonX          = x + width / 2 + 12;

  ctx.fillStyle   = confirmChoice === 0 ? "#8b0000" : "#2a2a2a";
  ctx.fillRect(ouiX, btnY, btnW, btnH);
  ctx.strokeStyle = confirmChoice === 0 ? "#ff4444" : "#555";
  ctx.lineWidth   = confirmChoice === 0 ? 2 : 1;
  ctx.strokeRect(ouiX, btnY, btnW, btnH);
  ctx.fillStyle   = confirmChoice === 0 ? "#ff4444" : "#666";
  ctx.font        = "13px monospace";
  ctx.textAlign   = "center";
  ctx.fillText("Oui", ouiX + btnW / 2, btnY + 7);

  ctx.fillStyle   = confirmChoice === 1 ? "#003300" : "#2a2a2a";
  ctx.fillRect(nonX, btnY, btnW, btnH);
  ctx.strokeStyle = confirmChoice === 1 ? "#44ff44" : "#555";
  ctx.lineWidth   = confirmChoice === 1 ? 2 : 1;
  ctx.strokeRect(nonX, btnY, btnW, btnH);
  ctx.fillStyle   = confirmChoice === 1 ? "#44ff44" : "#666";
  ctx.fillText("Non", nonX + btnW / 2, btnY + 7);

  ctx.textAlign = "left";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemLabel(item) {
  if (!item) {
    console.error("getItemLabel: item manquant");
    return "?";
  }
  if (item.itemType === "weapon") {
    const weaponDef  = gameData.weapons.find(w => w.code === item.itemCode);
    const modelIndex = (item.tier ?? 1) - 1;
    const weaponName = weaponDef?.models?.[modelIndex] ?? item.itemCode;
    const matName    = MATERIALS[item.material]?.name ?? "?";
    return `${weaponName} en ${matName}`;
  }
  return `${item.slot ?? "?"} T${item.tier}`;
}

const imageCache = {};

function getOrLoadImage(path) {
  if (!path) {
    console.error("getOrLoadImage: path manquant");
    return null;
  }
  if (!imageCache[path]) {
    const img = new Image();
    img.src   = `/assets/weapons/${path}`;
    imageCache[path] = img;
  }
  return imageCache[path];
}