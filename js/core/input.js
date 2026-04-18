/*
  INPUT.JS
*/

import { movePlayer } from "./player.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if (state.screen === "game") {
      handleGameInput(state, e);
    }

    if (state.screen === "characterCreation") {
      handleCharacterCreationInput(state, e);
    }
  });
}

// --- HANDLERS ---

function handleGameInput(state, e) {
  const { player, dungeon } = state;

  if (!player || !dungeon) return; // sécurité

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

  state.screen = "game";
}
