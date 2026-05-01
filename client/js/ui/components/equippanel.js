/*
  EQUIP PANEL — Gestion des mains (main droite / main gauche)
  
  Layout :
    [Cadre Main Droite] [Silhouette] [Cadre Main Gauche]
    [Liste MD sous cadre]            [Liste MG sous cadre]

  Navigation clavier :
    ←/→   : changer de main active
    ↑/↓   : naviguer dans la liste déroulante
    Entrée : équiper / déséquiper l'item sélectionné
    Échap  : retour au menu camp

  Intégration :
    - Importer handleEquipKeys() dans le gestionnaire de touches du camp
    - Appeler drawEquipPanel() depuis drawRightPanel() case "equip"
*/

import { gameData, MATERIALS } from "../../core/gameData.js";

// ─── Constantes de layout ────────────────────────────────────────────────────

const FRAME_W       = 120;
const FRAME_H       = 160;
const SILHOUETTE_W  = 100;
const SILHOUETTE_H  = 200;
const LIST_H        = 180;  // hauteur de la liste déroulante
const LIST_LINE_H   = 28;
const FRAME_GAP     = 20;   // espace entre cadre et silhouette

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawEquipPanel(ctx, campState, x, y, width) {
  const inventory = campState.inventory ?? [];

  // Initialisation état
  if (!campState.equipSelectedHand) campState.equipSelectedHand = "right";
  if (campState.equipIndex === undefined) campState.equipIndex = 0;
  if (campState.equipScroll === undefined) campState.equipScroll = 0;

  // ─── Calcul positions centrées ───────────────────────────────────────────

  const centerX     = x + width / 2;
  const frameY      = y + 20;

  // Silhouette au centre
  const silX = centerX - SILHOUETTE_W / 2;
  const silY = frameY;

  // Cadre main droite : collé à gauche de la silhouette
  // (main droite du personnage = côté gauche de l'écran)
  const rightFrameX = silX - FRAME_GAP - FRAME_W;
  const rightFrameY = silY + (SILHOUETTE_H - FRAME_H) / 2;

  // Cadre main gauche : collé à droite de la silhouette
  const leftFrameX  = silX + SILHOUETTE_W + FRAME_GAP;
  const leftFrameY  = rightFrameY;

  // ─── Récupération des items équipés ──────────────────────────────────────

  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const leftHandItem  = inventory.find(i => i.equippedSlot === "leftHand");

  // ─── Silhouette (placeholder) ─────────────────────────────────────────────

  drawSilhouette(ctx, silX, silY, SILHOUETTE_W, SILHOUETTE_H);

  // ─── Cadres ───────────────────────────────────────────────────────────────
  const rightActive = campState.equipSelectedHand === "right";
  const leftActive  = campState.equipSelectedHand === "left";

  // Main droite (physiquement à gauche de la silhouette)
  drawHandFrame(ctx, rightFrameX, rightFrameY, FRAME_W, FRAME_H,
    rightHandItem, "Main droite", rightActive, false);

  // Main gauche (physiquement à droite de la silhouette)
  const leftBlocked = rightHandItem && getWeaponDef(rightHandItem)?.hd === 2;
  drawHandFrame(ctx, leftFrameX, leftFrameY, FRAME_W, FRAME_H,
    leftHandItem, "Main gauche", leftActive, leftBlocked);

  // ─── Listes déroulantes ───────────────────────────────────────────────────

  const listY = frameY + SILHOUETTE_H + 30;
    
  // Liste main droite
  const rightWeapons = getCompatibleItems(inventory, "right", rightHandItem);
  drawSlotList(ctx, campState, rightFrameX, listY, FRAME_W + FRAME_GAP + SILHOUETTE_W / 2 - 10,
    LIST_H, rightWeapons, rightHandItem, rightActive, false);

  // Liste main gauche
  const leftWeapons = getCompatibleItems(inventory, "left", leftHandItem);
  drawSlotList(ctx, campState, centerX + 10, listY, FRAME_W + FRAME_GAP + SILHOUETTE_W / 2 - 10,
    LIST_H, leftWeapons, leftHandItem, leftActive, leftBlocked);

  // ─── Légende touches ─────────────────────────────────────────────────────
  const legendY = listY + LIST_H + 20;
  ctx.fillStyle = "#555";
  ctx.font      = "13px monospace";
  ctx.fillText("←/→ changer de main  •  ↑/↓ naviguer  •  Entrée équiper/déséquiper  •  Échap retour", x, legendY);
}

// ─── Silhouette placeholder ───────────────────────────────────────────────────

function drawSilhouette(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = "#ffffff";

  // Tête
  const headR = w * 0.22;
  const headCX = x + w / 2;
  const headCY = y + headR + 4;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Corps
  const bodyX = x + w * 0.2;
  const bodyY = headCY + headR + 2;
  const bodyW = w * 0.6;
  const bodyH = h * 0.38;
  ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

  // Bras gauche (côté droit écran)
  ctx.fillRect(x + w * 0.78, bodyY, w * 0.18, bodyH * 0.75);
  // Bras droit (côté gauche écran)
  ctx.fillRect(x + w * 0.04, bodyY, w * 0.18, bodyH * 0.75);

  // Jambes
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

  // Fond
  ctx.fillStyle = isBlocked ? "#1a1a1a" : "#222";
  ctx.fillRect(x, y, w, h);

  // Bordure
  if (isBlocked) {
    ctx.strokeStyle = "#333";
    ctx.setLineDash([4, 4]);
  } else if (isActive) {
    ctx.strokeStyle = "#d4a017";
  } else {
    ctx.strokeStyle = "#555";
  }
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Label
  ctx.fillStyle = isBlocked ? "#444" : (isActive ? "#d4a017" : "#888");
  ctx.font      = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y - 8);

  if (isBlocked) {
    // Croix grisée
    ctx.strokeStyle = "#333";
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + w - 10, y + h - 10);
    ctx.moveTo(x + w - 10, y + 10);
    ctx.lineTo(x + 10, y + h - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  if (item) {
    // Image de l'arme équipée
    const weaponDef = getWeaponDef(item);
    if (weaponDef?.image) {
      const img = getOrLoadImage(weaponDef.image);
      if (img?.complete && img.naturalWidth > 0) {
        const padding = 10;
        ctx.drawImage(img, x + padding, y + padding, w - padding * 2, h - padding * 2);
      } else {
        drawItemPlaceholder(ctx, x, y, w, h, item);
      }
    } else {
      drawItemPlaceholder(ctx, x, y, w, h, item);
    }
  } else {
    // Slot vide
    ctx.fillStyle = "#333";
    ctx.font      = "11px monospace";
    ctx.fillText("vide", x + w / 2, y + h / 2);
  }

  ctx.textAlign = "left";
  ctx.restore();
}

// ─── Placeholder texte si image absente ──────────────────────────────────────

function drawItemPlaceholder(ctx, x, y, w, h, item) {
  const weaponDef  = getWeaponDef(item);
  const modelIndex = (item.tier ?? 1) - 1;
  const name       = weaponDef?.models?.[modelIndex] ?? item.itemCode;
  const mat        = MATERIALS[item.material] ?? "";

  ctx.fillStyle = "#aaa";
  ctx.font      = "11px monospace";
  ctx.textAlign = "center";

  const words  = `${name} ${mat}`.split(" ");
  let line     = "";
  let lineY    = y + h / 2 - 10;
  const lines  = [];

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

  lineY = y + h / 2 - ((lines.length - 1) * 14) / 2;
  for (const l of lines) {
    ctx.fillText(l, x + w / 2, lineY);
    lineY += 14;
  }
}

// ─── Liste déroulante ────────────────────────────────────────────────────────

function drawSlotList(ctx, campState, x, y, w, maxH, items, equippedItem, isActive, isBlocked) {
    ctx.save();

    if (isBlocked) {
    ctx.restore();
    return;
    }

  const maxVisible = Math.floor(maxH / LIST_LINE_H);
  const selIdx     = isActive ? (campState.equipIndex ?? 0) : 0;
  let   scroll     = isActive ? (campState.equipScroll ?? 0) : 0;

  // Ajustement scroll
  if (selIdx < scroll) scroll = selIdx;
  if (selIdx >= scroll + maxVisible) scroll = selIdx - maxVisible + 1;
  if (isActive) campState.equipScroll = scroll;

  // Bordure liste
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
    const item      = items[i];
    const itemY     = y + (i - scroll) * LIST_LINE_H;
    const isSel     = isActive && i === selIdx;
    const isEquipped = equippedItem && item.id === equippedItem.id;

    if (isSel) {
    ctx.fillStyle = "#2a2200";
    ctx.fillRect(x, itemY + 1, w, LIST_LINE_H - 2);
    }

    ctx.fillStyle = isSel ? "#d4a017" : (isEquipped ? "#7ec8e3" : "#aaa");
    ctx.fillText(getItemLabel(item) + (isEquipped ? " ✓" : ""), x + 8, itemY + LIST_LINE_H / 2 + 5);
  }

  ctx.restore();

  // Scrollbar
  if (items.length > maxVisible) {
    const sbH  = (maxVisible / items.length) * maxH;
    const sbY  = y + (scroll / items.length) * maxH;
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
 * @param {Function} equipCallback  — appelé avec (itemId, slot) pour équiper
 * @param {Function} unequipCallback — appelé avec (slot) pour déséquiper
 * @param {Function} escCallback    — appelé quand Échap est pressé
 */
export function handleEquipKeys(e, campState, equipCallback, unequipCallback, escCallback) {
  const inventory = campState.inventory ?? [];
  const hand      = campState.equipSelectedHand ?? "right";
  const isRight   = hand === "right";

  const equippedItem  = inventory.find(i => i.equippedSlot === (isRight ? "rightHand" : "leftHand"));
  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const leftBlocked   = rightHandItem && getWeaponDef(rightHandItem)?.hd === 2;

  const items = getCompatibleItems(inventory, hand, equippedItem);

  switch (e.key) {

    case "ArrowLeft":
    case "ArrowRight": {
      // Changer de main active
      const goRight = e.key === "ArrowRight";
      // ArrowRight = main gauche (côté droit écran), ArrowLeft = main droite
      if (goRight && !leftBlocked) {
        campState.equipSelectedHand = "left";
      } else if (!goRight) {
        campState.equipSelectedHand = "right";
      }
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
        const idx  = campState.equipIndex ?? 0;
        const item = items[idx];
        if (!item) return true;

        const slot = isRight ? "rightHand" : "leftHand";
        const currentEquipped = campState.inventory.find(i => i.equippedSlot === slot);

        if (currentEquipped && item.id === currentEquipped.id) {
            // Mise à jour locale immédiate
            currentEquipped.equippedSlot = null;
            unequipCallback(currentEquipped.id, slot);
        } else {
            // Mise à jour locale immédiate
            campState.inventory.forEach(i => { if (i.equippedSlot === slot) i.equippedSlot = null; });
            const found = campState.inventory.find(i => i.id === item.id);
            if (found) found.equippedSlot = slot;
            equipCallback(item.id, slot);
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

/**
 * Retourne les items équipables pour un slot donné.
 * Main droite : toutes les armes
 * Main gauche : armes 1 main + boucliers (pas si arme 2 mains en main droite)
 */
function getCompatibleItems(inventory, hand, _equippedItem) {
  const rightHandItem = inventory.find(i => i.equippedSlot === "rightHand");
  const twoHanded     = rightHandItem && getWeaponDef(rightHandItem)?.hands === 2;

  if (hand === "left" && twoHanded) return [];

  return inventory.filter(item => {
    if (item.itemType === "weapon") {
      const def = getWeaponDef(item);
      if (!def) return false;

        // main gauche : armes 1 main seulement
        if (hand === "left") {
            const def = getWeaponDef(item);
            if (!def) return false;
            const isShield = def.damFirst === 0 && def.damLast === 0;
            const isOneHanded = def.hd === 1;
            return isShield || isOneHanded;
        }
        
        // main droite : toutes les armes
        if (hand === "right"){
            const def = getWeaponDef(item);
            return def && (def.damFirst > 0 || def.damLast > 0);
        }
    }
    if (item.itemType === "shield") {
      return hand === "left";                        // boucliers : main gauche uniquement
    }
    return false;
  });
}

function getWeaponDef(item) {
  return gameData.weapons.find(w => w.code === item.itemCode);
}

// Cache d'images pour éviter de recréer des objets Image à chaque frame
const imageCache = {};

function getOrLoadImage(path) {
  if (!imageCache[path]) {
    const img   = new Image();
    img.src     = `/assets/${path}`;
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
  if (item.itemType === "shield") {
    return `Bouclier T${item.tier}`;
  }
  return item.itemCode;
}
