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
  updateRunStatut as dbUpdateRunStatut,
  getCharacter    as dbGetCharacter,
  incrementStat   as dbIncrementStat
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

  socket.on("training:attempt", (data, callback) => {
    // Validation des données reçues
    if (!data.stat) {
      console.error("[training:attempt] stat manquante");
      return callback({ ok: false, error: "stat manquante" });
    }

    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    try {
      const character    = dbGetCharacter(session.runId);
      const augmentations = JSON.parse(character.augmentations ?? "{}");
      const nbAug        = augmentations[data.stat] ?? 0;

      // Formule GD : chanceEntrainement = (volonté * 5) / (1 + nbAugmentations de cette stat)
      const chance = Math.min((character.volonte * 5) / (1 + nbAug), 95);
      const roll     = Math.random() * 100;
      const success  = roll <= chance;

      if (success) {
        augmentations[data.stat] = nbAug + 1;
        dbIncrementStat(session.runId, data.stat, augmentations);

        // Mettre à jour le player en session
        session.player.stats[data.stat === "volonte" ? "volonté" : data.stat]++;
      }

      callback({ ok: true, success, chance: Math.floor(chance), roll: Math.floor(roll) });
    } catch (err) {
      console.error("[training:attempt] Erreur :", err.message);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("player:action", (action, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    // handlePlayerAction retourne soit :
    // { ok: false, error }           → erreur (mur, hors limites, etc.)
    // { ok: true, confirm: {...} }   → case spéciale détectée, pas de déplacement
    // { ok: true }                   → déplacement normal effectué
    const result = handlePlayerAction(session, action);
    if (!result.ok) return callback({ ok: false, error: result.error });

    // Cas case spéciale : on retourne la demande de confirmation au client
    // sans sauvegarder en BDD (le joueur n'a pas bougé)
    if (result.confirm) {
      return callback({ ok: true, confirm: result.confirm });
    }

    // Déplacement normal ou move:confirm : on récupère l'état mis à jour
    const state = session.getPublicState();

    // Sauvegarde de l'étage en BDD après chaque déplacement effectif
    try {
      if (session.runId) dbSaveFloor(session.runId, session.etage ?? 1, state.dungeon);
    } catch (err) {
      console.error("[player:action] Erreur DB :", err.message);
    }

    // Pour move:confirm, on retourne aussi le type de case
    // pour que le client sache quelle action spéciale lancer (entraînement, etc.)
    callback({ ok: true, state, specialType: result.specialType ?? null });
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