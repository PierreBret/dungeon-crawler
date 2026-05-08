/*
  SERVER/GAME/COMBAT.JS
  Résolveur de combat — côté serveur uniquement.

  Chaque action produit un tableau de lignes de log détaillées.
  Le client affiche ligne par ligne sur Entrée.
  Les lignes de fin (victoire/défaite/loot) font partie du log.
*/

// ─── Scores dérivés ───────────────────────────────────────────────────────────

export function computeScores(stats) {
  const vol = stats.volonté ?? stats.volonte ?? 0;
  return {
    enduranceInit: Math.floor((stats.constitution + vol + 10) * 2),
    BaseAttack:    Math.floor((stats.adresse * 0.5 + stats.vitesse * 0.3 + stats.intelligence * 0.2) * 4),
    BaseDodge:     stats.vitesse * 2 + stats.adresse - stats.taille,
    BaseParry:     stats.adresse + stats.force + vol,
    BaseRiposte:   Math.floor((stats.intelligence + stats.adresse * 0.5 + stats.vitesse * 0.5) / 2),
    init:          stats.vitesse * 0.6 + stats.intelligence * 0.4
  };
}

// ─── Modificateurs tactiques ──────────────────────────────────────────────────

/**
 * Calcule les modificateurs tactiques additifs pour les scores de défense.
 * - dodgeMod : (5 - EO) + (NA_effectif - 5) + (5 - EN)   (Req 10.2)
 * - parryMod : (5 - EO) + (5 - NA_effectif) + (EN - 5)   (Req 10.4)
 *
 * @param {number} eo - Effort Offensif (1–10)
 * @param {number} naEffectif - NA effectif (plafonné par endurance)
 * @param {number} en - Engagement (1–10)
 * @returns {{ dodgeMod: number, parryMod: number }}
 */
export function computeTacticMods(eo, naEffectif, en) {
  return {
    dodgeMod: (5 - eo) + (naEffectif - 5) + (5 - en),
    parryMod: (5 - eo) + (5 - naEffectif) + (en - 5)
  };
}

// ─── Charge, Portage et Surcoût d'Endurance ───────────────────────────────────

/**
 * Calcule la Charge totale d'un combattant.
 * Charge = Math.floor(PoidsArmeDroite + PoidsBouclier + Math.floor(PoidsArmures / 4))
 * - WeaponWeight = 0 si absent (Req 2.5)
 * - PoidsArmures = 0 car armures non implémentées (Req 2.4)
 */
export function computeCharge(weaponDef, equipment) {
  const poidsArmeDroite = weaponDef?.weight ?? 0;
  const poidsBouclier = equipment?.leftHand?.weight ?? 0;
  const poidsArmures = 0; // armures non implémentées (Req 2.4)
  return Math.floor(poidsArmeDroite + poidsBouclier + Math.floor(poidsArmures / 4));
}

/**
 * Calcule la capacité de portage d'un combattant.
 * Portage = Math.floor(force + Math.floor(taille / 2))
 */
export function computePortage(stats) {
  return Math.floor(stats.force + Math.floor(stats.taille / 2));
}

/**
 * Calcule le surcoût d'endurance lié à la surcharge.
 * Surcoût = Math.floor(Math.max(0, Charge - Portage) × 10 / 26)
 */
export function computeSurcoutEndurance(charge, portage) {
  return Math.floor(Math.max(0, charge - portage) * 10 / 26);
}

// ─── Clamping d'endurance ──────────────────────────────────────────────────────

/**
 * Contraint l'endurance dans la plage [0, EndInit] après toute modification.
 * endurance = Math.max(0, Math.min(endInit, endurance))
 * Req 3.7 : l'endurance ne peut jamais sortir de [0, EndInit].
 */
export function clampEndurance(endurance, endInit) {
  return Math.max(0, Math.min(endInit, endurance));
}

// ─── Sélection tactique par minute ────────────────────────────────────────────

/**
 * Retourne les paramètres tactiques (EO, NA, EN) pour une minute donnée.
 * - Joueur (isCreature = false) : tactic est un tableau de 5 éléments, index m-1
 * - Créature (isCreature = true) : tactic est un objet { min1, min2, ..., min5 }
 * - Si m > 5, utilise les paramètres de la minute 5.
 *
 * @param {Array|Object} tactic - Tactique du combattant
 * @param {number} minute - Minute courante (1+)
 * @param {boolean} isCreature - true si créature, false si joueur
 * @returns {{ EO: number, NA: number, EN: number }}
 */
export function getTacticForMinute(tactic, minute, isCreature) {
  const effectiveMinute = minute > 5 ? 5 : minute;
  if (isCreature) {
    return tactic[`min${effectiveMinute}`];
  }
  return tactic[effectiveMinute - 1];
}

// ─── Calcul du NA effectif en début de minute ─────────────────────────────────

/**
 * Calcule le NA effectif d'un combattant en début de minute.
 * NA_effectif = Math.min(NA_tactique, Math.floor(Endurance / 2))
 * Si endurance <= 0, NA_effectif = 0.
 * Cette valeur est fixée une seule fois en début de minute (pas de recalcul en cours de minute).
 */
export function computeNaEffectif(naTactique, endurance) {
  if (endurance <= 0) return 0;
  return Math.min(naTactique, Math.floor(endurance / 2));
}

// ─── Vivacité et Initiative ────────────────────────────────────────────────────

/**
 * Calcule le scoreVivacité d'un combattant pour un tick.
 * scoreVivacité = Math.floor(NA_effectif + vitesse × 0.6 + intelligence × 0.4 + d10 + momentum)
 *
 * @param {number} naEffectif - NA effectif du combattant (plafonné par endurance en début de minute)
 * @param {{ vitesse: number, intelligence: number }} stats - Statistiques du combattant
 * @param {number} momentum - Bonus/malus de momentum (0 dans cette version)
 * @param {number} d10 - Jet de dé d10 [1, 10], unique par combattant par tick
 * @returns {number} scoreVivacité (entier)
 */
export function computeVivacite(naEffectif, stats, momentum, d10) {
  return Math.floor(naEffectif + stats.vitesse * 0.6 + stats.intelligence * 0.4 + d10 + momentum);
}

/**
 * Détermine quel combattant est ATT (a l'initiative) pour ce tick.
 * - Le combattant avec le scoreVivacité le plus élevé est ATT.
 * - En cas d'égalité : le combattant avec le NA_effectif le plus élevé gagne.
 * - En cas de double égalité : tirage 50/50 via tieBreaker.
 *
 * @param {number} vivaciteA - scoreVivacité du combattant A
 * @param {number} vivaciteB - scoreVivacité du combattant B
 * @param {number} naEffectifA - NA_effectif du combattant A
 * @param {number} naEffectifB - NA_effectif du combattant B
 * @param {boolean} tieBreaker - true = A gagne le tirage 50/50, false = B gagne
 * @returns {"A" | "B"} Identifiant du combattant désigné ATT
 */
export function determineInitiative(vivaciteA, vivaciteB, naEffectifA, naEffectifB, tieBreaker) {
  if (vivaciteA > vivaciteB) return "A";
  if (vivaciteB > vivaciteA) return "B";
  // Égalité de vivacité : NA_effectif le plus élevé gagne
  if (naEffectifA > naEffectifB) return "A";
  if (naEffectifB > naEffectifA) return "B";
  // Double égalité : tirage 50/50
  return tieBreaker ? "A" : "B";
}

// ─── Choix d'action d'ATT avec dégradation ────────────────────────────────────

/**
 * Détermine l'action d'ATT selon son EO et son endurance, avec chaîne de dégradation.
 * - Si d10EO <= eo → intention = "attaque"
 * - Si d10EO > eo  → intention = "repositionnement"
 * - Dégradation : Attaque → Repositionnement → Récupération (si endurance insuffisante)
 * - L'endurance est vérifiée AVANT de déduire le coût (Req 6.5).
 *
 * @param {number} eo - Effort Offensif du combattant (1–10)
 * @param {number} endurance - Endurance courante du combattant
 * @param {number} coutAttaque - Coût en endurance d'une attaque
 * @param {number} coutRepo - Coût en endurance d'un repositionnement
 * @param {number} d10EO - Jet de dé D10 [1, 10] dédié au choix d'action
 * @param {number} distanceReelle - Distance réelle courante
 * @param {number} en - Engagement du combattant (pour calculer distance souhaitée)
 * @returns {{ action: "attaque"|"repositionnement"|"recuperation", fatigueMessage: string|null }}
 */
export function chooseAction(eo, endurance, coutAttaque, coutRepo, d10EO, distanceReelle, en) {
  const distanceSouhaitee = 11 - en;

  if (d10EO <= eo) {
    // Intention : attaquer
    if (endurance >= coutAttaque) {
      return { action: "attaque", fatigueMessage: null };
    }
    // Trop fatigué pour attaquer → tombe dans la branche repositionnement/récup
    return chooseNonAttackAction(endurance, coutRepo, distanceReelle, distanceSouhaitee, "trop fatigué pour attaquer");
  }

  // Intention : ne pas attaquer
  return chooseNonAttackAction(endurance, coutRepo, distanceReelle, distanceSouhaitee, null);
}

/**
 * Logique de choix quand ATT n'attaque pas (ou ne peut pas).
 */
function chooseNonAttackAction(endurance, coutRepo, distanceReelle, distanceSouhaitee, fatigueMessage) {
  if (distanceReelle !== distanceSouhaitee) {
    if (endurance >= coutRepo) {
      return { action: "repositionnement", fatigueMessage };
    }
    // Trop fatigué pour se repositionner aussi
    return { action: "recuperation", fatigueMessage: fatigueMessage ?? "trop fatigué pour se repositionner" };
  }
  // Déjà à la bonne distance → récupération
  return { action: "recuperation", fatigueMessage };
}

// ─── Résolution de l'Attaque ──────────────────────────────────────────────────

/**
 * Résout une attaque et retourne le résultat.
 * @param {{ adresse: number, vitesse: number, intelligence: number }} attackerStats
 * @param {{ dist: number, weight: number }} weaponDef - Définition de l'arme (dist = WeaponEN)
 * @param {number} distanceReelle - Distance courante entre combattants (1-10)
 * @param {number} d100 - Jet de dé D100 [1, 100]
 * @returns {{ hit: boolean, attackScore: number, attackQuality: number, baseAttack: number, modEN: number, phaseIncrement: number }}
 */
export function resolveAttack(attackerStats, weaponDef, distanceReelle, d100) {
  if (weaponDef == null || !("dist" in weaponDef)) {
    throw new Error("resolveCombat: champ 'dist' manquant dans weaponDef");
  }
  const baseAttack = Math.floor((attackerStats.adresse * 0.5 + attackerStats.vitesse * 0.3 + attackerStats.intelligence * 0.2) * 4);
  const modEN = Math.floor(Math.abs(distanceReelle - weaponDef.dist) * 2);
  const attackScore = baseAttack - modEN;
  const attackQuality = attackScore - d100;
  return {
    hit: attackQuality >= 0,
    attackScore,
    attackQuality,
    baseAttack,
    modEN,
    phaseIncrement: weaponDef.weight ?? 0
  };
}

// ─── Résolution du Repositionnement ───────────────────────────────────────────

/**
 * Résout un repositionnement.
 * Nouvelle formule : ±2 si écart >= 2, ±1 si écart == 1, 0 si déjà à distance.
 * @param {number} distanceReelle - Distance réelle actuelle (1-10)
 * @param {number} en - Engagement du combattant (1-10)
 * @returns {{ newDistance: number, phaseIncrement: number }}
 */
export function resolveReposition(distanceReelle, en) {
  const distCible = 11 - en;
  let newDistance = distanceReelle;

  if (distCible + 2 <= distanceReelle) {
    newDistance = distanceReelle - 2;
  } else if (distCible - 2 >= distanceReelle) {
    newDistance = distanceReelle + 2;
  } else if (distCible > distanceReelle) {
    newDistance = distanceReelle + 1;
  } else if (distCible < distanceReelle) {
    newDistance = distanceReelle - 1;
  }

  newDistance = Math.max(1, Math.min(10, newDistance));
  return { newDistance, phaseIncrement: 2 };
}

// ─── Résolution de la Récupération ────────────────────────────────────────────

/**
 * Résout une récupération.
 * @param {number} endurance - Endurance actuelle du combattant
 * @param {number} endInit - Endurance initiale (plafond)
 * @returns {{ newEndurance: number, phaseIncrement: number }}
 */
export function resolveRecovery(endurance, endInit) {
  const newEndurance = clampEndurance(endurance + 1, endInit);
  return { newEndurance, phaseIncrement: 1 };
}

// ─── Choix et résolution de la défense ─────────────────────────────────────────

/**
 * Choisit et résout la défense de DEF quand ATT a touché.
 *
 * @param {{ vitesse: number, adresse: number, taille: number, force: number, volonté?: number, volonte?: number }} defenderStats
 * @param {number} eo - EO du défenseur (1-10)
 * @param {number} naEffectif - NA_effectif du défenseur
 * @param {number} en - EN du défenseur (1-10)
 * @param {number} endurance - Endurance courante du défenseur
 * @param {number} coutEsquive - Coût d'esquive: Math.floor(5 + CoûtNA + Surcoût)
 * @param {number} coutParade - Coût de parade: Math.floor(2 + CoûtNA + Surcoût)
 * @param {number} d100 - Jet de dé D100 [1, 100] pour résoudre la défense
 * @returns {{
 *   defenseType: "esquive"|"parade"|"encaisse",
 *   success: boolean,
 *   dodgeScore: number,
 *   parryScore: number,
 *   defenseQuality: number,
 *   phaseIncrement: number,
 *   enduranceCost: number,
 *   degraded: boolean
 * }}
 */
export function chooseDefense(defenderStats, eo, naEffectif, en, endurance, coutEsquive, coutParade, d100) {
  const vol = defenderStats.volonté ?? defenderStats.volonte ?? 0;

  // 1. Compute base scores
  const baseDodge = defenderStats.vitesse * 2 + defenderStats.adresse - defenderStats.taille;
  const baseParry = defenderStats.adresse + defenderStats.force + vol;

  // 2. Compute full scores with tactic modifiers
  const dodgeScore = baseDodge + (5 - eo) + (naEffectif - 5) + (5 - en);
  const parryScore = baseParry + (5 - eo) + (5 - naEffectif) + (en - 5);

  // 3. Choose preferred defense: parade wins ties
  let preferred = dodgeScore > parryScore ? "esquive" : "parade";
  let degraded = false;

  // 4. Degradation: Esquive → Parade → Encaisse
  if (preferred === "esquive" && endurance < coutEsquive) {
    preferred = "parade";
    degraded = true;
  }
  if (preferred === "parade" && endurance < coutParade) {
    preferred = "encaisse";
    degraded = true;
  }

  // 5. Resolution
  let success;
  let phaseIncrement;
  let enduranceCost;
  let defenseQuality;

  if (preferred === "esquive") {
    defenseQuality = dodgeScore - d100;
    success = defenseQuality >= 0;
    phaseIncrement = 2;
    enduranceCost = coutEsquive;
  } else if (preferred === "parade") {
    defenseQuality = parryScore - d100;
    success = defenseQuality >= 0;
    phaseIncrement = 1;
    enduranceCost = coutParade;
  } else {
    // encaisse
    defenseQuality = 0;
    success = false;
    phaseIncrement = 0;
    enduranceCost = 0;
  }

  return {
    defenseType: preferred,
    success,
    dodgeScore,
    parryScore,
    defenseQuality,
    phaseIncrement,
    enduranceCost,
    degraded
  };
}

// ─── Résolution de la Riposte (ATT a raté) ────────────────────────────────────

/**
 * Résout une tentative de riposte quand ATT a raté son attaque.
 *
 * @param {{ intelligence: number, adresse: number, vitesse: number }} defenderStats
 * @param {number} naEffectif - NA_effectif du défenseur
 * @param {number} distanceReelle - Distance courante (1-10)
 * @param {number} endurance - Endurance courante du défenseur
 * @param {number} coutAttaque - Coût d'attaque du défenseur (Math.floor(WeaponWeight_DEF + CoûtNA + Surcoût))
 * @param {{ dist: number, weight: number }} weaponDef - Arme du défenseur
 * @param {number} d100Riposte - Jet D100 pour la tentative de riposte
 * @param {number} d100Attack - Jet D100 pour l'attaque de riposte (si autorisée)
 * @returns {{
 *   riposteAttempted: boolean,
 *   riposteAuthorized: boolean,
 *   riposteHit: boolean,
 *   riposteScore: number,
 *   riposteQuality: number,
 *   baseRiposte: number,
 *   distanceRiposte: number,
 *   attackResult: object|null,
 *   phaseIncrement: number,
 *   enduranceCost: number
 * }}
 */
export function resolveRiposte(defenderStats, naEffectif, distanceReelle, endurance, coutAttaque, weaponDef, d100Riposte, d100Attack) {
  // 1. BaseRiposte = Math.floor((intelligence + adresse × 0.5 + vitesse × 0.5) / 2)
  const baseRiposte = Math.floor((defenderStats.intelligence + defenderStats.adresse * 0.5 + defenderStats.vitesse * 0.5) / 2);

  // 2. RiposteScore = BaseRiposte + (naEffectif - 5) - distanceReelle
  const riposteScore = baseRiposte + (naEffectif - 5) - distanceReelle;

  // 3. RiposteQuality = RiposteScore - d100Riposte
  const riposteQuality = riposteScore - d100Riposte;

  // 4. riposteAttempted = true (always attempted when ATT misses)
  const riposteAttempted = true;

  // 5. If RiposteQuality >= 0 → riposte authorized (if endurance sufficient)
  if (riposteQuality >= 0) {
    // Check endurance
    if (endurance < coutAttaque) {
      // Endurance insuffisante → riposte annulée
      return {
        riposteAttempted,
        riposteAuthorized: false,
        riposteHit: false,
        riposteScore,
        riposteQuality,
        baseRiposte,
        distanceRiposte: 0,
        attackResult: null,
        phaseIncrement: 0,
        enduranceCost: 0
      };
    }

    // Riposte autorisée
    // DistanceRiposte = Math.max(1, DistanceRéelle - 2)
    const distanceRiposte = Math.max(1, distanceReelle - 2);

    // Résoudre l'attaque de riposte avec les formules standard à DistanceRiposte
    const attackResult = resolveAttack(defenderStats, weaponDef, distanceRiposte, d100Attack);

    // phaseIncrement = weaponDef.weight ?? 0
    const phaseIncrement = weaponDef.weight ?? 0;

    return {
      riposteAttempted,
      riposteAuthorized: true,
      riposteHit: attackResult.hit,
      riposteScore,
      riposteQuality,
      baseRiposte,
      distanceRiposte,
      attackResult,
      phaseIncrement,
      enduranceCost: coutAttaque
    };
  }

  // 6. If RiposteQuality < 0 → riposte fails
  return {
    riposteAttempted,
    riposteAuthorized: false,
    riposteHit: false,
    riposteScore,
    riposteQuality,
    baseRiposte,
    distanceRiposte: 0,
    attackResult: null,
    phaseIncrement: 0,
    enduranceCost: 0
  };
}

// ─── Réaction de DEF quand ATT ne l'attaque pas ───────────────────────────────

/**
 * Gère la réaction de DEF quand ATT ne l'attaque pas (repositionnement ou récupération d'ATT).
 *
 * @param {{ vitesse: number, intelligence: number, adresse: number, force: number, taille: number, volonté: number }} defenderStats
 * @param {number} eoDefender - EO du défenseur (1-10)
 * @param {number} enDefender - EN du défenseur (1-10)
 * @param {number} endurance - Endurance courante du défenseur
 * @param {number} coutAttaque - Coût d'attaque du défenseur
 * @param {number} coutRepo - Coût de repositionnement du défenseur
 * @param {number} distanceReelle - Distance courante (1-10)
 * @param {{ dist: number, weight: number }} weaponDef - Arme du défenseur
 * @param {number} d10EO - Jet D10 pour déterminer l'intention [1, 10]
 * @param {number} d100Repo - Jet D100 pour la tentative de repositionnement [1, 100]
 * @returns {{
 *   action: "attaque"|"repositionnement"|"recuperation",
 *   attackIntended: boolean,
 *   repoAttempted: boolean,
 *   repoSuccess: boolean,
 *   scoreRepo: number,
 *   newDistance: number|null,
 *   phaseIncrement: number,
 *   enduranceCost: number,
 *   degraded: boolean
 * }}
 */
export function resolveDefenderReaction(defenderStats, eoDefender, enDefender, endurance, coutAttaque, coutRepo, distanceReelle, weaponDef, d10EO, d100Repo) {
  // 1. Déterminer l'intention de DEF
  const attackIntended = (d10EO <= eoDefender);

  // 2. Si DEF veut attaquer
  if (attackIntended) {
    if (endurance >= coutAttaque) {
      // Endurance suffisante → DEF attaque (inversion des rôles, Req 7 + Req 10)
      return {
        action: "attaque",
        attackIntended,
        repoAttempted: false,
        repoSuccess: false,
        scoreRepo: 0,
        newDistance: null,
        phaseIncrement: weaponDef.weight ?? 0,
        enduranceCost: coutAttaque,
        degraded: false
      };
    }
    // Endurance insuffisante → dégradation (Req 6 critères 3–6)
    if (endurance >= coutRepo) {
      return {
        action: "repositionnement",
        attackIntended,
        repoAttempted: false,
        repoSuccess: false,
        scoreRepo: 0,
        newDistance: resolveReposition(distanceReelle, enDefender).newDistance,
        phaseIncrement: 2,
        enduranceCost: coutRepo,
        degraded: true
      };
    }
    // Endurance insuffisante même pour le repositionnement → récupération
    return {
      action: "recuperation",
      attackIntended,
      repoAttempted: false,
      repoSuccess: false,
      scoreRepo: 0,
      newDistance: null,
      phaseIncrement: 1,
      enduranceCost: -1,
      degraded: true
    };
  }

  // 3. DEF ne veut pas attaquer (d10EO > eoDefender)
  const distanceSouhaitee = 11 - enDefender;

  if (distanceReelle !== distanceSouhaitee) {
    // Tentative de repositionnement
    const scoreRepo = Math.floor((defenderStats.vitesse * 0.6 + defenderStats.intelligence * 0.4) * 5);
    const repoAttempted = true;

    if (scoreRepo - d100Repo >= 0 && endurance >= coutRepo) {
      // Repositionnement réussi — appliquer la logique de resolveReposition
      const { newDistance } = resolveReposition(distanceReelle, enDefender);
      return {
        action: "repositionnement",
        attackIntended,
        repoAttempted,
        repoSuccess: true,
        scoreRepo,
        newDistance,
        phaseIncrement: 2,
        enduranceCost: coutRepo,
        degraded: false
      };
    }

    // Repositionnement échoué → récupération
    return {
      action: "recuperation",
      attackIntended,
      repoAttempted,
      repoSuccess: false,
      scoreRepo,
      newDistance: null,
      phaseIncrement: 1,
      enduranceCost: -1,
      degraded: false
    };
  }

  // 4. DEF est déjà à sa distance souhaitée → récupération
  return {
    action: "recuperation",
    attackIntended,
    repoAttempted: false,
    repoSuccess: false,
    scoreRepo: 0,
    newDistance: null,
    phaseIncrement: 1,
    enduranceCost: -1,
    degraded: false
  };
}

// ─── Réduction armure ─────────────────────────────────────────────────────────

function computeArmorReduction(equipment) {
  if (!equipment) return 0;
  const slots = ["corps", "tete", "bras", "jambes"];
  const total = slots.reduce((sum, slot) => sum + (equipment[slot]?.tier ?? 0), 0);
  return Math.floor(total / 4);
}

// ─── Calcul dégâts ────────────────────────────────────────────────────────────

/**
 * Calcule les dégâts d'une attaque réussie.
 *
 * Formule complète :
 *   baseArme = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))
 *   modMatériau = table discrète [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0]
 *   coefStats = 1 + Σ((stat - 12) × 0.02 × weight)
 *   modAffinité = affinité / 100 (défaut 0 si absent — Req 13.4)
 *   modTypeDégâts = 1.0 (armures non implémentées — Req 13.5)
 *   TotalDamage = Math.floor(baseArme × modMatériau × coefStats × modAffinité × modTypeDégâts)
 *   dégâtsFinaux = Math.max(0, TotalDamage - armorReduction)
 *
 * @param {object} weaponDef - Définition de l'arme (damFirst, damLast, models, weightFO, etc.)
 * @param {object} weaponItem - Instance de l'arme (tier, material, affinities)
 * @param {object} attackerStats - Stats de l'attaquant (force, taille, intelligence, vitesse, adresse)
 * @param {number} armorReduction - Réduction d'armure (0 car armures non implémentées)
 * @param {string} [targetFamily] - Famille de la cible (pour lookup affinité)
 * @returns {{ raw: number, final: number, baseArme: number, modMateriau: number, coefStats: number, modAffinite: number, modTypeDegats: number }}
 */
export function computeDamage(weaponDef, weaponItem, attackerStats, armorReduction, targetFamily) {
  if (!weaponDef) return { raw: 0, final: 0, baseArme: 0, modMateriau: 1, coefStats: 1, modAffinite: 1, modTypeDegats: 1 };

  const nbTiers  = weaponDef.models?.length ?? 1;
  const tier     = weaponItem?.tier ?? 1;
  const baseArme = Math.floor(weaponDef.damFirst +
    (weaponDef.damLast - weaponDef.damFirst) * (tier - 1) / Math.max(nbTiers - 1, 1));

  const MATERIALS_MOD = [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0];
  const modMateriau = MATERIALS_MOD[weaponItem?.material ?? 0] ?? 1.0;

  const coefStats = 1
    + (attackerStats.force        - 12) * 0.02 * (weaponDef.weightFO ?? 0)
    + (attackerStats.taille       - 12) * 0.02 * (weaponDef.weightTA ?? 0)
    + (attackerStats.intelligence - 12) * 0.02 * (weaponDef.weightIN ?? 0)
    + (attackerStats.vitesse      - 12) * 0.02 * (weaponDef.weightVI ?? 0)
    + (attackerStats.adresse      - 12) * 0.02 * (weaponDef.weightAD ?? 0);

  // modAffinité : 1 + affinité / 100 (plage: 0 à 2)
  // affinité = 0 → neutre (×1), affinité = 100 → double (×2), affinité = -100 → nul (×0)
  // Si targetFamily n'est pas fourni (undefined), modAffinité = 1.0 (système d'affinité non applicable)
  // Si targetFamily est fourni mais l'affinité est absente, modAffinité = 1.0 (neutre par défaut)
  let modAffinite;
  if (targetFamily === undefined) {
    modAffinite = 1.0;
  } else {
    const affinityValue = weaponItem?.affinities?.[targetFamily] ?? 0;
    modAffinite = 1 + affinityValue / 100;
  }

  // modTypeDégâts : placeholder = 1.0 (armures non implémentées — Req 13.5)
  const modTypeDegats = 1.0;

  const raw   = Math.floor(baseArme * modMateriau * coefStats * modAffinite * modTypeDegats);
  const final = Math.max(0, raw - armorReduction);
  return { raw, final, baseArme, modMateriau, coefStats, modAffinite, modTypeDegats };
}

// ─── Helpers log ──────────────────────────────────────────────────────────────

function line(type, text) { return { type, text }; }

// ─── Validation des entrées ───────────────────────────────────────────────────

function validateInputs(playerData, creatureData) {
  // Validation playerData
  if (!playerData || !playerData.stats || playerData.hp == null || !playerData.tactic) {
    throw new Error("resolveCombat: playerData invalide");
  }

  // Validation creatureData
  if (!creatureData || !creatureData.stats || creatureData.hp == null || !creatureData.tactic) {
    throw new Error("resolveCombat: creatureData invalide");
  }

  // Validation tactic joueur : tableau de 5 éléments avec EO, NA, EN
  const playerTactic = playerData.tactic;
  if (
    !Array.isArray(playerTactic) ||
    playerTactic.length !== 5 ||
    !playerTactic.every(function hasEoNaEn(entry) {
      return entry != null && "EO" in entry && "NA" in entry && "EN" in entry;
    })
  ) {
    throw new Error("resolveCombat: tactic joueur invalide (attendu: tableau de 5 éléments {EO, NA, EN})");
  }

  // Validation tactic créature : clés min1..min5 avec EO, NA, EN
  const creatureTactic = creatureData.tactic;
  const requiredKeys = ["min1", "min2", "min3", "min4", "min5"];
  if (
    creatureTactic == null ||
    !requiredKeys.every(function hasMinKey(key) {
      const entry = creatureTactic[key];
      return entry != null && "EO" in entry && "NA" in entry && "EN" in entry;
    })
  ) {
    throw new Error("resolveCombat: tactic créature invalide (attendu: min1..min5 avec {EO, NA, EN})");
  }

  // Validation weaponDef : champ dist requis
  if (!playerData.weaponDef || !("dist" in playerData.weaponDef)) {
    throw new Error("resolveCombat: champ 'dist' manquant dans weaponDef");
  }
  if (!creatureData.weaponDef || !("dist" in creatureData.weaponDef)) {
    throw new Error("resolveCombat: champ 'dist' manquant dans weaponDef");
  }
}

// ─── Résolution complète ──────────────────────────────────────────────────────

export function resolveCombat(playerData, creatureData, options = {}) {
  validateInputs(playerData, creatureData);

  // ─── Options : devMode et injection de dés ──────────────────────────────────
  const devMode = options.devMode ?? false;
  const rollDieInjected = options.rollDie ?? function defaultRollDie(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // ─── Initialisation de l'état de combat ─────────────────────────────────────
  const playerScores = computeScores(playerData.stats);
  const creatureScores = computeScores(creatureData.stats);

  const state = {
    minute: 1,
    phase: 1,
    nbPhaseParMinute: 60,
    distanceReelle: 10,
    momentumA: 0,
    momentumB: 0,
    combatants: {
      player: {
        name: playerData.name,
        stats: playerData.stats,
        hp: playerData.hp,
        hpMax: playerData.hp,
        endurance: playerScores.enduranceInit,
        enduranceInit: playerScores.enduranceInit,
        naEffectif: 0, // computed below
        charge: computeCharge(playerData.weaponDef, playerData.equipment),
        portage: computePortage(playerData.stats),
        surcoutEndurance: 0, // computed below
        weaponDef: playerData.weaponDef,
        weaponItem: playerData.weaponItem,
        armorReduction: computeArmorReduction(playerData.equipment),
        tactic: playerData.tactic,
        isCreature: false
      },
      creature: {
        name: creatureData.nameFr,
        stats: creatureData.stats,
        hp: creatureData.hp,
        hpMax: creatureData.hp,
        endurance: creatureScores.enduranceInit,
        enduranceInit: creatureScores.enduranceInit,
        naEffectif: 0, // computed below
        charge: computeCharge(creatureData.weaponDef, creatureData.equipment),
        portage: computePortage(creatureData.stats),
        surcoutEndurance: 0, // computed below
        weaponDef: creatureData.weaponDef,
        weaponItem: creatureData.weaponItem ?? creatureData.equipment?.rightHand,
        armorReduction: computeArmorReduction(creatureData.equipment),
        tactic: creatureData.tactic,
        isCreature: true,
        family: creatureData.family
      }
    }
  };

  // Compute surcoutEndurance for each combatant
  state.combatants.player.surcoutEndurance = computeSurcoutEndurance(
    state.combatants.player.charge,
    state.combatants.player.portage
  );
  state.combatants.creature.surcoutEndurance = computeSurcoutEndurance(
    state.combatants.creature.charge,
    state.combatants.creature.portage
  );

  // Compute initial NA_effectif for minute 1
  const playerTacticMin1 = getTacticForMinute(state.combatants.player.tactic, 1, false);
  state.combatants.player.naEffectif = computeNaEffectif(
    playerTacticMin1.NA,
    state.combatants.player.endurance
  );

  const creatureTacticMin1 = getTacticForMinute(state.combatants.creature.tactic, 1, true);
  state.combatants.creature.naEffectif = computeNaEffectif(
    creatureTacticMin1.NA,
    state.combatants.creature.endurance
  );

  // ─── Boucle tick-par-tick ──────────────────────────────────────────────────
  const log = [];
  const rollDie = rollDieInjected;
  let lastMinuteLogged = 0;

  // Helper : incrémente la phase et logge en devMode
  function advancePhase(increment, reason) {
    const oldPhase = state.phase;
    state.phase += increment;
    if (devMode) {
      log.push(line("debug", `Phase ${oldPhase} → ${state.phase} (+${increment}, ${reason})`));
    }
  }

  // Main combat loop
  while (state.minute <= 20 && state.combatants.player.hp > 0 && state.combatants.creature.hp > 0) {
    // --- MINUTE SEPARATOR ---
    if (state.minute > lastMinuteLogged) {
      log.push(line("separator", `───── Minute ${state.minute} ─────`));
      lastMinuteLogged = state.minute;

      // Debug: minute start with EO/NA/EN and NA_effectif (une seule fois par minute)
      if (devMode) {
        const player = state.combatants.player;
        const creature = state.combatants.creature;
        const playerTacticDbg = getTacticForMinute(player.tactic, state.minute, false);
        const creatureTacticDbg = getTacticForMinute(creature.tactic, state.minute, true);
        log.push(line("debug", `Début minute ${state.minute} — ${player.name}: EO=${playerTacticDbg.EO} NA=${playerTacticDbg.NA} EN=${playerTacticDbg.EN} | ${creature.name}: EO=${creatureTacticDbg.EO} NA=${creatureTacticDbg.NA} EN=${creatureTacticDbg.EN}`));
        log.push(line("debug", `NA_effectif de ${player.name} : ${player.naEffectif}`));
        log.push(line("debug", `NA_effectif de ${creature.name} : ${creature.naEffectif}`));
      }
    }

    // Get current tactic for both combatants
    const playerTactic = getTacticForMinute(state.combatants.player.tactic, state.minute, false);
    const creatureTactic = getTacticForMinute(state.combatants.creature.tactic, state.minute, true);

    // --- INITIATIVE ---
    const d10A = rollDie(1, 10);
    const d10B = rollDie(1, 10);
    const vivA = computeVivacite(state.combatants.player.naEffectif, state.combatants.player.stats, state.momentumA, d10A);
    const vivB = computeVivacite(state.combatants.creature.naEffectif, state.combatants.creature.stats, state.momentumB, d10B);
    const tieBreaker = rollDie(1, 2) === 1;
    const attId = determineInitiative(vivA, vivB, state.combatants.player.naEffectif, state.combatants.creature.naEffectif, tieBreaker);

    const att = attId === "A" ? state.combatants.player : state.combatants.creature;
    const def = attId === "A" ? state.combatants.creature : state.combatants.player;
    const attTactic = attId === "A" ? playerTactic : creatureTactic;
    const defTactic = attId === "A" ? creatureTactic : playerTactic;

    // Debug: initiative dice
    if (devMode) {
      log.push(line("debug", `D10 initiative ${state.combatants.player.name} : ${d10A}, ${state.combatants.creature.name} : ${d10B}`));
    }

    // Log initiative
    log.push(line("initiative", `${att.name} prend l'initiative (vivacité: ${vivA}/${vivB})`));

    // --- COMPUTE COSTS ---
    const coutNA_att = Math.floor(att.naEffectif / 2);
    const coutNA_def = Math.floor(def.naEffectif / 2);
    const coutAttaque_att = Math.floor((att.weaponDef.weight ?? 0) + coutNA_att + att.surcoutEndurance);
    const coutRepo_att = Math.floor(1 + coutNA_att + att.surcoutEndurance);
    const coutAttaque_def = Math.floor((def.weaponDef.weight ?? 0) + coutNA_def + def.surcoutEndurance);
    const coutRepo_def = Math.floor(1 + coutNA_def + def.surcoutEndurance);
    const coutEsquive_def = Math.floor(5 + coutNA_def + def.surcoutEndurance);
    const coutParade_def = Math.floor(2 + coutNA_def + def.surcoutEndurance);

    // --- ATT ACTION ---
    const d10EO = rollDie(1, 10);
    const actionResult = chooseAction(attTactic.EO, att.endurance, coutAttaque_att, coutRepo_att, d10EO, state.distanceReelle, attTactic.EN);

    // Debug: action choice
    if (devMode) {
      log.push(line("debug", `${att.name} : ${actionResult.action}${actionResult.fatigueMessage ? ' (' + actionResult.fatigueMessage + ')' : ''}`));
    }

    // Log fatigue message if applicable
    if (actionResult.fatigueMessage) {
      log.push(line("action", `${actionResult.fatigueMessage}`));
    }

    if (actionResult.action === "attaque") {
      // Deduct endurance
      att.endurance = clampEndurance(att.endurance - coutAttaque_att, att.enduranceInit);

      // Debug: endurance after action
      if (devMode) {
        log.push(line("debug", `Endurance de ${att.name} : ${att.endurance} / ${att.enduranceInit}`));
      }

      // Resolve attack
      const d100Att = rollDie(1, 100);
      const attackResult = resolveAttack(att.stats, att.weaponDef, state.distanceReelle, d100Att);
      advancePhase(attackResult.phaseIncrement, "attaque " + att.name);

      // Log attack
      log.push(line("attack", `Attaque (score=${attackResult.attackScore}, jet=${d100Att}, qualité=${attackResult.attackQuality})`));

      if (attackResult.hit) {
        // DEF must defend
        const d100Def = rollDie(1, 100);
        const defenseResult = chooseDefense(def.stats, defTactic.EO, def.naEffectif, defTactic.EN, def.endurance, coutEsquive_def, coutParade_def, d100Def);
        def.endurance = clampEndurance(def.endurance - defenseResult.enduranceCost, def.enduranceInit);
        advancePhase(defenseResult.phaseIncrement, "défense " + def.name);

        // Debug: defense choice
        if (devMode) {
          log.push(line("debug", `${def.name} choisit ${defenseResult.defenseType} (DodgeScore=${defenseResult.dodgeScore}, ParryScore=${defenseResult.parryScore})`));
        }

        // Log defense attempt and result
        if (defenseResult.defenseType === "esquive") {
          log.push(line("dodge_attempt", `Esquive (score=${defenseResult.dodgeScore}, jet=${d100Def})`));
          if (defenseResult.success) {
            log.push(line("dodge", `Esquive réussie`));
          } else {
            log.push(line("defense_fail", `Défense échouée`));
          }
        } else if (defenseResult.defenseType === "parade") {
          log.push(line("parry_attempt", `Parade (score=${defenseResult.parryScore}, jet=${d100Def})`));
          if (defenseResult.success) {
            log.push(line("parry", `Parade réussie`));
          } else {
            log.push(line("defense_fail", `Défense échouée`));
          }
        } else {
          // encaisse
          log.push(line("defense_fail", `Défense échouée`));
        }

        if (!defenseResult.success) {
          // Apply damage
          const targetFamily = attId === "A" ? def.family : undefined;
          const dmg = computeDamage(att.weaponDef, att.weaponItem, att.stats, def.armorReduction, targetFamily);
          def.hp = Math.max(0, Math.min(def.hpMax, def.hp - dmg.final));

          // Debug: damage detail
          if (devMode) {
            log.push(line("debug", `Dégâts : baseArme=${dmg.baseArme} × modMat=${dmg.modMateriau} × coefStats=${dmg.coefStats.toFixed(2)} × modAffinité=${dmg.modAffinite} × modType=${dmg.modTypeDegats} = ${dmg.raw}`));
          }

          // Log damage
          if (def.armorReduction > 0) {
            log.push(line("armor", `Armure absorbe ${def.armorReduction}`));
          }
          log.push(line("hit", `${dmg.final} dégâts → ${def.name} (HP: ${def.hp}/${def.hpMax})`));
        }
      } else {
        // ATT missed
        log.push(line("miss", `Raté`));

        // DEF can riposte
        const d100Riposte = rollDie(1, 100);
        const d100RiposteAttack = rollDie(1, 100);
        const riposteResult = resolveRiposte(def.stats, def.naEffectif, state.distanceReelle, def.endurance, coutAttaque_def, def.weaponDef, d100Riposte, d100RiposteAttack);

        // Log riposte attempt
        log.push(line("riposte_attempt", `Riposte (score=${riposteResult.riposteScore}, jet=${d100Riposte})`));

        if (riposteResult.riposteAuthorized) {
          def.endurance = clampEndurance(def.endurance - riposteResult.enduranceCost, def.enduranceInit);
          advancePhase(riposteResult.phaseIncrement, "riposte " + def.name);

          if (riposteResult.riposteHit) {
            log.push(line("riposte", `Riposte touche ! (qualité=${riposteResult.attackResult.attackQuality})`));
            const targetFamily = attId === "A" ? undefined : att.family;
            const dmg = computeDamage(def.weaponDef, def.weaponItem, def.stats, att.armorReduction, targetFamily);
            att.hp = Math.max(0, Math.min(att.hpMax, att.hp - dmg.final));

            // Debug: riposte damage detail
            if (devMode) {
              log.push(line("debug", `Dégâts : baseArme=${dmg.baseArme} × modMat=${dmg.modMateriau} × coefStats=${dmg.coefStats.toFixed(2)} × modAffinité=${dmg.modAffinite} × modType=${dmg.modTypeDegats} = ${dmg.raw}`));
            }

            // Log riposte damage
            if (att.armorReduction > 0) {
              log.push(line("armor", `Armure absorbe ${att.armorReduction}`));
            }
            log.push(line("hit", `${dmg.final} dégâts → ${att.name} (HP: ${att.hp}/${att.hpMax})`));
          } else {
            log.push(line("riposte_fail", `Riposte échouée`));
          }
        } else {
          log.push(line("riposte_fail", `Riposte échouée`));
        }
      }
    } else if (actionResult.action === "repositionnement") {
      // Deduct endurance
      att.endurance = clampEndurance(att.endurance - coutRepo_att, att.enduranceInit);

      // Debug: endurance after action
      if (devMode) {
        log.push(line("debug", `Endurance de ${att.name} : ${att.endurance} / ${att.enduranceInit}`));
      }

      // Resolve reposition
      const oldDistance = state.distanceReelle;
      const repoResult = resolveReposition(state.distanceReelle, attTactic.EN);
      state.distanceReelle = repoResult.newDistance;
      advancePhase(repoResult.phaseIncrement, "repositionnement " + att.name);

      // Log reposition (uniquement si la distance a changé)
      if (state.distanceReelle !== oldDistance) {
        log.push(line("reposition", `Distance ${oldDistance} → ${state.distanceReelle}`));
      } else {
        log.push(line("reposition", `Distance ${state.distanceReelle} (inchangée)`));
      }

      // DEF reaction
      const d10EO_def = rollDie(1, 10);
      const d100Repo_def = rollDie(1, 100);
      const defReaction = resolveDefenderReaction(def.stats, defTactic.EO, defTactic.EN, def.endurance, coutAttaque_def, coutRepo_def, state.distanceReelle, def.weaponDef, d10EO_def, d100Repo_def);

      // Apply DEF reaction
      if (defReaction.action === "attaque") {
        def.endurance = clampEndurance(def.endurance - defReaction.enduranceCost, def.enduranceInit);
        advancePhase(defReaction.phaseIncrement, "réaction " + def.name);
        // DEF attacks ATT
        const d100DefAtt = rollDie(1, 100);
        const defAttackResult = resolveAttack(def.stats, def.weaponDef, state.distanceReelle, d100DefAtt);

        // Log DEF attack (roles inverted — DEF counter-attacks)
        log.push(line("attack", `${def.name} contre-attaque (score=${defAttackResult.attackScore}, jet=${d100DefAtt}, qualité=${defAttackResult.attackQuality})`));

        if (defAttackResult.hit) {
          // ATT must defend
          const coutEsquive_att = Math.floor(5 + coutNA_att + att.surcoutEndurance);
          const coutParade_att = Math.floor(2 + coutNA_att + att.surcoutEndurance);
          const d100AttDef = rollDie(1, 100);
          const attDefenseResult = chooseDefense(att.stats, attTactic.EO, att.naEffectif, attTactic.EN, att.endurance, coutEsquive_att, coutParade_att, d100AttDef);
          att.endurance = clampEndurance(att.endurance - attDefenseResult.enduranceCost, att.enduranceInit);
          advancePhase(attDefenseResult.phaseIncrement, "défense " + att.name);

          // Debug: defense choice (ATT defending against DEF)
          if (devMode) {
            log.push(line("debug", `${att.name} choisit ${attDefenseResult.defenseType} (DodgeScore=${attDefenseResult.dodgeScore}, ParryScore=${attDefenseResult.parryScore})`));
          }

          // Log ATT defense
          if (attDefenseResult.defenseType === "esquive") {
            log.push(line("dodge_attempt", `Esquive (score=${attDefenseResult.dodgeScore}, jet=${d100AttDef})`));
            if (attDefenseResult.success) {
              log.push(line("dodge", `Esquive réussie`));
            } else {
              log.push(line("defense_fail", `Défense échouée`));
            }
          } else if (attDefenseResult.defenseType === "parade") {
            log.push(line("parry_attempt", `Parade (score=${attDefenseResult.parryScore}, jet=${d100AttDef})`));
            if (attDefenseResult.success) {
              log.push(line("parry", `Parade réussie`));
            } else {
              log.push(line("defense_fail", `Défense échouée`));
            }
          } else {
            log.push(line("defense_fail", `Défense échouée`));
          }

          if (!attDefenseResult.success) {
            const targetFamily = attId === "A" ? undefined : att.family;
            const dmg = computeDamage(def.weaponDef, def.weaponItem, def.stats, att.armorReduction, targetFamily);
            att.hp = Math.max(0, Math.min(att.hpMax, att.hp - dmg.final));

            // Debug: damage detail
            if (devMode) {
              log.push(line("debug", `Dégâts : baseArme=${dmg.baseArme} × modMat=${dmg.modMateriau} × coefStats=${dmg.coefStats.toFixed(2)} × modAffinité=${dmg.modAffinite} × modType=${dmg.modTypeDegats} = ${dmg.raw}`));
            }

            // Log damage
            if (att.armorReduction > 0) {
              log.push(line("armor", `Armure absorbe ${att.armorReduction}`));
            }
            log.push(line("hit", `${dmg.final} dégâts → ${att.name} (HP: ${att.hp}/${att.hpMax})`));
          }
        } else {
          log.push(line("miss", `Raté`));
        }
      } else if (defReaction.action === "repositionnement") {
        const oldDistDef = state.distanceReelle;
        def.endurance = clampEndurance(def.endurance - defReaction.enduranceCost, def.enduranceInit);
        if (defReaction.newDistance !== null) {
          state.distanceReelle = defReaction.newDistance;
        }
        advancePhase(defReaction.phaseIncrement, "réaction " + def.name);

        // Log DEF reposition
                if (state.distanceReelle !== oldDistDef) {
          log.push(line("reposition", `Distance ${oldDistDef} → ${state.distanceReelle}`));
        } else {
          log.push(line("reposition", `Distance ${state.distanceReelle} (inchangée)`));
        }
      } else {
        // recuperation
        def.endurance = clampEndurance(def.endurance + 1, def.enduranceInit);
        advancePhase(1, "récupération " + def.name);

        // Log DEF recovery
        log.push(line("recovery", `Récupération (endurance: ${def.endurance}/${def.enduranceInit})`));
      }
    } else {
      // recuperation
      att.endurance = clampEndurance(att.endurance + 1, att.enduranceInit);
      advancePhase(1, "récupération " + def.name);

      // Debug: endurance after recovery
      if (devMode) {
        log.push(line("debug", `Endurance de ${att.name} : ${att.endurance} / ${att.enduranceInit}`));
      }

      // Log ATT recovery
      log.push(line("recovery", `Récupération (endurance: ${att.endurance}/${att.enduranceInit})`));

      // DEF reaction (same as repositionnement case)
      const d10EO_def = rollDie(1, 10);
      const d100Repo_def = rollDie(1, 100);
      const defReaction = resolveDefenderReaction(def.stats, defTactic.EO, defTactic.EN, def.endurance, coutAttaque_def, coutRepo_def, state.distanceReelle, def.weaponDef, d10EO_def, d100Repo_def);

      if (defReaction.action === "attaque") {
        def.endurance = clampEndurance(def.endurance - defReaction.enduranceCost, def.enduranceInit);
        advancePhase(defReaction.phaseIncrement, "réaction " + def.name);
        const d100DefAtt = rollDie(1, 100);
        const defAttackResult = resolveAttack(def.stats, def.weaponDef, state.distanceReelle, d100DefAtt);

        // Log DEF attack (roles inverted — DEF counter-attacks)
        log.push(line("attack", `${def.name} contre-attaque (score=${defAttackResult.attackScore}, jet=${d100DefAtt}, qualité=${defAttackResult.attackQuality})`));

        if (defAttackResult.hit) {
          const coutEsquive_att = Math.floor(5 + coutNA_att + att.surcoutEndurance);
          const coutParade_att = Math.floor(2 + coutNA_att + att.surcoutEndurance);
          const d100AttDef = rollDie(1, 100);
          const attDefenseResult = chooseDefense(att.stats, attTactic.EO, att.naEffectif, attTactic.EN, att.endurance, coutEsquive_att, coutParade_att, d100AttDef);
          att.endurance = clampEndurance(att.endurance - attDefenseResult.enduranceCost, att.enduranceInit);
          advancePhase(attDefenseResult.phaseIncrement, "défense " + att.name);

          // Debug: defense choice (ATT defending against DEF in recovery branch)
          if (devMode) {
            log.push(line("debug", `${att.name} choisit ${attDefenseResult.defenseType} (DodgeScore=${attDefenseResult.dodgeScore}, ParryScore=${attDefenseResult.parryScore})`));
          }

          // Log ATT defense
          if (attDefenseResult.defenseType === "esquive") {
            log.push(line("dodge_attempt", `Esquive (score=${attDefenseResult.dodgeScore}, jet=${d100AttDef})`));
            if (attDefenseResult.success) {
              log.push(line("dodge", `Esquive réussie`));
            } else {
              log.push(line("defense_fail", `Défense échouée`));
            }
          } else if (attDefenseResult.defenseType === "parade") {
            log.push(line("parry_attempt", `Parade (score=${attDefenseResult.parryScore}, jet=${d100AttDef})`));
            if (attDefenseResult.success) {
              log.push(line("parry", `Parade réussie`));
            } else {
              log.push(line("defense_fail", `Défense échouée`));
            }
          } else {
            log.push(line("defense_fail", `Défense échouée`));
          }

          if (!attDefenseResult.success) {
            const targetFamily = attId === "A" ? undefined : att.family;
            const dmg = computeDamage(def.weaponDef, def.weaponItem, def.stats, att.armorReduction, targetFamily);
            att.hp = Math.max(0, Math.min(att.hpMax, att.hp - dmg.final));

            // Debug: damage detail
            if (devMode) {
              log.push(line("debug", `Dégâts : baseArme=${dmg.baseArme} × modMat=${dmg.modMateriau} × coefStats=${dmg.coefStats.toFixed(2)} × modAffinité=${dmg.modAffinite} × modType=${dmg.modTypeDegats} = ${dmg.raw}`));
            }

            // Log damage
            if (att.armorReduction > 0) {
              log.push(line("armor", `Armure absorbe ${att.armorReduction}`));
            }
            log.push(line("hit", `${dmg.final} dégâts → ${att.name} (HP: ${att.hp}/${att.hpMax})`));
          }
        } else {
          log.push(line("miss", `Raté`));
        }
      } else if (defReaction.action === "repositionnement") {
        const oldDistDef = state.distanceReelle;
        def.endurance = clampEndurance(def.endurance - defReaction.enduranceCost, def.enduranceInit);
        if (defReaction.newDistance !== null) {
          state.distanceReelle = defReaction.newDistance;
        }
        advancePhase(defReaction.phaseIncrement, "réaction " + def.name);

        // Log DEF reposition
                if (state.distanceReelle !== oldDistDef) {
          log.push(line("reposition", `Distance ${oldDistDef} → ${state.distanceReelle}`));
        } else {
          log.push(line("reposition", `Distance ${state.distanceReelle} (inchangée)`));
        }
      } else {
        // recuperation
        def.endurance = clampEndurance(def.endurance + 1, def.enduranceInit);
        advancePhase(1, "récupération " + def.name);

        // Log DEF recovery
        log.push(line("recovery", `Récupération (endurance: ${def.endurance}/${def.enduranceInit})`));
      }
    }

    // --- CHECK HP ---
    if (state.combatants.player.hp <= 0 || state.combatants.creature.hp <= 0) break;

    // --- PHASE/MINUTE TRANSITION ---
    if (state.phase >= state.nbPhaseParMinute) {
      const oldPhase = state.phase;
      state.minute++;
      state.phase = 1;

      // Debug: phase tracking
      if (devMode) {
        log.push(line("debug", `Phase passe de ${oldPhase} à ${state.phase}`));
      }

      if (state.minute > 20) break; // draw

      // Recalculate NA_effectif for new minute
      const newPlayerTactic = getTacticForMinute(state.combatants.player.tactic, state.minute, false);
      state.combatants.player.naEffectif = computeNaEffectif(newPlayerTactic.NA, state.combatants.player.endurance);
      const newCreatureTactic = getTacticForMinute(state.combatants.creature.tactic, state.minute, true);
      state.combatants.creature.naEffectif = computeNaEffectif(newCreatureTactic.NA, state.combatants.creature.endurance);
    }
  }

  // --- DETERMINE WINNER ---
  let winner;
  if (state.combatants.player.hp <= 0) winner = "creature";
  else if (state.combatants.creature.hp <= 0) winner = "player";
  else winner = "draw"; // minute > 20

  // ─── Lignes de fin intégrées dans le log ──────────────────────────────────

  log.push(line("separator", "───── Fin du combat ─────"));

  if (winner === "player") {
    log.push(line("victory", `${state.combatants.player.name} remporte le combat ! (HP: ${state.combatants.player.hp}/${state.combatants.player.hpMax})`));
  } else if (winner === "creature") {
    log.push(line("defeat", `${state.combatants.player.name} est vaincu...`));
  } else {
    log.push(line("draw", "Match nul — le combat se termine sans vainqueur."));
  }

  return { log, playerHpFinal: state.combatants.player.hp, creatureHpFinal: state.combatants.creature.hp, winner };
}