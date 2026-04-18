/*
  UPDATE.JS

  Gère la logique du jeu à chaque frame
*/

export function update(state) {
  switch (state.screen) {
    case "menu":
      updateMenu(state);
      break;

    case "characterCreation":
      updateCharacterCreation(state);
      break;

    case "game":
      updateGame(state);
      break;

    default:
      console.warn("Unknown screen:", state.screen);
  }
}

// --- STATES ---

function updateMenu(state) {
  // rien pour l'instant
}

function updateCharacterCreation(state) {
  // rien pour l'instant
}

function updateGame(state) {
  // rien pour l'instant
}
