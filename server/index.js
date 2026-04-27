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

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Sert les fichiers statiques du client
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
    console.log(`[game:start] session créée pour ${socket.id}`);
    callback({ ok: true, state: session.getPublicState() });
  });

  // Action du joueur (déplacement, attaque...)
  socket.on("player:action", (action, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    const result = handlePlayerAction(session, action);
    if (!result.ok) return callback({ ok: false, error: result.error });

    callback({ ok: true, state: session.getPublicState() });
    // Future multijoueur : socket.to(session.roomId).emit("game:state", ...)
  });

  // Déconnexion
  socket.on("disconnect", () => {
    deleteSession(socket.id);
    console.log(`[-] Joueur déconnecté : ${socket.id}`);
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));
