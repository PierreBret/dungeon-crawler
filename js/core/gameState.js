import { generateDungeon } from "./dungeon.js";
import { createPlayer } from "./player.js";

const ROWS = 15;
const COLS = 20;
const EXTRA_PATHS = 10;

export const gameState = {
  dungeon: generateDungeon(ROWS, COLS, EXTRA_PATHS),
  player: null,
  // mode: "CHARACTER_CREATION",
  mode: "CAMP",
  playerCreated: false
};

// initialisation du joueur séparée
export function initPlayer() {
  gameState.player = createPlayer(gameState.dungeon);
}

// transition vers jeu
export function startGame() {
  gameState.mode = "EXPLORE";
  gameState.playerCreated = true;
}
