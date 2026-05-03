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
import { TRAINABLE_STATS }       from "../ui/training.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if      (state.screen === SCREENS.DUNGEON)            handleDungeonInput(state, e);
    else if (state.screen === SCREENS.CHARACTER_CREATION) handleCharacterCreationInput(state, e);
    else if (state.screen === SCREENS.CAMP)               handleCampInput(state, e);
    else if (state.screen === SCREENS.TRAINING)           handleTrainingInput(state, e);
  });
}

// ─── Donjon ───────────────────────────────────────────────────────────────────

function handleDungeonInput(state, e) {
  if (!state.player || !state.dungeon) return;

  // Si un dialog de confirmation est en attente — le gérer en priorité
  if (state.dungeon.pendingConfirm) {
    handleDungeonConfirmInput(state, e);
    return;
  }

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

      if (response.confirm) {
        // Case spéciale détectée — stocker pour affichage dialog
        state.dungeon.pendingConfirm = {
          ...response.confirm,
          choice: 1  // Non par défaut
        };
        return;
      }

      // Déplacement normal
      state.player.position = response.state.player.position;
      if (response.state.dungeon) state.dungeon = response.state.dungeon;
    });
  }

  if (e.key === "c" || e.key === "C") {
    state.screen    = SCREENS.CAMP;
    state.camp.mode = "menu";
  }
}

function handleDungeonConfirmInput(state, e) {
  const confirm = state.dungeon.pendingConfirm;
  if (!confirm) return;

  if (e.key === "ArrowLeft") {
    confirm.choice = 0; // Oui
    return;
  }

  if (e.key === "ArrowRight") {
    confirm.choice = 1; // Non
    return;
  }

  if (e.key === "Enter") {
    if (confirm.choice === 0) {
      // Confirme — envoie move:confirm avec la direction mémorisée
      const { dx, dy } = confirm.direction;
      socket.emit("player:action", { type: "move:confirm", dx, dy }, function onConfirmResponse(response) {
        if (!response.ok) {
          console.error("Erreur move:confirm :", response.error);
          state.dungeon.pendingConfirm = null;
          return;
        }

        state.player.position = response.state.player.position;
        if (response.state.dungeon) state.dungeon = response.state.dungeon;
        state.dungeon.pendingConfirm = null;

        // Lancer l'action spéciale selon le type de case
        if (response.specialType === "training") {
          launchTraining(state);
        }
      });
    } else {
      // Annule — le joueur reste sur sa case
      state.dungeon.pendingConfirm = null;
    }
    return;
  }

  // Échap annule aussi
  if (e.key === "Escape") {
    state.dungeon.pendingConfirm = null;
  }
}

// ─── Lancement des actions spéciales ─────────────────────────────────────────

function launchTraining(state) {
  // Initialise l'état de l'écran d'entraînement
  state.training = {
    phase:             "select",
    selectedIndex:     0,
    selectedStat:      null,
    animationStart:    null,
    animationDuration: null,
    success:           null
  };
  state.screen = SCREENS.TRAINING;
}

// ─── Entraînement ─────────────────────────────────────────────────────────────

function handleTrainingInput(state, e) {
  const training = state.training;
  if (!training) return;

  switch (training.phase) {

    case "select":
      handleTrainingSelectInput(state, e);
      break;

    case "animating":
      // Aucune touche acceptée pendant l'animation
      break;

    case "result":
      if (e.key === "Escape") {
        state.screen   = SCREENS.DUNGEON;
        state.training = null;
      }
      break;

    default:
      console.error(`handleTrainingInput: phase inconnue "${training.phase}"`);
  }
}

function handleTrainingSelectInput(state, e) {
  const training      = state.training;
  const augmentations = state.player.augmentations ?? {};

  // Filtrer les stats disponibles (non grisées)
  function isDisabled(stat) {
    if (stat.sqlKey === null) return true;                          // taille
    if ((state.player.stats[stat.key] ?? 0) >= 21) return true;   // stat max
    return false;
  }

  const max = TRAINABLE_STATS.length;

  if (e.key === "ArrowDown") {
    let next = (training.selectedIndex + 1) % max;
    // Sauter les stats grisées
    while (isDisabled(TRAINABLE_STATS[next]) && next !== training.selectedIndex) {
      next = (next + 1) % max;
    }
    training.selectedIndex = next;
  }

  if (e.key === "ArrowUp") {
    let prev = (training.selectedIndex - 1 + max) % max;
    while (isDisabled(TRAINABLE_STATS[prev]) && prev !== training.selectedIndex) {
      prev = (prev - 1 + max) % max;
    }
    training.selectedIndex = prev;
  }

  if (e.key === "Enter") {
    const stat = TRAINABLE_STATS[training.selectedIndex];
    if (!stat || isDisabled(stat)) return;

    const nbAug            = augmentations[stat.sqlKey] ?? 0;
    const duration         = 5 * (1 + nbAug); // secondes

    training.selectedStat      = stat.sqlKey;
    training.animationStart    = Date.now();
    training.animationDuration = duration;
    training.phase             = "animating";

    // Lancer la tentative après la durée de l'animation
    setTimeout(function onAnimationEnd() {
      socket.emit("training:attempt", { stat: stat.sqlKey }, function onTrainingResponse(response) {
        if (!response.ok) {
          console.error("Erreur training:attempt :", response.error);
          state.training.phase = "result";
          state.training.success = false;
          return;
        }

        // Mettre à jour les augmentations localement
        state.player.augmentations = state.player.augmentations ?? {};
        if (response.success) {
          state.player.augmentations[stat.sqlKey] =
            (state.player.augmentations[stat.sqlKey] ?? 0) + 1;
          // Mettre à jour la stat dans player.stats
          state.player.stats[stat.key] = (state.player.stats[stat.key] ?? 0) + 1;
        }

        state.training.success = response.success;
        state.training.chance  = response.chance;
        state.training.roll    = response.roll;
        state.training.phase   = "result";
      });
    }, duration * 1000);
  }

  if (e.key === "Escape") {
    state.screen   = SCREENS.DUNGEON;
    state.training = null;
  }
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
        state.camp.inventory              = response.inventory;
        state.camp.inventoryIndex         = 0;
        state.camp.inventoryConfirm       = null;
        state.camp.inventoryConfirmChoice = 1;
        state.camp.mode                   = "inventory";
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

  if (camp.inventoryConfirm) {
    handleInventoryConfirmInput(state, e);
    return;
  }

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
    if (!item.equipped && !item.equippedSlot) {
      camp.inventoryConfirm       = item;
      camp.inventoryConfirmChoice = 1;
    }
  }
}

function handleInventoryConfirmInput(state, e) {
  const camp = state.camp;

  if (e.key === "ArrowLeft")  camp.inventoryConfirmChoice = 0;
  if (e.key === "ArrowRight") camp.inventoryConfirmChoice = 1;

  if (e.key === "Enter") {
    if (camp.inventoryConfirmChoice === 0) {
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
    camp.inventoryConfirm       = null;
    camp.inventoryConfirmChoice = 1;
  }
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