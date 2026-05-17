/*
  CAMP.JS
  Interface du mode CAMP.
*/

import { CAMP_OPTIONS }        from "../core/constants.js";
import { getLayout }           from "../core/constants.js";
import { MATERIALS }           from "../core/constants.js";
import { drawPlayerCard }      from "./components/characterCard.js";
import { gameData }            from "../core/gameData.js";
import { drawEquipPanel, getCompatibleItems } from "./components/equippanel.js";
import { drawArmorEquipPanel, getArmorItemsForSlot } from "./components/equiparmorpanel.js";
import { drawForgePanel, drawForgeResult } from "./components/forgepanel.js";
import {
  WeaponDamage,
  getDamageTypeLabel,
  getAffinityLabel,
  AFFINITY_KEYS
} from "../core/damagecalc.js";

export function drawCamp(ctx, player, campState = {}) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  const layout = getLayout(ctx.canvas.width, ctx.canvas.height);

  drawLeftPanel(ctx, player, layout);
  drawCenterPanel(ctx, campState, layout, player);
  drawRightPanel(ctx, layout, campState);
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
    menu:       "Campement",
    rest:       "Repos",
    equip:      "Équipement (armes)",
    equipArmor: "Équipement (armures)",
    forge:      "Forge"
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
    case "equip":
      drawEquipPanel(ctx, campState, centerX + padding, padding + 46, centerWidth - padding * 2, player);
      break;
    case "equipArmor":
      drawArmorEquipPanel(ctx, campState, centerX + padding, padding + 46, centerWidth - padding * 2, player);
      break;
    case "forge":
      drawForgePanel(ctx, campState, centerX + padding, padding + 46, centerWidth - padding * 2);
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

function drawRightPanel(ctx, layout, campState) {
  const { rightX, rightWidth, height, padding } = layout;

  ctx.fillStyle = "#161616";
  ctx.fillRect(rightX, 0, rightWidth, height);

  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(rightX, 0);
  ctx.lineTo(rightX, height);
  ctx.stroke();

  // En mode équip : afficher les détails de l'arme sélectionnée dans la liste
  if (campState.mode === "equip") {
    const inventory = campState.inventory ?? [];
    const hand      = campState.equipSelectedHand ?? "right";
    const items     = getCompatibleItems(inventory, hand);
    const selIdx    = campState.equipIndex ?? 0;
    const selectedItem = items[selIdx];

    if (selectedItem) {
      drawItemDetail(ctx, selectedItem, rightX + padding, padding, rightWidth - padding * 2);
    }
    return;
  }

  // En mode equipArmor : afficher les détails de l'armure sélectionnée
  if (campState.mode === "equipArmor") {
    const inventory = campState.inventory ?? [];
    const slot      = campState.armorSelectedSlot ?? "tete";
    const items     = getArmorItemsForSlot(inventory, slot);
    const selIdx    = campState.armorIndex ?? 0;
    const selectedItem = items[selIdx];

    if (selectedItem) {
      drawArmorDetail(ctx, selectedItem, rightX + padding, padding, rightWidth - padding * 2);
    }
    return;
  }

  // En mode forge : afficher le résultat de la fusion
  if (campState.mode === "forge") {
    drawForgeResult(ctx, campState, rightX + padding, padding, rightWidth - padding * 2);
    return;
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

// ─── Détail item ──────────────────────────────────────────────────────────────

function drawItemDetail(ctx, item, x, y, width) {
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

  drawLine("Type :",        weaponDef.typeArme);
  drawLine("Dégâts :",      getDamageTypeLabel(weaponDef.damageType));
  drawLine("Maniement :",   hands);

  // Dégâts calculés via WeaponDamage (base selon tier et matériau)
  const WEAPON = {
    tier:     item.tier ?? 1,
    materiau: (item.material ?? 0) + 1,
    models:   weaponDef.models,
    damFirst: weaponDef.damFirst,
    damLast:  weaponDef.damLast
  };
  const dmg = WeaponDamage(WEAPON);

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Détail armure (panneau droit) ────────────────────────────────────────────

function drawArmorDetail(ctx, item, x, y, width) {
  if (item.itemType !== "armor") return;

  const slotArmors = gameData.armors[item.slot];
  if (!slotArmors) return;

  const armorDef = slotArmors.find(a => a.tier === (item.tier ?? 1));
  if (!armorDef) return;

  let currentY = y;
  const lineH  = 24;

  // ─── Nom ──────────────────────────────────────────────────────────────────

  ctx.fillStyle = "#d4a017";
  ctx.font      = "bold 15px monospace";
  ctx.fillText(armorDef.name, x, currentY);
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

  const SLOT_LABELS = { tete: "Tête", corps: "Corps", bras: "Bras", jambes: "Jambes" };

  drawLine("Emplacement :", SLOT_LABELS[item.slot] ?? item.slot);
  drawLine("Armure :",      `${armorDef.reduction}`);
  drawLine("Poids :",       `${armorDef.weight}`);
}