/*
  SERVER/INDEX.JS
  Point d'entrée du serveur.
*/

import express           from "express";
import { createServer }  from "http";
import { Server }        from "socket.io";
import { createSession, getSession, deleteSession } from "./state/gameState.js";
import { handlePlayerAction } from "./game/world.js";
import { generateCandidate }  from "./game/player.js";
import { initSchema }         from "./db/schema.js";
import {
  createPlayer    as dbCreatePlayer,
  createRun       as dbCreateRun,
  createCharacter as dbCreateCharacter,
  saveFloor       as dbSaveFloor,
  updateRunStatut as dbUpdateRunStatut
} from "./db/queries.js";

initSchema();

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static("../client"));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] Joueur connecté : ${socket.id}`);

  // Génère N candidats pour la création de personnage
  socket.on("game:candidates", (data, callback) => {
    const candidates = [];
    for (let i = 0; i < data.count; i++) {
      candidates.push(generateCandidate());
    }
    callback({ ok: true, candidates });
  });

  // Démarre une partie avec le candidat choisi
  socket.on("game:start", (data, callback) => {
    const session = createSession(socket.id, data.candidate);
    const state   = session.getPublicState();

    try {
      const playerId = dbCreatePlayer(data.candidate.name);
      const runId    = dbCreateRun(playerId);
      const { stats } = session.player;
      dbCreateCharacter(runId, stats, session.player.hp, session.player.endurance);
      dbSaveFloor(runId, 1, state.dungeon);

      // Stocke les IDs dans la session pour les actions futures
      session.playerId = playerId;
      session.runId    = runId;
      session.etage    = 1;

      console.log(`[game:start] playerId:${playerId} runId:${runId}`);
    } catch (err) {
      console.error("[game:start] Erreur DB :", err.message);
    }

    callback({ ok: true, state });
  });

  // Action du joueur (déplacement, attaque...)
  socket.on("player:action", (action, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    const result = handlePlayerAction(session, action);
    if (!result.ok) return callback({ ok: false, error: result.error });

    const state = session.getPublicState();

    try {
      if (session.runId) {
        dbSaveFloor(session.runId, session.etage ?? 1, state.dungeon);
      }
    } catch (err) {
      console.error("[player:action] Erreur DB :", err.message);
    }

    callback({ ok: true, state });
  });

  // Déconnexion
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

// ─── Démarrage ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));