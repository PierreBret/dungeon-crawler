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

  // Les modes non-menu reviennent au menu avec Échap
  if (camp.mode !== "menu") {
    if (e.key === "Escape") {
      camp.mode           = "menu";
      camp.inventoryIndex = 0;
      camp.equipIndex     = 0;
      camp.equipSelectedHand = "right";
      return;
    }

    // Chaque mode traite ses propres entrées
    if (camp.mode === "inventory" || camp.mode === "equip") {
      handleInventoryInput(state, e);
    }
    return;
  }

  // Mode menu — navigation des options
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

    case "equip":
      // Charge l'inventaire depuis le serveur puis affiche
      socket.emit("inventory:get", {}, (response) => {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory       = response.inventory;
        state.camp.equipIndex      = 0;
        state.camp.equipSelectedHand = "right";
        state.camp.mode            = "equip";
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

// ─── Inventaire et Équiper ────────────────────────────────────────────────────

function handleInventoryInput(state, e) {
  const camp = state.camp;

  if (camp.mode === "inventory") {
    handleInventoryModeInput(state, e);
  } else if (camp.mode === "equip") {
    handleEquipModeInput(state, e);
  }
}

function handleInventoryModeInput(state, e) {
  const camp      = state.camp;
  const inventory = camp.inventory ?? [];
  const max       = inventory.length;

  if (e.key === "ArrowDown") {
    if (camp.inventoryIndex < max - 1) camp.inventoryIndex++;
  }

  if (e.key === "ArrowUp") {
    if (camp.inventoryIndex > 0) camp.inventoryIndex--;
  }

  if (e.key === "Enter" && max > 0) {
    const item = inventory[camp.inventoryIndex];
    // Jeter seulement si l'item n'est pas équippé
    if (!item.equipped) {
      socket.emit("inventory:drop", { itemId: item.id }, (response) => {
        if (!response.ok) console.error("Erreur drop :", response.error);
        else socket.emit("inventory:get", {}, (res) => {
          if (res.ok) {
            state.camp.inventory = res.inventory;
            state.camp.inventoryIndex = Math.min(camp.inventoryIndex, res.inventory.length - 1);
          }
        });
      });
    }
  }
}

function handleEquipModeInput(state, e) {
  const camp      = state.camp;
  const inventory = camp.inventory ?? [];
  const weapons   = inventory.filter(item => item.itemType === "weapon");
  const max       = weapons.length;

  if (e.key === "Tab") {
    camp.equipSelectedHand = camp.equipSelectedHand === "right" ? "left" : "right";
  }

  if (e.key === "ArrowDown") {
    if (camp.equipIndex < max - 1) camp.equipIndex++;
  }

  if (e.key === "ArrowUp") {
    if (camp.equipIndex > 0) camp.equipIndex--;
  }

  if (e.key === "Enter" && max > 0) {
    const item = weapons[camp.equipIndex];
    const slot = camp.equipSelectedHand === "right" ? "rightHand" : "leftHand";
    socket.emit("inventory:equip", { itemId: item.id, slot }, (response) => {
      if (!response.ok) console.error("Erreur equip :", response.error);
      else socket.emit("inventory:get", {}, (res) => {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
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