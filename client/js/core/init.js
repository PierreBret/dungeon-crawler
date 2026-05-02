/*
  INIT.JS
  Point d'initialisation du jeu.

  Responsabilités :
  - Créer le canvas plein écran (100% viewport)
  - Gérer le redimensionnement de la fenêtre
  - Initialiser l'état local (UI uniquement)
  - Demander les candidats au serveur via Socket.io
*/

import { SCREENS }              from "./constants.js";
import { socket }               from "./socket.js";
import { getRandomAvatarPaths } from "./assets.js";

function resizeCanvas(canvas) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width  = canvas.width  + "px";
  canvas.style.height = canvas.height + "px";
}

export function initGame() {
  console.log("Lancement du jeu...");

  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");

  resizeCanvas(canvas);

  // Recalcul automatique — getLayout() est appelé à chaque frame
  window.addEventListener("resize", function onWindowResize() {
    resizeCanvas(canvas);
  });

  const state = {
    ctx,
    screen: SCREENS.CHARACTER_CREATION,
    camp: {
      mode:          "menu",
      selectedIndex: 0
    },
    dungeon:  null,
    player:   null,
    config:   null,
    characterCreation: {
      candidates:    [],
      selectedIndex: 0
    }
  };

  socket.emit("game:candidates", { count: 3 }, function onCandidatesReceived(response) {
    if (!response.ok) {
      console.error("Erreur génération candidats :", response.error);
      return;
    }

    const avatarPaths = getRandomAvatarPaths(response.candidates.length);
    response.candidates.forEach((candidate, i) => {
      candidate.avatarPath = avatarPaths[i];
    });

    state.characterCreation.candidates = response.candidates;
  });

  return state;
}