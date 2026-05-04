/*
  INPUT.JS
  Gère les entrées clavier du joueur.
*/

import { SCREENS, CAMP_OPTIONS } from "./constants.js";
import { socket }                from "./socket.js";
import { handleEquipKeys }       from "../ui/components/equipPanel.js";
import { TRAINABLE_STATS }       from "../ui/training.js";
import { gameData, MATERIALS }   from "./gameData.js";

export function setupInput(state) {
  window.addEventListener("keydown", (e) => {
    if      (state.screen === SCREENS.DUNGEON)            handleDungeonInput(state, e);
    else if (state.screen === SCREENS.CHARACTER_CREATION) handleCharacterCreationInput(state, e);
    else if (state.screen === SCREENS.CAMP)               handleCampInput(state, e);
    else if (state.screen === SCREENS.TRAINING)           handleTrainingInput(state, e);
    else if (state.screen === SCREENS.COMBAT_PREP)        handleCombatPrepInput(state, e);
    else if (state.screen === SCREENS.COMBAT_VIEW)        handleCombatViewInput(state, e);
    else if (state.screen === SCREENS.GAME_OVER)          handleGameOverInput(state, e);
  });
}

// ─── Donjon ───────────────────────────────────────────────────────────────────

function handleDungeonInput(state, e) {
  if (!state.player || !state.dungeon) return;

  if (state.dungeon.pendingConfirm) {
    handleDungeonConfirmInput(state, e);
    return;
  }

  const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const direction = keyMap[e.key];

  if (direction) {
    socket.emit("player:action", { type: "move", direction }, function onMoveResponse(response) {
      if (!response.ok) { console.log(`Déplacement refusé : ${response.error}`); return; }

      if (response.confirm) {
        state.dungeon.pendingConfirm = { ...response.confirm, choice: 1 };
        return;
      }

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

  if (e.key === "ArrowLeft")  { confirm.choice = 0; return; }
  if (e.key === "ArrowRight") { confirm.choice = 1; return; }

  if (e.key === "Enter") {
    if (confirm.choice === 0) {
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

        if (response.specialType === "training") launchTraining(state);
        if (response.specialType === "creature") launchCombatPrep(state, confirm.data);
      });
    } else {
      state.dungeon.pendingConfirm = null;
    }
    return;
  }

  if (e.key === "Escape") state.dungeon.pendingConfirm = null;
}

// ─── Combat préparation ───────────────────────────────────────────────────────

function launchCombatPrep(state, confirmData) {
  const creature = confirmData?.creature;
  if (!creature) { console.error("launchCombatPrep: creature manquante"); return; }

  const creatureIndex = state.dungeon.creatures.findIndex(
    c => c.x === creature.x && c.y === creature.y
  );

  const creatureDef = gameData.bestiary.find(b => b.id === (creature.id ?? "goblin_scout"));
  if (!creatureDef) { console.error(`launchCombatPrep: def introuvable pour id="${creature.id}"`); return; }

  const emptyStrategy = Array.from({ length: 5 }, () => ({ eo: null, na: null, en: null }));

  socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
    state.combat = {
      phase:          "prep",
      creatureIndex,
      creature:       creatureDef,
      inventory:      response.ok ? response.inventory : [],
      strategy:       emptyStrategy,
      selectedMinute: 0,
      selectedRow:    0
    };
    state.screen = SCREENS.COMBAT_PREP;
  });
}

function handleCombatPrepInput(state, e) {
  const combat = state.combat;
  if (!combat) return;

  const selMin = combat.selectedMinute ?? 0;
  const selRow = combat.selectedRow    ?? 0;

  if (e.key === "Escape") {
    state.screen = SCREENS.DUNGEON;
    state.combat = null;
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    combat.selectedRow = (selRow + 1) % 3;
    return;
  }

  if (e.key === "ArrowLeft")  { combat.selectedMinute = Math.max(0, selMin - 1); return; }
  if (e.key === "ArrowRight") { combat.selectedMinute = Math.min(4, selMin + 1); return; }

  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const rowKey  = ["eo", "na", "en"][selRow];
    const current = combat.strategy[selMin]?.[rowKey] ?? 5;
    const newVal  = Math.min(10, Math.max(1, current + (e.key === "ArrowUp" ? 1 : -1)));
    setStrategyValue(combat, selMin, selRow, newVal);
    return;
  }

  if (/^[0-9]$/.test(e.key)) {
    setStrategyValue(combat, selMin, selRow, e.key === "0" ? 10 : parseInt(e.key));
    return;
  }

  if (e.key === "Enter") {
    const s1 = combat.strategy[0];
    if (!s1.eo || !s1.na || !s1.en) { console.warn("Stratégie minute 1 incomplète"); return; }
    launchCombat(state);
  }
}

function setStrategyValue(combat, minute, row, value) {
  const rowKey = ["eo", "na", "en"][row];
  // Minute 1 : dupliquer sur les cases encore vides
  if (minute === 0) {
    for (let m = 0; m < 5; m++) {
      if (!combat.strategy[m]) combat.strategy[m] = { eo: null, na: null, en: null };
      if (combat.strategy[m][rowKey] === null) combat.strategy[m][rowKey] = value;
    }
  }
  if (!combat.strategy[minute]) combat.strategy[minute] = { eo: null, na: null, en: null };
  combat.strategy[minute][rowKey] = value;
}

function launchCombat(state) {
  const combat = state.combat;

  socket.emit("combat:resolve", {
    strategy:      combat.strategy,
    creatureIndex: combat.creatureIndex
  }, function onCombatResolved(response) {
    if (!response.ok) { console.error("Erreur combat:resolve :", response.error); return; }

    if (response.drop) {
      const def = gameData.weapons.find(w => w.code === response.drop.itemCode);
      response.drop.weaponDef = def;
      response.drop.matName   = MATERIALS[response.drop.material]?.name ?? "?";
    }

    const playerHpStart   = state.player.stats.constitution * 2 + state.player.stats.taille;
    const creatureHpStart = combat.creature.stats.constitution * 2 + combat.creature.stats.taille;

    state.combat = {
      ...combat,
      phase:            "view",
      log:              response.log,
      winner:           response.winner,
      playerHpStart,
      playerHpFinal:    response.playerHpFinal,
      playerHpCurrent:  playerHpStart,
      creatureHpStart,
      creatureHpCurrent: creatureHpStart,
      creatureHpFinal:  response.creatureHpFinal,
      currentLineIndex: 0,
      confirmQuit:      false,
      quitChoice:       1,
      drop:             response.drop ?? null
    };

    state.screen = SCREENS.COMBAT_VIEW;
  });
}

// ─── Combat visualisation ────────────────────────────────────────────────────
function handleCombatViewInput(state, e) {
  const combat = state.combat;
  if (!combat) return;
 
  const log    = combat.log ?? [];
  const atEnd  = (combat.currentLineIndex ?? 0) >= log.length - 1;
 
  // ─── Dialog de confirmation ouvert ──────────────────────────────────────
 
  if (combat.confirmQuit) {
    if (e.key === "ArrowLeft")  { combat.quitChoice = 0; return; }
    if (e.key === "ArrowRight") { combat.quitChoice = 1; return; }
 
    if (e.key === "Escape") {
      combat.confirmQuit = false;
      combat.quitChoice  = 1;
      return;
    }
 
    if (e.key === "Enter") {
      if (combat.quitChoice === 0) {
        // Confirme — quitter
        if (combat.winner === "player") {
          state.screen = SCREENS.DUNGEON;
          state.combat = null;
        } else {
          state.gameOver = { etage: state.player.etage ?? 1 };
          state.screen   = SCREENS.GAME_OVER;
          state.combat   = null;
        }
      } else {
        // Annule
        combat.confirmQuit = false;
        combat.quitChoice  = 1;
      }
    }
    return;
  }
 
  // ─── Navigation normale ──────────────────────────────────────────────────
 
  if (e.key !== "Enter") return;
 
  if (!atEnd) {
    combat.currentLineIndex = (combat.currentLineIndex ?? 0) + 1;
    return;
  }
 
  // Fin du log — ouvrir le dialog
  combat.confirmQuit = true;
  combat.quitChoice  = 1; // Non par défaut
}


// ─── Game over ────────────────────────────────────────────────────────────────

function handleGameOverInput(state, e) {
  if (e.key === "Enter") {
    state.screen   = SCREENS.CHARACTER_CREATION;
    state.player   = null;
    state.dungeon  = null;
    state.gameOver = null;
  }
}

// ─── Entraînement ─────────────────────────────────────────────────────────────

function launchTraining(state) {
  state.training = {
    phase:             "select",
    selectedIndex:     0,
    selectedStat:      null,
    animationStart:    null,
    animationDuration: null,
    success:           null,
    devMode:           state.devMode,
    trainingUsed:      !state.devMode && (state.dungeon.training?.used ?? false)
  };
  state.screen = SCREENS.TRAINING;
}

function handleTrainingInput(state, e) {
  const training = state.training;
  if (!training) return;

  switch (training.phase) {
    case "select":
      handleTrainingSelectInput(state, e);
      break;
    case "animating":
      break;
    case "result":
      if (e.key === "Enter") {
        state.training.phase         = "select";
        state.training.selectedIndex = 0;
        state.training.success       = null;
        state.training.chance        = null;
        state.training.roll          = null;
      }
      break;
    default:
      console.error(`handleTrainingInput: phase inconnue "${training.phase}"`);
  }
}

function handleTrainingSelectInput(state, e) {
  const training = state.training;

  function isDisabled(stat) {
    if (stat.sqlKey === null) return true;
    if ((state.player.stats[stat.key] ?? 0) >= 21) return true;
    return false;
  }

  const max = TRAINABLE_STATS.length;

  if (e.key === "ArrowDown") {
    let next = (training.selectedIndex + 1) % max;
    while (isDisabled(TRAINABLE_STATS[next]) && next !== training.selectedIndex) next = (next + 1) % max;
    training.selectedIndex = next;
  }

  if (e.key === "ArrowUp") {
    let prev = (training.selectedIndex - 1 + max) % max;
    while (isDisabled(TRAINABLE_STATS[prev]) && prev !== training.selectedIndex) prev = (prev - 1 + max) % max;
    training.selectedIndex = prev;
  }

  if (e.key === "Enter") {
    if (training.trainingUsed && !state.devMode) return;
    const stat = TRAINABLE_STATS[training.selectedIndex];
    if (!stat || isDisabled(stat)) return;

    const augmentations = state.player.augmentations ?? {};
    const nbAug         = augmentations[stat.sqlKey] ?? 0;
    const duration      = state.devMode ? 0 : 5 * (1 + nbAug);

    training.selectedStat      = stat.sqlKey;
    training.animationStart    = Date.now();
    training.animationDuration = duration;
    training.phase             = "animating";

    setTimeout(function onAnimationEnd() {
      socket.emit("training:attempt", { stat: stat.sqlKey }, function onTrainingResponse(response) {
        if (!response.ok) {
          console.error("Erreur training:attempt :", response.error);
          state.training.phase   = "result";
          state.training.success = false;
          return;
        }
        state.player.augmentations = state.player.augmentations ?? {};
        if (response.success) {
          state.player.augmentations[stat.sqlKey] =
            (state.player.augmentations[stat.sqlKey] ?? 0) + 1;
          state.player.stats[stat.key] = (state.player.stats[stat.key] ?? 0) + 1;
        }
        state.training.trainingUsed = true;
        state.training.success      = response.success;
        state.training.chance       = response.chance;
        state.training.roll         = response.roll;
        state.training.phase        = "result";
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
        camp.mode = "menu"; camp.inventoryIndex = 0; return;
      }
      handleInventoryModeInput(state, e);
    } else if (camp.mode === "equip") {
      handleEquipModeInput(state, e);
    } else {
      if (e.key === "Escape") { camp.mode = "menu"; return; }
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

function handleInventoryModeInput(state, e) {
  const camp = state.camp;
  if (camp.inventoryConfirm) { handleInventoryConfirmInput(state, e); return; }

  const inventory = camp.inventory ?? [];
  const max       = inventory.length;

  if (e.key === "ArrowDown" && camp.inventoryIndex < max - 1) camp.inventoryIndex++;
  if (e.key === "ArrowUp"   && camp.inventoryIndex > 0)       camp.inventoryIndex--;

  if (e.key === "Enter" && max > 0) {
    const item = inventory[camp.inventoryIndex];
    if (!item) { console.error("handleInventoryModeInput: item introuvable", camp.inventoryIndex); return; }
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
      if (!item?.id) { console.error("handleInventoryConfirmInput: item manquant", item); camp.inventoryConfirm = null; return; }
      socket.emit("inventory:drop", { itemId: item.id }, function onDropResponse(response) {
        if (!response.ok) { console.error("Erreur drop :", response.error); return; }
        socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
          if (res.ok) {
            state.camp.inventory      = res.inventory;
            state.camp.inventoryIndex = Math.min(camp.inventoryIndex, res.inventory.length - 1);
          }
        });
      });
    }
    camp.inventoryConfirm       = null;
    camp.inventoryConfirmChoice = 1;
  }
}

function handleEquipModeInput(state, e) {
  function onEquip(itemId, slot, itemCode) {
    socket.emit("inventory:equip", { itemId, slot, itemCode }, function onEquipResponse(response) {
      if (!response.ok) console.error("Erreur equip :", response.error);
      else socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
  }

  function onUnequip(itemId) {
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
    if (!response.ok) { console.error(`Erreur démarrage : ${response.error}`); return; }
    state.dungeon = response.state.dungeon;
    state.player  = response.state.player;
    state.config  = response.state.config;
    state.devMode = response.state.devMode;
    state.screen  = SCREENS.CAMP;
  });
}