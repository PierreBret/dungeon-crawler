/*
  GAME RENDERER
  Gère l'affichage selon l'état du jeu.
*/

import { SCREENS }               from "../core/constants.js";
import { drawDungeon }           from "./render.js";
import { drawCamp }              from "./camp.js";
import { drawCharacterCreation } from "./characterCreation.js";
import { drawTraining }          from "./training.js";
import { drawCombatPrep }        from "./combatprep.js";
import { drawCombatView }        from "./combatview.js";
import { drawGameOver }          from "./gameover.js";

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
    case SCREENS.COMBAT_PREP:
      drawCombatPrep(ctx, state.combat, player);
      break;
    case SCREENS.COMBAT_VIEW:
      drawCombatView(ctx, state.combat, player);
      break;
    case SCREENS.GAME_OVER:
      drawGameOver(ctx, state.gameOver, player);
      break;
    default:
      console.warn("Unknown screen:", screen);
  }
}