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
  constructor(socketId, candidate, bestiary) {
    if (!bestiary?.length) throw new Error("GameSession: bestiary manquant");

    this.socketId      = socketId;
    this.bestiary      = bestiary; // référence pour getSpecialTile dans world.js
    this.dungeon       = generateDungeon(bestiary);
    this.player        = createPlayer(candidate, this.dungeon.grid);
    this.screen        = "dungeon";
    this.turn          = 0;
    this.etage         = 1;
    this.combatLog     = [];
    this.augmentations = {}; // { stat: nbAugmentations }
  }

  getPublicState() {
    return {
      dungeon: {
        grid:      this.dungeon.grid,
        creatures: this.dungeon.creatures,
        forge:     this.dungeon.forge,
        training:  this.dungeon.training,
        exit:      this.dungeon.exit
      },
      player: {
        name:          this.player.name,
        avatarPath:    this.player.avatarPath,
        stats:         this.player.stats,
        position:      this.player.position,
        etage:         this.etage,
        augmentations: this.augmentations
      },
      screen:    this.screen,
      turn:      this.turn,
      combatLog: this.combatLog.slice(-20),
      config: {
        rows: this.dungeon.grid.length - 2,
        cols: this.dungeon.grid[0].length - 2
      }
    };
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export function createSession(socketId, candidate, bestiary) {
  const session = new GameSession(socketId, candidate, bestiary);
  sessions.set(socketId, session);
  return session;
}

export function getSession(socketId) {
  return sessions.get(socketId) ?? null;
}

export function deleteSession(socketId) {
  sessions.delete(socketId);
}