/*
  INPUT.JS
*/

import { movePlayer } from "./player.js";
import { SCREENS } from "./constants.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if (state.screen === SCREENS.DUNGEON) {
      handleDungeonInput(state, e);
    } else if (state.screen === SCREENS.CHARACTER_CREATION) {
      handleCharacterCreationInput(state, e);
    } else if (state.screen === SCREENS.CAMP) {
      handleCampInput(state, e);
    }
  });
}

// --- HANDLERS ---
function handleCampInput(state, e) {
  if (e.key === "c" || e.key === "C") {
    state.screen = SCREENS.DUNGEON; // exploration
  }

  if (e.key === "a" || e.key === "A") {
    // reset / abandon
    state.screen = SCREENS.CHARACTER_CREATION;
  }
}

function handleDungeonInput(state, e) {
  const { player, dungeon } = state;

  if (!player || !dungeon) return; // sécurité

  console.log("KEY:", e.key, "SCREEN:", state.screen);
  switch (e.key) {
    case "ArrowUp":
      movePlayer(player, dungeon, 0, -1);
      break;

    case "ArrowDown":
      movePlayer(player, dungeon, 0, 1);
      break;

    case "ArrowLeft":
      movePlayer(player, dungeon, -1, 0);
      break;

    case "ArrowRight":
      movePlayer(player, dungeon, 1, 0);
      break;

    case "c":
    case "C":
      state.screen = SCREENS.CAMP;
      break;
  }
}

function handleCharacterCreationInput(state, e) {
  const cc = state.characterCreation;

  if (e.key === "ArrowRight") {
    cc.selectedIndex = (cc.selectedIndex + 1) % cc.candidates.length;
  }

  if (e.key === "ArrowLeft") {
    cc.selectedIndex =
      (cc.selectedIndex - 1 + cc.candidates.length) % cc.candidates.length;
  }

  if (e.key === "Enter") {
    selectCandidate(state, cc.candidates[cc.selectedIndex]);
  }
}

import { createPlayer } from "./player.js";
import { generateDungeon } from "./dungeon.js";

function selectCandidate(state, candidate) {
  const dungeon = generateDungeon(20, 30, 0.3);

  state.dungeon = dungeon;
  state.player = createPlayer(candidate, dungeon);

  state.screen = SCREENS.CAMP; // transition vers camp
}
