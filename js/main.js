/*
  MAIN.JS

  Point d’entrée du jeu.

  Rôle :
  - Initialise le canvas
  - Charge le joueur et le donjon
  - Gère les inputs clavier
  - Gère les états du jeu (EXPLORE / CAMP)
  - Orchestre les appels entre CORE et UI
*/

console.log("Lancement du jeu...");

import { generateDungeon } from "./core/dungeon.js";
import { createPlayer, movePlayer } from "./core/player.js";
import { draw } from "./ui/render.js";
import { drawCamp } from "./ui/camp.js";
import { drawCharacterCreation } from "./ui/characterCreation.js";

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
console.log(player.name);

let gameState = "CHARACTER_CREATION";
let playerCreated = false;

function render() {
  if (gameState === "CHARACTER_CREATION") {
    drawCharacterCreation(ctx);
  }

  if (gameState === "EXPLORE") {
    draw(ctx, dungeon, player, TILE_SIZE);
  }

  if (gameState === "CAMP") {
    drawCamp(ctx, player);
  }

}

// DRAW INITIAL
render();

console.log("draw initial effectué - prêt pour les entrées clavier");

// INPUT
document.addEventListener("keydown", (e) => {
  if (gameState === "CHARACTER_CREATION" && e.key === "Enter") {
  playerCreated = true;
  gameState = "CAMP";
  render();
  return;
  }

  if (e.key === "c") {
  gameState = (gameState === "EXPLORE") ? "CAMP" : "EXPLORE";
  render();
  return;
  }
  
  let dx = 0;
  let dy = 0;

  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;

  movePlayer(player, dx, dy, dungeon);

  render();
});
