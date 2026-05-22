/*
  SERVER/INDEX.JS
  Point d'entrée du serveur.
*/

import "dotenv/config";
import express           from "express";
import { createServer }  from "http";
import { Server }        from "socket.io";
import { readFileSync }  from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createSession, getSession, deleteSession } from "./state/gameState.js";
import { handlePlayerAction, generateDungeon, findAdjacentCreature } from "./game/world.js";
import { generateCandidate, rollDie, getStartingPosition } from "./game/player.js";
import { resolveCombat }      from "./game/combat.js";
import { computeFusionPreview, areCompatible } from "./game/forge.js";
import { DEV_MODE }           from "./game/variables.js";
import { buildDropTable, generateDrop } from "./game/loot.js";
import { initSchema }         from "./db/schema.js";
import {
  createPlayer              as dbCreatePlayer,
  createRun                 as dbCreateRun,
  createCharacter           as dbCreateCharacter,
  addItem                   as dbAddItem,
  getInventory              as dbGetInventory,
  getCharacter              as dbGetCharacter,
  equipItem                 as dbEquipItem,
  unequipItem               as dbUnequipItem,
  unequipSlot               as dbUnequipSlot,
  removeItem                as dbRemoveItem,
  updateItemAffinities      as dbUpdateItemAffinities,
  updateRunStatut           as dbUpdateRunStatut,
  incrementStat             as dbIncrementStat,
  updateCharacterHpEndurance as dbUpdateCharacterHpEndurance
} from "./db/queries.js";

initSchema();

// ─── Mode développement ───────────────────────────────────────────────────────

console.log(`[Config] DEV_MODE = ${DEV_MODE}`);

const __dirname = dirname(fileURLToPath(import.meta.url));

const app        = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(join(__dirname, "..", "client")));

// ─── Données statiques ────────────────────────────────────────────────────────

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(__dirname, "data", filename), "utf8"));
}

const items    = loadJSON("items.json");
const armors   = loadJSON("armors.json");
const bestiary = loadJSON("bestiary.json");

// Dérivation : armes + boucliers (tout sauf les armures BO/HE/AR/LE)
const armorCodes = ["BO", "HE", "AR", "LE"];
const weapons = items.filter(i => !armorCodes.includes(i.code));

// Table de drop pondérée (poids = nombre de tiers par type d'item)
const dropTable = buildDropTable(items);

app.get("/api/data/items",    (req, res) => res.json(items));
app.get("/api/data/armors",   (req, res) => res.json(armors));
app.get("/api/data/bestiary", (req, res) => res.json(bestiary));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] Joueur connecté : ${socket.id}`);

  socket.on("game:candidates", (data, callback) => {
    if (!data?.count) {
      console.error("[game:candidates] count manquant");
      return callback({ ok: false, error: "count manquant" });
    }
    const candidates = [];
    for (let i = 0; i < data.count; i++) candidates.push(generateCandidate());
    callback({ ok: true, candidates });
  });

  socket.on("game:start", (data, callback) => {
    if (!data?.candidate) {
      console.error("[game:start] candidate manquant");
      return callback({ ok: false, error: "candidate manquant" });
    }

    // bestiary passé à createSession pour generateDungeon
    const session = createSession(socket.id, data.candidate, bestiary);
    const state   = session.getPublicState();
    state.devMode = DEV_MODE;

    try {
      const playerId   = dbCreatePlayer(data.candidate.name);
      const runId      = dbCreateRun(playerId);
      const { stats }  = session.player;

      dbCreateCharacter(runId, stats, 0, 0);

      if (DEV_MODE) {
        for (const weapon of weapons) {
          dbAddItem(runId, {
            itemType: "weapon", itemCode: weapon.code,
            tier: 1, material: 0,
            affinities: { bestial: 0, elementaire: 0, gigante: 0, theriomorphe: 0, reptilien: 0, eidolon: 0, primordial: 0 },
            equipped: 0, equippedSlot: null
          });
        }
        // Armures tier 1 — une par slot
        for (const slot of ["tete", "corps", "bras", "jambes"]) {
          dbAddItem(runId, {
            itemType: "armor", slot,
            tier: 1, material: 0,
            affinities: { bestial: 0, elementaire: 0, gigante: 0, theriomorphe: 0, reptilien: 0, eidolon: 0, primordial: 0 },
            equipped: 0, equippedSlot: null
          });
        }
      } else {
        dbAddItem(runId, {
          itemType: "weapon", itemCode: "SH",
          tier: 1, material: 0,
          affinities: { bestial: 0, elementaire: 0, gigante: 0, theriomorphe: 0, reptilien: 0, eidolon: 0, primordial: 0 },
          equipped: 0, equippedSlot: null
        });
      }

      session.playerId = playerId;
      session.runId    = runId;
      session.etage    = 1;

      console.log(`[game:start] playerId:${playerId} runId:${runId} DEV_MODE:${DEV_MODE}`);
    } catch (err) {
      console.error("[game:start] Erreur DB :", err.message);
    }

    callback({ ok: true, state });
  });

  socket.on("inventory:get", (data, callback) => {
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      callback({ ok: true, inventory: dbGetInventory(session.runId) });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:equip", (data, callback) => {
    if (!data.itemId || !data.slot) {
      console.error("[inventory:equip] données manquantes :", data);
      return callback({ ok: false, error: "données manquantes" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbUnequipSlot(session.runId, data.slot);
      const weaponDef = weapons.find(w => w.code === data.itemCode);
      if (weaponDef?.hd === 2) dbUnequipSlot(session.runId, "leftHand");
      dbEquipItem(data.itemId, data.slot);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:unequip", (data, callback) => {
    if (!data.itemId) {
      console.error("[inventory:unequip] itemId manquant :", data);
      return callback({ ok: false, error: "itemId manquant" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbUnequipItem(data.itemId);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("inventory:drop", (data, callback) => {
    if (!data.itemId) {
      console.error("[inventory:drop] itemId manquant :", data);
      return callback({ ok: false, error: "itemId manquant" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      dbRemoveItem(data.itemId);
      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("forge:preview", (data, callback) => {
    if (!data.itemIdA || !data.itemIdB) {
      return callback({ ok: false, error: "2 IDs requis" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      const inventory = dbGetInventory(session.runId);
      const itemA = inventory.find(i => i.id === data.itemIdA);
      const itemB = inventory.find(i => i.id === data.itemIdB);
      if (!itemA || !itemB) return callback({ ok: false, error: "Objet introuvable" });
      const preview = computeFusionPreview(itemA, itemB);
      callback(preview);
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("forge:confirm", (data, callback) => {
    if (!data.itemIdA || !data.itemIdB) {
      return callback({ ok: false, error: "2 IDs requis" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });
    try {
      const inventory = dbGetInventory(session.runId);
      const itemA = inventory.find(i => i.id === data.itemIdA);
      const itemB = inventory.find(i => i.id === data.itemIdB);
      if (!itemA || !itemB) return callback({ ok: false, error: "Objet introuvable" });
      const preview = computeFusionPreview(itemA, itemB);
      if (!preview.ok) return callback(preview);

      // Supprimer les 2 objets
      dbRemoveItem(data.itemIdA);
      dbRemoveItem(data.itemIdB);

      // Créer l'objet résultant
      const newItem = {
        itemType:    preview.result.itemType,
        itemCode:    preview.result.itemCode ?? null,
        slot:        preview.result.slot ?? null,
        tier:        preview.result.tier,
        material:    preview.result.material ?? 0,
        affinities:  preview.result.affinities ?? { bestial: 0, elementaire: 0, gigante: 0, theriomorphe: 0, reptilien: 0, eidolon: 0, primordial: 0 },
        equipped:    0,
        equippedSlot: null
      };
      dbAddItem(session.runId, newItem);

      callback({ ok: true, result: preview.result });
    } catch (err) {
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("player:action", (action, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    const result = handlePlayerAction(session, action);
    if (!result.ok) return callback({ ok: false, error: result.error });

    if (result.confirm) {
      return callback({ ok: true, confirm: result.confirm });
    }

    const state = session.getPublicState();

    // Combat automatique déclenché par une créature qui atteint le joueur
    if (result.creatureCombat !== undefined) {
      const creature = session.dungeon.creatures[result.creatureCombat];
      const creatureDef = bestiary.find(b => b.id === creature.id);
      const name = creatureDef?.nameFr ?? "une créature";
      return callback({
        ok: true,
        state,
        specialType: result.specialType ?? null,
        creatureCombat: {
          creatureIndex: result.creatureCombat,
          label: `${name} vous attaque !`
        }
      });
    }

    callback({ ok: true, state, specialType: result.specialType ?? null });
  });

  socket.on("creature:scan", (data, callback) => {
    const session = getSession(socket.id);
    if (!session) return callback({ ok: false, error: "Session introuvable" });

    const playerX = session.player.position.x;
    const playerY = session.player.position.y;
    const creatureIdx = findAdjacentCreature(session.dungeon, playerX, playerY);

    if (creatureIdx === -1) {
      return callback({ ok: false, error: "Aucune créature adjacente" });
    }

    const creature = session.dungeon.creatures[creatureIdx];
    const creatureDef = bestiary.find(function findById(b) { return b.id === creature.id; });

    if (!creatureDef) {
      console.error(`[creature:scan] Def introuvable pour id="${creature.id}"`);
      return callback({ ok: false, error: "Créature inconnue" });
    }

    // Marquer la créature comme scannée
    creature.scanned = true;

    callback({
      ok: true,
      creatureIndex: creatureIdx,
      nameFr: creatureDef.nameFr,
      description: creatureDef.description,
      emoji: creatureDef.emoji
    });
  });

  socket.on("treasure:loot", (data, callback) => {
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    const treasure = session.dungeon.treasure;
    if (!treasure || treasure.looted) return callback({ ok: false, error: "Trésor déjà récupéré" });

    treasure.looted = true;

    const drop = generateDrop(dropTable);
    dbAddItem(session.runId, { ...drop, equipped: 0, equippedSlot: null });

    callback({ ok: true, drop });
  });

  socket.on("dungeon:next", (data, callback) => {
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    session.etage = (session.etage ?? 1) + 1;
    session.dungeon = generateDungeon(bestiary, session.etage);
    session.player.position = getStartingPosition(session.dungeon.grid);
    session.turn = 0;

    const state = session.getPublicState();

    callback({ ok: true, state });
  });

  socket.on("training:attempt", (data, callback) => {
    if (!data.stat) {
      console.error("[training:attempt] stat manquante");
      return callback({ ok: false, error: "stat manquante" });
    }
    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    // En mode normal, un seul entraînement par terrain
    if (!DEV_MODE && session.dungeon.training?.used) {
      return callback({ ok: false, error: "Terrain d'entraînement déjà utilisé" });
    }

    try {
      const character     = dbGetCharacter(session.runId);
      const augmentations = JSON.parse(character.augmentations ?? "{}");
      const nbAug         = augmentations[data.stat] ?? 0;
      const chanceBase    = ((character.volonte - 3) / 18) * 50 + 50;
      const chance        = Math.floor(chanceBase / Math.pow(2, nbAug));
      const roll          = rollDie(1, 100);
      const success       = roll <= chance;

      if (success) {
        augmentations[data.stat] = nbAug + 1;
        dbIncrementStat(session.runId, data.stat, augmentations);
        const statKey = data.stat === "volonte" ? "volonté" : data.stat;
        session.player.stats[statKey] = (session.player.stats[statKey] ?? 0) + 1;
        session.augmentations = augmentations;
      }

      // Marquer le terrain comme utilisé
      if (!DEV_MODE && session.dungeon.training) {
        session.dungeon.training.used = true;
      }

      callback({ ok: true, success, chance, roll });
    } catch (err) {
      console.error("[training:attempt] Erreur :", err.message);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("combat:resolve", (data, callback) => {
    if (!data.tactic && !data.strategy) {
      console.error("[combat:resolve] tactic manquante");
      return callback({ ok: false, error: "tactic manquante" });
    }
    if (data.creatureIndex === undefined) {
      console.error("[combat:resolve] creatureIndex manquant");
      return callback({ ok: false, error: "creatureIndex manquant" });
    }

    const session = getSession(socket.id);
    if (!session?.runId) return callback({ ok: false, error: "Session introuvable" });

    try {
      const creature = session.dungeon.creatures[data.creatureIndex];
      if (!creature)         return callback({ ok: false, error: "Créature introuvable" });
      if (creature.defeated) return callback({ ok: false, error: "Créature déjà vaincue" });

      const creatureDef = bestiary.find(b => b.id === creature.id);
      if (!creatureDef)  return callback({ ok: false, error: `Def introuvable pour id="${creature.id}"` });

      // Armes de la créature (main droite = arme principale, main gauche = arme secondaire)
      const creatureWeaponDef  = weapons.find(w => w.code === creatureDef.equipment?.rightHand?.code);
      const creatureWeaponDefL = creatureDef.equipment?.leftHand
        ? weapons.find(w => w.code === creatureDef.equipment.leftHand.code)
        : null;

      // HP joueur depuis BDD (0 = premier combat → le moteur utilisera hpMax)
      const character  = dbGetCharacter(session.runId);
      const playerHp   = character.hp;

      // HP créature (toujours plein — le moteur utilisera hpMax)
      const creatureHp = 0;

      // Arme équipée du joueur
      const inventory       = dbGetInventory(session.runId);
      const equippedItem    = inventory.find(i => i.equippedSlot === "rightHand");
      const playerWeaponDef = equippedItem
        ? weapons.find(w => w.code === equippedItem.itemCode)
        : null;

      // Arme par défaut (mains nues) si aucune arme équipée
      const defaultWeaponDef = { code: "FIST", typeArme: "Mains nues", dist: 1, weight: 0, damFirst: 3, damLast: 8, models: ["Mains nues"], weightFO: 1, weightTA: 0.5, weightIN: 0, weightVI: 0.5, weightAD: 1 };

      // Normaliser la tactique joueur (tableau [{EO, NA, EN}])
      const rawTactic = data.tactic ?? data.strategy;
      const normalizedTactic = [{
        EO: rawTactic?.EO ?? rawTactic?.eo ?? 5,
        NA: rawTactic?.NA ?? rawTactic?.na ?? 5,
        EN: rawTactic?.EN ?? rawTactic?.en ?? 5
      }];

      const playerData = {
        name:       session.player.name,
        stats:      session.player.stats,
        hp:         playerHp,
        tactic:     normalizedTactic,
        weaponDef:  playerWeaponDef ?? defaultWeaponDef,
        weaponItem: equippedItem ?? { tier: 1, material: 0, affinities: {} },
        equipment:  null,  // armures non implémentées
        scanMalus:  !creature.scanned
      };

      const creatureData = {
        nameFr:    creatureDef.nameFr,
        stats:     creatureDef.stats,
        hp:        creatureHp,
        weaponDef:   creatureWeaponDef ?? defaultWeaponDef,
        weaponItem:  creatureDef.equipment?.rightHand ?? { tier: 1, material: 0, affinities: {} },
        weaponDefL:  creatureWeaponDefL ?? null,
        weaponItemL: creatureDef.equipment?.leftHand ?? null,
        equipment: creatureDef.equipment,
        tactic:    creatureDef.tactic ?? creatureDef.strategy,
        family:    creatureDef.family
      };

      const options = { devMode: DEV_MODE };
      const result = resolveCombat(playerData, creatureData, options);

      // Mettre à jour HP joueur en BDD et en session
      dbUpdateCharacterHpEndurance(session.runId, result.playerHpFinal, character.endurance ?? 0);
      session.player.hp    = result.playerHpFinal;
      session.player.hpMax = result.playerHpMax;

      // Victoire — marquer créature vaincue + drop
      let drop = null;
      if (result.winner === "player") {
        creature.defeated = true;

        // ─── Mise à jour affinité de l'arme ─────────────────────────────────
        if (equippedItem && creatureDef.family) {
          const AFFINITY_TYPES = ["bestial", "elementaire", "gigante", "theriomorphe", "reptilien", "eidolon", "primordial"];
          const familyIndex = AFFINITY_TYPES.indexOf(creatureDef.family);
          if (familyIndex !== -1) {
            const affinities = {
              bestial:      equippedItem.aff_bestial      ?? 0,
              elementaire:  equippedItem.aff_elementaire  ?? 0,
              gigante:      equippedItem.aff_gigante      ?? 0,
              theriomorphe: equippedItem.aff_theriomorphe ?? 0,
              reptilien:    equippedItem.aff_reptilien    ?? 0,
              eidolon:      equippedItem.aff_eidolon      ?? 0,
              primordial:   equippedItem.aff_primordial   ?? 0
            };
            // +2 pour le type battu
            affinities[AFFINITY_TYPES[familyIndex]] += 2;
            // -1 pour les 2 types suivants (cyclique)
            const next1 = (familyIndex + 1) % AFFINITY_TYPES.length;
            const next2 = (familyIndex + 2) % AFFINITY_TYPES.length;
            affinities[AFFINITY_TYPES[next1]] -= 1;
            affinities[AFFINITY_TYPES[next2]] -= 1;
            dbUpdateItemAffinities(equippedItem.id, affinities);
          }
        }

        // ─── Butin : item aléatoire après chaque victoire ──────────────────────
        drop = generateDrop(dropTable);
        dbAddItem(session.runId, { ...drop, equipped: 0, equippedSlot: null });
      }

      callback({
        ok:              true,
        log:             result.log,
        winner:          result.winner,
        playerHpStart:   result.playerHpStart,
        playerHpFinal:   result.playerHpFinal,
        playerHpMax:     result.playerHpMax,
        creatureHpStart: result.creatureHpStart,
        creatureHpFinal: result.creatureHpFinal,
        creatureHpMax:   result.creatureHpMax,
        drop
      });

    } catch (err) {
      console.error("[combat:resolve] Erreur :", err.message);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on("disconnect", () => {
    const session = getSession(socket.id);
    if (session?.runId) {
      try { dbUpdateRunStatut(session.runId, "actif"); }
      catch (err) { console.error("[disconnect] Erreur DB :", err.message); }
    }
    deleteSession(socket.id);
    console.log(`[-] Joueur déconnecté : ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} déjà utilisé. Arrêtez l'autre instance ou changez le PORT.`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));