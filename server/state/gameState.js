/*
  SERVER/STATE/GAMESTATE.JS
  État autoritaire du jeu — côté serveur uniquement.
  Le client ne reçoit que getPublicState() — jamais l'objet complet.
*/

import { createPlayer }    from "../game/player.js";
import { generateDungeon } from "../game/world.js";

// Sessions actives : Map<socketId, GameSession>
const sessions = new Map();

// ─── Classe GameSession ───────────────────────────────────────────────────────

class GameSession {
  constructor(socketId, candidate) {
    this.socketId  = socketId;
    this.dungeon   = generateDungeon();
    this.player    = createPlayer(candidate, this.dungeon);
    this.screen    = "dungeon";
    this.turn      = 0;
    this.combatLog = [];
  }

  getPublicState() {
    return {
      dungeon: this.dungeon,
      player: {
        name:       this.player.name,
        avatarPath: this.player.avatarPath,
        stats:      this.player.stats,
        position:   this.player.position
      },
      screen:    this.screen,
      turn:      this.turn,
      combatLog: this.combatLog.slice(-20),
      // Dimensions jouables (sans les bordures de génération)
      config: {
        rows: this.dungeon.length - 2,
        cols: this.dungeon[0].length - 2
      }
    };
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export function createSession(socketId, candidate) {
  const session = new GameSession(socketId, candidate);
  sessions.set(socketId, session);
  return session;
}

export function getSession(socketId) {
  return sessions.get(socketId) ?? null;
}

export function deleteSession(socketId) {
  sessions.delete(socketId);
}
