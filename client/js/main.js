/*
  MAIN.JS

  Point d’entrée du jeu.
*/

import { initGame } from "./core/init.js";
import { setupInput } from "./core/input.js";
import { renderGame } from "./ui/gameRenderer.js";
import { update } from "./core/update.js"; // ⚠️ à créer ou adapter

let gameState;

window.onload = () => {
  gameState = initGame();
  setupInput(gameState);
  gameLoop();
  console.log("Jeu initialisé - main loop lancée");
};

function gameLoop() {
  update(gameState);
  render(gameState);
  requestAnimationFrame(gameLoop);
}

function render(state) {
  if (!state.ctx) return;
  renderGame(state);
}
