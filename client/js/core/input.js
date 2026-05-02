/*
  INPUT.JS
  Gère les entrées clavier du joueur.

  Principe :
  - Actions de jeu (déplacement, attaque) → serveur via Socket.io
  - Navigation UI (menus, sélection) → local uniquement
*/

import { SCREENS, CAMP_OPTIONS } from "./constants.js";
import { socket }                from "./socket.js";
import { handleEquipKeys }       from "../ui/components/equipPanel.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if      (state.screen === SCREENS.DUNGEON)            handleDungeonInput(state, e);
    else if (state.screen === SCREENS.CHARACTER_CREATION) handleCharacterCreationInput(state, e);
    else if (state.screen === SCREENS.CAMP)               handleCampInput(state, e);
  });
}

// ─── Camp ─────────────────────────────────────────────────────────────────────

function handleCampInput(state, e) {
  const camp = state.camp;

  if (camp.mode !== "menu") {
    if (camp.mode === "inventory") {
      if (e.key === "Escape" && !camp.inventoryConfirm) {
        camp.mode           = "menu";
        camp.inventoryIndex = 0;
        return;
      }
      handleInventoryModeInput(state, e);
    } else if (camp.mode === "equip") {
      handleEquipModeInput(state, e);
    } else {
      if (e.key === "Escape") {
        camp.mode = "menu";
        return;
      }
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
      socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory      = response.inventory;
        state.camp.inventoryIndex = 0;
        state.camp.inventoryConfirm       = null;
        state.camp.inventoryConfirmChoice = 1;
        state.camp.mode           = "inventory";
      });
      break;

    case "equip":
      socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory         = response.inventory;
        state.camp.equipIndex        = 0;
        state.camp.equipSelectedHand = "right";
        state.camp.mode              = "equip";
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

function handleInventoryModeInput(state, e) {
  const camp = state.camp;

  // ─── Mode confirmation ────────────────────────────────────────────────────
  if (camp.inventoryConfirm) {
    handleInventoryConfirmInput(state, e);
    return;
  }

  // ─── Navigation normale ───────────────────────────────────────────────────
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
    if (!item) {
      console.error("handleInventoryModeInput: item introuvable à l'index", camp.inventoryIndex);
      return;
    }
    // Ouvrir confirmation seulement si l'item n'est pas équipé
    if (!item.equipped && !item.equippedSlot) {
      camp.inventoryConfirm       = item;
      camp.inventoryConfirmChoice = 1; // Non par défaut
    }
  }
}

function handleInventoryConfirmInput(state, e) {
  const camp = state.camp;

  if (e.key === "ArrowLeft") {
    camp.inventoryConfirmChoice = 0; // Oui
  }

  if (e.key === "ArrowRight") {
    camp.inventoryConfirmChoice = 1; // Non
  }

  if (e.key === "Enter") {
    if (camp.inventoryConfirmChoice === 0) {
      // Confirme la suppression
      const item = camp.inventoryConfirm;
      if (!item?.id) {
        console.error("handleInventoryConfirmInput: item ou id manquant", item);
        camp.inventoryConfirm = null;
        return;
      }
      socket.emit("inventory:drop", { itemId: item.id }, function onDropResponse(response) {
        if (!response.ok) {
          console.error("Erreur drop :", response.error);
        } else {
          socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
            if (res.ok) {
              state.camp.inventory      = res.inventory;
              state.camp.inventoryIndex = Math.min(camp.inventoryIndex, res.inventory.length - 1);
            }
          });
        }
      });
    }
    // Dans les deux cas (Oui ou Non) — fermer le dialog
    camp.inventoryConfirm       = null;
    camp.inventoryConfirmChoice = 1;
  }

  // Échap ne fait rien en mode confirmation (intentionnel)
}

// ─── Équiper ──────────────────────────────────────────────────────────────────

function handleEquipModeInput(state, e) {

  function onEquip(itemId, slot, itemCode) {
    socket.emit("inventory:equip", { itemId, slot, itemCode }, function onEquipResponse(response) {
      if (!response.ok) console.error("Erreur equip :", response.error);
      else socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
  }

  function onUnequip(itemId, slot) {
    socket.emit("inventory:unequip", { itemId }, function onUnequipResponse(response) {
      if (!response.ok) console.error("Erreur unequip :", response.error);
      else socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
  }

  function onEscape() {
    state.camp.mode              = "menu";
    state.camp.equipIndex        = 0;
    state.camp.equipSelectedHand = "right";
  }

  handleEquipKeys(e, state.camp, onEquip, onUnequip, onEscape);
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
    socket.emit("player:action", { type: "move", direction }, function onMoveResponse(response) {
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
  socket.emit("game:start", { candidate }, function onGameStartResponse(response) {
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