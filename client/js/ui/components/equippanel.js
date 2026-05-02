/*
  EQUIP PANEL — Gestion des mains (main droite / main gauche)

  Layout :
    [Cadre Main Droite] [Silhouette] [Cadre Main Gauche]
    [Liste MD sous cadre]            [Liste MG sous cadre]

  Toutes les dimensions sont calculées proportionnellement à la largeur
  disponible — s'adapte à toute résolution sans stretching.

  Navigation clavier :
    ←/→   : changer de main active
    ↑/↓   : naviguer dans la liste déroulante
    Entrée : équiper / déséquiper l'item sélectionné
    Échap  : retour au menu camp

  Intégration :
    - Importer handleEquipKeys() dans le gestionnaire de touches du camp
    - Appeler drawEquipPanel() depuis drawCenterPanel() case "equip"
*/

import { gameData, MATERIALS } from "../../core/gameData.js";

// ─── Ratios fixes — proportions préservées quelle que soit la résolution ──────

const SILHOUETTE_W_RATIO = 0.22;   // % de la largeur disponible
const SILHOUETTE_ASPECT  = 2.0;    // hauteur = largeur × 2

const FRAME_W_RATIO      = 0.35;   // % de la largeur disponible
const FRAME_ASPECT       = 1.35;   // hauteur = largeur × 1.35

const FRAME_GAP_RATIO    = 0.03;   // % de la largeur disponible

const LIST_H_RATIO       = 0.25;   // % de la hauteur canvas
const LIST_LINE_H        = 28;

// ─── Calcul des dimensions depuis la largeur disponible ───────────────────────

function computeLayout(width, canvasHeight) {
  const silW    = Math.floor(width * SILHOUETTE_W_RATIO);
  const silH    = Math.floor(silW  * SILHOUETTE_ASPECT);
  const frameW  = Math.floor(width * FRAME_W_RATIO);
  const frameH  = Math.floor(frameW * FRAME_ASPECT);
  const gap     = Math.floor(width * FRAME_GAP_RATIO);
  const listH   = Math.floor(canvasHeight * LIST_H_RATIO);

  return { silW, silH, frameW, frameH, gap, listH };
}

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawEquipPanel(ctx, campState, x, y, width) {
  if (typeof width !== "number" || width <= 0) throw new Error("drawEquipPanel: width invalide");

  if (!campState.equipSelectedHand) campState.equipSelectedHand = "right";
  if (campState.equipIndex  === undefined) campState.equipIndex  = 0;
  if (campState.equipScroll === undefined) campState.equipScroll = 0;

  const inventory = campState.inventory ?? [];
  const dim       = computeLayout(width, ctx.canvas.height);

  const centerX   = x + width / 2;
  const frameY    = y + 20;

  const silX = centerX - dim.silW / 2;
  const silY = frameY;

  const rightFrameX = silX - dim.gap - dim.frameW;
  const rightFrameY = silY + (dim.silH - dim.frameH) / 2;
  const leftFrameX  = silX + dim.silW + dim.gap;
  const leftFrameY  = rightFrameY;

  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const leftHandItem  = inventory.find(i => i.equippedSlot === "leftHand");
  const leftBlocked   = rightHandItem && getWeaponDef(rightHandItem)?.hd === 2;

  const rightActive = campState.equipSelectedHand === "right";
  const leftActive  = campState.equipSelectedHand === "left";

  drawSilhouette(ctx, silX, silY, dim.silW, dim.silH);

  drawHandFrame(ctx, rightFrameX, rightFrameY, dim.frameW, dim.frameH,
    rightHandItem, "Main droite", rightActive, false);

  const leftFrameItem = leftBlocked ? rightHandItem : leftHandItem;
  drawHandFrame(ctx, leftFrameX, leftFrameY, dim.frameW, dim.frameH,
    leftFrameItem, "Main gauche", leftActive, leftBlocked);

  const listY  = frameY + dim.silH + 30;
  const listW  = dim.frameW + dim.gap + dim.silW / 2 - 10;

  const rightWeapons = getCompatibleItems(inventory, "right");
  const leftWeapons  = getCompatibleItems(inventory, "left");

  drawSlotList(ctx, campState, rightFrameX, listY, listW,
    dim.listH, rightWeapons, rightHandItem, rightActive, false);

  drawSlotList(ctx, campState, centerX + 10, listY, listW,
    dim.listH, leftWeapons, leftHandItem, leftActive, leftBlocked);

  const legendY = listY + dim.listH + 20;
  ctx.fillStyle = "#555";
  ctx.font      = "13px monospace";
  ctx.fillText("←/→ changer de main  •  ↑/↓ naviguer  •  Entrée équiper/déséquiper  •  Échap retour", x, legendY);
}

// ─── Silhouette placeholder ───────────────────────────────────────────────────

function drawSilhouette(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = "#ffffff";

  const headR  = w * 0.22;
  const headCX = x + w / 2;
  const headCY = y + headR + 4;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  const bodyX = x + w * 0.2;
  const bodyY = headCY + headR + 2;
  const bodyW = w * 0.6;
  const bodyH = h * 0.38;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
  ctx.fillRect(x + w * 0.78, bodyY, w * 0.18, bodyH * 0.75);
  ctx.fillRect(x + w * 0.04, bodyY, w * 0.18, bodyH * 0.75);

  const legY = bodyY + bodyH + 2;
  const legH = h - (legY - y);
  const legW = bodyW * 0.4;
  ctx.fillRect(bodyX, legY, legW, legH);
  ctx.fillRect(bodyX + bodyW - legW, legY, legW, legH);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Cadre d'une main ────────────────────────────────────────────────────────

function drawHandFrame(ctx, x, y, w, h, item, label, isActive, isBlocked) {
  ctx.save();

  ctx.fillStyle = isBlocked ? "#1a1a1a" : "#222";
  ctx.fillRect(x, y, w, h);

  if (isBlocked)     { ctx.strokeStyle = "#333"; ctx.setLineDash([4, 4]); }
  else if (isActive) { ctx.strokeStyle = "#d4a017"; }
  else               { ctx.strokeStyle = "#555"; }

  ctx.lineWidth = isActive ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  ctx.fillStyle = isBlocked ? "#444" : (isActive ? "#d4a017" : "#888");
  ctx.font      = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y - 8);

  if (item) {
    drawItemInFrame(ctx, x, y, w, h, item);
  } else {
    ctx.fillStyle = "#333";
    ctx.font      = "11px monospace";
    ctx.fillText(isBlocked ? "occupé" : "vide", x + w / 2, y + h / 2);
  }

  if (isBlocked) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#333";
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 10,     y + 10);
    ctx.lineTo(x + w - 10, y + h - 10);
    ctx.moveTo(x + w - 10, y + 10);
    ctx.lineTo(x + 10,     y + h - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.restore();
}

function drawItemInFrame(ctx, x, y, w, h, item) {
  const weaponDef = getWeaponDef(item);
  if (!weaponDef?.image) {
    drawItemPlaceholder(ctx, x, y, w, h, item);
    return;
  }
  const img = getOrLoadImage(weaponDef.image);
  if (img?.complete && img.naturalWidth > 0) {
    drawItemImage(ctx, x, y, w, h, img);
  } else {
    drawItemPlaceholder(ctx, x, y, w, h, item);
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

function drawItemPlaceholder(ctx, x, y, w, h, item) {
  const weaponDef  = getWeaponDef(item);
  const modelIndex = (item.tier ?? 1) - 1;
  const name       = weaponDef?.models?.[modelIndex] ?? item.itemCode;
  const mat        = MATERIALS[item.material] ?? "";

  ctx.fillStyle = "#aaa";
  ctx.font      = "11px monospace";
  ctx.textAlign = "center";

  const words = `${name} ${mat}`.split(" ");
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

// ─── Liste déroulante ────────────────────────────────────────────────────────

function drawSlotList(ctx, campState, x, y, w, maxH, items, equippedItem, isActive, isBlocked) {
  ctx.save();

  if (isBlocked) { ctx.restore(); return; }

  const maxVisible = Math.floor(maxH / LIST_LINE_H);
  const selIdx     = isActive ? (campState.equipIndex  ?? 0) : 0;
  let   scroll     = isActive ? (campState.equipScroll ?? 0) : 0;

  if (selIdx < scroll) scroll = selIdx;
  if (selIdx >= scroll + maxVisible) scroll = selIdx - maxVisible + 1;
  if (isActive) campState.equipScroll = scroll;

  ctx.strokeStyle = isActive ? "#444" : "#2a2a2a";
  ctx.lineWidth   = 1;
  ctx.fillStyle   = "#1a1a1a";
  ctx.fillRect(x, y, w, maxH);
  ctx.strokeRect(x, y, w, maxH);

  if (items.length === 0) {
    ctx.fillStyle = "#555";
    ctx.font      = "13px monospace";
    ctx.fillText("aucun item disponible", x + 8, y + 20);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, maxH);
  ctx.clip();
  ctx.font = "13px monospace";

  for (let i = scroll; i < Math.min(scroll + maxVisible, items.length); i++) {
    const item       = items[i];
    const itemY      = y + (i - scroll) * LIST_LINE_H;
    const isSel      = isActive && i === selIdx;
    const isEquipped = equippedItem && item.id === equippedItem.id;

    if (isSel) {
      ctx.fillStyle = "#2a2200";
      ctx.fillRect(x, itemY + 1, w, LIST_LINE_H - 2);
    }

    ctx.fillStyle = isSel ? "#d4a017" : (isEquipped ? "#7ec8e3" : "#aaa");
    ctx.fillText(getItemLabel(item) + (isEquipped ? " ✓" : ""), x + 8, itemY + LIST_LINE_H / 2 + 5);
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
 * À appeler depuis le gestionnaire de touches du camp.
 * Retourne true si la touche a été consommée.
 *
 * @param {KeyboardEvent} e
 * @param {object} campState
 * @param {Function} equipCallback   — onEquip(itemId, slot, itemCode)
 * @param {Function} unequipCallback — onUnequip(itemId, slot)
 * @param {Function} escCallback     — onEscape()
 */
export function handleEquipKeys(e, campState, equipCallback, unequipCallback, escCallback) {
  if (typeof equipCallback   !== "function") throw new Error("handleEquipKeys: equipCallback doit être une fonction");
  if (typeof unequipCallback !== "function") throw new Error("handleEquipKeys: unequipCallback doit être une fonction");
  if (typeof escCallback     !== "function") throw new Error("handleEquipKeys: escCallback doit être une fonction");

  const inventory     = campState.inventory ?? [];
  const hand          = campState.equipSelectedHand ?? "right";
  const isRight       = hand === "right";
  const slot          = isRight ? "rightHand" : "leftHand";
  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const leftBlocked   = rightHandItem && getWeaponDef(rightHandItem)?.hd === 2;
  const items         = getCompatibleItems(inventory, hand);

  switch (e.key) {

    case "ArrowLeft":
    case "ArrowRight": {
      const goRight = e.key === "ArrowRight";
      if (goRight && !leftBlocked) campState.equipSelectedHand = "left";
      else if (!goRight)           campState.equipSelectedHand = "right";
      campState.equipIndex  = 0;
      campState.equipScroll = 0;
      return true;
    }

    case "ArrowUp": {
      const idx = campState.equipIndex ?? 0;
      campState.equipIndex = Math.max(0, idx - 1);
      return true;
    }

    case "ArrowDown": {
      const idx = campState.equipIndex ?? 0;
      campState.equipIndex = Math.min(items.length - 1, idx + 1);
      return true;
    }

    case "Enter": {
      if (items.length === 0) return true;
      const item = items[campState.equipIndex ?? 0];
      if (!item) return true;

      const currentEquipped = inventory.find(i => i.equippedSlot === slot);

      if (currentEquipped && item.id === currentEquipped.id) {
        currentEquipped.equippedSlot = null;
        unequipCallback(currentEquipped.id, slot);
      } else {
        const def = getWeaponDef(item);
        inventory.forEach(i => { if (i.equippedSlot === slot) i.equippedSlot = null; });
        if (def?.hd === 2) {
          inventory.forEach(i => { if (i.equippedSlot === "leftHand") i.equippedSlot = null; });
        }
        const found = inventory.find(i => i.id === item.id);
        if (found) found.equippedSlot = slot;
        equipCallback(item.id, slot, item.itemCode);
      }
      return true;
    }

    case "Escape": {
      escCallback();
      return true;
    }
  }

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCompatibleItems(inventory, hand) {
  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const twoHanded     = rightHandItem && getWeaponDef(rightHandItem)?.hd === 2;

  if (hand === "left" && twoHanded) return [];

  return inventory.filter(function isCompatible(item) {
    if (item.itemType !== "weapon") return false;
    const def = getWeaponDef(item);
    if (!def) return false;
    if (hand === "left") {
      return (def.damFirst === 0 && def.damLast === 0) || def.hd === 1;
    }
    return def.damFirst > 0 || def.damLast > 0;
  });
}

function getWeaponDef(item) {
  if (!item?.itemCode) {
    console.error("getWeaponDef: item ou itemCode manquant", item);
    return null;
  }
  const def = gameData.weapons.find(w => w.code === item.itemCode);
  if (!def) console.error(`getWeaponDef: aucune def pour itemCode="${item.itemCode}"`);
  return def ?? null;
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

function getItemLabel(item) {
  if (item.itemType === "weapon") {
    const weaponDef  = gameData.weapons.find(w => w.code === item.itemCode);
    const modelIndex = (item.tier ?? 1) - 1;
    const weaponName = weaponDef?.models?.[modelIndex] ?? item.itemCode;
    const matName    = MATERIALS[item.material] ?? "?";
    return `${weaponName} en ${matName}`;
  }
  if (item.itemType === "shield") return `Bouclier T${item.tier}`;
  return item.itemCode;
}