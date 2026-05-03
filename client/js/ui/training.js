/*
  CLIENT/JS/UI/TRAINING.JS
  Écran d'entraînement du terrain de combat.

  Flow :
    1. Sélection de la stat à entraîner (↑↓ + Entrée)
    2. Animation (durée = 5 * (1 + nbAugmentations) secondes)
    3. Résultat affiché (succès ou échec)
    4. Échap → retour au donjon

  Stats entraînables : force, constitution, intelligence, volonté, vitesse, adresse
  Stats grisées : taille (non entraînable), stat >= 21
*/

import { THEME } from "../core/theme.js";

// ─── Configuration des stats entraînables ────────────────────────────────────

export const TRAINABLE_STATS = [
  { key: "force",        label: "Force",        sqlKey: "force"        },
  { key: "constitution", label: "Constitution", sqlKey: "constitution" },
  { key: "intelligence", label: "Intelligence", sqlKey: "intelligence" },
  { key: "volonté",      label: "Volonté",      sqlKey: "volonte"      },
  { key: "vitesse",      label: "Vitesse",      sqlKey: "vitesse"      },
  { key: "adresse",      label: "Adresse",      sqlKey: "adresse"      },
  { key: "taille",       label: "Taille",       sqlKey: null           },
];

// ─── Draw principal ───────────────────────────────────────────────────────────

export function drawTraining(ctx, trainingState, player) {
  if (!trainingState) throw new Error("drawTraining: trainingState manquant");
  if (!player)        throw new Error("drawTraining: player manquant");

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.textBaseline = "top";

  ctx.fillStyle = THEME.ui.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const cx = ctx.canvas.width  / 2;
  const cy = ctx.canvas.height / 2;

  switch (trainingState.phase) {
    case "select":
      drawSelectPhase(ctx, trainingState, player, cx, cy);
      break;
    case "animating":
      drawAnimationPhase(ctx, trainingState, player, cx, cy);
      break;
    case "result":
      drawResultPhase(ctx, trainingState, player, cx, cy);
      break;
    default:
      console.error(`drawTraining: phase inconnue "${trainingState.phase}"`);
  }
}

// ─── Phase sélection ──────────────────────────────────────────────────────────

function drawSelectPhase(ctx, state, player, cx, cy) {
  const augmentations = player.augmentations ?? {};

  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.title;
  ctx.textAlign = "center";
  ctx.fillText("Terrain d'entraînement", cx, 60);

  ctx.fillStyle = THEME.text.secondary;
  ctx.font      = THEME.font.mono;
  ctx.fillText("Choisissez une stat à entraîner", cx, 100);

  ctx.textAlign = "left";

  const lineH  = 48;
  const startY = 160;
  const listX  = cx - 200;

  for (let i = 0; i < TRAINABLE_STATS.length; i++) {
    const stat       = TRAINABLE_STATS[i];
    const isGrayed   = stat.sqlKey === null;
    const statVal    = player.stats[stat.key] ?? 0;
    const isMaxed    = statVal >= 21;
    const isDisabled = isGrayed || isMaxed;
    const isSelected = i === state.selectedIndex;
    const nbAug      = augmentations[stat.sqlKey] ?? 0;
    const itemY      = startY + i * lineH;

    // Fond surbrillance
    if (isSelected && !isDisabled) {
      ctx.fillStyle   = THEME.ui.bgSelected;
      ctx.fillRect(listX - 16, itemY - 8, 432, lineH - 4);
      ctx.strokeStyle = THEME.ui.borderAccent;
      ctx.lineWidth   = 1;
      ctx.strokeRect(listX - 16, itemY - 8, 432, lineH - 4);
    }

    // Label stat — style uniforme avec characterCard
    ctx.font      = isSelected && !isDisabled
      ? `bold ${THEME.components.statLabel.font}`
      : THEME.components.statLabel.font;
    ctx.fillStyle = isDisabled
      ? THEME.text.disabled
      : (isSelected ? THEME.text.accent : THEME.components.statLabel.color);
    ctx.fillText(stat.label, listX, itemY);

    // Valeur stat — style uniforme avec characterCard
    ctx.font      = THEME.components.statValue.font;
    ctx.fillStyle = isDisabled ? THEME.text.disabled : THEME.components.statValue.color;
    ctx.textAlign = "left";
    ctx.fillText(`${statVal}`, listX + 200, itemY);

    // Nb augmentations
    if (!isDisabled && nbAug > 0) {
      ctx.fillText(`(+${nbAug})`, listX + 240, itemY);
    }

    // Raison du grisage
    if (isMaxed) {
      ctx.fillStyle = THEME.text.disabled;
      ctx.font      = THEME.font.small;
      ctx.fillText("maximum atteint", listX + 290, itemY + 2);
    } else if (isGrayed) {
      ctx.fillStyle = THEME.text.disabled;
      ctx.font      = THEME.font.small;
      ctx.fillText("non entraînable", listX + 290, itemY + 2);
    }
  }

  ctx.fillStyle = THEME.text.muted;
  ctx.font      = THEME.font.small;
  ctx.textAlign = "center";
  ctx.fillText("↑↓ naviguer  •  Entrée choisir  •  Échap retour au donjon", cx, ctx.canvas.height - 40);
  ctx.textAlign = "left";
}

// ─── Phase animation ──────────────────────────────────────────────────────────

function drawAnimationPhase(ctx, state, player, cx, cy) {
  const now      = Date.now();
  const elapsed  = (now - state.animationStart) / 1000;
  const progress = Math.min(elapsed / state.animationDuration, 1);
  const t        = now / 1000;

  ctx.fillStyle = THEME.text.primary;
  ctx.font      = THEME.font.heading;
  ctx.textAlign = "center";
  const statLabel = TRAINABLE_STATS.find(s => s.sqlKey === state.selectedStat)?.label ?? "";
  ctx.fillText(`Entraînement — ${statLabel}`, cx, 60);

  drawStatAnimation(ctx, state.selectedStat, cx, cy - 40, t, progress);

  const barW = 400;
  const barH = 18;
  const barX = cx - barW / 2;
  const barY = cy + 120;

  ctx.fillStyle = THEME.ui.bgItem;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = THEME.text.accent;
  ctx.fillRect(barX, barY, barW * progress, barH);
  ctx.strokeStyle = THEME.ui.border;
  ctx.lineWidth   = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  const remaining = Math.ceil(state.animationDuration - elapsed);
  ctx.fillStyle   = THEME.text.secondary;
  ctx.font        = THEME.font.small;
  ctx.fillText(`${remaining}s`, cx, barY + barH + 12);

  ctx.textAlign = "left";
}

// ─── Animations par stat ──────────────────────────────────────────────────────

function drawStatAnimation(ctx, stat, cx, cy, t, progress) {
  ctx.save();

  switch (stat) {

    case "force": {
      const lift = Math.sin(t * 3) * 20 * (1 - progress * 0.3);
      ctx.fillStyle = THEME.text.secondary;
      ctx.fillRect(cx - 60, cy + lift, 120, 16);
      ctx.fillRect(cx - 80, cy + lift - 10, 20, 36);
      ctx.fillRect(cx + 60, cy + lift - 10, 20, 36);
      ctx.strokeStyle = THEME.text.accent;
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy + 60);
      ctx.lineTo(cx - 20, cy + lift + 16);
      ctx.moveTo(cx + 20, cy + 60);
      ctx.lineTo(cx + 20, cy + lift + 16);
      ctx.stroke();
      break;
    }

    case "constitution": {
      const pulse = 1 + Math.sin(t * 4) * 0.15;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse * 2, pulse * 2);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-30, -20, -50, 10, 0, 40);
      ctx.bezierCurveTo(50, 10, 30, -20, 0, 10);
      ctx.fill();
      ctx.restore();
      break;
    }

    case "intelligence": {
      const runes  = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ"];
      const radius = 80;
      ctx.font         = "24px serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < runes.length; i++) {
        const angle   = (i / runes.length) * Math.PI * 2 + t * 0.8;
        const rx      = cx + Math.cos(angle) * radius;
        const ry      = cy + Math.sin(angle) * radius;
        const opacity = 0.4 + 0.6 * Math.sin(t * 2 + i);
        ctx.fillStyle = `rgba(180, 140, 255, ${opacity})`;
        ctx.fillText(runes[i], rx, ry);
      }
      ctx.textBaseline = "top";
      break;
    }

    case "volonte": {
      const flameH = 60 + Math.sin(t * 5) * 15 + progress * 40;
      const flameW = 30 + Math.sin(t * 3) * 8;
      ctx.fillStyle = "rgba(255, 100, 0, 0.9)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - flameH);
      ctx.quadraticCurveTo(cx + flameW, cy - flameH / 2, cx + flameW / 2, cy);
      ctx.quadraticCurveTo(cx, cy + 10, cx - flameW / 2, cy);
      ctx.quadraticCurveTo(cx - flameW, cy - flameH / 2, cx, cy - flameH);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 220, 50, 0.8)";
      ctx.beginPath();
      ctx.ellipse(cx, cy - flameH * 0.3, flameW * 0.3, flameH * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "vitesse": {
      const legAngle = Math.sin(t * 8) * 0.6;
      ctx.strokeStyle = THEME.text.accent;
      ctx.lineWidth   = 5;
      ctx.lineCap     = "round";
      ctx.beginPath();
      ctx.arc(cx, cy - 50, 16, 0, Math.PI * 2);
      ctx.fillStyle = THEME.text.accent;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 34);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(legAngle) * 30, cy + 40);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - Math.sin(legAngle) * 30, cy + 40);
      ctx.stroke();
      for (let i = 1; i <= 4; i++) {
        ctx.strokeStyle = `rgba(212, 160, 23, ${0.3 - i * 0.06})`;
        ctx.beginPath();
        ctx.moveTo(cx - i * 20, cy - 30);
        ctx.lineTo(cx - i * 20 - 30, cy - 30);
        ctx.stroke();
      }
      break;
    }

    case "adresse": {
      const rings  = [40, 28, 16, 6];
      const colors = ["#555", "#888", "#c0392b", "#e74c3c"];
      for (let i = 0; i < rings.length; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, rings[i], 0, Math.PI * 2);
        ctx.fillStyle = colors[i];
        ctx.fill();
      }
      const arrowProgress = (t * 0.8) % 1;
      const arrowX = cx - 200 + arrowProgress * 200;
      const arrowY = cy + Math.sin(arrowProgress * Math.PI) * (-30);
      ctx.strokeStyle = THEME.text.accent;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(arrowX - 20, arrowY);
      ctx.lineTo(arrowX + 10, arrowY);
      ctx.stroke();
      ctx.fillStyle = THEME.text.accent;
      ctx.beginPath();
      ctx.moveTo(arrowX + 10, arrowY);
      ctx.lineTo(arrowX + 2,  arrowY - 5);
      ctx.lineTo(arrowX + 2,  arrowY + 5);
      ctx.fill();
      break;
    }

    default:
      console.error(`drawStatAnimation: stat inconnue "${stat}"`);
  }

  ctx.restore();
}

// ─── Phase résultat ───────────────────────────────────────────────────────────

function drawResultPhase(ctx, state, player, cx, cy) {
  const statEntry = TRAINABLE_STATS.find(s => s.sqlKey === state.selectedStat);
  const statLabel = statEntry?.label ?? "";
  const statVal   = player.stats[statEntry?.key] ?? 0;

  ctx.textAlign = "center";

  // Message principal
  ctx.font      = THEME.font.title;
  ctx.fillStyle = THEME.text.primary;

    if (state.success) {
        ctx.fillText(`${player.name} a réussi à augmenter sa ${statLabel.toLowerCase()} !`, cx, cy - 80);

        // Stat avant/après — style uniforme
        ctx.font      = THEME.components.statLabel.font;
        ctx.fillStyle = THEME.components.statLabel.color;
        ctx.fillText(statLabel, cx - 60, cy - 20);

        ctx.font      = THEME.components.statValue.font;
        ctx.fillStyle = THEME.components.statValue.color;
        ctx.fillText(`${statVal - 1} → ${statVal}`, cx + 60, cy - 20);
    } else {
        ctx.fillText(`${player.name} n'a pas réussi à augmenter sa ${statLabel.toLowerCase()}.`, cx, cy - 80);
        ctx.font      = THEME.font.body;
        ctx.fillStyle = THEME.text.secondary;
        ctx.fillText("Meilleure chance la prochaine fois.", cx, cy - 30);
    }

    // Chance et roll pour debug
    ctx.font      = THEME.font.mono;
    ctx.fillStyle = THEME.text.muted;
    ctx.fillText(`Chance : ${state.chance ?? "?"}%   —   Roll : ${state.roll ?? "?"}`, cx, cy + 40);

    ctx.font      = THEME.font.small;
    ctx.fillStyle = THEME.text.muted;
    ctx.fillText("Échap — retour au donjon", cx, ctx.canvas.height - 40);
    ctx.textAlign = "left";
}