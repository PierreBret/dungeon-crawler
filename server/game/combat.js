/*
  SERVER/GAME/COMBAT.JS
  Résolveur de combat — côté serveur uniquement.

  Moteur de combat refactorisé : architecture modulaire avec fonctions pures,
  configuration externalisée, et phases isolées.

  Point d'entrée : resolveCombat(playerData, creatureData, rng?)
*/

import { COMBAT } from "./combatConfig.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// presentation.json doit être chargé en mémoire avant tout appel à Presentation()
const presentation = JSON.parse(
  readFileSync(join(__dirname, "../data/presentation.json"), "utf8")
);

// armors.json — référentiel des pièces d'armure par slot et tier
const armors = JSON.parse(
  readFileSync(join(__dirname, "../data/armors.json"), "utf8")
);

// ─── Normalisation en pourcentage ──────────────────────────────────────────────

/**
 * Transforme une compétence brute en pourcentage normalisé.
 * Formule : floor(skill × multiplicateur / diviseur), plafonné dans [percentMin, percentMax].
 *
 * @param {number} rawSkill - Compétence brute
 * @param {number} multiplier - Multiplicateur spécifique à la compétence (config.normalization)
 * @param {number} divisor - Diviseur spécifique à la compétence
 * @param {object} config - Configuration (pour percentMin/percentMax)
 * @returns {number} Pourcentage entier dans [percentMin, percentMax]
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
export function normalizeToPercent(rawSkill, multiplier, divisor, config) {
  const raw = Math.floor(rawSkill * multiplier / divisor);
  return Math.max(config.percentMin, Math.min(config.percentMax, raw));
}

// ─── Compétences dérivées ─────────────────────────────────────────────────────

/**
 * Calcule les 6 compétences dérivées à partir des statistiques primaires
 * et des coefficients définis dans la configuration.
 *
 * Pour chaque compétence, la formule est :
 *   Σ(stat × coefficient) pour chaque stat référencée dans config.skills[compétence]
 *
 * Cas spécial : TAI_INV utilise (24 - TAI) au lieu de TAI directement.
 *
 * @param {{ FOR: number, CON: number, TAI: number, INT: number, VOL: number, VIT: number, ADR: number }} stats
 * @param {object} config - Objet COMBAT contenant config.skills avec les coefficients
 * @returns {{ vivacite: number, initiative: number, attaque: number, parade: number, esquive: number, riposte: number }}
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export function computeDerivedSkills(stats, config) {
  const skillNames = ['vivacite', 'initiative', 'attaque', 'parade', 'esquive', 'riposte'];
  const result = {};

  for (const skillName of skillNames) {
    const coefficients = config.skills[skillName];
    let total = 0;

    for (const [key, coef] of Object.entries(coefficients)) {
      if (key === 'TAI_INV') {
        total += (24 - stats.TAI) * coef;
      } else {
        total += stats[key] * coef;
      }
    }

    result[skillName] = total;
  }

  return result;
}

// ─── Ajustements tactiques — compétences effectives ───────────────────────────

/**
 * Calcule les compétences effectives après ajustements tactiques.
 *
 * Formules :
 * - Vivacité_eff = Vivacité% + (EO-5)×2 + (NA-5)
 * - Initiative_eff = Initiative% + (EO-5) + (NA-5) + (EN-5)
 * - Attaque_eff = Attaque% + (EO-5) + (5-|DistanceArme - Distance|)×2
 * - Esquive_eff = Esquive% + (5-EO) + (NA-5) + (5-EN)
 * - Parade_eff = Parade% + (5-EO) + (5-NA) + (5-EN)
 * - Riposte_eff = Riposte% + (5-EO) + (5-NA) + (EN-5)×2
 *
 * Chaque résultat est borné dans [config.effectiveMin, config.effectiveMax] = [1, 99].
 *
 * @param {object} percentages - {vivacite, initiative, attaque, parade, esquive, riposte} in [12.5, 87.5]
 * @param {object} tactics - {EO, NA, EN} values [1, 10]
 * @param {number} distance - Current distance [1, 10]
 * @param {number} weaponDist - Weapon optimal distance [1, 10]
 * @param {object} config - COMBAT config
 * @returns {object} {vivacite, initiative, attaque, parade, esquive, riposte} in [1, 99]
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */
export function computeEffectiveSkills(percentages, tactics, distance, weaponDist, config) {
  const { EO, NA, EN } = tactics;
  const neutral = config.tacticNeutral;

  const clamp = (value) => Math.max(config.effectiveMin, Math.min(config.effectiveMax, Math.floor(value)));

  const vivacite = clamp(percentages.vivacite + (EO - neutral) * 2 + (NA - neutral));
  const initiative = clamp(percentages.initiative + (EO - neutral) + (NA - neutral) + (EN - neutral));
  const attaque = clamp(percentages.attaque + (EO - neutral) + (neutral - Math.abs(weaponDist - distance)) * 2);
  const esquive = clamp(percentages.esquive + (neutral - EO) + (NA - neutral) + (neutral - EN));
  const parade = clamp(percentages.parade + (neutral - EO) + (neutral - NA) + (neutral - EN));
  const riposte = clamp(percentages.riposte + (neutral - EO) + (neutral - NA) + (EN - neutral) * 2);

  return { vivacite, initiative, attaque, esquive, parade, riposte };
}

// ─── Système de jets de dés ────────────────────────────────────────────────────

/**
 * Effectue un jet de compétence uniforme.
 * Formule : quality = effectiveSkill - D100 - fatigue
 * Le jet est réussi si quality >= 0.
 *
 * @param {number} effectiveSkill - Compétence effective [1, 99]
 * @param {number} fatigue - Malus de fatigue {0, 5, 10, 15, 20}
 * @param {Function} rng - Générateur aléatoire (returns [0, 1))
 * @returns {{quality: number, d100: number, success: boolean}}
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export function rollSkill(effectiveSkill, fatigue, rng) {
  const d100 = Math.floor(rng() * 100) + 1;
  const quality = effectiveSkill - d100 - fatigue;
  return { quality, d100, success: quality >= 0 };
}

/**
 * log — pousse une entrée dans le buffer (visible au prochain flushLogs).
 */
function log(state, type, text) {
  state.logBuffer.push({ type, text });
}

/**
 * logDev — pousse une entrée de log uniquement si devMode est actif.
 */
function logDev(state, type, text) {
  if (state.devMode) {
    log(state, type, text);
  }
}

/**
 * flushLogs — transfère toutes les entrées du buffer vers state.log,
 * puis vide le buffer. Conforme au pseudo-code : flushlogs() sans argument.
 */
function flushLogs(state) {
  for (const entry of state.logBuffer) {
    state.log.push(entry);
  }
  state.logBuffer = [];
}

/**
 * TestEndurance — Vérifie l'endurance d'un combattant et applique fatigue + NA cap.
 *
 * Conforme au pseudo-code : utilise les seuils configurables seuilEndurance1-4.
 * Le premier palier (END <= seuilEndurance4) utilise AleatoireParmi pour le log NA.
 */
function testEndurance(combatant, state, rng) {
  const name = combatant.name;

  if (combatant.endurance <= COMBAT.seuilEndurance4) {
    log(state, 'fatigue', `${name} est terrassé par la fatigue`);
    logDev(state, 'debug', `(Endurance : ${combatant.endurance} / ${combatant.endMax})`);
    combatant.fatigue = 20;
    if (combatant.naCap > 2) {
      const messages = [
        `${name} ralentit le rythme`,
        `${name} se préserve`,
        `${name} réduit son activité`
      ];
      const index = Math.floor(rng() * messages.length);
      log(state, 'fatigue', messages[index]);
      logDev(state, 'debug', `(Niveau d'activité : ${combatant.naCap} → 2)`);
      combatant.naCap = 2;
    }
  } else if (combatant.endurance <= COMBAT.seuilEndurance3) {
    log(state, 'fatigue', `${name} est épuisé`);
    logDev(state, 'debug', `(Endurance : ${combatant.endurance} / ${combatant.endMax})`);
    combatant.fatigue = 15;
    if (combatant.naCap > 4) {
      const messages = [
        `${name} ralentit le rythme`,
        `${name} se préserve`,
        `${name} réduit son activité`
      ];
      const index = Math.floor(rng() * messages.length);
      log(state, 'fatigue', messages[index]);
      logDev(state, 'debug', `(Niveau d'activité : ${combatant.naCap} → 4)`);
      combatant.naCap = 4;
    }
  } else if (combatant.endurance <= COMBAT.seuilEndurance2) {
    log(state, 'fatigue', `${name} commence à traîner des pieds`);
    logDev(state, 'debug', `(Endurance : ${combatant.endurance} / ${combatant.endMax})`);
    combatant.fatigue = 10;
    if (combatant.naCap > 6) {
      const messages = [
        `${name} ralentit le rythme`,
        `${name} se préserve`,
        `${name} réduit son activité`
      ];
      const index = Math.floor(rng() * messages.length);
      log(state, 'fatigue', messages[index]);
      logDev(state, 'debug', `(Niveau d'activité : ${combatant.naCap} → 6)`);
      combatant.naCap = 6;
    }
  } else if (combatant.endurance <= COMBAT.seuilEndurance1) {
    log(state, 'fatigue', `${name} n'est plus aussi frais qu'au début du combat`);
    logDev(state, 'debug', `(Endurance : ${combatant.endurance} / ${combatant.endMax})`);
    combatant.fatigue = 5;
    if (combatant.naCap > 8) {
      const messages = [
        `${name} ralentit le rythme`,
        `${name} se préserve`,
        `${name} réduit son activité`
      ];
      const index = Math.floor(rng() * messages.length);
      log(state, 'fatigue', messages[index]);
      logDev(state, 'debug', `(Niveau d'activité : ${combatant.naCap} → 8)`);
      combatant.naCap = 8;
    }
  }
}

// ─── Coûts d'endurance et récupération ────────────────────────────────────────

/**
 * Calcule le coût d'endurance d'une attaque.
 * @param {number} weaponWeight - Poids de l'arme (1-14)
 * @param {number} na - Niveau d'activité effectif (1-10)
 * @param {number} surcout - Surcoût d'endurance (0-10)
 * @returns {number} Coût total = weaponWeight + na + surcout
 *
 * Requirements: 6.4
 */
export function computeAttackCost(weaponWeight, na, surcout) {
  return weaponWeight + na + surcout;
}

/**
 * Calcule le coût d'endurance d'une défense (esquive ou parade).
 * @param {number} na - Niveau d'activité effectif (1-10)
 * @param {number} surcout - Surcoût d'endurance (0-10)
 * @returns {number} Coût total = na + surcout
 *
 * Requirements: 6.5, 6.6
 */
export function computeDefenseCost(na, surcout) {
  return na + surcout;
}

// ─── Phase de Vivacité ─────────────────────────────────────────────────────────

/**
 * Phase de Vivacité — détermine qui est ATT et qui est DEF pour la minute.
 *
 * Formule : VIVACITYQUALITY = VIVACITY - D100 + ALTERNANCE - FATIGUE
 *
 * 1. Effectue un jet D100 pour chaque combattant
 * 2. Applique le bonus d'alternance (COMBAT.alternance) au combattant qui était DEF
 * 3. Compare les qualités : la plus élevée désigne ATT
 * 4. Si les deux qualités sont < 0, relance (les combattants cherchent une ouverture)
 * 5. Ajoute une entrée de log indiquant le résultat
 *
 * @param {CombatState} state - État courant du combat
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État mis à jour avec attacker défini
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export function phaseVivacite(state, rng) {
  // Aiguillage enchaînement initiative & riposte
  // si NEXTPHASE == Phase d'attaque alors NEXTPHASE = null, goto Phase d'attaque
  if (state.nextPhase === 'attaque') {
    state.nextPhase = null;
    return state;
  }

  const pName = state.player.name;
  const cName = state.creature.name;

  let safetyCounter = 0;
  while (true) {
    safetyCounter++;

    // Jets de vivacité
    const playerRoll = rollSkill(state.player.effective.vivacite, state.player.fatigue, rng);
    const creatureRoll = rollSkill(state.creature.effective.vivacite, state.creature.fatigue, rng);

    let c1Quality = playerRoll.quality;
    let c2Quality = creatureRoll.quality;

    // Alternance
    let c1Alternance = 0;
    let c2Alternance = 0;
    if (state.attacker === 'player') {
      c2Alternance = COMBAT.alternance;
    } else if (state.attacker === 'creature') {
      c1Alternance = COMBAT.alternance;
    }
    c1Quality = c1Quality + c1Alternance;
    c2Quality = c2Quality + c2Alternance;

    logDev(state, 'debug', `(${pName} — Vivacité: ${state.player.effective.vivacite} | D100: ${playerRoll.d100} | Alternance: ${c1Alternance} | Fatigue: ${state.player.fatigue})`);
    logDev(state, 'debug', `(${cName} — Vivacité: ${state.creature.effective.vivacite} | D100: ${creatureRoll.d100} | Alternance: ${c2Alternance} | Fatigue: ${state.creature.fatigue})`);

    if (c1Quality < 0 && c2Quality < 0) {
      // Sécurité : après 100 tentatives, forcer la résolution
      if (safetyCounter >= 100) {
        if (c1Quality >= c2Quality) {
          state.attacker = 'player';
        } else {
          state.attacker = 'creature';
        }
        break;
      }
      log(state, 'initiative', `Les deux combattants cherchent une ouverture dans les défenses de leur adversaire`);
      log(state, 'initiative', '');
      flushLogs(state);
      continue; // goto Phase de vivacité
    }

    if (c1Quality >= c2Quality) {
      if (c2Quality < 0) {
        log(state, 'initiative', `${pName} prend l'initiative`);
      } else {
        log(state, 'initiative', `${pName} prend l'ascendant sur ${cName}`);
      }
      state.attacker = 'player';
    } else {
      if (c1Quality < 0) {
        log(state, 'initiative', `${cName} prend l'initiative`);
      } else {
        log(state, 'initiative', `${cName} prend l'ascendant sur ${pName}`);
      }
      state.attacker = 'creature';
    }

    break;
  }

  return state;
}

// ─── Phase de Positionnement ───────────────────────────────────────────────────

/**
 * Repositionnement — repositionne un combattant avant l'attaque.
 *
 * @param {CombatState} state - État courant
 * @returns {CombatState} État mis à jour avec distance modifiée
 */
export function phasePositionnement(state) {
  const att = state[state.attacker];

  // Tactique de la minute courante pour ATT
  const tactics = att.tactics[Math.min(state.minute - 1, att.tactics.length - 1)];

  // NA effectif plafonné par le naCap du palier de fatigue
  const effectiveNA = Math.min(tactics.NA, att.naCap);

  // DISTANCECIBLE = 11 - COMBATTANT.EN
  const distanceCible = 11 - tactics.EN;

  // PAS = Plancher(COMBATTANT.NA / 2)
  const pas = Math.floor(effectiveNA / 2);

  // DELTA = DISTANCECIBLE - DISTANCE
  let delta = distanceCible - state.distance;
  // DELTA = Max(-PAS, Min(PAS, DELTA))
  delta = Math.max(-pas, Math.min(pas, delta));

  // NOUVELLEDISTANCE = DISTANCE + DELTA
  const nouvelleDistance = state.distance + delta;

  if (distanceCible === state.distance) {
    logDev(state, 'debug', `(${att.name} est déjà à bonne distance | Distance : ${state.distance} | Distance cible : ${distanceCible})`);
  } else if (nouvelleDistance === state.distance) {
    log(state, 'reposition', `${att.name} consolide ses appuis`);
    logDev(state, 'debug', `(Distance : ${state.distance} | Distance cible : ${distanceCible} | Pas : ${pas})`);
  } else if (nouvelleDistance < state.distance) {
    log(state, 'reposition', `${att.name} se rapproche de son adversaire`);
    if (nouvelleDistance === distanceCible) {
      log(state, 'reposition', `... et atteint sa distance idéale`);
    }
    logDev(state, 'debug', `(Distance : ${state.distance} → ${nouvelleDistance} | Distance cible : ${distanceCible} | Pas : ${pas})`);
    state.distance = nouvelleDistance;
  } else if (nouvelleDistance > state.distance) {
    log(state, 'reposition', `${att.name} s'éloigne de son adversaire`);
    if (nouvelleDistance === distanceCible) {
      log(state, 'reposition', `... et atteint sa distance idéale`);
    }
    logDev(state, 'debug', `(Distance : ${state.distance} → ${nouvelleDistance} | Distance cible : ${distanceCible} | Pas : ${pas})`);
    state.distance = nouvelleDistance;
  }

  return state;
}

// ─── Phase d'Attaque ───────────────────────────────────────────────────────────

/**
 * Phase d'Attaque — résolution de l'attaque.
 *
 * Algorithme (conforme à la spec) :
 * 1. Si ATT.END < COUTENDURANCEATTAQUE :
 *    - Log fatigue, récupération des deux combattants
 *    - TEMPO += 1, goto Phase de riposte
 * 2. Sinon (ATTAQUE) :
 *    - Jet d'attaque : quality = ATT.ATTACK - D100 - ATT.FATIGUE
 *    - Log "ATT attaque avec WEAPON"
 *    - ATT.END -= COUTENDURANCEATTAQUE
 *    - Si quality < 0 (RATÉ) : TEMPO += ATT.WEAPON.DIST, goto Phase de riposte
 *    - Sinon (RÉUSSI) : TEMPO += ATT.WEAPON.DIST, goto Phase de défense
 *
 * @param {CombatState} state - État courant
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État mis à jour
 *
 * Requirements: 10.4, 10.5, 10.6, 10.7
 */
export function phaseAttaque(state, rng) {
  const att = state[state.attacker];
  const defKey = state.attacker === 'player' ? 'creature' : 'player';
  const def = state[defKey];

  // Tactique de la minute courante pour ATT
  const tactics = att.tactics[Math.min(state.minute - 1, att.tactics.length - 1)];

  // NA effectif plafonné par le naCap du palier de fatigue
  const effectiveNA = Math.min(tactics.NA, att.naCap);

  // Calcul du coût d'attaque
  const attackCost = computeAttackCost(att.weapon.poids, effectiveNA, att.surcout);

  // ─── Vérification de l'endurance ────────────────────────────────────────
  if (att.endurance < attackCost) {
    log(state, 'recovery', `${att.name} est trop fatigué pour attaquer`);
    logDev(state, 'debug', `(Endurance : ${att.endurance} | Coût attaque : ${attackCost})`);
    log(state, 'recovery', `Les combattants reprennent leur souffle`);

    // ATT.END = ATT.END + GAINENDURANCERECUP
    att.endurance = att.endurance + COMBAT.gainRecuperation;
    // DEF.END = DEF.END + GAINENDURANCERECUP
    def.endurance = def.endurance + COMBAT.gainRecuperation;
    logDev(state, 'debug', `(${att.name} Endurance : ${att.endurance} | ${def.name} Endurance : ${def.endurance})`);

    // TEMPO = TEMPO + 1
    logDev(state, 'debug', `Tempo ${state.tempo} → ${state.tempo + 1})`);
    state.tempo += 1;

    log(state, 'recovery', '');
    flushLogs(state);

    // goto Phase de vivacité
    state.skipToNextTempo = true;
    return state;
  }

  // ─── ATTAQUE ────────────────────────────────────────────────────────────

  // ATT.ATTACKQUALITY = ATT.ATTACK - JetD100()
  const d100 = Math.floor(rng() * 100) + 1;
  const attackQuality = att.effective.attaque - d100;

  // Log "ATT.NOM attaque avec ATT.WEAPON.NAME"
  log(state, 'attack', `${att.name} attaque avec ${att.weaponName}`);

  // ATT.END = ATT.END - COUTENDURANCEATTAQUE
  att.endurance -= attackCost;

  if (attackQuality < 0) {
    // ─── ATTAQUE RATÉE ──────────────────────────────────────────────────
    state.attackResult = 'miss';
    log(state, 'miss', `... mais l'attaque est mal exécutée`);
    logDev(state, 'debug', `(Attaque : ${att.effective.attaque} | D100 : ${d100} | Qualité : ${attackQuality})`);
    logDev(state, 'debug', `(Endurance : ${att.endurance} / ${att.endMax} | Coût attaque : ${attackCost})`);

    // TEMPO = TEMPO + ATT.WEAPON.DIST
    logDev(state, 'debug', `Tempo ${state.tempo} → ${state.tempo + att.weapon.dist})`);
    state.tempo += att.weapon.dist;

    // goto Phase de riposte (géré par la boucle principale)
  } else {
    // ─── ATTAQUE RÉUSSIE ────────────────────────────────────────────────
    state.attackResult = 'hit';
    state.attackQuality = attackQuality;
    log(state, 'attack', `... et touche son adversaire`);
    logDev(state, 'debug', `(Attaque : ${att.effective.attaque} | D100 : ${d100} | Qualité : ${attackQuality})`);
    logDev(state, 'debug', `(Endurance : ${att.endurance} / ${att.endMax} | Coût attaque : ${attackCost})`);

    // TEMPO = TEMPO + ATT.WEAPON.DIST
    logDev(state, 'debug', `Tempo ${state.tempo} → ${state.tempo + att.weapon.dist})`);
    state.tempo += att.weapon.dist;

    // goto Phase de défense (géré par la boucle principale)
  }

  return state;
}

// ─── Phase de Défense ─────────────────────────────────────────────────────────

/**
 * Phase de Défense — résolution de la défense du DEF.
 *
 * @param {CombatState} state - État courant (must have attackResult = 'hit')
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État mis à jour
 */
export function phaseDefense(state, rng) {
  if (state.attackResult !== 'hit') {
    return state;
  }

  const defKey = state.attacker === 'player' ? 'creature' : 'player';
  const def = state[defKey];

  const tacticIndex = Math.min(state.minute - 1, def.tactics.length - 1);
  const tactics = def.tactics[tacticIndex];
  const effectiveNA = Math.min(tactics.NA, def.naCap);

  const coutEsquive = computeDefenseCost(effectiveNA, def.surcout);
  const coutParade = computeDefenseCost(effectiveNA, def.surcout);

  // scoreEsquive = DEF.ESQUIVE - DEF.FATIGUE
  const scoreEsquive = def.effective.esquive - def.fatigue;
  // scoreParade = DEF.PARADE - DEF.FATIGUE
  const scoreParade = def.effective.parade - def.fatigue;

  // Choix de la défense
  let defense = null;
  if (scoreEsquive > Math.max(0, scoreParade) && def.endurance >= coutEsquive) {
    defense = 'esquive';
  } else if (scoreParade > 0 && def.endurance >= coutParade) {
    defense = 'parade';
  } else {
    // Encaissement
    state.defenseResult = 'encaissement';
    log(state, 'defense', `${def.name} encaisse le coup`);
    logDev(state, 'debug', `(Esquive : ${scoreEsquive} | Parade : ${scoreParade})`);
    return state;
  }

  if (defense === 'esquive') {
    const d100 = Math.floor(rng() * 100) + 1;
    const dodgeQuality = scoreEsquive - d100;
    log(state, 'defense', `${def.name} tente d'éviter l'attaque`);

    if (dodgeQuality < 0) {
      state.defenseResult = 'fail';
      log(state, 'defense', `... mais ${def.name} n'est pas assez rapide`);
      logDev(state, 'debug', `(Esquive : ${scoreEsquive} | D100 : ${d100} | Qualité : ${dodgeQuality})`);
      def.endurance -= coutEsquive;
      logDev(state, 'debug', `(Coût endurance : ${coutEsquive} | Endurance : ${def.endurance} / ${def.endMax})`);
    } else {
      state.defenseResult = 'success';
      log(state, 'defense', `... et réussit son esquive`);
      logDev(state, 'debug', `(Esquive : ${scoreEsquive} | D100 : ${d100} | Qualité : ${dodgeQuality})`);
      def.endurance -= coutEsquive;
      logDev(state, 'debug', `(Coût endurance : ${coutEsquive} | Endurance : ${def.endurance} / ${def.endMax})`);
    }
  }

  if (defense === 'parade') {
    const d100 = Math.floor(rng() * 100) + 1;
    const parryQuality = scoreParade - d100;
    log(state, 'defense', `${def.name} tente de parer l'attaque`);

    if (parryQuality < 0) {
      state.defenseResult = 'fail';
      log(state, 'defense', `... mais ${def.name} rate sa parade`);
      logDev(state, 'debug', `(Parade : ${scoreParade} | D100 : ${d100} | Qualité : ${parryQuality})`);
      def.endurance -= coutParade;
      logDev(state, 'debug', `(Coût endurance : ${coutParade} | Endurance : ${def.endurance} / ${def.endMax})`);
    } else {
      state.defenseResult = 'success';
      log(state, 'defense', `... et réussit sa parade`);
      logDev(state, 'debug', `(Parade : ${scoreParade} | D100 : ${d100} | Qualité : ${parryQuality})`);
      def.endurance -= coutParade;
      logDev(state, 'debug', `(Coût endurance : ${coutParade} | Endurance : ${def.endurance} / ${def.endMax})`);
    }
  }
  return state;
}

// ─── Calcul des dégâts ────────────────────────────────────────────────────────

/**
 * WeaponDamage — retourne les dégâts de base selon le tier et le matériau de l'arme.
 * WEAPON.tier : indice entre 1 et Longueur(WEAPON.models)
 * WEAPON.materiau : indice entre 1 et 8
 *
 * @param {object} WEAPON - {tier, materiau, models, damFirst, damLast}
 * @returns {number} Dégâts de base
 */
export function WeaponDamage(WEAPON) {
  if (!WEAPON) return 0;
  const NBRTIERS = WEAPON.models.length;
  if (NBRTIERS < 2) throw new Error(`WeaponDamage: l'arme doit avoir au moins 2 modèles (reçu: ${NBRTIERS})`);
  const MODMATERIEL = 1 + (WEAPON.materiau - 1) * 0.150;
  const DAMAGE = (WEAPON.damFirst + (WEAPON.tier - 1) * (WEAPON.damLast - WEAPON.damFirst) / (NBRTIERS - 1)) * MODMATERIEL;
  return Math.round(DAMAGE * 100) / 100;
}

/**
 * WeaponModStats — retourne le modificateur de stats du porteur pour une arme donnée.
 * Les poids sont issus de weapon.json : weightFO, weightTA, weightIN, weightVI, weightAD
 *
 * @param {object} WEAPON - {weightFO, weightTA, weightIN, weightVI, weightAD}
 * @param {object} COMBATTANT - {FOR, ADR, VIT, TAI, INT}
 * @returns {number} Modificateur de stats
 */
export function WeaponModStats(WEAPON, COMBATTANT) {
  const MODSTATS = 1
    + (COMBATTANT.FOR - 12) * 0.02 * WEAPON.weightFO
    + (COMBATTANT.ADR - 12) * 0.02 * WEAPON.weightAD
    + (COMBATTANT.VIT - 12) * 0.02 * WEAPON.weightVI
    + (COMBATTANT.TAI - 12) * 0.02 * WEAPON.weightTA
    + (COMBATTANT.INT - 12) * 0.02 * WEAPON.weightIN;
  return Math.round(MODSTATS * 100) / 100;
}

/**
 * WeaponModAff — retourne le modificateur d'affinité de l'arme contre le type de l'ennemi.
 * COMBATTANT.type : bestial | elementaire | feerique | demoniaque | undead | reptilien
 *
 * @param {object} WEAPON - {aff_bestial, aff_elementaire, aff_feerique, aff_demoniaque, aff_undead, aff_reptilien}
 * @param {object} COMBATTANT - {type}
 * @returns {number} Modificateur d'affinité
 */
export function WeaponModAff(WEAPON, COMBATTANT) {
  let AFFINITY = 0;
  if (COMBATTANT.type == "bestial")      AFFINITY = WEAPON.aff_bestial;
  if (COMBATTANT.type == "elementaire")  AFFINITY = WEAPON.aff_elementaire;
  if (COMBATTANT.type == "feerique")     AFFINITY = WEAPON.aff_feerique;
  if (COMBATTANT.type == "demoniaque")   AFFINITY = WEAPON.aff_demoniaque;
  if (COMBATTANT.type == "undead")       AFFINITY = WEAPON.aff_undead;
  if (COMBATTANT.type == "reptilien")    AFFINITY = WEAPON.aff_reptilien;
  return Math.round((AFFINITY / 100 + 1) * 100) / 100;
}

// ─── Phase de Résolution des Dégâts ───────────────────────────────────────────

/**
 * Phase de Résolution des Dégâts — applique les dégâts au DEF.
 *
 * Conditions d'application :
 * - L'attaque a touché (state.attackResult === 'hit')
 * - La défense a échoué (state.defenseResult !== 'success')
 *
 * Implémentation conforme au pseudo-code :
 *   DAMAGE = WeaponDamage(ATT.WEAPON)
 *   MODSTATS = WeaponModStats(ATT.WEAPON, ATT)
 *   MODAFF = WeaponModAff(ATT.WEAPON, DEF)
 *   DAMAGE = DAMAGE * MODSTATS * MODAFF
 *   FINALDAMAGE = Max(0, DAMAGE - DEF.ARMOR)
 *
 * @param {CombatState} state - État courant
 * @returns {CombatState} État mis à jour
 */
export function phaseResolutionDegats(state) {
  if (state.attackResult !== 'hit' || state.defenseResult === 'success') {
    return state;
  }

  const attKey = state.attacker;
  const defKey = attKey === 'player' ? 'creature' : 'player';
  const att = state[attKey];
  const def = state[defKey];

  // DAMAGE = WeaponDamage(ATT.WEAPON)
  let DAMAGE = WeaponDamage(att.weapon);
  // MODSTATS = WeaponModStats(ATT.WEAPON, ATT)
  const MODSTATS = WeaponModStats(att.weapon, att.stats);
  // MODAFF = WeaponModAff(ATT.WEAPON, DEF)
  const MODAFF = WeaponModAff(att.weapon, def);

  // LogDev("Dégâts de l'arme : DAMAGE | ModStat : MODSTAT | ModAff : MODAFF")
  logDev(state, 'debug', `Dégâts de l'arme : ${DAMAGE} | ModStat : ${MODSTATS} | ModAff : ${MODAFF}`);

  // DAMAGE = plancher(DAMAGE * MODSTATS * MODAFF)
  DAMAGE = Math.floor(DAMAGE * MODSTATS * MODAFF);

  // Log("ATT.NOM inflige un coup de force DAMAGE")
  log(state, 'damage', `${att.name} inflige un coup de force ${DAMAGE}`);

  // LogDev("Armure : DEF.ARMOR")
  logDev(state, 'debug', `Armure : ${def.ARMOR}`);

  // FINALDAMAGE = Max(0, DAMAGE - DEF.ARMOR)
  const FINALDAMAGE = Math.max(0, DAMAGE - def.ARMOR);

  if (FINALDAMAGE <= 0) {
    // Log("... mais le coup rebondit sur l'armure de DEF.NOM")
    log(state, 'damage', `... mais le coup rebondit sur l'armure de ${def.name}`);
    // LogDev("(Dégâts bruts : RAWDAMAGE | Armure : DEF.ARMOR)")
    logDev(state, 'debug', `(Dégâts bruts : ${DAMAGE} | Armure : ${def.ARMOR})`);
  } else {
    // DEF.HP = DEF.HP - FINALDAMAGE
    def.hp -= FINALDAMAGE;
    // Log("... DEF.NOM perd FINALDAMAGE points de vie")
    log(state, 'hp_loss', `... ${def.name} perd ${FINALDAMAGE} points de vie (HP: ${def.hp}/${def.hpMax})`);
    // LogDev("(HP : DEF.HP / DEF.HPMAX)")
    logDev(state, 'debug', `(HP : ${def.hp} / ${def.hpMax})`);

    // si DEF.HP < 1 alors
    if (def.hp < 1) {
      def.hp = 0; // Plancher à 0
      // Log("DEF.NOM s'écroule dans une mare de sang.")
      log(state, 'death', `${def.name} s'écroule dans une mare de sang.`);
      // Log("ATT.NOM est victorieux !")
      log(state, 'victory', `${att.name} est victorieux !`);
      log(state, 'victory', '');
      flushLogs(state);
      // Exit()
      const winner = attKey === 'player' ? 'player' : 'creature';
      state.result = { winner, hpPlayer: state.player.hp, hpCreature: state.creature.hp };
      state.combatOver = true;
    }
  }

  return state;
}

// ─── Phase d'Initiative ─────────────────────────────────────────────────────────

/**
 * Phase d'Initiative — ATT tente d'enchaîner.
 *
 * ATT.D100 = JetD100()
 * ATT.INITIATIVEQUALITY = ATT.INITIATIVE - ATT.D100 - ATT.FATIGUE
 * si < 0 → goto Phase fin de boucle
 * sinon → Log("ATT.NOM enchaîne les attaques"), goto Phase Attaque
 *
 * @param {CombatState} state - État courant du combat
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État mis à jour
 */
export function phaseInitiative(state, rng) {
  const att = state[state.attacker];

  // ATT.D100 = JetD100()
  const d100 = Math.floor(rng() * 100) + 1;
  // ATT.INITIATIVEQUALITY = ATT.INITIATIVE - ATT.D100 - ATT.FATIGUE
  const initiativeQuality = att.effective.initiative - d100 - att.fatigue;

  if (initiativeQuality < 0) {
    // LogDev("(Initiative : ATT.INITIATIVE | D100 : ATT.D100 | Fatigue : ATT.FATIGUE | Qualité : ATT.INITIATIVEQUALITY)")
    logDev(state, 'debug', `(Initiative : ${att.effective.initiative} | D100 : ${d100} | Fatigue : ${att.fatigue} | Qualité : ${initiativeQuality})`);
    // goto Phase fin de boucle
    state.initiativeResult = 'lost';
  } else {
    // Log("ATT.NOM enchaîne les attaques")
    log(state, 'initiative', `${att.name} enchaîne les attaques`);
    // LogDev("(Initiative : ATT.INITIATIVE | D100 : ATT.D100 | Fatigue : ATT.FATIGUE | Qualité : ATT.INITIATIVEQUALITY)")
    logDev(state, 'debug', `(Initiative : ${att.effective.initiative} | D100 : ${d100} | Fatigue : ${att.fatigue} | Qualité : ${initiativeQuality})`);
    log(state, 'initiative', '');
    flushLogs(state);
    // NEXTPHASE = Phase Attaque, goto fin de boucle
    state.nextPhase = 'attaque';
    state.initiativeResult = 'kept';
  }

  return state;
}

// ─── Phase de Riposte ──────────────────────────────────────────────────────────

/**
 * Phase de Riposte — DEF tente de prendre l'initiative.
 *
 * DEF.D100 = JetD100()
 * DEF.RIPOSTEQUALITY = DEF.RIPOSTE - DEF.D100 - DEF.FATIGUE
 * si < 0 → Log("DEF.NOM rate une opportunité de riposte"), goto Phase fin de boucle
 * sinon → Log("DEF.NOM contre-attaque !"), Swap(ATT, DEF), goto Phase d'attaque
 *
 * @param {CombatState} state - État courant du combat
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État mis à jour
 */
export function phaseRiposte(state, rng) {
  if (state.initiativeResult !== 'lost') {
    return state;
  }

  const defKey = state.attacker === 'player' ? 'creature' : 'player';
  const def = state[defKey];

  // DEF.D100 = JetD100()
  const d100 = Math.floor(rng() * 100) + 1;
  // DEF.RIPOSTEQUALITY = DEF.RIPOSTE - DEF.D100 - DEF.FATIGUE
  const riposteQuality = def.effective.riposte - d100 - def.fatigue;

  if (riposteQuality < 0) {
    // Log("DEF.NOM rate une opportunité de riposte")
    log(state, 'riposte', `${def.name} rate une opportunité de riposte`);
    // LogDev("(Riposte : DEF.RIPOSTE | D100 : DEF.D100 | Fatigue : DEF.FATIGUE | Qualité : DEF.RIPOSTEQUALITY)")
    logDev(state, 'debug', `(Riposte : ${def.effective.riposte} | D100 : ${d100} | Fatigue : ${def.fatigue} | Qualité : ${riposteQuality})`);
    // goto Phase fin de boucle
    state.riposteResult = 'fail';
  } else {
    // Log("DEF.NOM contre-attaque !")
    log(state, 'riposte', `${def.name} contre-attaque !`);
    // LogDev("(Riposte : DEF.RIPOSTE | D100 : DEF.D100 | Fatigue : DEF.FATIGUE | Qualité : DEF.RIPOSTEQUALITY)")
    logDev(state, 'debug', `(Riposte : ${def.effective.riposte} | D100 : ${d100} | Fatigue : ${def.fatigue} | Qualité : ${riposteQuality})`);
    // Swap(ATT, DEF)
    state.attacker = defKey;
    log(state, 'riposte', '');
    flushLogs(state);
    // NEXTPHASE = Phase Attaque, goto fin de boucle
    state.nextPhase = 'attaque';
    state.riposteResult = 'success';
  }

  return state;
}

// ─── Validation des entrées ───────────────────────────────────────────────────

/**
 * Valide les données d'entrée des deux combattants.
 * Vérifie :
 * - 7 statistiques primaires dans [1, 24]
 * - Au moins une tactique définie avec EO, NA, EN dans [1, 10]
 * - Équipement complet (arme avec `dist`, armure avec `reduction`)
 *
 * Lève une Error descriptive si une contrainte est violée.
 *
 * @param {CombatantInput} playerData - Données du joueur
 * @param {CombatantInput} creatureData - Données de la créature
 * @throws {Error} Si une contrainte de validation est violée
 *
 * Requirements: 1.6, 1.7, 2.8
 */
export function validateInputs(playerData, creatureData) {
  validateCombatant(playerData);
  validateCombatant(creatureData);
}

/**
 * Valide les données d'un combattant individuel.
 * @param {CombatantInput} data
 */
function validateCombatant(data) {
  // 1. Vérifier l'équipement complet (arme)
  if (!data.weaponDef || !data.equipment) {
    throw new Error("Équipement incomplet: arme ou armure manquante");
  }

  // 2. Vérifier le champ 'dist' dans weaponDef
  if (!("dist" in data.weaponDef)) {
    throw new Error("Champ 'dist' manquant dans weaponDef");
  }

  // 3. Vérifier le champ 'reduction' dans armure (si armure présente)
  if (data.equipment.armure && !("reduction" in data.equipment.armure)) {
    throw new Error("Équipement incomplet: arme ou armure manquante");
  }

  // 4. Vérifier les 7 statistiques primaires dans [1, 24]
  const statNames = ["FOR", "CON", "TAI", "INT", "VOL", "VIT", "ADR"];
  for (const nom of statNames) {
    const valeur = data.stats?.[nom];
    if (valeur == null || !Number.isInteger(valeur) || valeur < 1 || valeur > 24) {
      throw new Error(`Statistique invalide: ${nom} = ${valeur} (attendu: 1-24)`);
    }
  }

  // 5. Vérifier au moins une tactique définie
  if (!data.tactic || !Array.isArray(data.tactic) || data.tactic.length === 0) {
    throw new Error("Tactique manquante pour le combattant");
  }

  // 6. Vérifier chaque tactique : EO, NA, EN dans [1, 10]
  const tacticFields = ["EO", "NA", "EN"];
  for (const entry of data.tactic) {
    if (entry == null) {
      throw new Error("Tactique manquante pour le combattant");
    }
    for (const champ of tacticFields) {
      const valeur = entry[champ];
      if (valeur == null || !Number.isInteger(valeur) || valeur < 1 || valeur > 10) {
        throw new Error(`Tactique invalide: ${champ} = ${valeur} (attendu: 1-10)`);
      }
    }
  }
}

// ─── Initialisation de l'état de combat ───────────────────────────────────────

/**
 * Construit l'état initial du combat à partir des données des deux combattants.
 *
 * Pour chaque combattant :
 * - Calcule HPMAX = (CON×19 + TAI×5 + VOL×2) / divisor
 * - Calcule ENDMAX = (FOR + CON + VOL) × 3, borné dans [config.endMin, config.endMax]
 * - Calcule Charge = Poids_Arme + Math.floor(Poids_Armure / 4)
 * - Calcule Portage = FOR + Math.floor(TAI / 2)
 * - Calcule Surcoût = Math.floor(Math.max(0, Charge - Portage) × 10 / 26)
 * - Calcule les 6 compétences dérivées via computeDerivedSkills
 * - Normalise chaque compétence en pourcentage via normalizeToPercent
 *
 * @param {CombatantInput} playerData - Données du joueur
 * @param {CombatantInput} creatureData - Données de la créature
 * @param {object} config - Configuration du combat (COMBAT)
 * @returns {CombatState} État initial du combat
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 8.1
 */
export function initCombatState(playerData, creatureData, config) {
  const player = buildCombatant(playerData, config);
  const creature = buildCombatant(creatureData, config);

  return {
    minute: 1,
    tempo: 1,
    distance: config.distanceInitiale,
    attacker: null,
    nextPhase: null,
    devMode: false,
    combatOver: false,

    player,
    creature,

    log: [],
    logBuffer: [],
    result: null
  };
}

/**
 * Construit l'objet combattant interne à partir des données d'entrée.
 * @param {CombatantInput} data
 * @param {object} config
 * @returns {object} Combattant initialisé
 */
function buildCombatant(data, config) {
  const { stats } = data;

  // Nom du combattant
  const name = data.name ?? data.nameFr ?? 'Combattant';

  // HP max : (CON×19 + TAI×5 + VOL×2) / divisor
  const hpRaw = stats.CON * config.hpFormula.CON
              + stats.TAI * config.hpFormula.TAI
              + stats.VOL * config.hpFormula.VOL;
  const hpMax = Math.floor(hpRaw / (config.hpFormula.divisor ?? 1));

  // Endurance max : (FOR + CON + VOL) × 3
  const endMax = (stats.FOR + stats.CON + stats.VOL) * config.endFormula.multiplier;

  // Charge = Poids_Arme_Droite + Poids_Arme_Gauche + Poids_Armure / 4
  const poidsArmeR = data.weaponDef.poids ?? data.weaponDef.weight ?? 0;
  const poidsArmeL = data.weaponDefL?.poids ?? data.weaponDefL?.weight ?? 0;
  const poidsArmure = data.equipment.armure?.poids ?? data.equipment.armure?.weight ?? 0;
  const charge = poidsArmeR + poidsArmeL + Math.floor(poidsArmure / 4);

  // Portage = FOR + TAI / 2
  const portage = stats.FOR + Math.floor(stats.TAI / 2);

  // Surcoût = Max(0, Charge - Portage) * 10 / 26
  const surcout = Math.floor(Math.max(0, charge - portage) * config.surcoutMultiplier / config.surcoutDiviseur);

  // Compétences dérivées (brutes)
  const skills = computeDerivedSkills(stats, config);

  // Normalisation en pourcentages
  const skillNames = ['vivacite', 'initiative', 'attaque', 'parade', 'esquive', 'riposte'];
  const divisors = { vivacite: 396, initiative: 228, attaque: 384, esquive: 444, parade: 336, riposte: 312 };
  const percentages = {};
  for (const name of skillNames) {
    percentages[name] = normalizeToPercent(skills[name], config.normalization[name], divisors[name], config);
  }

  // Si un HP courant est fourni (persisté entre combats), l'utiliser ; sinon hpMax
  const hp = (data.hp != null && data.hp > 0) ? Math.min(data.hp, hpMax) : hpMax;

  return {
    name,
    hp,
    hpMax,
    endurance: endMax,
    endMax,
    fatigue: 0,
    naCap: Infinity,
    stats: data.stats,
    type: data.family ?? null,
    ARMOR: data.equipment.armure?.reduction ?? 0,
    skills,
    percentages,
    effective: {},
    tactics: data.tactic,
    charge,
    portage,
    surcout,
    weapon: data.weaponDef,
    weaponName: data.weaponDef?.typeArme ?? data.weaponDef?.weaponType ?? 'arme',
    weaponL: data.weaponDefL ?? null,
    weaponNameL: data.weaponDefL?.typeArme ?? data.weaponDefL?.weaponType ?? null,
    armor: data.equipment.armure,
    armorName: data.equipment.armure?.name ?? data.equipment.armure?.nom ?? null,
    armorPieces: data.equipment.armure?.pieces ?? null
  };
}

// ─── Boucle principale du combat ──────────────────────────────────────────────

/**
 * Boucle principale du combat.
 *
 * Structure :
 * - Boucle externe sur les minutes (1 à config.maxMinutes)
 *   - Récupère les tactiques de la minute pour chaque combattant
 *   - Applique le plafond NA de fatigue aux tactiques
 *   - Calcule les compétences effectives (ajustements tactiques)
 *   - Phase Vivacité (une fois par minute) pour déterminer ATT/DEF
 *   - Boucle interne sur les tempos (1 à config.nbTempoParMinute)
 *     - Phase Attaque (repositionnement + jet d'attaque)
 *     - Phase Défense (si attaque touche)
 *     - Phase Résolution Dégâts (si attaque touche et défense échoue)
 *     - Vérification condition de fin (HP ≤ 0)
 *     - Phase Initiative
 *     - Phase Riposte (si initiative perdue)
 * - Match nul si maxMinutes dépassé
 *
 * @param {CombatState} state - État initial du combat
 * @param {object} config - COMBAT config
 * @param {Function} rng - Générateur aléatoire
 * @returns {CombatState} État final avec result défini
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
export function mainLoop(state, config, rng) {
  // ─── Phase début minute (première minute) ─────────────────────────────────
  state.minute = 1;

  // Tactiques de la minute
  let playerTacticIndex = Math.min(state.minute - 1, state.player.tactics.length - 1);
  let creatureTacticIndex = Math.min(state.minute - 1, state.creature.tactics.length - 1);
  let playerTactics = state.player.tactics[playerTacticIndex];
  let creatureTactics = state.creature.tactics[creatureTacticIndex];

  // Appliquer le plafond NA de fatigue
  let playerEffNA = Math.min(playerTactics.NA, state.player.naCap);
  let creatureEffNA = Math.min(creatureTactics.NA, state.creature.naCap);

  // Calcul des compétences effectives
  state.player.effective = computeEffectiveSkills(
    state.player.percentages,
    { EO: playerTactics.EO, NA: playerEffNA, EN: playerTactics.EN },
    state.distance, state.player.weapon.dist, config
  );
  state.creature.effective = computeEffectiveSkills(
    state.creature.percentages,
    { EO: creatureTactics.EO, NA: creatureEffNA, EN: creatureTactics.EN },
    state.distance, state.creature.weapon.dist, config
  );

  log(state, 'separator', `=== Minute ${state.minute} ===`);
  logDev(state, 'debug', `${state.player.name} Tactics — EO: ${playerTactics.EO} | NA: ${playerTactics.NA} | EN: ${playerTactics.EN}`);
  logDev(state, 'debug', `${state.creature.name} Tactics — EO: ${creatureTactics.EO} | NA: ${creatureTactics.NA} | EN: ${creatureTactics.EN}`);

  // Phase Vivacité initiale
  state = phaseVivacite(state, rng);

  // ─── Boucle principale ──────────────────────────────────────────────────────
  state.tempo = 1;

  while (true) {
    // Reset per-tempo flags
    state.attackResult = null;
    state.defenseResult = null;
    state.initiativeResult = null;
    state.riposteResult = null;
    state.skipToNextTempo = false;

    // ─── Phase Positionnement ─────────────────────────────────────────────
    state = phasePositionnement(state);

    // ─── Boucle d'attaque (reboucle si riposte réussie → goto Phase d'attaque)
    while (true) {
      // ─── Phase Attaque ──────────────────────────────────────────────────
      state = phaseAttaque(state, rng);

      // Si skip (endurance insuffisante), goto Phase de vivacité
      if (state.skipToNextTempo) {
        break;
      }

      // Si attaque ratée → goto Phase de riposte
      if (state.attackResult === 'miss') {
        state.initiativeResult = 'lost';
        state = phaseRiposte(state, rng);

        if (state.riposteResult === 'success') {
          // NEXTPHASE = Phase Attaque, goto fin de boucle
          break;
        }
        // goto Phase fin de boucle
        break;
      }

      // ─── Phase Défense (attaque a touché) ───────────────────────────────
      state = phaseDefense(state, rng);

      if (state.defenseResult === 'success') {
        state.initiativeResult = 'lost';
        state = phaseRiposte(state, rng);

        if (state.riposteResult === 'success') {
          // NEXTPHASE = Phase Attaque, goto fin de boucle
          break;
        }
        break;
      }

      // ─── Phase Résolution Dégâts ────────────────────────────────────────
      state = phaseResolutionDegats(state);

      if (state.combatOver) {
        return state;
      }

      // ─── Phase d'initiative ─────────────────────────────────────────────
      state = phaseInitiative(state, rng);

      if (state.initiativeResult === 'kept') {
        // NEXTPHASE = Phase Attaque, goto fin de boucle
        break;
      }

      // initiativeResult === 'lost' → Phase de riposte
      state = phaseRiposte(state, rng);

      if (state.riposteResult === 'success') {
        // NEXTPHASE = Phase Attaque, goto fin de boucle
        break;
      }

      // goto Phase fin de boucle
      break;
    }

    // ─── Phase fin de boucle ──────────────────────────────────────────────

    // Si goto Phase de vivacité (endurance insuffisante)
    if (state.skipToNextTempo) {
      state.skipToNextTempo = false;
      state = phaseVivacite(state, rng);
      continue;
    }

    // si TEMPO >= NBTEMPOPARMMINUTE
    if (state.tempo >= config.nbTempoParMinute) {
      // TEMPO = TEMPO - NBTEMPOPARMMINUTE
      state.tempo = state.tempo - config.nbTempoParMinute;
      // NUMMINUTE = NUMMINUTE + 1
      state.minute = state.minute + 1;

      // Vérification match nul
      if (state.minute > config.maxMinutes) {
        state.result = { winner: 'draw', hpPlayer: state.player.hp, hpCreature: state.creature.hp };
        log(state, 'draw', `Match nul — temps écoulé (${config.maxMinutes} minutes)`);
        flushLogs(state);
        return state;
      }

      // TestEndurance(ATT)
      // TestEndurance(DEF)
      const attKey = state.attacker;
      const defKey = attKey === 'player' ? 'creature' : 'player';
      testEndurance(state[attKey], state, rng);
      testEndurance(state[defKey], state, rng);

      log(state, 'separator', '');
      flushLogs(state);

      // goto Phase début minute
      playerTacticIndex = Math.min(state.minute - 1, state.player.tactics.length - 1);
      creatureTacticIndex = Math.min(state.minute - 1, state.creature.tactics.length - 1);
      playerTactics = state.player.tactics[playerTacticIndex];
      creatureTactics = state.creature.tactics[creatureTacticIndex];

      playerEffNA = Math.min(playerTactics.NA, state.player.naCap);
      creatureEffNA = Math.min(creatureTactics.NA, state.creature.naCap);

      state.player.effective = computeEffectiveSkills(
        state.player.percentages,
        { EO: playerTactics.EO, NA: playerEffNA, EN: playerTactics.EN },
        state.distance, state.player.weapon.dist, config
      );
      state.creature.effective = computeEffectiveSkills(
        state.creature.percentages,
        { EO: creatureTactics.EO, NA: creatureEffNA, EN: creatureTactics.EN },
        state.distance, state.creature.weapon.dist, config
      );

      log(state, 'separator', `=== Minute ${state.minute} ===`);
      logDev(state, 'debug', `${state.player.name} Tactics — EO: ${playerTactics.EO} | NA: ${playerTactics.NA} | EN: ${playerTactics.EN}`);
      logDev(state, 'debug', `${state.creature.name} Tactics — EO: ${creatureTactics.EO} | NA: ${creatureTactics.NA} | EN: ${creatureTactics.EN}`);

      state = phaseVivacite(state, rng);
    } else {
      // TestEndurance(ATT)
      // TestEndurance(DEF)
      const attKey = state.attacker;
      const defKey = attKey === 'player' ? 'creature' : 'player';
      testEndurance(state[attKey], state, rng);
      testEndurance(state[defKey], state, rng);

      log(state, 'separator', '');
      flushLogs(state);

      // goto Phase de vivacité
      state = phaseVivacite(state, rng);
    }
  }
}

// ─── Point d'entrée principal ──────────────────────────────────────────────────

// ─── Normalisation des données serveur ─────────────────────────────────────────

/**
 * Mappe les noms de stats français longs vers les abréviations internes.
 */
const STAT_MAP = {
  force: 'FOR', constitution: 'CON', taille: 'TAI',
  intelligence: 'INT', 'volonté': 'VOL', vitesse: 'VIT', adresse: 'ADR'
};

/**
 * Normalise les stats d'un combattant depuis le format serveur (noms français longs)
 * vers le format interne (abréviations majuscules).
 * Si les stats sont déjà en format abrégé (FOR, CON...), les retourne telles quelles.
 */
function normalizeStats(stats) {
  if (!stats) return stats;
  // Déjà en format abrégé ?
  if ('FOR' in stats) return stats;
  const result = {};
  for (const [key, value] of Object.entries(stats)) {
    const mapped = STAT_MAP[key];
    if (mapped) result[mapped] = value;
  }
  return result;
}

/**
 * Normalise les tactiques depuis les différents formats serveur vers un tableau
 * d'objets {EO, NA, EN}.
 *
 * Formats supportés :
 * - Tableau d'objets [{EO, NA, EN}, ...] (déjà normalisé)
 * - Objet {min1: {EO, NA, EN}, min2: {...}, ...} (format bestiary)
 * - null/undefined → tactique par défaut [{EO:5, NA:5, EN:5}]
 */
function normalizeTactics(tactic) {
  if (!tactic) return [{ EO: 5, NA: 5, EN: 5 }];
  if (Array.isArray(tactic)) return tactic;
  // Format objet {min1: {...}, min2: {...}, ...}
  if (typeof tactic === 'object') {
    const entries = Object.keys(tactic)
      .sort()
      .map(key => tactic[key]);
    return entries.length > 0 ? entries : [{ EO: 5, NA: 5, EN: 5 }];
  }
  return [{ EO: 5, NA: 5, EN: 5 }];
}

/**
 * Normalise les données d'arme depuis le format serveur vers le format interne.
 * Le serveur sépare weaponDef (définition de base) et weaponItem (instance avec tier/material).
 *
 * Format interne conforme au pseudo-code :
 * - tier : indice entre 1 et Longueur(models)
 * - materiau : indice entre 1 et 8
 * - models, damFirst, damLast, weightFO, weightTA, weightIN, weightVI, weightAD
 * - aff_bestial, aff_elementaire, aff_feerique, aff_demoniaque, aff_undead, aff_reptilien
 */
function normalizeWeapon(weaponDef, weaponItem) {
  if (!weaponDef) return {
    poids: 0, dist: 1, tier: 1, materiau: 1,
    models: ["Mains nues", "Mains nues"], damFirst: 3, damLast: 8,
    weightFO: 1, weightTA: 0, weightIN: 0, weightVI: 0, weightAD: 0,
    aff_bestial: 0, aff_elementaire: 0, aff_feerique: 0, aff_demoniaque: 0, aff_undead: 0, aff_reptilien: 0
  };

  const tier = weaponItem?.tier ?? 1;
  const materiau = (weaponItem?.material ?? 0) + 1; // convert 0-7 to 1-8
  const affinities = weaponItem?.affinities ?? {};

  return {
    poids: weaponDef.weight ?? 0,
    dist: weaponDef.dist ?? 1,
    tier,
    materiau,
    models: weaponDef.models ?? ["Arme"],
    damFirst: weaponDef.damFirst ?? 5,
    damLast: weaponDef.damLast ?? 10,
    weightFO: weaponDef.weightFO ?? 0,
    weightTA: weaponDef.weightTA ?? 0,
    weightIN: weaponDef.weightIN ?? 0,
    weightVI: weaponDef.weightVI ?? 0,
    weightAD: weaponDef.weightAD ?? 0,
    aff_bestial: affinities.bestial ?? 0,
    aff_elementaire: affinities.elementaire ?? 0,
    aff_feerique: affinities.feerique ?? 0,
    aff_demoniaque: affinities.demoniaque ?? 0,
    aff_undead: affinities.undead ?? 0,
    aff_reptilien: affinities.reptilien ?? 0
  };
}

/**
 * Normalise l'équipement d'un combattant vers le format interne.
 * Le serveur peut avoir equipment: null (joueur) ou un objet avec des slots d'armure.
 */
function normalizeEquipment(equipment) {
  if (!equipment) {
    return { armure: null };
  }
  // Si déjà au format interne
  if (equipment.armure && 'reduction' in equipment.armure) {
    return equipment;
  }
  // Format serveur : slots d'armure (corps, tete, bras, jambes)
  // Calculer une réduction basée sur le nombre de pièces et leur tier
  let reduction = 0;
  let poids = 0;
  let hasArmor = false;
  const pieces = {};
  const slots = ['corps', 'tete', 'bras', 'jambes'];
  for (const slot of slots) {
    const piece = equipment[slot];
    if (piece) {
      hasArmor = true;
      const tier = piece.tier ?? 1;
      reduction += tier;
      poids += tier * 2;
      const armorSlot = armors[slot];
      const armorDef = armorSlot?.find(a => a.tier === tier);
      pieces[slot] = armorDef?.name ?? null;
    } else {
      pieces[slot] = null;
    }
  }
  if (!hasArmor) {
    return { armure: null };
  }
  return { armure: { reduction, poids, pieces } };
}

/**
 * Normalise les données d'un combattant depuis le format serveur vers le format
 * CombatantInput attendu par le moteur de combat.
 */
function normalizeCombatantData(data) {
  return {
    name: data.name ?? data.nameFr ?? 'Combattant',
    nameFr: data.nameFr ?? data.name ?? 'Combattant',
    stats: normalizeStats(data.stats),
    hp: data.hp ?? null,
    tactic: normalizeTactics(data.tactic),
    weaponDef: normalizeWeapon(data.weaponDef, data.weaponItem),
    weaponDefL: data.weaponDefL ? normalizeWeapon(data.weaponDefL, data.weaponItemL) : null,
    equipment: normalizeEquipment(data.equipment),
    family: data.family ?? null
  };
}

// ─── Point d'entrée principal ──────────────────────────────────────────────────

/**
 * Point d'entrée principal du moteur de combat.
 * Résout un combat complet entre un joueur et une créature.
 *
 * Accepte les données au format serveur (stats en français, equipment: null, etc.)
 * et les normalise automatiquement vers le format interne.
 *
 * @param {object} playerData - Données du joueur (format serveur ou interne)
 * @param {object} creatureData - Données de la créature (format serveur ou interne)
 * @param {object|Function} [optionsOrRng] - Options {devMode, rollDie} ou fonction RNG
 * @returns {CombatResult} {log, winner, playerHpFinal, creatureHpFinal, hpPlayer, hpCreature}
 *
 * Requirements: 15.2, 15.4, 16.1, 16.2, 16.3, 16.4
 */
export function resolveCombat(playerData, creatureData, optionsOrRng = {}) {
  // Déterminer le RNG : soit une fonction passée directement, soit via options.rollDie
  let rng = Math.random;
  if (typeof optionsOrRng === 'function') {
    rng = optionsOrRng;
  } else if (optionsOrRng?.rollDie) {
    // Adapter rollDie(min, max) en rng() → [0, 1)
    rng = () => optionsOrRng.rollDie(0, 99) / 100;
  }

  // Normaliser les données depuis le format serveur
  const normalizedPlayer = normalizeCombatantData(playerData);
  const normalizedCreature = normalizeCombatantData(creatureData);

  // Valider et exécuter
  validateInputs(normalizedPlayer, normalizedCreature);
  const state = initCombatState(normalizedPlayer, normalizedCreature, COMBAT);

  // Activer le mode debug si demandé
  state.devMode = (typeof optionsOrRng === 'object' && optionsOrRng !== null && optionsOrRng.devMode === true) || false;

  // Sauvegarder les HP de départ (avant le combat)
  const playerHpStart = state.player.hp;
  const creatureHpStart = state.creature.hp;

  // ─── Phase début du combat ────────────────────────────────────────────────
  log(state, 'separator', `=== Début du combat ===`);
  // Presentation(C1) — commenté dans la spec
  equipementCombattant(state.player, state);
  presentationCombattant(state.creature, state);
  equipementCombattant(state.creature, state);

  const finalState = mainLoop(state, COMBAT, rng);

  return {
    log: finalState.log,
    winner: finalState.result.winner,
    // Format attendu par server/index.js
    playerHpStart,
    playerHpFinal: finalState.player.hp,
    playerHpMax: finalState.player.hpMax,
    creatureHpStart,
    creatureHpFinal: finalState.creature.hp,
    creatureHpMax: finalState.creature.hpMax,
    // Format interne (pour les tests)
    hpPlayer: finalState.player.hp,
    hpCreature: finalState.creature.hp
  };
}

// ─── Présentation ───────────────────────────────────────────────────────────────

/**
 * Tranche — convertit une valeur en indice de tranche (1-5).
 */
export function tranche(valeur) {
  if (valeur <= 7) return 1;
  if (valeur <= 10) return 2;
  if (valeur <= 13) return 3;
  if (valeur <= 16) return 4;
  return 5;
}

/**
 * Presentation — affiche la description narrative d'un combattant
 * à partir de ses caractéristiques et des matrices de presentation.json.
 */
export function presentationCombattant(combattant, state) {
  const s = combattant.stats;

  // calcul des scores composites
  const robustesse = Math.floor((s.CON + s.TAI) / 2);
  const rapidite = Math.floor((s.INT + s.VIT) / 2);
  const presence = Math.floor((s.TAI + s.ADR) / 2);
  const mentalOffensif = Math.floor((s.INT + s.VOL) / 2);
  const letalite = Math.floor((s.FOR + s.ADR) / 2);
  const mentalReactif = Math.floor((s.INT + s.VOL + s.VIT) / 3);
  const espace = Math.floor((s.ADR + (24 - s.TAI)) / 2);
  const solidite = Math.floor((s.FOR + s.VOL + (24 - s.TAI)) / 3);
  const pression = Math.floor((s.VIT + s.INT) / 2);
  const anticipation = Math.floor((s.ADR + s.INT) / 2);
  const tailleCm = 115 + s.TAI * 5;

  // présentation
  log(state, 'normal', `=== ${combattant.name} ===`);
  log(state, 'normal', `${combattant.name} mesure ${tailleCm} cm`);
  log(state, 'normal', presentation.MATRICE_PHYSIQUE[tranche(robustesse)][tranche(s.FOR)]);
  log(state, 'normal', presentation.MATRICE_VIVACITE[tranche(rapidite)][tranche(presence)]);
  log(state, 'normal', presentation.MATRICE_ATTAQUE[tranche(mentalOffensif)][tranche(letalite)]);
  log(state, 'normal', presentation.MATRICE_ESQUIVE[tranche(mentalReactif)][tranche(espace)]);
  log(state, 'normal', presentation.MATRICE_PARADE[tranche(solidite)][tranche(s.ADR)]);
  log(state, 'normal', presentation.MATRICE_INITIATIVE[tranche(s.VOL)][tranche(pression)]);
  log(state, 'normal', presentation.MATRICE_RIPOSTE[tranche(s.VIT)][tranche(anticipation)]);
  log(state, 'normal', '');
  flushLogs(state);
}

/**
 * Equipement — affiche l'équipement d'un combattant.
 * Format arme : "${model} en ${matière}" (comme les écrans d'inventaire/équipement).
 * Armure : affiche les 4 slots individuellement (corps, tête, bras, jambes).
 */
export function equipementCombattant(combattant, state) {
  if (combattant.weapon) {
    const modelIndex = (combattant.weapon.tier ?? 1) - 1;
    const model = combattant.weapon.models?.[modelIndex] ?? combattant.weaponName;
    const matName = COMBAT.materials[(combattant.weapon.materiau ?? 1) - 1] ?? "?";
    log(state, 'normal', `${combattant.name} combat avec ${model} en ${matName} en main droite`);
  }
  if (combattant.weaponL) {
    const modelIndex = (combattant.weaponL.tier ?? 1) - 1;
    const model = combattant.weaponL.models?.[modelIndex] ?? combattant.weaponNameL;
    const matName = COMBAT.materials[(combattant.weaponL.materiau ?? 1) - 1] ?? "?";
    log(state, 'normal', `${combattant.name} porte ${model} en ${matName} en main gauche`);
  }
  if (combattant.armorPieces) {
    if (combattant.armorPieces.corps) {
      log(state, 'normal', `${combattant.name} porte ${combattant.armorPieces.corps} (corps)`);
    }
    if (combattant.armorPieces.tete) {
      log(state, 'normal', `${combattant.name} porte ${combattant.armorPieces.tete} (tête)`);
    }
    if (combattant.armorPieces.bras) {
      log(state, 'normal', `${combattant.name} porte ${combattant.armorPieces.bras} (bras)`);
    }
    if (combattant.armorPieces.jambes) {
      log(state, 'normal', `${combattant.name} porte ${combattant.armorPieces.jambes} (jambes)`);
    }
  } else if (!combattant.armor) {
    log(state, 'normal', `${combattant.name} combat sans armure`);
  }
  log(state, 'normal', '');
  flushLogs(state);
}
