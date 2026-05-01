/*
  INPUT.JS
  Gère les entrées clavier du joueur.

  Principe :
  - Actions de jeu (déplacement, attaque) → serveur via Socket.io
  - Navigation UI (menus, sélection) → local uniquement
*/

import { SCREENS, CAMP_OPTIONS } from "./constants.js";
import { socket }                from "./socket.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if      (state.screen === SCREENS.DUNGEON)             handleDungeonInput(state, e);
    else if (state.screen === SCREENS.CHARACTER_CREATION)  handleCharacterCreationInput(state, e);
    else if (state.screen === SCREENS.CAMP)                handleCampInput(state, e);
  });
}

// ─── Camp ─────────────────────────────────────────────────────────────────────

function handleCampInput(state, e) {
  const camp = state.camp;

  // Mode inventaire — navigation séparée
  if (camp.mode === "inventory") {
    handleInventoryInput(state, e);
    return;
  }

  const max = CAMP_OPTIONS.length;
  if (e.key === "ArrowDown") camp.selectedIndex = (camp.selectedIndex + 1) % max;
  if (e.key === "ArrowUp")   camp.selectedIndex = (camp.selectedIndex - 1 + max) % max;
  if (e.key === "Enter")     handleCampAction(state, camp.selectedIndex);
}

function handleCampAction(state, index) {
  const action = CAMP_OPTIONS[index].action;

  switch (action) {
    case "explore":
      state.screen = SCREENS.DUNGEON;
      break;

    case "inventory":
      // Charge l'inventaire depuis le serveur puis affiche
      socket.emit("inventory:get", {}, (response) => {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory      = response.inventory;
        state.camp.inventoryIndex = 0;
        state.camp.mode           = "inventory";
      });
      break;

    case "rest":
      state.camp.mode = "rest";
      break;

    case "quit":
      state.screen = SCREENS.CHARACTER_CREATION;
      break;
  }
}

// ─── Inventaire ───────────────────────────────────────────────────────────────

function handleInventoryInput(state, e) {
  const camp      = state.camp;
  const inventory = camp.inventory ?? [];
  const max       = inventory.length;

  if (e.key === "ArrowDown") {
    camp.inventoryIndex = (camp.inventoryIndex + 1) % max;
  }

  if (e.key === "ArrowUp") {
    camp.inventoryIndex = (camp.inventoryIndex - 1 + max) % max;
  }

  if (e.key === "Enter" && max > 0) {
    // TODO : écran d'équipement de l'objet sélectionné
    const item = inventory[camp.inventoryIndex];
    console.log("Objet sélectionné :", item);
  }

  if (e.key === "Escape") {
    camp.mode           = "menu";
    camp.inventoryIndex = 0;
  }
}

// ─── Donjon ───────────────────────────────────────────────────────────────────

function handleDungeonInput(state, e) {
  if (!state.player || !state.dungeon) return;

  const keyMap = {
    ArrowUp:    "up",
    ArrowDown:  "down",
    ArrowLeft:  "left",
    ArrowRight: "right"
  };

  const direction = keyMap[e.key];

  if (direction) {
    socket.emit("player:action", { type: "move", direction }, (response) => {
      if (!response.ok) {
        console.log(`Déplacement refusé : ${response.error}`);
        return;
      }
      state.player.position = response.state.player.position;
    });
  }

  if (e.key === "c" || e.key === "C") {
    state.screen    = SCREENS.CAMP;
    state.camp.mode = "menu";
  }
}

// ─── Création de personnage ───────────────────────────────────────────────────

function handleCharacterCreationInput(state, e) {
  const cc = state.characterCreation;

  if (e.key === "ArrowRight") cc.selectedIndex = (cc.selectedIndex + 1) % cc.candidates.length;
  if (e.key === "ArrowLeft")  cc.selectedIndex = (cc.selectedIndex - 1 + cc.candidates.length) % cc.candidates.length;
  if (e.key === "Enter")      selectCandidate(state, cc.candidates[cc.selectedIndex]);
}

function selectCandidate(state, candidate) {
  socket.emit("game:start", { candidate }, (response) => {
    if (!response.ok) {
      console.error(`Erreur démarrage : ${response.error}`);
      return;
    }
    state.dungeon = response.state.dungeon;
    state.player  = response.state.player;
    state.config  = response.state.config;
    state.screen  = SCREENS.CAMP;
  });
}