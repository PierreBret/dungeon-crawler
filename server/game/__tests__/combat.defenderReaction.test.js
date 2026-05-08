import { describe, it, expect } from "vitest";
import { resolveDefenderReaction } from "../combat.js";

const baseStats = {
  vitesse: 12,
  intelligence: 10,
  adresse: 14,
  force: 13,
  taille: 11,
  volonté: 10
};

describe("resolveDefenderReaction", () => {
  describe("attackIntended = true (d10EO <= eoDefender)", () => {
    it("should attack when endurance is sufficient", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 7,
        /* enDefender */ 5,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 5, // <= 7 → attackIntended
        /* d100Repo */ 50
      );
      expect(result.action).toBe("attaque");
      expect(result.attackIntended).toBe(true);
      expect(result.degraded).toBe(false);
      expect(result.enduranceCost).toBe(10);
      expect(result.phaseIncrement).toBe(4); // weaponDef.weight
      expect(result.repoAttempted).toBe(false);
      expect(result.repoSuccess).toBe(false);
      expect(result.newDistance).toBeNull();
    });

    it("should degrade to repositionnement when endurance insufficient for attack but sufficient for repo", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 7,
        /* enDefender */ 6,
        /* endurance */ 5,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 3, // <= 7 → attackIntended
        /* d100Repo */ 50
      );
      expect(result.action).toBe("repositionnement");
      expect(result.attackIntended).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.enduranceCost).toBe(3);
      expect(result.phaseIncrement).toBe(2);
      expect(result.newDistance).not.toBeNull();
    });

    it("should degrade to recuperation when endurance insufficient for both attack and repo", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 7,
        /* enDefender */ 5,
        /* endurance */ 1,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 2, // <= 7 → attackIntended
        /* d100Repo */ 50
      );
      expect(result.action).toBe("recuperation");
      expect(result.attackIntended).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.enduranceCost).toBe(-1);
      expect(result.phaseIncrement).toBe(1);
      expect(result.newDistance).toBeNull();
    });

    it("should use weapon weight for phaseIncrement on attack", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 10,
        /* enDefender */ 5,
        /* endurance */ 50,
        /* coutAttaque */ 5,
        /* coutRepo */ 2,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 4, weight: 7 },
        /* d10EO */ 1,
        /* d100Repo */ 50
      );
      expect(result.phaseIncrement).toBe(7);
    });

    it("should default weapon weight to 0 if undefined", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 10,
        /* enDefender */ 5,
        /* endurance */ 50,
        /* coutAttaque */ 5,
        /* coutRepo */ 2,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 4 },
        /* d10EO */ 1,
        /* d100Repo */ 50
      );
      expect(result.phaseIncrement).toBe(0);
    });
  });

  describe("attackIntended = false (d10EO > eoDefender)", () => {
    it("should attempt repositionnement when distance != distanceSouhaitee and succeed", () => {
      // distanceSouhaitee = 11 - enDefender = 11 - 5 = 6
      // scoreRepo = Math.floor((12 * 0.6 + 10 * 0.4) * 5) = Math.floor((7.2 + 4) * 5) = Math.floor(56) = 56
      // scoreRepo - d100Repo = 56 - 30 = 26 >= 0 → success
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 3,
        /* enDefender */ 5,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 8, // != 6
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 7, // > 3 → not attackIntended
        /* d100Repo */ 30
      );
      expect(result.action).toBe("repositionnement");
      expect(result.attackIntended).toBe(false);
      expect(result.repoAttempted).toBe(true);
      expect(result.repoSuccess).toBe(true);
      expect(result.scoreRepo).toBe(56);
      expect(result.newDistance).not.toBeNull();
      expect(result.phaseIncrement).toBe(2);
      expect(result.enduranceCost).toBe(3);
      expect(result.degraded).toBe(false);
    });

    it("should fail repositionnement when scoreRepo - d100Repo < 0 and recover", () => {
      // scoreRepo = 56, d100Repo = 80 → 56 - 80 = -24 < 0 → fail
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 3,
        /* enDefender */ 5,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 8,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 7,
        /* d100Repo */ 80
      );
      expect(result.action).toBe("recuperation");
      expect(result.attackIntended).toBe(false);
      expect(result.repoAttempted).toBe(true);
      expect(result.repoSuccess).toBe(false);
      expect(result.scoreRepo).toBe(56);
      expect(result.newDistance).toBeNull();
      expect(result.phaseIncrement).toBe(1);
      expect(result.enduranceCost).toBe(-1);
    });

    it("should fail repositionnement when endurance insufficient for repo cost", () => {
      // scoreRepo = 56, d100Repo = 30 → 56 - 30 >= 0 but endurance < coutRepo
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 3,
        /* enDefender */ 5,
        /* endurance */ 1,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 8,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 7,
        /* d100Repo */ 30
      );
      expect(result.action).toBe("recuperation");
      expect(result.attackIntended).toBe(false);
      expect(result.repoAttempted).toBe(true);
      expect(result.repoSuccess).toBe(false);
      expect(result.scoreRepo).toBe(56);
      expect(result.newDistance).toBeNull();
      expect(result.phaseIncrement).toBe(1);
      expect(result.enduranceCost).toBe(-1);
    });

    it("should recover when already at distanceSouhaitee", () => {
      // distanceSouhaitee = 11 - 5 = 6, distanceReelle = 6
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 3,
        /* enDefender */ 5,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 6, // == distanceSouhaitee
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 7,
        /* d100Repo */ 30
      );
      expect(result.action).toBe("recuperation");
      expect(result.attackIntended).toBe(false);
      expect(result.repoAttempted).toBe(false);
      expect(result.repoSuccess).toBe(false);
      expect(result.scoreRepo).toBe(0);
      expect(result.newDistance).toBeNull();
      expect(result.phaseIncrement).toBe(1);
      expect(result.enduranceCost).toBe(-1);
    });

    it("should compute scoreRepo correctly with different stats", () => {
      const stats = { vitesse: 20, intelligence: 15, adresse: 10, force: 10, taille: 10, volonté: 10 };
      // scoreRepo = Math.floor((20 * 0.6 + 15 * 0.4) * 5) = Math.floor((12 + 6) * 5) = Math.floor(90) = 90
      const result = resolveDefenderReaction(
        stats,
        /* eoDefender */ 2,
        /* enDefender */ 3,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 5, // distanceSouhaitee = 11 - 3 = 8, != 5
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 8,
        /* d100Repo */ 89
      );
      expect(result.scoreRepo).toBe(90);
      expect(result.repoSuccess).toBe(true); // 90 - 89 = 1 >= 0
    });

    it("should compute newDistance using resolveReposition logic", () => {
      // enDefender = 8, distanceSouhaitee = 11 - 8 = 3
      // distanceReelle = 7
      // newDistance = 7 + Math.floor((3 - 7) * 0.5) = 7 + Math.floor(-2) = 7 - 2 = 5
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 2,
        /* enDefender */ 8,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 7,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 8,
        /* d100Repo */ 1 // very low → success
      );
      expect(result.newDistance).toBe(5);
    });
  });

  describe("edge cases", () => {
    it("d10EO exactly equal to eoDefender → attackIntended = true", () => {
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 5,
        /* enDefender */ 5,
        /* endurance */ 50,
        /* coutAttaque */ 5,
        /* coutRepo */ 2,
        /* distanceReelle */ 5,
        /* weaponDef */ { dist: 3, weight: 3 },
        /* d10EO */ 5, // == eoDefender → attackIntended
        /* d100Repo */ 50
      );
      expect(result.attackIntended).toBe(true);
      expect(result.action).toBe("attaque");
    });

    it("scoreRepo exactly equals d100Repo → success (scoreRepo - d100Repo >= 0)", () => {
      // scoreRepo = Math.floor((12 * 0.6 + 10 * 0.4) * 5) = 56
      const result = resolveDefenderReaction(
        baseStats,
        /* eoDefender */ 3,
        /* enDefender */ 5,
        /* endurance */ 20,
        /* coutAttaque */ 10,
        /* coutRepo */ 3,
        /* distanceReelle */ 8,
        /* weaponDef */ { dist: 3, weight: 4 },
        /* d10EO */ 7,
        /* d100Repo */ 56 // scoreRepo - d100Repo = 0 → success
      );
      expect(result.repoSuccess).toBe(true);
      expect(result.action).toBe("repositionnement");
    });
  });
});
