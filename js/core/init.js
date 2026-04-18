/*
  INIT.JS
*/

import { generateDungeon } from "./dungeon.js";
import { createPlayer, generateCandidates } from "./player.js";

const TILE_SIZE = 32;
const ROWS = 20;
const COLS = 30;
const EXTRA_PATHS = 0.3;

export function initGame() {
    console.log("Lancement du jeu...");

    // --- CANVAS ---
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    // 🔥 TAILLE AGRANDIE (UI + dungeon)
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- GAME STATE ---
    return {
        ctx,
        TILE_SIZE,

        screen: "characterCreation",

        dungeon: null,
        player: null,

        characterCreation: {
            candidates: generateCandidates(3),
            selectedIndex: 0
        }
    };
}
