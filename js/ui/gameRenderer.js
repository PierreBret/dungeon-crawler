/*
  GAME RENDERER.JS

  Gère l'affichage du jeu selon son état
*/

import { draw } from "./render.js";
import { drawCamp } from "./camp.js";
import { drawCharacterCreation } from "./characterCreation.js";

export function renderGame(state) {
  const { ctx, dungeon, player, TILE_SIZE, screen } = state;

  switch (screen) {
    case "characterCreation":
      drawCharacterCreation(
        ctx,
        state.characterCreation.candidates,
        state.characterCreation.selectedIndex
      );
      break;

    case "game":
      draw(ctx, dungeon, player, TILE_SIZE);
      break;

    case "camp":
      drawCamp(ctx, player);
      break;

    case "menu":
      // rien pour l'instant
      break;

    default:
      console.warn("Unknown screen:", screen);
  }
}
