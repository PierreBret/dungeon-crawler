/*
  CLIENT/JS/UI/COMBATVIEW.JS
  Visualisation du combat ligne par ligne.

  Tout est dans le log — victoire/défaite/loot apparaissent comme des lignes.
  En fin de log : dialog de confirmation pour quitter.

  Navigation :
    Entrée : ligne suivante
    Fin du log : dialog "Quitter ?"
    ←/→ : Oui / Non dans le dialog
    Entrée sur Oui : quitter
    Entrée / Échap sur Non : rester
*/

import { THEME } from "../core/theme.js";

const LINE_COLORS = {
  separator:       THEME.text.accent,
  vivacite:        THEME.text.muted,
  initiative:      THEME.text.secondary,
  attack:          THEME.text.secondary,
  miss:            THEME.text.muted,
  dodge_attempt:   THEME.text.muted,
  parry_attempt:   THEME.text.muted,
  dodge:           THEME.text.secondary,
  parry:           THEME.text.secondary,
  defense_fail:    THEME.text.secondary,
  damage_raw:      THEME.text.secondary,
  armor:           THEME.text.muted,
  hit:             THEME.text.primary,
  riposte_attempt: THEME.text.muted,
  init_contest:    THEME.text.muted,
  riposte:         THEME.text.accent,
  riposte_fail:    THEME.text.muted,
  noAction:        THEME.text.muted,
  victory:         THEME.text.accent,
  defeat:          THEME.text.primary
};

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawCombatView(ctx, combatState, player) {
  if (!combatState) throw new Error("drawCombatView: combatState manquant");
  if (!player)      throw new Error("drawCombatView: player manquant");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  ctx.fillStyle = THEME.ui.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const W  = ctx.canvas.width;
  const H  = ctx.canvas.height;

  drawCombatLog(ctx, combatState, player, W, H);
}

// ─── Journal de combat ────────────────────────────────────────────────────────

function drawCombatLog(ctx, combatState, player, W, H) {
  const padding    = 40;
  const lineH      = 22;
  const log        = combatState.log ?? [];
  const currentIdx = combatState.currentLineIndex ?? 0;
  const atEnd      = currentIdx >= log.length - 1;

  // Titre
  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.heading;
  ctx.textAlign = "center";
  ctx.fillText("Combat", W / 2, 20);

  // HP courants
  const playerHp   = computeCurrentHp(log, currentIdx, player.name,                    combatState.playerHpStart);
  const creatureHp = computeCurrentHp(log, currentIdx, combatState.creature?.nameFr,   combatState.creatureHpStart);

  ctx.font      = THEME.font.mono;
  ctx.fillStyle = THEME.text.secondary;
  ctx.fillText(
    `${player.name} HP: ${playerHp}   |   ${combatState.creature?.nameFr} HP: ${creatureHp}`,
    W / 2, 50
  );

  ctx.textAlign = "left";

  // Zone de log
  const logX     = padding;
  const logY     = 88;
  const maxLines = Math.floor((H - logY - 60) / lineH);
  const start    = Math.max(0, currentIdx - maxLines + 1);
  const visible  = log.slice(start, currentIdx + 1);

  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    ctx.fillStyle = LINE_COLORS[entry.type] ?? THEME.text.primary;
    ctx.font      = entry.type === "separator" ? THEME.font.monoBold : THEME.font.mono;
    ctx.fillText(entry.text, logX, logY + i * lineH);
  }

  // Loot sous le log si victoire et fin atteinte
  if (atEnd && combatState.winner === "player" && combatState.drop) {
    const dropY = logY + Math.min(visible.length, maxLines) * lineH + 10;
    const drop  = combatState.drop;
    const def   = drop.weaponDef;
    const model = def?.models?.[(drop.tier ?? 1) - 1] ?? drop.itemCode;
    ctx.fillStyle = THEME.text.accent;
    ctx.font      = THEME.font.mono;
    ctx.fillText(`Butin : ${model} en ${drop.matName ?? "?"}`, logX, dropY);
  }

  // Légende / dialog
  if (atEnd && combatState.confirmQuit) {
    drawQuitConfirm(ctx, combatState, W / 2, H);
  } else {
    ctx.fillStyle = atEnd ? THEME.text.accent : THEME.text.muted;
    ctx.font      = THEME.font.small;
    ctx.textAlign = "center";
    ctx.fillText(
      atEnd ? "Entrée — quitter le compte rendu" : "Entrée — ligne suivante",
      W / 2, H - 24
    );
    ctx.textAlign = "left";
  }
}

// ─── Calcul HP courant depuis le log ─────────────────────────────────────────

function computeCurrentHp(log, currentIdx, name, startHp) {
  if (!name) return startHp ?? "?";
  let hp = startHp ?? "?";
  for (let i = 0; i <= currentIdx && i < log.length; i++) {
    const entry = log[i];
    if ((entry.type === "hit" || entry.type === "riposte" || entry.type === "victory") &&
        entry.text.includes(name) && entry.text.includes("HP:")) {
      const match = entry.text.match(/HP:\s*(\d+)/);
      if (match) hp = parseInt(match[1]);
    }
  }
  return hp;
}

// ─── Dialog confirmation quitter ──────────────────────────────────────────────

function drawQuitConfirm(ctx, combatState, cx, H) {
  const choice = combatState.quitChoice ?? 1;
  const w = 400;
  const h = 90;
  const x = cx - w / 2;
  const y = H - h - 20;

  ctx.fillStyle   = THEME.ui.bgConfirm;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = THEME.ui.borderAccent;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.font      = THEME.font.mono;
  ctx.fillStyle = THEME.text.primary;
  ctx.textAlign = "center";
  ctx.fillText("Quitter le compte rendu ?", cx, y + 14);

  const btnW = 80; const btnH = 28;
  const btnY = y + h - btnH - 10;

  drawConfirmButton(ctx, "Oui", cx - btnW - 12, btnY, btnW, btnH, choice === 0);
  drawConfirmButton(ctx, "Non", cx + 12,         btnY, btnW, btnH, choice === 1);

  ctx.textAlign = "left";
}

function drawConfirmButton(ctx, label, x, y, w, h, isSelected) {
  ctx.fillStyle   = isSelected ? "#1a1a00" : THEME.ui.bgItem;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isSelected ? THEME.ui.borderAccent : THEME.ui.border;
  ctx.lineWidth   = isSelected ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle   = isSelected ? THEME.text.accent : THEME.text.muted;
  ctx.font        = THEME.font.mono;
  ctx.textAlign   = "center";
  ctx.fillText(label, x + w / 2, y + 7);
}