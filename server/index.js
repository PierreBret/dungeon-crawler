/*
  SERVER/INDEX.JS
  Point d'entrée du serveur.
*/

import express           from "express";
import { createServer }  from "http";
import { Server }        from "socket.io";
import { readFileSync }  from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createSession, getSession, deleteSession } from "./state/gameState.js";
import { handlePlayerAction } from "./game/world.js";
import { generateCandidate }  from "./game/player.js";
import { initSchema }         from "./db/schema.js";
import {
  createPlayer    as dbCreatePlayer,
  createRun       as dbCreateRun,
  createCharacter as dbCreateCharacter,
  addItem         as dbAddItem,
  getInventory    as dbGetInventory,
  equipItem       as dbEquipItem,
  unequipItem     as dbUnequipItem,
  unequipSlot     as dbUnequipSlot,
  removeItem      as dbRemoveItem,
  saveFloor       as dbSaveFloor,
  updateRunStatut as dbUpdateRunStatut
} from "./db/queries.js";

initSchema();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(join(__dirname, "..", "client")));

// ─── API REST — données statiques ─────────────────────────────────────────────
// Source de vérité unique : les fichiers JSON dans server/data/
// Le client charge ces données au démarrage via fetch

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(__dirname, "data", filename), "utf8"));
}

const weapons = loadJSON("weapons.json");

app.get("/api/data/weapons",  (req, res) => res.json(weapons));
app.get("/api/data/armors",   (req, res) => res.json(loadJSON("armors.json")));
app.get("/api/data/shields",  (req, res) => res.json(loadJSON("shields.json")));
app.get("/api/data/bestiary", (req, res) => res.json(loadJSON("bestiary.json")));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] Joueur connecté : ${socket.id}`);

  socket.on("game:candidates", (data, callback) => {
    const candidates = [];
    for (let i = 0; i < data.count; i++) candidates.push(generateCandidate());
    callback({ ok: true, candidates });
  });

  socket.on("game:start", (data, callback) => {
    const session = createSession(socket.id, data.candidate);
    const state   = session.getPublicState();

    try {
      const playerId = dbCreatePlayer(data.candidate.name);
      const runId    = dbCreateRun(playerId);
      const { stats } = session.player;

      dbCreateCharacter(runId, stats, session.player.hp, session.player.endurance);

      // Ajouter une arme de chaque type à l'inventaire
      for (const weapon of weapons) {
        dbAddItem(runId, {
          itemType:     "weapon",
          itemCode:     weapon.code,
          tier:         1,
          material:     0,
          affinities:   { bestial: 0, elementaire: 0, feerique: 0, demoniaque: 0, undead: 0, reptilien: 0 },
          equipped:     0,
          equippedSlot: null
        });
      }

      dbSaveFloor(runId, 1, state.dungeon);

      session.playerId = playerId;
      session.runId    = runId;
      session.etage    = 1;

      console.log(`[game:start] playerId:${playerId} runId:${runId}`);
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
      // Vider le slot cible
      dbUnequipSlot(session.runId, data.slot);

      // Si arme 2 mains — vider aussi la main gauche
      const weaponDef = weapons.find(w => w.code === data.itemCode);
      if (weaponDef?.hd === 2) {
        dbUnequipSlot(session.runId, "leftHand");
      }

      dbEquipItem(data.itemId, data.slot);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:unequip", (data, callback) => {
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

    const state = session.getPublicState();

    try {
      if (session.runId) dbSaveFloor(session.runId, session.etage ?? 1, state.dungeon);
    } catch (err) {
      console.error("[player:action] Erreur DB :", err.message);
    }

    callback({ ok: true, state });
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