# Implementation Plan: Combat Engine Refactor

## Overview

Refonte complète du moteur de combat du Dungeon Crawler. Le nouveau système remplace `server/game/combat.js` par une architecture modulaire avec des fonctions pures, une configuration externalisée (`combatConfig.js`), et un système de combat basé sur des minutes/tempos avec compétences dérivées, tactiques et résolution de dégâts multi-facteurs.

## Tasks

- [x] 1. Configuration externalisée et validation des entrées
  - [x] 1.1 Créer le fichier `server/game/combatConfig.js` avec toutes les constantes
    - Exporter l'objet `COMBAT` contenant : coefficients de compétences, diviseurs de normalisation, seuils de fatigue, table des matériaux, paramètres de boucle (nbTempoParMinute, maxMinutes, distanceInitiale), coûts d'endurance, gains de récupération, séquence de phases
    - Structurer en sections logiques conformément au modèle de données CombatConfig du design
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 1.2 Implémenter la fonction `validateInputs(playerData, creatureData)`
    - Vérifier les 7 statistiques primaires dans [1, 24] pour chaque combattant
    - Vérifier au moins une tactique définie avec EO, NA, EN dans [1, 10]
    - Vérifier l'équipement complet (arme avec `dist`, armure avec `reduction`)
    - Lever une `Error` descriptive indiquant le champ invalide
    - _Requirements: 1.6, 1.7, 2.8_

  - [ ]* 1.3 Écrire le test property-based pour la validation des entrées
    - **Property 15: Rejet des entrées invalides**
    - **Validates: Requirements 1.6, 1.7**

- [x] 2. Calcul des statistiques dérivées et initialisation
  - [x] 2.1 Implémenter `computeDerivedSkills(stats, config)`
    - Calculer les 6 compétences dérivées (Vivacité, Initiative, Attaque, Parade, Esquive, Riposte) selon les formules et coefficients du config
    - Gérer le terme inversé (24-TAI) pour Parade et Esquive
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Écrire le test property-based pour les compétences dérivées
    - **Property 2: Bornes des compétences dérivées**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

  - [x] 2.3 Implémenter `normalizeToPercent(rawSkill, divisor, config)`
    - Transformer la compétence brute en pourcentage : skill × 50 / diviseur
    - Arrondir à 2 décimales
    - Plafonner dans [12.5, 87.5]
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 2.4 Écrire le test property-based pour la normalisation
    - **Property 3: Normalisation en pourcentage bornée**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

  - [x] 2.5 Implémenter `initCombatState(playerData, creatureData, config)`
    - Calculer HPMAX = CON×19 + TAI×5 + VOL×2, borné dans [78, 546]
    - Calculer ENDMAX = (FOR + CON + VOL) × 3, borné dans [27, 189]
    - Calculer Charge, Portage, Surcoût_Endurance
    - Appeler `computeDerivedSkills` et `normalizeToPercent` pour chaque combattant
    - Construire l'objet `CombatState` initial (minute=1, tempo=1, distance=10)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 8.1_

  - [ ]* 2.6 Écrire le test property-based pour HPMAX et ENDMAX
    - **Property 1: Bornes des maximums dérivés (HPMAX et ENDMAX)**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.7 Écrire le test property-based pour charge et portage
    - **Property 6: Bornes du système de charge et portage**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 3. Checkpoint - Vérifier les fondations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Système de tactiques et ajustements
  - [x] 4.1 Implémenter `computeEffectiveSkills(percentages, tactics, distance, weaponDist, config)`
    - Appliquer les ajustements tactiques pour chaque compétence selon les formules du design
    - Vivacité_eff = Vivacité% + (EO-5)×2 + (NA-5)
    - Initiative_eff = Initiative% + (EO-5) + (NA-5) + (EN-5)
    - Attaque_eff = Attaque% + (EO-5) + (5-|DistanceArme - Distance|)×2
    - Esquive_eff = Esquive% + (5-EO) + (NA-5) + (5-EN)
    - Parade_eff = Parade% + (5-EO) + (5-NA) + (5-EN)
    - Riposte_eff = Riposte% + (5-EO) + (5-NA) + (EN-5)×2
    - Borner chaque résultat dans [1, 99]
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.2 Écrire le test property-based pour les ajustements tactiques
    - **Property 4: Compétences effectives bornées et neutralité tactique**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 5. Système de jets de dés et endurance
  - [x] 5.1 Implémenter `rollSkill(effectiveSkill, fatigue, rng)`
    - Tirer D100 = Math.floor(rng() × 100) + 1
    - Calculer qualité = effectiveSkill - D100 - fatigue
    - Retourner {quality, d100, success: quality >= 0}
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 5.2 Écrire le test property-based pour les jets de dés
    - **Property 5: Uniformité de la formule de jet**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

  - [x] 5.3 Implémenter `getFatigueTier(endurance, config)`
    - Parcourir les paliers de fatigue du config (fatigueTiers)
    - Retourner {fatigue, naCap} correspondant au palier d'endurance
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.4 Implémenter les fonctions de coût d'endurance
    - `computeAttackCost(weaponWeight, na, surcout)` → Poids_Arme + NA + Surcoût
    - `computeDefenseCost(na, surcout)` → NA + Surcoût
    - Récupération : gain de 1 point sans dépasser ENDMAX
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 7.6, 7.7_

  - [ ]* 5.5 Écrire le test property-based pour la fatigue
    - **Property 8: Correspondance palier de fatigue**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [ ]* 5.6 Écrire le test property-based pour les coûts d'endurance
    - **Property 7: Coûts d'endurance et récupération bornée**
    - **Validates: Requirements 6.4, 6.5, 6.6, 6.7**

- [x] 6. Checkpoint - Vérifier les systèmes de base
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phases de combat individuelles
  - [x] 7.1 Implémenter `phaseVivacite(state, rng)`
    - Effectuer un jet de Vivacité pour chaque combattant
    - Désigner ATT (qualité la plus élevée) et DEF
    - Départager par tirage aléatoire en cas d'égalité
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 7.2 Écrire le test property-based pour la vivacité
    - **Property 10: Attribution ATT/DEF par vivacité**
    - **Validates: Requirements 9.2, 9.3**

  - [x] 7.3 Implémenter `computeMovement(currentDist, en, na, config)` et `phaseAttaque(state, rng)`
    - Calculer distance souhaitée = 11 - EN, déplacement max = floor(NA/2)
    - Vérifier l'endurance suffisante pour l'attaque ; si insuffisante, récupération des deux combattants
    - Déduire le coût d'endurance, résoudre le jet d'attaque
    - Si attaque ratée, sauter les phases Défense et Résolution Dégâts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 7.4 Écrire le test property-based pour la distance
    - **Property 11: Contraintes de distance et déplacement**
    - **Validates: Requirements 10.1, 10.2**

  - [x] 7.5 Implémenter `selectDefense(...)` et `phaseDefense(state, rng)`
    - Comparer Esquive_eff et Parade_eff pour choisir la défense préférée
    - Dégrader vers l'autre défense si endurance insuffisante
    - Encaissement direct si aucune défense payable
    - Résoudre le jet défensif et déduire le coût d'endurance
    - Si défense réussie, annuler les dégâts
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 7.6 Écrire le test property-based pour la sélection de défense
    - **Property 12: Sélection de défense optimale**
    - **Validates: Requirements 11.1, 11.2, 11.5, 11.6**

  - [x] 7.7 Implémenter `computeDamage(weapon, attackerStats, targetFamily, armorReduction, config)` et `phaseResolutionDegats(state)`
    - Calculer modMateriau depuis la table indexée [0-7]
    - Calculer coef_STATS = 1 + Σ((stat-12)×0.02×poids_stat)
    - Calculer modAffinité = 1 + (affinité / 100)
    - TotalDamage = floor(BaseArme × modMateriau × coef_STATS × modAffinité × modTypeDégâts)
    - DégâtsFinals = max(0, TotalDamage - Armure)
    - Déduire les dégâts des HP du défenseur
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 7.8 Écrire le test property-based pour les dégâts
    - **Property 14: Dégâts non-négatifs et formule multi-facteurs**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6**

  - [x] 7.9 Implémenter `phaseInitiative(state, rng)` et `phaseRiposte(state, rng)`
    - Jet d'initiative pour ATT : si réussi, ATT conserve l'initiative
    - Si initiative échouée, déclencher la phase de riposte pour DEF
    - Jet de riposte pour DEF : si réussi, inverser les rôles ATT/DEF
    - Si riposte échouée, passer au tempo suivant
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 7.10 Écrire le test property-based pour initiative et riposte
    - **Property 13: Gestion des rôles par initiative et riposte**
    - **Validates: Requirements 12.2, 12.5**

- [x] 8. Checkpoint - Vérifier les phases individuelles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Boucle principale et orchestration
  - [x] 9.1 Implémenter la boucle principale `mainLoop(state, config, rng)`
    - Boucle externe sur les minutes (1 à maxMinutes)
    - Phase Vivacité une fois par minute, puis ajustements tactiques
    - Boucle interne sur les tempos (1 à nbTempoParMinute)
    - Exécuter la séquence de phases configurable pour chaque tempo
    - Vérifier la condition de fin (HP ≤ 0) après chaque résolution de dégâts
    - Déclarer match nul si les deux HP ≤ 0 simultanément ou si maxMinutes dépassé
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 9.2 Écrire le test property-based pour la terminaison
    - **Property 9: Terminaison garantie du combat**
    - **Validates: Requirements 8.5, 8.7**

  - [x] 9.3 Implémenter `resolveCombat(playerData, creatureData, rng?)`
    - Appeler `validateInputs`, `initCombatState`, `mainLoop`
    - Retourner `CombatResult` avec log, winner, hpPlayer, hpCreature
    - Exporter comme fonction principale du module
    - _Requirements: 15.2, 15.4, 16.1, 16.2, 16.3, 16.4_

- [x] 10. Remplacement de l'ancien système et intégration
  - [x] 10.1 Remplacer le contenu de `server/game/combat.js`
    - Supprimer l'intégralité de l'ancien code de combat
    - Exporter `resolveCombat` comme fonction principale
    - Conserver le même chemin d'import pour compatibilité
    - Vérifier qu'aucune référence aux anciennes mécaniques ne subsiste
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 10.2 Écrire les tests d'intégration
    - Combat complet avec RNG fixe (déterministe)
    - Vérification de la structure du log de sortie
    - Compatibilité de l'interface avec les appelants existants
    - _Requirements: 15.2, 15.4, 16.1_

- [x] 11. Final checkpoint - Vérification complète
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Le RNG est injectable pour permettre des tests déterministes
- Toutes les constantes proviennent de `combatConfig.js` — aucune valeur codée en dur dans la logique

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.3"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "2.7", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.2", "5.5", "5.6"] },
    { "id": 6, "tasks": ["7.1", "7.3", "7.5", "7.7", "7.9"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.6", "7.8", "7.10"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2"] }
  ]
}
```
