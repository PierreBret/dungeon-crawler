/*
  SERVER/DB/SCHEMA.JS
  Création des tables SQLite au démarrage.
  Les tables ne sont créées que si elles n'existent pas déjà.

  Pour les colonnes ajoutées après la création initiale :
  ALTER TABLE est utilisé avec try/catch car SQLite ne supporte pas
  "ADD COLUMN IF NOT EXISTS". Si la colonne existe déjà, l'erreur est ignorée.
*/

import db from "./database.js";

export function initSchema() {

  // Profil méta du joueur (persiste entre les runs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL,
      niveauMaxFranchi  INTEGER NOT NULL DEFAULT 0,
      createdAt         TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Run en cours
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId    INTEGER NOT NULL REFERENCES players(id),
      etageActuel INTEGER NOT NULL DEFAULT 1,
      statut      TEXT    NOT NULL DEFAULT 'actif',  -- actif | mort | victoire
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Personnage du run (stats + augmentations d'entraînement)
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      runId           INTEGER NOT NULL REFERENCES runs(id),
      force           INTEGER NOT NULL,
      constitution    INTEGER NOT NULL,
      taille          INTEGER NOT NULL,
      intelligence    INTEGER NOT NULL,
      volonte         INTEGER NOT NULL,
      vitesse         INTEGER NOT NULL,
      adresse         INTEGER NOT NULL,
      hp              INTEGER NOT NULL,
      endurance       INTEGER NOT NULL,
      augmentations   TEXT    NOT NULL DEFAULT '{}',  -- JSON {stat: nbAugmentations}
      force_base      INTEGER,  -- stat originale à la création du personnage
      constitution_base INTEGER,
      taille_base     INTEGER,
      intelligence_base INTEGER,
      volonte_base    INTEGER,
      vitesse_base    INTEGER,
      adresse_base    INTEGER
    )
  `);

  // Inventaire du run
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      runId            INTEGER NOT NULL REFERENCES runs(id),
      itemType         TEXT    NOT NULL,  -- weapon | armor | shield
      itemCode         TEXT,              -- code arme (DA, SH...) ou null pour armure/bouclier
      slot             TEXT,              -- pour armures : corps | tete | bras | jambes
      tier             INTEGER NOT NULL,
      material         INTEGER NOT NULL DEFAULT 0,  -- index matériau (0=Bois...7=Acier damascène)
      aff_bestial      INTEGER NOT NULL DEFAULT 0,
      aff_elementaire  INTEGER NOT NULL DEFAULT 0,
      aff_feerique     INTEGER NOT NULL DEFAULT 0,
      aff_demoniaque   INTEGER NOT NULL DEFAULT 0,
      aff_undead       INTEGER NOT NULL DEFAULT 0,
      aff_reptilien    INTEGER NOT NULL DEFAULT 0,
      equipped         INTEGER NOT NULL DEFAULT 0,  -- 0=non, 1=oui
      equippedSlot     TEXT                          -- rightHand | leftHand | corps | tete | bras | jambes
    )
  `);

  // Étages visités du run
  db.exec(`
    CREATE TABLE IF NOT EXISTS floors (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      runId     INTEGER NOT NULL REFERENCES runs(id),
      etage     INTEGER NOT NULL,
      dungeon   TEXT    NOT NULL,  -- JSON {grid, creatures, forge, training, exit}
      cleared   INTEGER NOT NULL DEFAULT 0  -- 0=non, 1=oui
    )
  `);

  console.log("[DB] Schema initialisé");
}