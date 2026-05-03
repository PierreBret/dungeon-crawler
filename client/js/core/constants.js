export const SCREENS = {
  CHARACTER_CREATION: "characterCreation",
  CAMP:               "camp",
  DUNGEON:            "dungeon",
  TRAINING:           "training"
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
  leftRatio:  0.20,
  rightRatio: 0.30,
  padding:    20,
};

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