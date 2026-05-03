/*
  GAME RENDERER
  Gère l'affichage selon l'état du jeu.
*/

import { SCREENS }               from "../core/constants.js";
import { drawDungeon }           from "./render.js";
import { drawCamp }              from "./camp.js";
import { drawCharacterCreation } from "./characterCreation.js";
import { drawTraining }          from "./training.js";

export function renderGame(state) {
  const { ctx, dungeon, player, screen, characterCreation } = state;

  switch (screen) {
    case SCREENS.CHARACTER_CREATION:
      drawCharacterCreation(ctx, characterCreation.candidates, characterCreation.selectedIndex);
      break;

    case SCREENS.DUNGEON:
      drawDungeon(ctx, dungeon, player, state.config);
      break;

    case SCREENS.CAMP:
      drawCamp(ctx, player, state.camp);
      break;

    case SCREENS.TRAINING:
      drawTraining(ctx, state.training, player);
      break;

    default:
      console.warn("Unknown screen:", screen);
  }
}