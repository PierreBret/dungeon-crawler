/*
  INIT.JS
  Point d'initialisation du jeu.

  Responsabilités :
  - Créer le canvas (taille adaptée à l'écran)
  - Initialiser l'état local (UI uniquement)
  - Demander les candidats au serveur via Socket.io

  Note : TILE_SIZE n'est plus défini ici.
  Il est calculé dynamiquement dans render.js à partir de state.config,
  qui est reçu du serveur lors du game:start.
*/

import { SCREENS }              from "./constants.js";
import { socket }               from "./socket.js";
import { getRandomAvatarPaths } from "./assets.js";

export function initGame() {
  console.log("Lancement du jeu...");

  // --- CANVAS ---
  // Le canvas prend tout l'espace disponible.
  // La taille des tuiles sera calculée dynamiquement dans render.js
  // à partir des dimensions du donjon reçues du serveur.
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");

  canvas.width  = window.innerWidth  - 60;
  canvas.height = window.innerHeight - 150;

  canvas.style.width  = canvas.width  + "px";
  canvas.style.height = canvas.height + "px";

  // --- STATE LOCAL ---
  const state = {
    ctx,
    screen: SCREENS.CHARACTER_CREATION,
    camp: {
      mode:          "menu",
      selectedIndex: 0
    },
    dungeon:  null,
    player:   null,
    config:   null, // reçu du serveur via game:start
    characterCreation: {
      candidates:    [],
      selectedIndex: 0
    }
  };

  // --- DEMANDE DES CANDIDATS AU SERVEUR ---
  // Le serveur génère les stats, le client assigne les avatars
  socket.emit("game:candidates", { count: 3 }, (response) => {
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
