/*
  CHARACTER CREATION RENDERER

  Affiche les candidats sous forme de cartes centrées.
  - Layout dynamique
  - Alignement propre
  - Padding uniforme
*/

import { loadAvatar } from "../core/assets.js";

export function drawCharacterCreation(ctx, candidates, selectedIndex) {

  // Candidats pas encore reçus du serveur — on attend
  if (!candidates || candidates.length === 0) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 🔥 IMPORTANT : baseline propre
  ctx.textBaseline = "top";

  const lineHeight = 26;
  const padding = 20;
  const spacing = 40;
  const startY = 140;
  const avatarSize = 150;
  const avatarSpacing = 15;

  // --- TITRE ---
  ctx.fillStyle = "white";
  ctx.font = "24px Arial";

  const title = "Choisissez votre personnage (← → puis Entrée)";
  const titleWidth = ctx.measureText(title).width;

  ctx.fillText(title, (ctx.canvas.width - titleWidth) / 2, 60);

  // --- 1. CALCUL DES BLOCS ---
  const blocks = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const stats = candidate.stats;

    ctx.font = "bold 22px Arial";
    let maxWidth = ctx.measureText(candidate.name).width;

    ctx.font = "20px Arial";

    const statsList = [
      ["FORCE", stats.force],
      ["CONSTITUTION", stats.constitution],
      ["TAILLE", stats.taille],
      ["INTELLIGENCE", stats.intelligence],
      ["VOLONTÉ", stats.volonté],
      ["VITESSE", stats.vitesse],
      ["ADRESSE", stats.adresse],
    ];

    for (let j = 0; j < statsList.length; j++) {
      const [label] = statsList[j];
      const width = ctx.measureText(label).width + 60; // espace pour la valeur
      if (width > maxWidth) maxWidth = width;
    }

    const textHeight = (1 + statsList.length) * lineHeight;
    const imageHeight = avatarSize + avatarSpacing;
    const blockHeight = textHeight + imageHeight + padding * 2;
    const blockWidth = maxWidth + padding * 2;

    blocks.push({ candidate, statsList, blockWidth, blockHeight });
  }

  // --- 2. LARGEUR TOTALE ---
  let totalWidth = 0;
  for (let i = 0; i < blocks.length; i++) {
    totalWidth += blocks[i].blockWidth;
  }
  totalWidth += spacing * (blocks.length - 1);

  // --- 3. CENTRAGE ---
  let currentX = (ctx.canvas.width - totalWidth) / 2;

  // --- 4. RENDER ---
  for (let i = 0; i < blocks.length; i++) {
    const { candidate, statsList, blockWidth, blockHeight } = blocks[i];

    const frameX = currentX;
    const frameY = startY;

    const contentX = frameX + padding;
    let currentY = frameY + padding;

    // --- CADRE ---
    if (i === selectedIndex) {
      ctx.fillStyle = "#333";
      ctx.fillRect(frameX, frameY, blockWidth, blockHeight);

      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.strokeRect(frameX, frameY, blockWidth, blockHeight);
    } else {
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(frameX, frameY, blockWidth, blockHeight);
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

    // centrage horizontal dans la carte
    const avatarX = frameX + (blockWidth - avatarSize) / 2;

    if (candidate.avatarImage) {
      ctx.drawImage(
        candidate.avatarImage,
        avatarX,
        currentY,
        avatarSize,
        avatarSize
      );
    } else {
      // placeholder
      ctx.fillStyle = "#222";
      ctx.fillRect(avatarX, currentY, avatarSize, avatarSize);
    }

    currentY += avatarSize + avatarSpacing;

    // --- STATS ---
    ctx.font = "20px Arial";

    for (let j = 0; j < statsList.length; j++) {
      const [label, value] = statsList[j];

      // label
      ctx.textAlign = "left";
      ctx.fillText(label, contentX, currentY);

      // valeur alignée à droite
      ctx.textAlign = "right";
      ctx.fillText(
        String(value),
        frameX + blockWidth - padding,
        currentY
      );

      currentY += lineHeight;
    }

    // reset important
    ctx.textAlign = "left";

    currentX += blockWidth + spacing;
  }
}