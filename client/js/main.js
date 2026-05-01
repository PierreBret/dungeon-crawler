/*
  MAIN.JS
  Point d'entrée du jeu.
*/

import { initGame }      from "./core/init.js";
import { setupInput }    from "./core/input.js";
import { renderGame }    from "./ui/gameRenderer.js";
import { update }        from "./core/update.js";
import { loadGameData }  from "./core/gameData.js";

let gameState;

window.onload = async () => {
  // Charge les données statiques (armes, armures, boucliers, bestiaire)
  // depuis l'API serveur — source de vérité unique
  await loadGameData();

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