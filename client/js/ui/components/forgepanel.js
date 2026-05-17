/*
  FORGE PANEL — Fusion de 2 objets de l'inventaire

  Layout :
    [Cadre Objet 1] [Enclume] [Cadre Objet 2]
    [Liste inventaire (objets non équipés)]

  Panneau droit : résultat de la fusion (prévisualisé)

  Navigation clavier :
    ↑/↓   : naviguer dans la liste d'inventaire
    Entrée : sélectionner / déselectionner un objet
    C      : confirmer la fusion (si 2 objets sélectionnés et résultat valide)
    Échap  : annuler, retour au menu camp

  Intégration :
    - Importer handleForgeKeys() dans le gestionnaire de touches
    - Appeler drawForgePanel() depuis drawCenterPanel() case "forge"
*/

import { MATERIALS }  from "../../core/constants.js";
import { gameData, getArmorName, getShieldName }   from "../../core/gameData.js";
import { WeaponDamage } from "../../core/damagecalc.js";

// ─── Ratios fixes ─────────────────────────────────────────────────────────────
const ANVIL_W_RATIO   = 0.22;
const ANVIL_ASPECT    = 2.0;

const FRAME_W_RATIO   = 0.35;
const FRAME_ASPECT    = 1;

const FRAME_GAP_RATIO = 0.03;

const LIST_H_RATIO    = 0.25;
const LIST_LINE_H     = 28;

// ─── Calcul des dimensions ────────────────────────────────────────────────────
function computeLayout(width, canvasHeight) {
  const anvilW  = Math.floor(width * ANVIL_W_RATIO);
  const anvilH  = Math.floor(anvilW * ANVIL_ASPECT);
  const frameW  = Math.floor(width * FRAME_W_RATIO);
  const frameH  = Math.floor(frameW * FRAME_ASPECT);
  const gap     = Math.floor(width * FRAME_GAP_RATIO);
  const listH   = Math.floor(canvasHeight * LIST_H_RATIO);

  return { anvilW, anvilH, frameW, frameH, gap, listH };
}

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawForgePanel(ctx, campState, x, y, width) {
  if (typeof width !== "number" || width <= 0) throw new Error("drawForgePanel: width invalide");

  if (campState.forgeIndex  === undefined) campState.forgeIndex  = 0;
  if (campState.forgeScroll === undefined) campState.forgeScroll = 0;
  if (!campState.forgeSelected) campState.forgeSelected = [];

  const inventory = campState.inventory ?? [];
  const dim       = computeLayout(width, ctx.canvas.height);

  const centerX   = x + width / 2;
  const frameY    = y;

  const anvilX = centerX - dim.anvilW / 2;
  const anvilY = frameY;

  const leftFrameX  = anvilX - dim.gap - dim.frameW;
  const leftFrameY  = anvilY + (dim.anvilH - dim.frameH) / 2;
  const rightFrameX = anvilX + dim.anvilW + dim.gap;
  const rightFrameY = leftFrameY;

  const selectedItems = campState.forgeSelected.map(id => inventory.find(i => i.id === id)).filter(Boolean);
  const itemA = selectedItems[0] ?? null;
  const itemB = selectedItems[1] ?? null;

  // Dessiner l'enclume
  drawAnvil(ctx, anvilX, anvilY, dim.anvilW, dim.anvilH);

  // Dessiner les 2 cadres
  drawForgeFrame(ctx, leftFrameX, leftFrameY, dim.frameW, dim.frameH,
    itemA, "Objet 1", campState.forgeSelected.length === 0);

  drawForgeFrame(ctx, rightFrameX, rightFrameY, dim.frameW, dim.frameH,
    itemB, "Objet 2", campState.forgeSelected.length === 1);

  // Liste d'inventaire (objets non équipés)
  const listY = frameY + dim.anvilH + 10;
  const listW = width - 20;

  const forgeItems = getForgeItems(inventory);

  drawForgeList(ctx, campState, x + 10, listY, listW, dim.listH, forgeItems);

  // ─── Légende clavier ──────────────────────────────────────────────────────

  const helperY = ctx.canvas.height - 30;
  ctx.fillStyle = "#555";
  ctx.font      = "13px monospace";
  ctx.fillText("↑/↓ naviguer  •  Entrée sélectionner  •  C confirmer  •  Échap retour", x, helperY);
}

// ─── Enclume placeholder ──────────────────────────────────────────────────────

function drawAnvil(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle   = "#888";

  // Base de l'enclume
  const baseW = w * 0.8;
  const baseH = h * 0.15;
  const baseX = x + (w - baseW) / 2;
  const baseY = y + h - baseH;
  ctx.fillRect(baseX, baseY, baseW, baseH);

  // Pied
  const footW = w * 0.3;
  const footH = h * 0.35;
  const footX = x + (w - footW) / 2;
  const footY = baseY - footH;
  ctx.fillRect(footX, footY, footW, footH);

  // Corps de l'enclume
  const bodyW = w * 0.7;
  const bodyH = h * 0.2;
  const bodyX = x + (w - bodyW) / 2;
  const bodyY = footY - bodyH;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Surface (table)
  const topW = w * 0.9;
  const topH = h * 0.08;
  const topX = x + (w - topW) / 2;
  const topY = bodyY - topH;
  ctx.fillRect(topX, topY, topW, topH);

  // Corne (bec)
  const hornW = w * 0.3;
  const hornH = h * 0.06;
  const hornX = x + w * 0.05;
  const hornY = topY + (topH - hornH) / 2;
  ctx.beginPath();
  ctx.moveTo(hornX + hornW, hornY);
  ctx.lineTo(hornX, hornY + hornH / 2);
  ctx.lineTo(hornX + hornW, hornY + hornH);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Cadre d'un emplacement forge ─────────────────────────────────────────────

function drawForgeFrame(ctx, x, y, w, h, item, label, isActive) {
  ctx.save();

  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, w, h);

  if (isActive) { ctx.strokeStyle = "#d4a017"; }
  else          { ctx.strokeStyle = "#555"; }

  ctx.lineWidth = isActive ? 2 : 1;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = isActive ? "#d4a017" : "#888";
  ctx.font      = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y - 8);

  if (item) {
    drawItemInFrame(ctx, x, y, w, h, item);
  } else {
    ctx.fillStyle = "#333";
    ctx.font      = "11px monospace";
    ctx.fillText("vide", x + w / 2, y + h / 2);
  }

  ctx.textAlign = "left";
  ctx.restore();
}

function drawItemInFrame(ctx, x, y, w, h, item) {
  if (item.itemType === "weapon") {
    const weaponDef = gameData.weapons.find(wd => wd.code === item.itemCode);
    if (weaponDef?.image) {
      const img = getOrLoadImage(weaponDef.image);
      if (img?.complete && img.naturalWidth > 0) {
        drawItemImage(ctx, x, y, w, h, img);
        return;
      }
    }
  }

  const label = getItemLabel(item);

  ctx.fillStyle = "#aaa";
  ctx.font      = "11px monospace";
  ctx.textAlign = "center";

  const words = label.split(" ");
  const lines = [];
  let line    = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w - 10 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  let lineY = y + h / 2 - ((lines.length - 1) * 14) / 2;
  for (const l of lines) {
    ctx.fillText(l, x + w / 2, lineY);
    lineY += 14;
  }
}

function drawItemImage(ctx, x, y, w, h, img) {
  const padding = 10;
  const innerW  = w - padding * 2;
  const innerH  = h - padding * 2;
  const ratio   = img.naturalWidth / img.naturalHeight;

  let drawW = innerW;
  let drawH = innerW / ratio;
  if (drawH > innerH) { drawH = innerH; drawW = innerH * ratio; }

  const drawX = x + padding + (innerW - drawW) / 2;
  const drawY = y + padding + (innerH - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// ─── Liste déroulante ─────────────────────────────────────────────────────────

function drawForgeList(ctx, campState, x, y, w, maxH, items) {
  ctx.save();

  const maxVisible = Math.floor(maxH / LIST_LINE_H);
  const selIdx     = campState.forgeIndex  ?? 0;
  let   scroll     = campState.forgeScroll ?? 0;

  if (selIdx < scroll) scroll = selIdx;
  if (selIdx >= scroll + maxVisible) scroll = selIdx - maxVisible + 1;
  campState.forgeScroll = scroll;

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.fillStyle   = "#1a1a1a";
  ctx.fillRect(x, y, w, maxH);
  ctx.strokeRect(x, y, w, maxH);

  if (items.length === 0) {
    ctx.fillStyle = "#555";
    ctx.font      = "13px monospace";
    ctx.fillText("aucun objet disponible", x + 8, y + 20);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, maxH);
  ctx.clip();
  ctx.font = "13px monospace";

  const selected = campState.forgeSelected ?? [];

  for (let i = scroll; i < Math.min(scroll + maxVisible, items.length); i++) {
    const item       = items[i];
    const itemY      = y + (i - scroll) * LIST_LINE_H;
    const isSel      = i === selIdx;
    const isSelected = selected.includes(item.id);

    if (isSel) {
      ctx.fillStyle = "#2a2200";
      ctx.fillRect(x, itemY + 1, w, LIST_LINE_H - 2);
    }

    ctx.fillStyle = isSel ? "#d4a017" : (isSelected ? "#7ec8e3" : "#aaa");
    ctx.fillText(getItemLabel(item) + (isSelected ? " ★" : ""), x + 8, itemY + LIST_LINE_H / 2 + 5);
  }

  ctx.restore();

  if (items.length > maxVisible) {
    const sbH = (maxVisible / items.length) * maxH;
    const sbY = y + (scroll  / items.length) * maxH;
    ctx.fillStyle = "#444";
    ctx.fillRect(x + w - 4, sbY, 3, sbH);
  }

  ctx.restore();
}

// ─── Gestionnaire de touches ──────────────────────────────────────────────────

/**
 * @param {KeyboardEvent} e
 * @param {object} campState
 * @param {Function} previewCallback — onPreview(itemIdA, itemIdB)
 * @param {Function} confirmCallback — onConfirm(itemIdA, itemIdB)
 * @param {Function} escCallback     — onEscape()
 */
export function handleForgeKeys(e, campState, previewCallback, confirmCallback, escCallback) {
  if (typeof previewCallback !== "function") throw new Error("handleForgeKeys: previewCallback doit être une fonction");
  if (typeof confirmCallback !== "function") throw new Error("handleForgeKeys: confirmCallback doit être une fonction");
  if (typeof escCallback     !== "function") throw new Error("handleForgeKeys: escCallback doit être une fonction");

  const inventory = campState.inventory ?? [];
  const items     = getForgeItems(inventory);
  const selected  = campState.forgeSelected ?? [];

  switch (e.key) {

    case "ArrowUp": {
      const idx = campState.forgeIndex ?? 0;
      campState.forgeIndex = Math.max(0, idx - 1);
      return true;
    }

    case "ArrowDown": {
      const idx = campState.forgeIndex ?? 0;
      campState.forgeIndex = Math.min(items.length - 1, idx + 1);
      return true;
    }

    case "Enter": {
      if (items.length === 0) return true;
      const item = items[campState.forgeIndex ?? 0];
      if (!item) return true;

      const idx = selected.indexOf(item.id);
      if (idx !== -1) {
        // Déselectionner
        selected.splice(idx, 1);
        campState.forgeSelected = selected;
        campState.forgePreview  = null;
      } else {
        if (selected.length >= 2) return true;
        selected.push(item.id);
        campState.forgeSelected = selected;

        // Si 2 objets sélectionnés, demander la prévisualisation
        if (selected.length === 2) {
          previewCallback(selected[0], selected[1]);
        } else {
          campState.forgePreview = null;
        }
      }
      return true;
    }

    case "c":
    case "C": {
      if (selected.length !== 2) return true;
      if (!campState.forgePreview?.ok) return true;
      confirmCallback(selected[0], selected[1]);
      return true;
    }

    case "Escape": {
      escCallback();
      return true;
    }
  }

  return false;
}

// ─── Panneau résultat (panneau droit) ─────────────────────────────────────────

export function drawForgeResult(ctx, campState, x, y, width) {
  const selected = campState.forgeSelected ?? [];
  const preview  = campState.forgePreview;

  let currentY = y;
  const lineH  = 24;

  ctx.fillStyle = "#d4a017";
  ctx.font      = "bold 15px monospace";
  ctx.fillText("Résultat de la forge", x, currentY);
  currentY += lineH + 8;

  ctx.strokeStyle = "#333";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, currentY);
  ctx.lineTo(x + width - 10, currentY);
  ctx.stroke();
  currentY += 12;

  // 0 objet sélectionné
  if (selected.length === 0) {
    ctx.fillStyle = "#555";
    ctx.font      = "13px monospace";
    ctx.fillText("Sélectionnez 2 objets", x, currentY);
    ctx.fillText("à fusionner", x, currentY + lineH);
    return;
  }

  // 1 objet sélectionné
  if (selected.length === 1) {
    ctx.fillStyle = "#555";
    ctx.font      = "13px monospace";
    ctx.fillText("Sélectionnez un 2ème objet", x, currentY);
    return;
  }

  // 2 objets sélectionnés mais fusion impossible
  if (!preview || !preview.ok) {
    ctx.fillStyle = "#e57373";
    ctx.font      = "13px monospace";
    ctx.fillText("Fusion impossible", x, currentY);
    return;
  }

  // 2 objets compatibles — afficher le résultat
  const result = preview.result;

  // Image de l'arme résultante
  if (result.itemType === "weapon") {
    const weaponDef = gameData.weapons.find(w => w.code === result.itemCode);
    if (weaponDef?.image) {
      const img = getOrLoadImage(weaponDef.image);
      if (img?.complete && img.naturalWidth > 0) {
        const imgSize = Math.min(width - 20, 140);
        const ratio   = img.naturalWidth / img.naturalHeight;
        const drawH   = imgSize;
        const drawW   = Math.min(imgSize * ratio, width - 20);
        const drawX   = x + (width - drawW) / 2;
        ctx.drawImage(img, drawX, currentY, drawW, drawH);
        currentY += drawH + 16;
      }
    }
  }

  ctx.fillStyle = "#d4a017";
  ctx.font      = "bold 14px monospace";
  if (result.itemType === "weapon") {
    const matName = MATERIALS[result.material]?.name ?? "?";
    ctx.fillText(`${result.name} en ${matName}`, x, currentY);
  } else {
    ctx.fillText(result.name, x, currentY);
  }
  currentY += lineH + 4;

  function drawLine(label, value) {
    ctx.fillStyle = "#888";
    ctx.font      = "13px monospace";
    ctx.fillText(label, x, currentY);
    ctx.fillStyle = "white";
    ctx.fillText(value, x + 120, currentY);
    currentY += lineH;
  }

  // Afficher les dégâts uniquement pour les armes (pas bouclier ni armure)
  if (result.itemType === "weapon") {
    const weaponDef = gameData.weapons.find(w => w.code === result.itemCode);
    if (weaponDef) {
      const WEAPON = {
        tier:     result.tier,
        materiau: (result.material ?? 0) + 1,
        models:   weaponDef.models,
        damFirst: weaponDef.damFirst,
        damLast:  weaponDef.damLast
      };
      const dmg = WeaponDamage(WEAPON);
      drawLine("Dégâts :", `${dmg}`);
    }
  }

  if (result.itemType === "weapon") {
    currentY += 8;
    ctx.fillStyle = "#888";
    ctx.font      = "13px monospace";
    ctx.fillText("Affinités", x, currentY);
    currentY += lineH;

    const AFFINITY_LABELS = {
      bestial:     "Bestial",
      elementaire: "Élémentaire",
      feerique:    "Féérique",
      demoniaque:  "Démoniaque",
      undead:      "Undead",
      reptilien:   "Reptilien"
    };

    for (const key of Object.keys(AFFINITY_LABELS)) {
      const value = result.affinities[key] ?? 0;
      ctx.fillStyle = "#aaa";
      ctx.font      = "12px monospace";
      ctx.fillText(AFFINITY_LABELS[key], x, currentY);
      ctx.fillStyle = value > 0 ? "#4caf50" : value < 0 ? "#e57373" : "#555";
      ctx.textAlign = "right";
      ctx.fillText(value > 0 ? `+${value}` : `${value}`, x + width - 12, currentY);
      ctx.textAlign = "left";
      currentY += lineH;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const imageCache = {};

function getOrLoadImage(path) {
  if (!path) return null;
  if (!imageCache[path]) {
    const img = new Image();
    img.src   = `/assets/weapons/${path}`;
    imageCache[path] = img;
  }
  return imageCache[path];
}

export function getForgeItems(inventory) {
  // Tous les objets non équipés (armes, armures, boucliers)
  const items = inventory.filter(i => !i.equipped && !i.equippedSlot);

  items.sort(function sortByTypeAndTier(a, b) {
    // Trier par itemType d'abord (weapon, armor, shield)
    if (a.itemType < b.itemType) return -1;
    if (a.itemType > b.itemType) return  1;

    // Pour les armes : trier par weaponType (itemCode) puis tier
    if (a.itemType === "weapon") {
      const defA = gameData.weapons.find(w => w.code === a.itemCode);
      const defB = gameData.weapons.find(w => w.code === b.itemCode);
      const typeA = defA?.weaponType ?? "";
      const typeB = defB?.weaponType ?? "";
      if (typeA < typeB) return -1;
      if (typeA > typeB) return  1;
    }

    // Pour les armures : trier par slot puis tier
    if (a.itemType === "armor") {
      if (a.slot < b.slot) return -1;
      if (a.slot > b.slot) return  1;
    }

    // Tier croissant
    return (a.tier ?? 1) - (b.tier ?? 1);
  });

  return items;
}

function getItemLabel(item) {
  if (item.itemType === "weapon") {
    const weaponDef  = gameData.weapons.find(w => w.code === item.itemCode);
    const modelIndex = (item.tier ?? 1) - 1;
    const weaponName = weaponDef?.models?.[modelIndex] ?? item.itemCode;
    const matName    = MATERIALS[item.material]?.name ?? "?";
    return `${weaponName} en ${matName}`;
  }
  if (item.itemType === "armor") {
    return getArmorName(item.slot, item.tier) ?? `Armure T${item.tier}`;
  }
  if (item.itemType === "shield") {
    return getShieldName(item.itemCode, item.tier) ?? `Bouclier T${item.tier}`;
  }
  return item.itemCode ?? "?";
}
