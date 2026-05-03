/*
  CLIENT/JS/CORE/EQUIPCHECKS.JS

  Vérification des contraintes de maniement des armes.
  Retourne une liste de messages string à afficher dans le panneau droit.

  Règles (GAME_DESIGN) :
  - stat_joueur + 2 < stat_arme  → message critique
  - stat_joueur     < stat_arme  → message léger
  - Main gauche : AD requise = arme.ad + 5
  - Ambidextrie : testé uniquement si 2 armes (pas bouclier)
    seuil = arme_gauche.fo + arme_droite.fo + 10
*/

/**
 * Retourne la liste des messages de contrainte pour l'équipement actuel.
 *
 * @param {object} playerStats   — stats du joueur
 * @param {string} playerName    — nom du joueur
 * @param {object|null} rightDef — def arme main droite (ou null)
 * @param {object|null} leftDef  — def arme main gauche (ou null)
 * @param {boolean} leftIsShield — true si main gauche est un bouclier
 * @returns {string[]}
 */
export function computeEquipMessages(playerStats, playerName, rightDef, leftDef, leftIsShield) {
  if (!playerStats) throw new Error("computeEquipMessages: playerStats manquant");
  if (!playerName)  throw new Error("computeEquipMessages: playerName manquant");

  const messages = [];

  if (rightDef) {
    for (const msg of checkWeaponConstraints(playerStats, playerName, rightDef, false)) {
      messages.push(msg);
    }
  }

  if (leftDef && !leftIsShield) {
    for (const msg of checkWeaponConstraints(playerStats, playerName, leftDef, true)) {
      messages.push(msg);
    }
  }

  if (rightDef && leftDef && !leftIsShield) {
    for (const msg of checkAmbidexterity(playerStats, playerName, rightDef, leftDef)) {
      messages.push(msg);
    }
  }

  if (messages.length === 0 && (rightDef || leftDef)) {
    messages.push(`${playerName} manie ${buildEquipSummary(rightDef, leftDef, leftIsShield)} avec aisance.`);
  }

  return messages;
}

// ─── Contraintes d'une arme ───────────────────────────────────────────────────

function checkWeaponConstraints(stats, name, def, isLeftHand) {
  if (!def) throw new Error("checkWeaponConstraints: def manquant");

  const messages = [];
  const slot     = isLeftHand ? "main gauche" : "main droite";
  const model    = def.models?.[0] ?? def.typeArme;

  // Force
  if (stats.force + 2 < def.fo) {
    messages.push(`${name} n'est pas assez fort pour manier ${model} (${slot}).`);
  } else if (stats.force < def.fo) {
    messages.push(`${name} n'est pas tout à fait assez fort pour manier ${model} (${slot}).`);
  }

  // Taille
  if (stats.taille + 2 < def.ta) {
    messages.push(`${name} est trop petit pour manier ${model} (${slot}).`);
  } else if (stats.taille < def.ta) {
    messages.push(`${name} est légèrement trop petit pour manier ${model} (${slot}).`);
  }

  // Intelligence
  if (stats.intelligence + 2 < def.in) {
    messages.push(`${name} ne comprend pas comment manier ${model} (${slot}).`);
  } else if (stats.intelligence < def.in) {
    messages.push(`${name} n'est pas assez malin pour manier ${model} (${slot}).`);
  }

  // Adresse (main gauche : seuil + 5)
  const adRequired = isLeftHand ? def.ad + 5 : def.ad;
  if (stats.adresse + 2 < adRequired) {
    messages.push(`${name} n'est pas assez adroit pour ${model} (${slot}).`);
  } else if (stats.adresse < adRequired) {
    messages.push(`${name} manque légèrement d'adresse pour manier ${model} (${slot}).`);
  }

  return messages;
}

// ─── Ambidextrie ──────────────────────────────────────────────────────────────

function checkAmbidexterity(stats, name, rightDef, leftDef) {
  if (!rightDef) throw new Error("checkAmbidexterity: rightDef manquant");
  if (!leftDef)  throw new Error("checkAmbidexterity: leftDef manquant");

  const messages = [];
  const seuil    = rightDef.fo + leftDef.fo + 10;

  if (stats.adresse + 2 <= seuil) {
    messages.push(`${name} n'est pas assez adroit pour manier ces 2 armes ensemble.`);
  } else if (stats.adresse <= seuil) {
    messages.push(`${name} manque légèrement d'adresse pour manier ces 2 armes ensemble.`);
  }

  return messages;
}

// ─── Résumé équipement ────────────────────────────────────────────────────────

function buildEquipSummary(rightDef, leftDef, leftIsShield) {
  const rightName = rightDef ? (rightDef.models?.[0] ?? rightDef.typeArme) : null;
  const leftName  = leftDef  ? (leftDef.models?.[0]  ?? leftDef.typeArme)  : null;

  if (rightName && leftName) {
    return leftIsShield ? `${rightName} avec bouclier` : `${rightName} et ${leftName}`;
  }
  if (rightName) return rightName;
  if (leftName)  return leftName;
  return "cet équipement";
}