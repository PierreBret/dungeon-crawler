/*
  INPUT.JS
  Gère les entrées clavier du joueur.
*/

import { SCREENS, CAMP_OPTIONS, MATERIALS } from "./constants.js";
import { socket }                from "./socket.js";
import { handleEquipKeys }       from "../ui/components/equipPanel.js";
import { handleArmorEquipKeys }  from "../ui/components/equiparmorpanel.js";
import { handleForgeKeys }       from "../ui/components/forgepanel.js";
import { TRAINABLE_STATS }       from "../ui/training.js";
import { gameData, getArmorName }              from "./gameData.js";

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

  // Notification de trésor affichée — Enter pour fermer
  if (state.treasureDrop) {
    if (e.key === "Enter") state.treasureDrop = null;
    return;
  }

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

      // Combat automatique déclenché par une créature
      if (response.creatureCombat) {
        const ci = response.creatureCombat.creatureIndex;
        const creature = state.dungeon.creatures[ci];
        launchCombatPrep(state, { creature });
      }
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

        // Combat automatique déclenché par une créature (prioritaire)
        if (response.creatureCombat) {
          const ci = response.creatureCombat.creatureIndex;
          const creature = state.dungeon.creatures[ci];
          launchCombatPrep(state, { creature });
          return;
        }

        if (response.specialType === "training") launchTraining(state);
        if (response.specialType === "creature") launchCombatPrep(state, confirm.data);
        if (response.specialType === "forge")    launchForge(state);
        if (response.specialType === "treasure") launchTreasure(state);
        if (response.specialType === "exit")     launchNextFloor(state);
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
      if (response.drop.itemType === "armor") {
        response.drop.armorName = getArmorName(response.drop.slot, response.drop.tier) ?? `Armure T${response.drop.tier}`;
      } else {
        const def = gameData.weapons.find(w => w.code === response.drop.itemCode);
        response.drop.weaponDef = def;
        response.drop.matName   = MATERIALS[response.drop.material]?.name ?? "?";
      }
    }

    const playerHpStart   = response.playerHpStart ?? response.playerHpMax ?? (state.player.stats.constitution * 2 + state.player.stats.taille);
    const creatureHpStart = response.creatureHpStart ?? response.creatureHpMax ?? (combat.creature.stats.constitution * 2 + combat.creature.stats.taille);

    state.combat = {
      ...combat,
      phase:            "view",
      log:              response.log,
      winner:           response.winner,
      playerHpStart,
      playerHpMax:      response.playerHpMax ?? playerHpStart,
      playerHpFinal:    response.playerHpFinal,
      playerHpCurrent:  playerHpStart,
      creatureHpStart,
      creatureHpMax:    response.creatureHpMax ?? creatureHpStart,
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
        // Mettre à jour les HP du joueur
        state.player.hp    = combat.playerHpFinal;
        state.player.hpMax = combat.playerHpMax ?? state.player.hpMax;

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
    // Avancer jusqu'à la prochaine ligne vide (marqueur de flushLogs)
    let idx = (combat.currentLineIndex ?? 0) + 1;
    while (idx < log.length - 1 && log[idx].text !== '') {
      idx++;
    }
    combat.currentLineIndex = idx;
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

function launchForge(state) {
  socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
    if (!response.ok) { console.error("Erreur inventaire :", response.error); return; }
    state.camp.inventory     = response.inventory;
    state.camp.forgeIndex    = 0;
    state.camp.forgeScroll   = 0;
    state.camp.forgeSelected = [];
    state.camp.forgePreview  = null;
    state.camp.mode          = "forge";
    state.screen             = SCREENS.CAMP;
  });
}

function launchTreasure(state) {
  socket.emit("treasure:loot", {}, function onTreasureLoot(response) {
    if (!response.ok) { console.error("Erreur treasure:loot :", response.error); return; }

    if (response.drop) {
      if (response.drop.itemType === "armor") {
        response.drop.armorName = getArmorName(response.drop.slot, response.drop.tier) ?? `Armure T${response.drop.tier}`;
      } else {
        const def = gameData.weapons.find(w => w.code === response.drop.itemCode);
        response.drop.weaponDef = def;
        response.drop.matName   = MATERIALS[response.drop.material]?.name ?? "?";
      }
    }

    // Marquer le trésor comme récupéré côté client
    if (state.dungeon.treasure) state.dungeon.treasure.looted = true;

    state.treasureDrop = response.drop ?? null;
  });
}

function launchNextFloor(state) {
  socket.emit("dungeon:next", {}, function onNextFloor(response) {
    if (!response.ok) { console.error("Erreur dungeon:next :", response.error); return; }
    state.dungeon = response.state.dungeon;
    state.player  = response.state.player;
    state.config  = response.state.config;
  });
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
    if (camp.mode === "equip") {
      handleEquipModeInput(state, e);
    } else if (camp.mode === "equipArmor") {
      handleArmorEquipModeInput(state, e);
    } else if (camp.mode === "forge") {
      handleForgeModeInput(state, e);
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
    case "equipWeapon":
      socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory         = response.inventory;
        state.camp.equipIndex        = 0;
        state.camp.equipSelectedHand = "right";
        state.camp.mode              = "equip";
      });
      break;
    case "equipArmor":
      socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory        = response.inventory;
        state.camp.armorIndex       = 0;
        state.camp.armorScroll      = 0;
        state.camp.armorSelectedSlot = "tete";
        state.camp.mode             = "equipArmor";
      });
      break;
    case "forge":
      socket.emit("inventory:get", {}, function onInventoryLoaded(response) {
        if (!response.ok) return console.error("Erreur inventaire :", response.error);
        state.camp.inventory     = response.inventory;
        state.camp.forgeIndex    = 0;
        state.camp.forgeScroll   = 0;
        state.camp.forgeSelected = [];
        state.camp.forgePreview  = null;
        state.camp.mode          = "forge";
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

  function onDrop(itemId) {
    socket.emit("inventory:drop", { itemId }, function onDropResponse(response) {
      if (!response.ok) { console.error("Erreur drop :", response.error); return; }
      socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) {
          state.camp.inventory   = res.inventory;
          state.camp.equipIndex  = Math.min(state.camp.equipIndex, Math.max(0, res.inventory.length - 1));
        }
      });
    });
  }

  handleEquipKeys(e, state.camp, onEquip, onUnequip, onEscape, onDrop);
}

function handleArmorEquipModeInput(state, e) {
  function onEquip(itemId, slot) {
    socket.emit("inventory:equip", { itemId, slot }, function onEquipResponse(response) {
      if (!response.ok) console.error("Erreur equip armor :", response.error);
      else socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
  }

  function onUnequip(itemId) {
    socket.emit("inventory:unequip", { itemId }, function onUnequipResponse(response) {
      if (!response.ok) console.error("Erreur unequip armor :", response.error);
      else socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) state.camp.inventory = res.inventory;
      });
    });
  }

  function onEscape() {
    state.camp.mode             = "menu";
    state.camp.armorIndex       = 0;
    state.camp.armorScroll      = 0;
    state.camp.armorSelectedSlot = "tete";
  }

  function onDrop(itemId) {
    socket.emit("inventory:drop", { itemId }, function onDropResponse(response) {
      if (!response.ok) { console.error("Erreur drop :", response.error); return; }
      socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) {
          state.camp.inventory  = res.inventory;
          state.camp.armorIndex = Math.min(state.camp.armorIndex, Math.max(0, res.inventory.length - 1));
        }
      });
    });
  }

  handleArmorEquipKeys(e, state.camp, onEquip, onUnequip, onEscape, onDrop);
}

function handleForgeModeInput(state, e) {
  function onPreview(itemIdA, itemIdB) {
    socket.emit("forge:preview", { itemIdA, itemIdB }, function onPreviewResponse(response) {
      state.camp.forgePreview = response;
    });
  }

  function onConfirm(itemIdA, itemIdB) {
    socket.emit("forge:confirm", { itemIdA, itemIdB }, function onConfirmResponse(response) {
      if (!response.ok) { console.error("Erreur forge:confirm :", response.error); return; }
      // Recharger l'inventaire et réinitialiser la sélection
      socket.emit("inventory:get", {}, function onInventoryRefresh(res) {
        if (res.ok) {
          state.camp.inventory     = res.inventory;
          state.camp.forgeIndex    = 0;
          state.camp.forgeScroll   = 0;
          state.camp.forgeSelected = [];
          state.camp.forgePreview  = null;
        }
      });
    });
  }

  function onEscape() {
    state.camp.mode          = "menu";
    state.camp.forgeIndex    = 0;
    state.camp.forgeScroll   = 0;
    state.camp.forgeSelected = [];
    state.camp.forgePreview  = null;
  }

  handleForgeKeys(e, state.camp, onPreview, onConfirm, onEscape);
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