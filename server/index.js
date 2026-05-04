/*
  SERVER/INDEX.JS
  Point d'entrée du serveur.
*/

import "dotenv/config";
import express           from "express";
import { createServer }  from "http";
import { Server }        from "socket.io";
import { readFileSync }  from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createSession, getSession, deleteSession } from "./state/gameState.js";
import { handlePlayerAction } from "./game/world.js";
import { generateCandidate, rollDie } from "./game/player.js";
import { resolveCombat }      from "./game/combat.js";
import { initSchema }         from "./db/schema.js";
import {
  createPlayer              as dbCreatePlayer,
  createRun                 as dbCreateRun,
  createCharacter           as dbCreateCharacter,
  addItem                   as dbAddItem,
  getInventory              as dbGetInventory,
  getCharacter              as dbGetCharacter,
  equipItem                 as dbEquipItem,
  unequipItem               as dbUnequipItem,
  unequipSlot               as dbUnequipSlot,
  removeItem                as dbRemoveItem,
  saveFloor                 as dbSaveFloor,
  updateRunStatut           as dbUpdateRunStatut,
  incrementStat             as dbIncrementStat,
  updateCharacterHpEndurance as dbUpdateCharacterHpEndurance
} from "./db/queries.js";

initSchema();

// ─── Mode développement ───────────────────────────────────────────────────────

const DEV_MODE = process.env.DEV_MODE === "true";
console.log(`[Config] DEV_MODE = ${DEV_MODE}`);

const __dirname = dirname(fileURLToPath(import.meta.url));

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(join(__dirname, "..", "client")));

// ─── Données statiques ────────────────────────────────────────────────────────

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(__dirname, "data", filename), "utf8"));
}

const weapons  = loadJSON("weapons.json");
const bestiary = loadJSON("bestiary.json");

app.get("/api/data/weapons",  (req, res) => res.json(weapons));
app.get("/api/data/armors",   (req, res) => res.json(loadJSON("armors.json")));
app.get("/api/data/shields",  (req, res) => res.json(loadJSON("shields.json")));
app.get("/api/data/bestiary", (req, res) => res.json(bestiary));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] Joueur connecté : ${socket.id}`);

  socket.on("game:candidates", (data, callback) => {
    if (!data?.count) {
      console.error("[game:candidates] count manquant");
      return callback({ ok: false, error: "count manquant" });
    }
    const candidates = [];
    for (let i = 0; i < data.count; i++) candidates.push(generateCandidate());
    callback({ ok: true, candidates });
  });

  socket.on("game:start", (data, callback) => {
    if (!data?.candidate) {
      console.error("[game:start] candidate manquant");
      return callback({ ok: false, error: "candidate manquant" });
    }

    // bestiary passé à createSession pour generateDungeon
    const session = createSession(socket.id, data.candidate, bestiary);
    const state   = session.getPublicState();
    state.devMode = DEV_MODE;

    try {
      const playerId   = dbCreatePlayer(data.candidate.name);
      const runId      = dbCreateRun(playerId);
      const { stats }  = session.player;

      dbCreateCharacter(runId, stats, 0, 0);

      if (DEV_MODE) {
        for (const weapon of weapons) {
          dbAddItem(runId, {
            itemType: "weapon", itemCode: weapon.code,
            tier: 1, material: 0,
            affinities: { bestial: 0, elementaire: 0, feerique: 0, demoniaque: 0, undead: 0, reptilien: 0 },
            equipped: 0, equippedSlot: null
          });
        }
      } else {
        dbAddItem(runId, {
          itemType: "weapon", itemCode: "SH",
          tier: 1, material: 0,
          affinities: { bestial: 0, elementaire: 0, feerique: 0, demoniaque: 0, undead: 0, reptilien: 0 },
          equipped: 0, equippedSlot: null
        });
      }

      dbSaveFloor(runId, 1, state.dungeon);
      session.playerId = playerId;
      session.runId    = runId;
      session.etage    = 1;

      console.log(`[game:start] playerId:${playerId} runId:${runId} DEV_MODE:${DEV_MODE}`);
    } catch (err) {
      console.error("[game:start] Erreur DB :", err.message);
    }

    callback({ ok: true, state });
  });

  socket.on("inventory:get", (data, callback) => {
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      callback({ ok: true, inventory: dbGetInventory(session.runId) });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:equip", (data, callback) => {
    if (!data.itemId || !data.slot) {
      console.error("[inventory:equip] données manquantes :", data);
      return callback({ ok: false, error: "données manquantes" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbUnequipSlot(session.runId, data.slot);
      const weaponDef = weapons.find(w => w.code === data.itemCode);
      if (weaponDef?.hd === 2) dbUnequipSlot(session.runId, "leftHand");
      dbEquipItem(data.itemId, data.slot);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:unequip", (data, callback) => {
    if (!data.itemId) {
      console.error("[inventory:unequip] itemId manquant :", data);
      return callback({ ok: false, error: "itemId manquant" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbUnequipItem(data.itemId);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:drop", (data, callback) => {
    if (!data.itemId) {
      console.error("[inventory:drop] itemId manquant :", data);
      return callback({ ok: false, error: "itemId manquant" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbRemoveItem(data.itemId);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("player:action", (action, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    const result = handlePlayerAction(session, action);
    if (!result.ok) return callback({ ok: false, error: result.error });

    if (result.confirm) {
      return callback({ ok: true, confirm: result.confirm });
    }

    const state = session.getPublicState();
    try {
      if (session.runId) dbSaveFloor(session.runId, session.etage ?? 1, state.dungeon);
    } catch (err) {
      console.error("[player:action] Erreur DB :", err.message);
    }

    callback({ ok: true, state, specialType: result.specialType ?? null });
  });

  socket.on("training:attempt", (data, callback) => {
    if (!data.stat) {
      console.error("[training:attempt] stat manquante");
      return callback({ ok: false, error: "stat manquante" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      const character     = dbGetCharacter(session.runId);
      const augmentations = JSON.parse(character.augmentations ?? "{}");
      const nbAug         = augmentations[data.stat] ?? 0;
      const chance        = Math.min((character.volonte * 5) / (1 + nbAug), 95);
      const roll          = rollDie(1, 100);
      const success       = roll <= chance;

      if (success) {
        augmentations[data.stat] = nbAug + 1;
        dbIncrementStat(session.runId, data.stat, augmentations);
        const statKey = data.stat === "volonte" ? "volonté" : data.stat;
        session.player.stats[statKey] = (session.player.stats[statKey] ?? 0) + 1;
        session.augmentations = augmentations;
      }

      callback({ ok: true, success, chance: Math.floor(chance), roll: Math.floor(roll) });
    } catch (err) {
      console.error("[training:attempt] Erreur :", err.message);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("combat:resolve", (data, callback) => {
    if (!data.strategy) {
      console.error("[combat:resolve] strategy manquante");
      return callback({ ok: false, error: "strategy manquante" });
    }
    if (data.creatureIndex === undefined) {
      console.error("[combat:resolve] creatureIndex manquant");
      return callback({ ok: false, error: "creatureIndex manquant" });
    }

    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    try {
      const creature = session.dungeon.creatures[data.creatureIndex];
      if (!creature)         return callback({ ok: false, error: "Créature introuvable" });
      if (creature.defeated) return callback({ ok: false, error: "Créature déjà vaincue" });

      const creatureDef = bestiary.find(b => b.id === creature.id);
      if (!creatureDef)  return callback({ ok: false, error: `Def introuvable pour id="${creature.id}"` });

      const creatureWeaponDef = weapons.find(w => w.code === creatureDef.equipment?.rightHand?.code);

      // HP joueur depuis BDD (ou calculé si première fois)
      const character  = dbGetCharacter(session.runId);
      const playerHp   = character.hp > 0
        ? character.hp
        : session.player.stats.constitution * 2 + session.player.stats.taille;

      // HP créature
      const creatureHp = creatureDef.stats.constitution * 2 + creatureDef.stats.taille;

      // Arme équipée du joueur
      const inventory       = dbGetInventory(session.runId);
      const equippedItem    = inventory.find(i => i.equippedSlot === "rightHand");
      const playerWeaponDef = equippedItem ? weapons.find(w => w.code === equippedItem.itemCode) : null;

      const playerData = {
        name:       session.player.name,
        stats:      session.player.stats,
        hp:         playerHp,
        strategy:   data.strategy,
        weaponDef:  playerWeaponDef,
        weaponItem: equippedItem,
        equipment:  null  // armures non implémentées
      };

      const creatureData = {
        nameFr:    creatureDef.nameFr,
        stats:     creatureDef.stats,
        hp:        creatureHp,
        weaponDef: creatureWeaponDef,
        equipment: creatureDef.equipment,
        strategy:  creatureDef.strategy
      };

      const result = resolveCombat(playerData, creatureData);

      // Mettre à jour HP joueur en BDD
      dbUpdateCharacterHpEndurance(session.runId, result.playerHpFinal, character.endurance ?? 0);

      // Victoire — marquer créature vaincue + drop
      let drop = null;
      if (result.winner === "player") {
        creature.defeated = true;
        dbSaveFloor(session.runId, session.etage ?? 1, session.dungeon);

        const dropDef = creatureDef.drops?.weapon;
        if (dropDef && Math.random() < (dropDef.chance ?? 1)) {
          const dungeonLevel = session.etage ?? 1;
          const maxTier      = Math.min(Math.ceil(dungeonLevel / 10) + 1, 2);
          const maxMat       = Math.min(Math.ceil(dungeonLevel / 10) + 1, 2);
          const dropTier     = rollDie(1, maxTier);
          const dropMat      = rollDie(0, maxMat - 1);

          drop = {
            itemType:   "weapon",
            itemCode:   dropDef.code,
            tier:       dropTier,
            material:   dropMat,
            affinities: { bestial: 0, elementaire: 0, feerique: 0, demoniaque: 0, undead: 0, reptilien: 0 }
          };
          dbAddItem(session.runId, { ...drop, equipped: 0, equippedSlot: null });
        }
      }

      callback({
        ok:              true,
        log:             result.log,
        winner:          result.winner,
        playerHpFinal:   result.playerHpFinal,
        creatureHpFinal: result.creatureHpFinal,
        drop
      });

    } catch (err) {
      console.error("[combat:resolve] Erreur :", err.message);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("disconnect", () => {
    const session = getSession(socket.id);
    if (session?.runId) {
      try { dbUpdateRunStatut(session.runId, "actif"); }
      catch (err) { console.error("[disconnect] Erreur DB :", err.message); }
    }
    deleteSession(socket.id);
    console.log(`[-] Joueur déconnecté : ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} déjà utilisé. Arrêtez l'autre instance ou changez le PORT.`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));