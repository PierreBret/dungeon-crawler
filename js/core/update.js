/*
  UPDATE.JS

  Gère la logique du jeu à chaque frame
*/

import { SCREENS } from "./constants.js";

export function update(state) {
  switch (state.screen) {

    case SCREENS.DUNGEON:
      updateDungeon(state);
      break;

    case SCREENS.CAMP:
      updateCamp(state);
      break;

    case SCREENS.CHARACTER_CREATION:
      updateCharacterCreation(state);
      break;
  }
}


// --- STATES ---

function updateCamp(state) {
  // rien pour l'instant
}

function updateCharacterCreation(state) {
  // rien pour l'instant
}

function updateDungeon(state) {
  // logique dungeon
}
