/*
  CLIENT/JS/CORE/THEME.JS
  Source de vérité unique pour l'apparence visuelle.
  Importer THEME dans tous les fichiers UI au lieu de hardcoder couleurs et polices.

  Usage :
    import { THEME } from "../core/theme.js";
    ctx.fillStyle = THEME.text.primary;
    ctx.font      = THEME.font.body;
*/

export const THEME = {

  // ─── Couleurs texte ─────────────────────────────────────────────────────────
  text: {
    primary:   "white",
    secondary: "#eeeeee",
    muted:     "#eeeeee",
    accent:    "#d4a017",
    success:   "#4caf50",
    danger:    "#e53935",
    disabled:  "#aaa"
  },

  // ─── Typographie ────────────────────────────────────────────────────────────
  font: {
    title:      "bold 28px Arial",
    heading:    "bold 20px Arial",
    subheading: "bold 16px Arial",
    body:       "16px Arial",
    bodyBold:   "bold 16px Arial",
    small:      "13px monospace",
    mono:       "14px monospace",
    monoBold:   "bold 14px monospace",
    monoSmall:  "12px monospace"
  },

  // ─── Couleurs interface ──────────────────────────────────────────────────────
  ui: {
    bg:              "#111",
    bgPanel:         "#1a1a1a",
    bgDark:          "#161616",
    bgItem:          "#222",
    bgSelected:      "#1a1a00",
    bgConfirm:       "#1e1000",
    border:          "#444",
    borderLight:     "#333",
    borderAccent:    "#d4a017",
    borderDisabled:  "#333",
    scrollbar:       "#444"
  },

  // ─── Composants réutilisables ────────────────────────────────────────────────
  // Ces styles doivent être utilisés partout où des stats sont affichées
  // (characterCard, training, équipement, combat...) pour une cohérence visuelle.
  components: {
    statLabel: {
      font:  "20px Arial",
      color: "white"
    },
    statValue: {
      font:  "20px Arial",
      color: "white"
    }
  }
};