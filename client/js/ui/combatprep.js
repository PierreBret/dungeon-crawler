/*
  CLIENT/JS/UI/COMBATPREP.JS
  Écran de préparation au combat.

  Layout :
    Colonne gauche  : infos créature
    Colonne centrale : équipement joueur + grille stratégie 5×3
    Colonne droite  : scores dérivés calculés avec la stratégie minute 1

  Navigation :
    ←/→  : naviguer entre les minutes
    Tab  : naviguer entre EO / NA / EN
    ↑/↓ ou 1-9/0 : modifier la valeur (0 = 10)
    Entrée : valider et lancer le combat
    Échap  : retour au donjon
*/

import { THEME }               from "../core/theme.js";
import { gameData, MATERIALS } from "../core/gameData.js";

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawCombatPrep(ctx, combatState, player) {
  if (!combatState) throw new Error("drawCombatPrep: combatState manquant");
  if (!player)      throw new Error("drawCombatPrep: player manquant");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  ctx.fillStyle = THEME.ui.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const W       = ctx.canvas.width;
  const H       = ctx.canvas.height;
  const colW    = Math.floor(W / 3);
  const padding = 20;

  drawCreaturePanel(ctx, combatState.creature, 0,        0, colW,         H, padding);
  drawPlayerPanel  (ctx, combatState, player,   colW,     0, colW,         H, padding);
  drawScoresPanel  (ctx, combatState, player,   colW * 2, 0, W - colW * 2, H, padding);
}

// ─── Colonne gauche — créature ────────────────────────────────────────────────

function drawCreaturePanel(ctx, creature, x, y, w, h, padding) {
  if (!creature) return;

  ctx.fillStyle   = THEME.ui.bgPanel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = THEME.ui.borderLight;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, h); ctx.stroke();

  let cy = y + padding;
  const cx = x + padding;

  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.title;
  ctx.fillText("Adversaire", cx, cy);
  cy += 40;

  ctx.fillStyle = THEME.text.accent;
  ctx.font      = THEME.font.heading;
  ctx.fillText(creature.nameFr, cx, cy);
  cy += 32;

  ctx.fillStyle = THEME.text.secondary;
  ctx.font      = THEME.font.mono;
  ctx.fillText(`Famille : ${creature.family}`, cx, cy);
  cy += 24;

  const weaponDef = gameData.weapons.find(w => w.code === creature.equipment?.rightHand?.code);
  ctx.fillText(`Arme : ${weaponDef?.typeArme ?? "—"}`, cx, cy);
  cy += 40;

  ctx.strokeStyle = THEME.ui.border;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x + w - padding, cy); ctx.stroke();
  cy += 16;

  const statsList = [
    ["FORCE",        creature.stats.force],
    ["CONSTITUTION", creature.stats.constitution],
    ["TAILLE",       creature.stats.taille],
    ["INTELLIGENCE", creature.stats.intelligence],
    ["VOLONTÉ",      creature.stats.volonté ?? creature.stats.volonte],
    ["VITESSE",      creature.stats.vitesse],
    ["ADRESSE",      creature.stats.adresse],
  ];

  for (const [label, value] of statsList) {
    ctx.font      = THEME.components.statLabel.font;
    ctx.fillStyle = THEME.components.statLabel.color;
    ctx.textAlign = "left";
    ctx.fillText(label, cx, cy);
    ctx.font      = THEME.components.statValue.font;
    ctx.fillStyle = THEME.components.statValue.color;
    ctx.textAlign = "right";
    ctx.fillText(String(value), x + w - padding, cy);
    cy += 26;
  }

  ctx.textAlign = "left";
}

// ─── Colonne centrale — équipement + stratégie ────────────────────────────────

function drawPlayerPanel(ctx, combatState, player, x, y, w, h, padding) {
  ctx.fillStyle   = THEME.ui.bgPanel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = THEME.ui.borderLight;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, h); ctx.stroke();

  let cy = y + padding;
  const cx = x + padding;

  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.title;
  ctx.fillText("Préparation", cx, cy);
  cy += 40;

  // Équipement
  ctx.fillStyle = THEME.text.secondary;
  ctx.font      = THEME.font.mono;
  ctx.fillText("Équipement", cx, cy);
  cy += 24;

  const inventory = combatState.inventory ?? [];
  const rightItem = inventory.find(i => i.equippedSlot === "rightHand");
  const leftItem  = inventory.find(i => i.equippedSlot === "leftHand");

  function drawEquipLine(label, item) {
    const def     = item ? gameData.weapons.find(w => w.code === item.itemCode) : null;
    const model   = def?.models?.[(item?.tier ?? 1) - 1] ?? "—";
    const matName = item ? (MATERIALS[item.material]?.name ?? "?") : "—";
    const text    = item ? `${model} en ${matName}` : "vide";

    ctx.font      = THEME.components.statLabel.font;
    ctx.fillStyle = THEME.components.statLabel.color;
    ctx.textAlign = "left";
    ctx.fillText(label, cx, cy);
    ctx.font      = THEME.components.statValue.font;
    ctx.fillStyle = item ? THEME.text.primary : THEME.text.muted;
    ctx.textAlign = "right";
    ctx.fillText(text, x + w - padding, cy);
    cy += 26;
  }

  drawEquipLine("Main droite :", rightItem);
  drawEquipLine("Main gauche :", leftItem);
  cy += 16;

  // Grille stratégie
  ctx.fillStyle = THEME.text.secondary;
  ctx.font      = THEME.font.mono;
  ctx.textAlign = "left";
  ctx.fillText("Stratégie", cx, cy);
  cy += 28;

  drawStrategyGrid(ctx, combatState, cx, cy, w - padding * 2);
  cy += 160;

  // Légende
  ctx.fillStyle = THEME.text.muted;
  ctx.font      = THEME.font.small;
  ctx.fillText("←/→ minute  •  Tab EO/NA/EN  •  ↑/↓ ou 1-9/0 valeur", cx, cy);
  cy += 18;
  ctx.fillText("Entrée — combattre  •  Échap — retour au donjon", cx, cy);

  ctx.textAlign = "left";
}

// ─── Grille stratégie ─────────────────────────────────────────────────────────

function drawStrategyGrid(ctx, combatState, x, y, w) {
  const strategy  = combatState.strategy;
  const selMin    = combatState.selectedMinute ?? 0;
  const selRow    = combatState.selectedRow    ?? 0;
  const rowLabels = ["EO", "NA", "EN"];
  const colLabels = ["1", "2", "3", "4", "5+"];
  const rowKeys   = ["eo", "na", "en"];

  const cellW  = Math.floor((w - 30) / 5);
  const cellH  = 36;
  const labelW = 30;

  // En-têtes colonnes
  ctx.font      = THEME.font.mono;
  ctx.fillStyle = THEME.text.secondary;
  ctx.textAlign = "center";
  for (let m = 0; m < 5; m++) {
    ctx.fillText(colLabels[m], x + labelW + m * cellW + cellW / 2, y);
  }

  for (let row = 0; row < 3; row++) {
    const rowY = y + 24 + row * cellH;

    ctx.font      = THEME.components.statLabel.font;
    ctx.fillStyle = THEME.components.statLabel.color;
    ctx.textAlign = "left";
    ctx.fillText(rowLabels[row], x, rowY + 8);

    for (let col = 0; col < 5; col++) {
      const cellX      = x + labelW + col * cellW;
      const isSelected = col === selMin && row === selRow;
      const value      = strategy[col]?.[rowKeys[row]];

      ctx.fillStyle   = isSelected ? THEME.ui.bgSelected : THEME.ui.bgItem;
      ctx.fillRect(cellX + 2, rowY + 2, cellW - 4, cellH - 4);
      ctx.strokeStyle = isSelected ? THEME.ui.borderAccent : THEME.ui.border;
      ctx.lineWidth   = isSelected ? 2 : 1;
      ctx.strokeRect(cellX + 2, rowY + 2, cellW - 4, cellH - 4);

      ctx.font      = THEME.components.statValue.font;
      ctx.fillStyle = value != null ? (isSelected ? THEME.text.accent : THEME.text.primary) : THEME.text.disabled;
      ctx.textAlign = "center";
      ctx.fillText(value != null ? String(value) : "—", cellX + cellW / 2, rowY + 10);
    }
  }

  ctx.textAlign = "left";
}

// ─── Colonne droite — scores dérivés ──────────────────────────────────────────

function drawScoresPanel(ctx, combatState, player, x, y, w, h, padding) {
  ctx.fillStyle = THEME.ui.bgDark;
  ctx.fillRect(x, y, w, h);

  let cy = y + padding;
  const cx = x + padding;

  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.heading;
  ctx.fillText("Scores de combat", cx, cy);
  cy += 36;

  ctx.fillStyle = THEME.text.muted;
  ctx.font      = THEME.font.small;
  ctx.fillText("(basé sur minute 1)", cx, cy);
  cy += 24;

  const stats = player.stats;
  const s1    = combatState.strategy?.[0] ?? {};
  const eo    = s1.eo ?? 5;
  const na    = s1.na ?? 5;
  const en    = s1.en ?? 5;

  function sm(v) { return 0.8 + ((v ?? 5) - 1) * (0.4 / 9); }

  const vol    = stats.volonté ?? stats.volonte ?? 0;
  const attack = stats.adresse * 0.5 + stats.vitesse * 0.3 + stats.intelligence * 0.2;
  const parry  = stats.adresse * 0.4 + stats.force * 0.3 + vol * 0.3;
  const dodge  = stats.vitesse * 0.5 + stats.adresse * 0.3 - stats.taille * 0.2;
  const init   = stats.vitesse * 0.6 + stats.intelligence * 0.4;

  const scoresList = [
    ["Attaque",    Math.floor(attack * sm(na)      * sm(en))],
    ["Parade",     Math.floor(parry  * sm(11 - eo) * sm(11 - na) * sm(en))],
    ["Esquive",    Math.floor(dodge  * sm(11 - eo) * sm(na) * sm(11 - en))],
    ["Initiative", Math.floor(init   * sm(eo)      * sm(en))],
  ];

  for (const [label, value] of scoresList) {
    ctx.font      = THEME.components.statLabel.font;
    ctx.fillStyle = THEME.components.statLabel.color;
    ctx.textAlign = "left";
    ctx.fillText(label, cx, cy);
    ctx.font      = THEME.components.statValue.font;
    ctx.fillStyle = THEME.components.statValue.color;
    ctx.textAlign = "right";
    ctx.fillText(String(value), x + w - padding, cy);
    cy += 26;
  }

  ctx.textAlign = "left";
}