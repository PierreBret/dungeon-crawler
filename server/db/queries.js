/*
  SERVER/DB/QUERIES.JS
  Fonctions CRUD pour interagir avec la base de données.
  Toutes les requêtes sont préparées (protection injection SQL).
*/

import db from "./database.js";

// ─── Players ──────────────────────────────────────────────────────────────────

export function createPlayer(name) {
  return db.prepare("INSERT INTO players (name) VALUES (?)").run(name).lastInsertRowid;
}

export function getPlayer(id) {
  return db.prepare("SELECT * FROM players WHERE id = ?").get(id);
}

export function updateNiveauMax(playerId, niveau) {
  db.prepare(`
    UPDATE players SET niveauMaxFranchi = ?
    WHERE id = ? AND niveauMaxFranchi < ?
  `).run(niveau, playerId, niveau);
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export function createRun(playerId) {
  return db.prepare("INSERT INTO runs (playerId) VALUES (?)").run(playerId).lastInsertRowid;
}

export function getActiveRun(playerId) {
  return db.prepare(`
    SELECT * FROM runs WHERE playerId = ? AND statut = 'actif'
    ORDER BY createdAt DESC LIMIT 1
  `).get(playerId);
}

export function updateRunStatut(runId, statut) {
  db.prepare("UPDATE runs SET statut = ? WHERE id = ?").run(statut, runId);
}

export function updateRunEtage(runId, etage) {
  db.prepare("UPDATE runs SET etageActuel = ? WHERE id = ?").run(etage, runId);
}

// ─── Characters ───────────────────────────────────────────────────────────────

export function createCharacter(runId, stats, hp, endurance) {
  return db.prepare(`
    INSERT INTO characters
      (runId,
       force, constitution, taille, intelligence, volonte, vitesse, adresse,
       force_base, constitution_base, taille_base, intelligence_base,
       volonte_base, vitesse_base, adresse_base,
       hp, endurance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    // Stats actuelles
    stats.force, stats.constitution, stats.taille,
    stats.intelligence, stats.volonté, stats.vitesse, stats.adresse,
    // Stats de base (identiques à la création)
    stats.force, stats.constitution, stats.taille,
    stats.intelligence, stats.volonté, stats.vitesse, stats.adresse,
    hp, endurance
  ).lastInsertRowid;
}

export function getCharacter(runId) {
  return db.prepare("SELECT * FROM characters WHERE runId = ?").get(runId);
}

export function updateCharacterHpEndurance(runId, hp, endurance) {
  db.prepare("UPDATE characters SET hp = ?, endurance = ? WHERE runId = ?")
    .run(hp, endurance, runId);
}

export function updateAugmentations(runId, augmentations) {
  db.prepare("UPDATE characters SET augmentations = ? WHERE runId = ?")
    .run(JSON.stringify(augmentations), runId);
}

/**
 * Augmente une stat d'un point et met à jour augmentations.
 * Les deux opérations sont atomiques (transaction).
 *
 * @param {number} runId
 * @param {string} stat        — nom de la colonne SQL (ex: "force", "adresse")
 * @param {object} augmentations — objet JSON augmentations mis à jour
 */
export function incrementStat(runId, stat, augmentations) {
  // Colonnes autorisées — protection contre injection SQL
  const allowed = ["force", "constitution", "intelligence", "volonte", "vitesse", "adresse"];
  if (!allowed.includes(stat)) {
    throw new Error(`incrementStat: stat non autorisée "${stat}"`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE characters SET ${stat} = ${stat} + 1 WHERE runId = ?`).run(runId);
    db.prepare(`UPDATE characters SET augmentations = ? WHERE runId = ?`)
      .run(JSON.stringify(augmentations), runId);
  });

  transaction();
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export function addItem(runId, item) {
  return db.prepare(`
    INSERT INTO inventory
      (runId, itemType, itemCode, slot, tier, material,
       aff_bestial, aff_elementaire, aff_feerique,
       aff_demoniaque, aff_undead, aff_reptilien,
       equipped, equippedSlot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    item.itemType,
    item.itemCode        ?? null,
    item.slot            ?? null,
    item.tier,
    item.material        ?? 0,
    item.affinities?.bestial      ?? 0,
    item.affinities?.elementaire  ?? 0,
    item.affinities?.feerique     ?? 0,
    item.affinities?.demoniaque   ?? 0,
    item.affinities?.undead       ?? 0,
    item.affinities?.reptilien    ?? 0,
    item.equipped        ?? 0,
    item.equippedSlot    ?? null
  ).lastInsertRowid;
}

export function getInventory(runId) {
  return db.prepare("SELECT * FROM inventory WHERE runId = ?").all(runId);
}

export function getEquipped(runId) {
  return db.prepare("SELECT * FROM inventory WHERE runId = ? AND equipped = 1").all(runId);
}

export function equipItem(itemId, equippedSlot) {
  db.prepare("UPDATE inventory SET equipped = 1, equippedSlot = ? WHERE id = ?")
    .run(equippedSlot, itemId);
}

export function unequipItem(itemId) {
  db.prepare("UPDATE inventory SET equipped = 0, equippedSlot = NULL WHERE id = ?")
    .run(itemId);
}

export function unequipSlot(runId, slot) {
  db.prepare("UPDATE inventory SET equipped = 0, equippedSlot = NULL WHERE runId = ? AND equippedSlot = ?")
    .run(runId, slot);
}

export function removeItem(itemId) {
  db.prepare("DELETE FROM inventory WHERE id = ?").run(itemId);
}

// ─── Floors ───────────────────────────────────────────────────────────────────

export function saveFloor(runId, etage, dungeon) {
  const existing = db.prepare("SELECT id FROM floors WHERE runId = ? AND etage = ?")
    .get(runId, etage);

  if (existing) {
    db.prepare("UPDATE floors SET dungeon = ? WHERE id = ?")
      .run(JSON.stringify(dungeon), existing.id);
  } else {
    db.prepare("INSERT INTO floors (runId, etage, dungeon) VALUES (?, ?, ?)")
      .run(runId, etage, JSON.stringify(dungeon));
  }
}

export function getFloor(runId, etage) {
  const row = db.prepare("SELECT * FROM floors WHERE runId = ? AND etage = ?")
    .get(runId, etage);
  if (!row) return null;
  return { ...row, dungeon: JSON.parse(row.dungeon) };
}

export function setFloorCleared(runId, etage) {
  db.prepare("UPDATE floors SET cleared = 1 WHERE runId = ? AND etage = ?")
    .run(runId, etage);
}