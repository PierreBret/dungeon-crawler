/*
  EQUIP ARMOR PANEL — Gestion des 4 emplacements d'armure

  Layout :
    [Cadre Tête]   [Silhouette]   [Cadre Bras]
    [Cadre Corps]                 [Cadre Jambes]
    [Liste items sous le slot actif]

  Les 4 slots : tete, corps, bras, jambes

  Navigation clavier :
    ←/→   : changer de slot actif
    ↑/↓   : naviguer dans la liste déroulante
    Entrée : équiper / déséquiper l'item sélectionné
    Échap  : retour au menu camp

  Intégration :
    - Importer handleArmorEquipKeys() dans le gestionnaire de touches du camp
    - Appeler drawArmorEquipPanel() depuis drawCenterPanel() case "equipArmor"
*/

import { MATERIALS }  from "../../core/constants.js";
import { getArmorName }   from "../../core/gameData.js";

// ─── Constantes des slots ─────────────────────────────────────────────────────

const ARMOR_SLOTS = [
  { key: "tete",   label: "Tête"   },
  { key: "corps",  label: "Corps"  },
  { key: "bras",   label: "Bras"   },
  { key: "jambes", label: "Jambes" }
];

// ─── Ratios fixes — proportions préservées quelle que soit la résolution ──────
const SILHOUETTE_W_RATIO = 0.22;
const SILHOUETTE_ASPECT  = 2.0;

const FRAME_W_RATIO      = 0.17;
const FRAME_ASPECT       = 1;

const FRAME_GAP_RATIO    = 0.03;

const LIST_H_RATIO       = 0.25;
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

export function drawArmorEquipPanel(ctx, campState, x, y, width, player) {
  if (typeof width !== "number" || width <= 0) throw new Error("drawArmorEquipPanel: width invalide");

  if (!campState.armorSelectedSlot) campState.armorSelectedSlot = "tete";
  if (campState.armorIndex  === undefined) campState.armorIndex  = 0;
  if (campState.armorScroll === undefined) campState.armorScroll = 0;

  const inventory = campState.inventory ?? [];
  const dim       = computeLayout(width, ctx.canvas.height);

  const centerX   = x + width / 2;
  const frameY    = y;

  const silX = centerX - dim.silW / 2;
  const silY = frameY;

  // Positions des 4 cadres autour de la silhouette
  // Rangée haute : Tête (gauche), Bras (droite)
  const teteFrameX  = silX - dim.gap - dim.frameW;
  const teteFrameY  = silY;
  const brasFrameX  = silX + dim.silW + dim.gap;
  const brasFrameY  = silY;

  // Rangée basse : Corps (gauche), Jambes (droite)
  const corpsFrameX  = teteFrameX;
  const corpsFrameY  = silY + dim.frameH + dim.gap * 2;
  const jambesFrameX = brasFrameX;
  const jambesFrameY = corpsFrameY;

  // Items équipés par slot
  const teteItem   = inventory.find(i => i.equippedSlot === "tete");
  const corpsItem  = inventory.find(i => i.equippedSlot === "corps");
  const brasItem   = inventory.find(i => i.equippedSlot === "bras");
  const jambesItem = inventory.find(i => i.equippedSlot === "jambes");

  const selectedSlot = campState.armorSelectedSlot;

  // Dessiner la silhouette
  drawSilhouette(ctx, silX, silY, dim.silW, dim.silH);

  // Dessiner les 4 cadres
  drawArmorFrame(ctx, teteFrameX, teteFrameY, dim.frameW, dim.frameH,
    teteItem, "Tête", selectedSlot === "tete");

  drawArmorFrame(ctx, brasFrameX, brasFrameY, dim.frameW, dim.frameH,
    brasItem, "Bras", selectedSlot === "bras");

  drawArmorFrame(ctx, corpsFrameX, corpsFrameY, dim.frameW, dim.frameH,
    corpsItem, "Corps", selectedSlot === "corps");

  drawArmorFrame(ctx, jambesFrameX, jambesFrameY, dim.frameW, dim.frameH,
    jambesItem, "Jambes", selectedSlot === "jambes");

  // Liste d'items pour le slot sélectionné
  const listY = frameY + dim.silH + 10;
  const listW = width - 20;

  const slotItems    = getArmorItemsForSlot(inventory, selectedSlot);
  const equippedItem = inventory.find(i => i.equippedSlot === selectedSlot);

  drawArmorSlotList(ctx, campState, x + 10, listY, listW,
    dim.listH, slotItems, equippedItem);

  // ─── Dialog de confirmation de suppression ────────────────────────────────

  const legendY = listY + dim.listH + 20;

  if (campState.armorConfirm) {
    drawArmorDeleteConfirm(ctx, campState, x, legendY, width);
  }

  // ─── Légende clavier tout en bas du panneau ───────────────────────────────

  const helperY = ctx.canvas.height - 30;
  ctx.fillStyle = "#555";
  ctx.font      = "13px monospace";
  ctx.fillText("←/→ changer de slot  •  ↑/↓ naviguer  •  Entrée équiper  •  J jeter  •  Échap retour", x, helperY);
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

// ─── Cadre d'un slot d'armure ────────────────────────────────────────────────

function drawArmorFrame(ctx, x, y, w, h, item, label, isActive) {
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
    drawArmorItemInFrame(ctx, x, y, w, h, item);
  } else {
    ctx.fillStyle = "#333";
    ctx.font      = "11px monospace";
    ctx.fillText("vide", x + w / 2, y + h / 2);
  }

  ctx.textAlign = "left";
  ctx.restore();
}

function drawArmorItemInFrame(ctx, x, y, w, h, item) {
  const armorDef = getArmorDef(item);
  const name     = armorDef?.name ?? item.slot ?? "?";

  ctx.fillStyle = "#aaa";
  ctx.font      = "11px monospace";
  ctx.textAlign = "center";

  const words = name.split(" ");
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

function drawArmorSlotList(ctx, campState, x, y, w, maxH, items, equippedItem) {
  ctx.save();

  const maxVisible = Math.floor(maxH / LIST_LINE_H);
  const selIdx     = campState.armorIndex  ?? 0;
  let   scroll     = campState.armorScroll ?? 0;

  if (selIdx < scroll) scroll = selIdx;
  if (selIdx >= scroll + maxVisible) scroll = selIdx - maxVisible + 1;
  campState.armorScroll = scroll;

  ctx.strokeStyle = "#444";
  ctx.lineWidth   = 1;
  ctx.fillStyle   = "#1a1a1a";
  ctx.fillRect(x, y, w, maxH);
  ctx.strokeRect(x, y, w, maxH);

  if (items.length === 0) {
    ctx.fillStyle = "#555";
    ctx.font      = "13px monospace";
    ctx.fillText("aucune armure disponible", x + 8, y + 20);
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
    const isSel      = i === selIdx;
    const isEquipped = equippedItem && item.id === equippedItem.id;

    if (isSel) {
      ctx.fillStyle = "#2a2200";
      ctx.fillRect(x, itemY + 1, w, LIST_LINE_H - 2);
    }

    ctx.fillStyle = isSel ? "#d4a017" : (isEquipped ? "#7ec8e3" : "#aaa");
    ctx.fillText(getArmorLabel(item) + (isEquipped ? " ✓" : ""), x + 8, itemY + LIST_LINE_H / 2 + 5);
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
 * @param {Function} equipCallback   — onEquip(itemId, slot)
 * @param {Function} unequipCallback — onUnequip(itemId, slot)
 * @param {Function} escCallback     — onEscape()
 * @param {Function} dropCallback    — onDrop(itemId)
 */
export function handleArmorEquipKeys(e, campState, equipCallback, unequipCallback, escCallback, dropCallback) {
  if (typeof equipCallback   !== "function") throw new Error("handleArmorEquipKeys: equipCallback doit être une fonction");
  if (typeof unequipCallback !== "function") throw new Error("handleArmorEquipKeys: unequipCallback doit être une fonction");
  if (typeof escCallback     !== "function") throw new Error("handleArmorEquipKeys: escCallback doit être une fonction");
  if (typeof dropCallback    !== "function") throw new Error("handleArmorEquipKeys: dropCallback doit être une fonction");

  // ─── Mode confirmation de suppression ─────────────────────────────────────
  if (campState.armorConfirm) {
    if (e.key === "ArrowLeft")  { campState.armorConfirmChoice = 0; return true; }
    if (e.key === "ArrowRight") { campState.armorConfirmChoice = 1; return true; }
    if (e.key === "Enter") {
      if (campState.armorConfirmChoice === 0) {
        const item = campState.armorConfirm;
        if (item?.id) dropCallback(item.id);
      }
      campState.armorConfirm       = null;
      campState.armorConfirmChoice = 1;
      return true;
    }
    if (e.key === "Escape") {
      campState.armorConfirm       = null;
      campState.armorConfirmChoice = 1;
      return true;
    }
    return true;
  }

  const inventory    = campState.inventory ?? [];
  const selectedSlot = campState.armorSelectedSlot ?? "tete";
  const items        = getArmorItemsForSlot(inventory, selectedSlot);

  switch (e.key) {

    case "ArrowLeft":
    case "ArrowRight": {
      const slotKeys = ARMOR_SLOTS.map(s => s.key);
      const curIdx   = slotKeys.indexOf(selectedSlot);
      const dir      = e.key === "ArrowRight" ? 1 : -1;
      const newIdx   = (curIdx + dir + slotKeys.length) % slotKeys.length;
      campState.armorSelectedSlot = slotKeys[newIdx];
      campState.armorIndex  = 0;
      campState.armorScroll = 0;
      return true;
    }

    case "ArrowUp": {
      const idx = campState.armorIndex ?? 0;
      campState.armorIndex = Math.max(0, idx - 1);
      return true;
    }

    case "ArrowDown": {
      const idx = campState.armorIndex ?? 0;
      campState.armorIndex = Math.min(items.length - 1, idx + 1);
      return true;
    }

    case "Enter": {
      if (items.length === 0) return true;
      const item = items[campState.armorIndex ?? 0];
      if (!item) return true;

      const currentEquipped = inventory.find(i => i.equippedSlot === selectedSlot);

      if (currentEquipped && item.id === currentEquipped.id) {
        // Déséquiper
        currentEquipped.equippedSlot = null;
        unequipCallback(currentEquipped.id, selectedSlot);
      } else {
        // Équiper : retirer l'ancien du même slot
        inventory.forEach(i => { if (i.equippedSlot === selectedSlot) i.equippedSlot = null; });
        const found = inventory.find(i => i.id === item.id);
        if (found) found.equippedSlot = selectedSlot;
        equipCallback(item.id, selectedSlot);
      }
      return true;
    }

    case "Escape": {
      escCallback();
      return true;
    }

    case "j": {
      if (items.length === 0) return true;
      const item = items[campState.armorIndex ?? 0];
      if (!item) return true;
      // Les armures équipées ne peuvent pas être jetées
      if (item.equippedSlot) return true;
      campState.armorConfirm       = item;
      campState.armorConfirmChoice = 1;
      return true;
    }
  }

  return false;
}

// ─── Dialog confirmation suppression ─────────────────────────────────────────

function drawArmorDeleteConfirm(ctx, campState, x, y, width) {
  const item = campState.armorConfirm;
  if (!item) return;

  const label   = getArmorLabel(item);
  const dialogH = 80;

  ctx.fillStyle = "#1e1000";
  ctx.fillRect(x, y - 10, width, dialogH);
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y - 10, width, dialogH);

  ctx.fillStyle = "white";
  ctx.font      = "13px monospace";
  ctx.fillText(`Détruire "${label}" ?`, x + 8, y + 4);

  const confirmChoice = campState.armorConfirmChoice ?? 1;
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

export function getArmorItemsForSlot(inventory, slot) {
  return inventory.filter(i => i.itemType === "armor" && i.slot === slot);
}

function getArmorDef(item) {
  if (!item?.slot) return null;
  const name = getArmorName(item.slot, item.tier);
  if (!name) return null;
  const tier = item.tier ?? 1;
  return { tier, name, weight: tier, reduction: tier };
}

function getArmorLabel(item) {
  return getArmorName(item.slot, item.tier) ?? item.slot ?? "?";
}
