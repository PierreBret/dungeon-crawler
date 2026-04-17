console.log("Lancement du jeu...");

import { generateDungeon } from "./core/dungeon.js";
import { createPlayer, movePlayer } from "./core/player.js";
import { draw } from "./ui/render.js";

// CONFIG
const TILE_SIZE = 32;
const ROWS = 20;
const COLS = 30;
const EXTRA_PATHS = 0.3;

// CANVAS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = (COLS - 1) * TILE_SIZE;
canvas.height = (ROWS - 1) * TILE_SIZE;

console.log("canvas prêt : " + canvas.width + "x" + canvas.height);

// INIT
const dungeon = generateDungeon(ROWS, COLS, EXTRA_PATHS);
const player = createPlayer(dungeon);

// DRAW INITIAL
draw(ctx, dungeon, player, TILE_SIZE);

console.log("draw initial effectué - prêt pour les entrées clavier");

// INPUT
document.addEventListener("keydown", (e) => {
  let dx = 0;
  let dy = 0;

  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;

  movePlayer(player, dx, dy, dungeon);

  draw(ctx, dungeon, player, TILE_SIZE);
});
