/*
  SERVER/GAME/COMBAT.JS
  Résolveur de combat — côté serveur uniquement.

  Chaque action produit un tableau de lignes de log détaillées.
  Le client affiche ligne par ligne sur Entrée.
  Les lignes de fin (victoire/défaite/loot) font partie du log.
*/

import { rollDie } from "./player.js";
import { COMBAT_CONFIG } from "../config.js";

const D100 = COMBAT_CONFIG.diceMax;

// ─── Scores dérivés ───────────────────────────────────────────────────────────

function computeScores(stats) {
  const vol = stats.volonté ?? stats.volonte ?? 0;
  return {
    attack:    stats.adresse * 0.5 + stats.vitesse * 0.3 + stats.intelligence * 0.2,
    parry:     stats.adresse * 0.4 + stats.force * 0.3 + vol * 0.3,
    dodge:     stats.vitesse * 0.5 + stats.adresse * 0.3 - stats.taille * 0.2,
    init:      stats.vitesse * 0.6 + stats.intelligence * 0.4,
    endurance: stats.constitution + vol
  };
}

// ─── Modificateurs de stratégie ───────────────────────────────────────────────

function stratMod(value) {
  return 0.8 + ((value ?? 5) - 1) * (0.4 / 9);
}

function computeStrategyMods(eo, na, en) {
  const iEO = 11 - eo; const iNA = 11 - na; const iEN = 11 - en;
  return {
    vivacite:  stratMod(eo)  * stratMod(na),
    precision: stratMod(na)  * stratMod(en),
    dodge:     stratMod(iEO) * stratMod(na)  * stratMod(iEN),
    parry:     stratMod(iEO) * stratMod(iNA) * stratMod(en),
    riposte:   stratMod(iEO) * stratMod(na)  * stratMod(en),
    init:      stratMod(eo)  * stratMod(en)
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

function computeDamage(weaponDef, weaponItem, attackerStats, armorReduction) {
  if (!weaponDef) return { raw: 1, final: Math.max(0, 1 - armorReduction) };

  const nbTiers  = weaponDef.models?.length ?? 1;
  const tier     = weaponItem?.tier ?? 1;
  const baseArme = weaponDef.damFirst +
    (weaponDef.damLast - weaponDef.damFirst) * (tier - 1) / Math.max(nbTiers - 1, 1);

  const MATERIALS_MOD = [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0];
  const modMat = MATERIALS_MOD[weaponItem?.material ?? 0] ?? 1.0;

  const coefStats = 1
    + (attackerStats.force        - 12) * 0.02 * (weaponDef.weightFO ?? 0)
    + (attackerStats.taille       - 12) * 0.02 * (weaponDef.weightTA ?? 0)
    + (attackerStats.intelligence - 12) * 0.02 * (weaponDef.weightIN ?? 0)
    + (attackerStats.vitesse      - 12) * 0.02 * (weaponDef.weightVI ?? 0)
    + (attackerStats.adresse      - 12) * 0.02 * (weaponDef.weightAD ?? 0);

  const raw   = Math.floor(baseArme * modMat * coefStats);
  const final = Math.max(0, raw - armorReduction);
  return { raw, final };
}

// ─── Helpers log ──────────────────────────────────────────────────────────────

function f(n) { return Math.floor(n); }
function line(type, text) { return { type, text }; }

// ─── Résolution d'une minute ──────────────────────────────────────────────────

function resolveCombatMinute(attacker, defender, attackerStrat, defenderStrat, weaponDefs, minute) {
  const lines   = [];
  const aScores = computeScores(attacker.stats);
  const dScores = computeScores(defender.stats);
  const aMods   = computeStrategyMods(
    attackerStrat.EO ?? attackerStrat.eo,
    attackerStrat.NA ?? attackerStrat.na,
    attackerStrat.EN ?? attackerStrat.en
  );
  const dMods   = computeStrategyMods(
    defenderStrat.EO ?? defenderStrat.eo,
    defenderStrat.NA ?? defenderStrat.na,
    defenderStrat.EN ?? defenderStrat.en
  );

  lines.push(line("separator", `───── Minute ${minute} ─────`));

  // Vivacité
  const aVivScore = f(aScores.init * aMods.vivacite);
  const dVivScore = f(dScores.init * dMods.vivacite);
  const aVivRoll  = rollDie(1, D100);
  const dVivRoll  = rollDie(1, D100);
  const aViv      = aVivScore - aVivRoll;
  const dViv      = dVivScore - dVivRoll;

  lines.push(line("vivacite", `Vivacité — ${attacker.name} : score=${aVivScore}, jet=${aVivRoll}, résultat=${aViv}`));
  lines.push(line("vivacite", `Vivacité — ${defender.name} : score=${dVivScore}, jet=${dVivRoll}, résultat=${dViv}`));

  if (aViv <= 0 && dViv <= 0) {
    lines.push(line("noAction", "Aucun des deux combattants n'obtient l'initiative."));
    return lines;
  }

  let aggressor, victim, agScores, viScores, agMods, viMods, agWeapon, agArmor, viArmor;

  if (aViv >= dViv) {
    aggressor = attacker; agScores = aScores; agMods = aMods;
    agWeapon  = weaponDefs.attacker; agArmor = defender.armorReduction; viArmor = attacker.armorReduction;
    victim    = defender; viScores = dScores; viMods = dMods;
  } else {
    aggressor = defender; agScores = dScores; agMods = dMods;
    agWeapon  = weaponDefs.defender; agArmor = attacker.armorReduction; viArmor = defender.armorReduction;
    victim    = attacker; viScores = aScores; viMods = aMods;
  }

  lines.push(line("initiative", `${aggressor.name} prend l'initiative.`));

  // Attaque
  const attackScore   = f(agScores.attack * agMods.precision);
  const attackRoll    = rollDie(1, D100);
  const attackQuality = attackScore - attackRoll;
  const weaponName    = agWeapon.def?.typeArme ?? "arme";

  lines.push(line("attack", `${aggressor.name} attaque avec ${weaponName} (score=${attackScore}, jet=${attackRoll}, qualité=${f(attackQuality)})`));

  if (attackQuality <= 0) {
    lines.push(line("miss", `${aggressor.name} rate son attaque.`));
    const rs = f(viScores.attack * viMods.riposte);
    const rr = rollDie(1, D100);
    const rq = rs - rr;
    lines.push(line("riposte_attempt", `${victim.name} tente une riposte (score=${rs}, jet=${rr}, résultat=${f(rq)})`));
    if (rq > 0) {
      const dmg = computeDamage(agWeapon.def, agWeapon.item, victim.stats, agArmor);
      aggressor.hp = Math.max(0, aggressor.hp - dmg.final);
      if (agArmor > 0) lines.push(line("armor", `${aggressor.name} absorbe ${agArmor} dégâts grâce à son armure.`));
      lines.push(line("riposte", `${victim.name} riposte et inflige ${dmg.final} dégâts à ${aggressor.name} ! (HP: ${aggressor.hp})`));
    } else {
      lines.push(line("riposte_fail", `${victim.name} ne parvient pas à riposter.`));
    }
    return lines;
  }

  // Esquive
  const dodgeScore   = f(viScores.dodge * viMods.dodge);
  const dodgeRoll    = rollDie(1, D100);
  const dodgeQuality = dodgeScore - dodgeRoll;
  lines.push(line("dodge_attempt", `${victim.name} tente d'esquiver (score=${dodgeScore}, jet=${dodgeRoll}, qualité=${f(dodgeQuality)})`));

  if (dodgeQuality > attackQuality) {
    lines.push(line("dodge", `${victim.name} esquive l'attaque.`));
    const rs = f(viScores.attack * viMods.riposte);
    const rr = rollDie(1, D100);
    const rq = rs - rr;
    const is = f(agScores.init * agMods.init);
    const ir = rollDie(1, D100);
    const iq = is - ir;
    lines.push(line("riposte_attempt", `${victim.name} tente une riposte (score=${rs}, jet=${rr}, résultat=${f(rq)})`));
    lines.push(line("init_contest",    `${aggressor.name} tente de conserver l'initiative (score=${is}, jet=${ir}, résultat=${f(iq)})`));
    if (rq > iq) {
      const dmg = computeDamage(agWeapon.def, agWeapon.item, victim.stats, agArmor);
      aggressor.hp = Math.max(0, aggressor.hp - dmg.final);
      if (agArmor > 0) lines.push(line("armor", `${aggressor.name} absorbe ${agArmor} dégâts grâce à son armure.`));
      lines.push(line("riposte", `${victim.name} riposte après esquive et inflige ${dmg.final} dégâts à ${aggressor.name} ! (HP: ${aggressor.hp})`));
    } else {
      lines.push(line("riposte_fail", `${aggressor.name} conserve l'initiative — pas de riposte.`));
    }
    return lines;
  }

  // Parade
  const parryScore   = f(viScores.parry * viMods.parry);
  const parryRoll    = rollDie(1, D100);
  const parryQuality = parryScore - parryRoll;
  lines.push(line("parry_attempt", `${victim.name} tente de parer (score=${parryScore}, jet=${parryRoll}, qualité=${f(parryQuality)})`));

  if (parryQuality > attackQuality) {
    lines.push(line("parry", `${victim.name} pare l'attaque.`));
    const rs = f(viScores.attack * viMods.riposte);
    const rr = rollDie(1, D100);
    const rq = rs - rr;
    const is = f(agScores.init * agMods.init);
    const ir = rollDie(1, D100);
    const iq = is - ir;
    lines.push(line("riposte_attempt", `${victim.name} tente une riposte (score=${rs}, jet=${rr}, résultat=${f(rq)})`));
    lines.push(line("init_contest",    `${aggressor.name} tente de conserver l'initiative (score=${is}, jet=${ir}, résultat=${f(iq)})`));
    if (rq > iq) {
      const dmg = computeDamage(agWeapon.def, agWeapon.item, victim.stats, agArmor);
      aggressor.hp = Math.max(0, aggressor.hp - dmg.final);
      if (agArmor > 0) lines.push(line("armor", `${aggressor.name} absorbe ${agArmor} dégâts grâce à son armure.`));
      lines.push(line("riposte", `${victim.name} riposte après parade et inflige ${dmg.final} dégâts à ${aggressor.name} ! (HP: ${aggressor.hp})`));
    } else {
      lines.push(line("riposte_fail", `${aggressor.name} conserve l'initiative — pas de riposte.`));
    }
    return lines;
  }

  // Dégâts
  lines.push(line("defense_fail", `${victim.name} ne parvient ni à esquiver ni à parer.`));
  const viWeapon = aViv >= dViv ? weaponDefs.attacker : weaponDefs.defender;
  const dmg      = computeDamage(viWeapon.def, viWeapon.item, aggressor.stats, viArmor);
  victim.hp      = Math.max(0, victim.hp - dmg.final);
  lines.push(line("damage_raw",  `${aggressor.name} inflige ${dmg.raw} dégâts bruts.`));
  if (viArmor > 0) lines.push(line("armor", `${victim.name} absorbe ${viArmor} dégâts grâce à son armure.`));
  lines.push(line("hit",         `${victim.name} subit ${dmg.final} dégâts. (HP: ${victim.hp})`));

  return lines;
}

// ─── Résolution complète ──────────────────────────────────────────────────────

export function resolveCombat(playerData, creatureData) {
  if (!playerData)   throw new Error("resolveCombat: playerData manquant");
  if (!creatureData) throw new Error("resolveCombat: creatureData manquant");

  const player   = {
    name:           playerData.name,
    stats:          playerData.stats,
    hp:             playerData.hp,
    armorReduction: computeArmorReduction(playerData.equipment)
  };
  const creature = {
    name:           creatureData.nameFr,
    stats:          creatureData.stats,
    hp:             creatureData.hp,
    armorReduction: computeArmorReduction(creatureData.equipment)
  };

  const weaponDefs = {
    attacker: { def: playerData.weaponDef,   item: playerData.weaponItem           },
    defender: { def: creatureData.weaponDef, item: creatureData.equipment?.rightHand }
  };

  const log = [];

  for (let minute = 1; minute <= 5; minute++) {
    if (player.hp <= 0 || creature.hp <= 0) break;
    const playerStrat   = playerData.strategy[minute - 1] ?? playerData.strategy[4];
    const creatureStrat = creatureData.strategy[`min${minute}`] ?? creatureData.strategy["min5"];
    const lines = resolveCombatMinute(player, creature, playerStrat, creatureStrat, weaponDefs, minute);
    for (const l of lines) log.push(l);
  }

  const winner = player.hp > 0 ? "player" : "creature";

  // ─── Lignes de fin intégrées dans le log ──────────────────────────────────

  log.push(line("separator", "───── Fin du combat ─────"));

  if (winner === "player") {
    log.push(line("victory", `${playerData.name} remporte le combat ! (HP: ${player.hp})`));
  } else {
    log.push(line("defeat",  `${playerData.name} est vaincu...`));
  }

  return { log, playerHpFinal: player.hp, creatureHpFinal: creature.hp, winner };
}