import { loadAvatar } from "../../core/assets.js";

export function drawPlayerCard(ctx, candidate, frameX, frameY, blockWidth, isSelected = false) {
  ctx.textBaseline = "top";

  const padding = 20;
  const lineHeight = 26;
  const avatarSize = 150;
  const avatarSpacing = 15;

  const contentX = frameX + padding;
  let currentY = frameY + padding;

  // --- CADRE ---
  if (isSelected) {
    ctx.fillStyle = "#333";
    ctx.fillRect(frameX, frameY, blockWidth, 400); // hauteur temporaire

    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.strokeRect(frameX, frameY, blockWidth, 400);
  } else {
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(frameX, frameY, blockWidth, 400);
  }

  // --- NOM ---
  ctx.fillStyle = "white";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.fillText(candidate.name, contentX, currentY);

  currentY += lineHeight;

  // --- AVATAR ---
  if (!candidate.avatarImage) {
    loadAvatar(candidate.avatarPath).then(img => {
      candidate.avatarImage = img;
    });
  }

  const avatarX = frameX + (blockWidth - avatarSize) / 2;

  if (candidate.avatarImage) {
    ctx.drawImage(candidate.avatarImage, avatarX, currentY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(avatarX, currentY, avatarSize, avatarSize);
  }

  currentY += avatarSize + avatarSpacing;

  // --- STATS ---
  ctx.font = "20px Arial";

  const stats = candidate.stats;

  const statsList = [
    ["FORCE", stats.force],
    ["CONSTITUTION", stats.constitution],
    ["TAILLE", stats.taille],
    ["INTELLIGENCE", stats.intelligence],
    ["VOLONTÉ", stats.volonté],
    ["VITESSE", stats.vitesse],
    ["ADRESSE", stats.adresse],
  ];

  for (let i = 0; i < statsList.length; i++) {
    const [label, value] = statsList[i];

    ctx.textAlign = "left";
    ctx.fillText(label, contentX, currentY);

    ctx.textAlign = "right";
    ctx.fillText(String(value), frameX + blockWidth - padding, currentY);

    currentY += lineHeight;
  }

  ctx.textAlign = "left";
}