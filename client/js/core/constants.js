export const SCREENS = {
  CHARACTER_CREATION: "characterCreation",
  CAMP: "camp",
  DUNGEON: "dungeon"
};

export const CAMP_OPTIONS = [
  { label: "Explorer le donjon", action: "explore"   },
  { label: "Inventaire",         action: "inventory" },
  { label: "Équiper",            action: "equip"     },
  { label: "Se reposer",         action: "rest"      },
  { label: "Abandonner",         action: "quit"      }
];

// ─── Layout — source de vérité unique ────────────────────────────────────────

export const LAYOUT = {
  leftRatio:  0.20,  // 20% — colonne gauche  (characterCard + progression)
  rightRatio: 0.30,  // 30% — colonne droite  (infos contextuelles)
  padding:      20,  // padding interne des panneaux
};

/**
 * Retourne les dimensions calculées à partir du canvas.
 * À appeler depuis chaque drawXxx() qui en a besoin.
 * Les colonnes sont proportionnelles — s'adaptent à toute résolution.
 *
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {object}
 */
export function getLayout(canvasWidth, canvasHeight) {
  const { leftRatio, rightRatio, padding } = LAYOUT;
  const leftWidth  = Math.floor(canvasWidth * leftRatio);
  const rightWidth = Math.floor(canvasWidth * rightRatio);
  return {
    leftWidth,
    rightWidth,
    padding,
    leftX:       0,
    centerX:     leftWidth,
    centerWidth: canvasWidth - leftWidth - rightWidth,
    rightX:      canvasWidth - rightWidth,
    height:      canvasHeight,
  };
}