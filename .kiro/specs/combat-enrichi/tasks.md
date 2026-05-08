# Plan d'implémentation : Combat Enrichi

## Vue d'ensemble

Refactoring de `server/game/combat.js` pour passer d'un modèle à 5 minutes fixes (1 action/minute) à une boucle tick-par-tick avec endurance, distance et fatigue liée à la charge. Le refactoring conserve les helpers existants (`line()`, `computeScores`, `computeDamage`, `computeArmorReduction`) en les adaptant aux nouvelles formules, et maintient la signature `resolveCombat(playerData, creatureData)` compatible.

## Tâches

- [x] 1. Mise en place de l'infrastructure de test et validation des entrées
  - [x] 1.1 Installer Vitest et fast-check, configurer le test runner
    - Ajouter `vitest` et `fast-check` en devDependencies dans `server/package.json`
    - Créer `server/vitest.config.js` avec support ES modules
    - Ajouter le script `"test": "vitest --run"` dans `package.json`
    - Créer le répertoire `server/game/__tests__/`
    - _Requirements: 17.1, 17.6_

  - [x] 1.2 Implémenter `validateInputs` et refactorer la validation dans `resolveCombat`
    - Créer la fonction `validateInputs(playerData, creatureData)` dans `combat.js`
    - Valider la présence de `stats`, `hp`, `tactic` dans `playerData` et `creatureData`
    - Valider que `playerData.tactic` est un tableau de 5 éléments avec clés `EO`, `NA`, `EN`
    - Valider que `creatureData.tactic` contient les clés `min1`..`min5` avec `EO`, `NA`, `EN`
    - Valider la présence du champ `dist` dans `weaponDef`
    - Lever des erreurs explicites avec messages en français identifiant le paramètre manquant
    - Adapter `resolveCombat` pour appeler `validateInputs` en premier
    - _Requirements: 1.6, 1.7, 17.4, 17.7_

  - [x] 1.3 Écrire les tests property pour la validation des entrées
    - **Property 2: Invalid input rejection**
    - **Valide: Requirements 1.6, 1.7, 17.4, 17.7**

- [x] 2. Fonctions utilitaires de charge et endurance
  - [x] 2.1 Implémenter `computeCharge`, `computePortage` et `computeSurcoutEndurance`
    - Créer `computeCharge(weaponDef, equipment)` : `Math.floor(PoidsArmeDroite + PoidsBouclier + Math.floor(PoidsArmures / 4))`
    - Créer `computePortage(stats)` : `Math.floor(force + Math.floor(taille / 2))`
    - Créer `computeSurcoutEndurance(charge, portage)` : `Math.floor(Math.max(0, charge - portage) × 10 / 26)`
    - Utiliser `WeaponWeight = 0` si absent (Req 2.5)
    - Utiliser `PoidsArmures = 0` car armures non implémentées (Req 2.4)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Écrire le test property pour la charge et le portage
    - **Property 3: Load and encumbrance calculation**
    - **Valide: Requirements 2.1, 2.2, 2.3**

  - [x] 2.3 Adapter `computeScores` pour calculer `enduranceInit` et les nouveaux scores de base
    - Modifier `computeScores(stats)` pour retourner `enduranceInit = Math.floor((constitution + volonté + 10) × 2)`
    - Ajouter `BaseAttack = Math.floor((adresse × 0.5 + vitesse × 0.3 + intelligence × 0.2) × 4)`
    - Ajouter `BaseDodge = vitesse × 2 + adresse - taille`
    - Ajouter `BaseParry = adresse + force + volonté`
    - Ajouter `BaseRiposte = Math.floor((intelligence + adresse × 0.5 + vitesse × 0.5) / 2)`
    - _Requirements: 1.4, 7.1, 10.1, 10.3, 11.1_

  - [x] 2.4 Écrire les tests property pour les coûts d'action
    - **Property 4: Action cost formulas**
    - **Valide: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 2.5 Écrire le test property pour l'invariant d'endurance
    - **Property 5: Endurance invariant**
    - **Valide: Requirements 3.7**

- [x] 3. Checkpoint — Vérifier que les tests passent
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Système tactique et initiative
  - [x] 4.1 Renommer `computeStrategyMods` en `computeTacticMods` et adapter la logique
    - Renommer la fonction existante `computeStrategyMods` → `computeTacticMods(eo, naEffectif, en)`
    - Adapter les modificateurs pour le nouveau système (DodgeScore, ParryScore, etc.)
    - Calculer les modificateurs tactiques pour les scores de défense selon Req 10
    - _Requirements: 10.2, 10.4, 17.8_

  - [x] 4.2 Implémenter le calcul de `NA_effectif` en début de minute
    - Créer la logique `NA_effectif = Math.min(NA_tactique, Math.floor(Endurance / 2))`
    - Si endurance ≤ 0, `NA_effectif = 0`
    - Fixer `NA_effectif` une seule fois en début de minute (pas de recalcul en cours de minute)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.3 Écrire le test property pour NA_effectif
    - **Property 6: NA_effectif calculation and stability**
    - **Valide: Requirements 4.1, 4.2, 4.3**

  - [x] 4.4 Implémenter `computeVivacite` et la phase d'initiative
    - Créer `computeVivacite(naEffectif, stats, momentum, d10)` : `Math.floor(NA_effectif + vitesse × 0.6 + intelligence × 0.4 + d10 + momentum)`
    - Désigner ATT = combattant avec le scoreVivacité le plus élevé
    - En cas d'égalité : NA_effectif le plus élevé gagne ; double égalité : tirage 50/50
    - Utiliser un unique jet `d10` par combattant par tick (distinct des autres jets)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.5 Écrire le test property pour l'initiative
    - **Property 7: Initiative determination**
    - **Valide: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 4.6 Écrire le test property pour la sélection tactique par minute
    - **Property 18: Tactic selection by minute**
    - **Valide: Requirements 15.2, 15.3**

- [x] 5. Actions d'ATT : choix, dégradation et résolution
  - [x] 5.1 Implémenter `chooseAction` avec la chaîne de dégradation
    - Créer `chooseAction(eo, endurance, coutAttaque, coutRepo)` avec jet `D10_EO`
    - Si `D10_EO <= EO` → Attaque ; sinon → Repositionnement
    - Dégradation : Attaque → Repositionnement → Récupération (si endurance insuffisante)
    - Vérifier l'endurance AVANT de déduire le coût
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.2 Écrire le test property pour la sélection d'action avec dégradation
    - **Property 8: Action selection with degradation**
    - **Valide: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 5.3 Implémenter la résolution de l'Attaque (score, touche, phase)
    - Calculer `BaseAttack`, `modEN = Math.floor(|DistanceRéelle - WeaponEN| × 2)`
    - Calculer `AttackScore = BaseAttack - modEN`
    - Calculer `AttackQuality = AttackScore - D100` (jet dédié [1, 100])
    - Touche si `AttackQuality >= 0`, raté sinon
    - Incrémenter `Phase` de `WeaponWeight` de l'arme d'ATT
    - Lever une erreur si `WeaponEN` (champ `dist`) est absent
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 5.4 Écrire le test property pour le score d'attaque
    - **Property 9: Attack score and hit determination**
    - **Valide: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

  - [x] 5.5 Implémenter `resolveReposition` (distance, clamping, phase)
    - Créer `resolveReposition(distanceReelle, distanceSouhaitee)` : `distanceReelle += Math.floor((distanceSouhaitee - distanceReelle) × 0.5)`
    - Clamper le résultat dans `[1, 10]`
    - Incrémenter `Phase` de `2`
    - `Distance_Souhaitée = 11 - EN`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.6 Écrire le test property pour le repositionnement
    - **Property 10: Repositioning formula with clamping**
    - **Valide: Requirements 8.1, 8.3**

  - [x] 5.7 Implémenter la résolution de la Récupération
    - Ajouter `1` à l'endurance du combattant (plafonné à `EndInit`)
    - Incrémenter `Phase` de `1`
    - _Requirements: 9.1, 9.2_

- [x] 6. Checkpoint — Vérifier que les tests passent
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Réactions de DEF
  - [x] 7.1 Implémenter `chooseDefense` et la résolution Esquive/Parade
    - Créer `chooseDefense(defenderStats, eo, naEffectif, en, endurance, coutEsquive, coutParade)`
    - Calculer `DodgeScore = BaseDodge + (5 - EO) + (NA_effectif - 5) + (5 - EN)`
    - Calculer `ParryScore = BaseParry + (5 - EO) + (5 - NA_effectif) + (EN - 5)`
    - Choisir la défense avec le score le plus élevé ; Parade prioritaire en cas d'égalité
    - Dégradation : Esquive → Parade → Encaisse (si endurance insuffisante)
    - Esquive réussie si `DodgeScore - D100 >= 0` ; Parade réussie si `ParryScore - D100 >= 0`
    - Déduire le coût d'endurance de la défense choisie
    - Incrémenter `Phase` de `2` (esquive) ou `1` (parade)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13_

  - [x] 7.2 Écrire le test property pour la sélection et résolution de défense
    - **Property 11: Defense selection and resolution**
    - **Valide: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9, 10.11, 10.12, 10.13**

  - [x] 7.3 Implémenter la résolution de la Riposte (ATT a raté)
    - Calculer `BaseRiposte = Math.floor((intelligence + adresse × 0.5 + vitesse × 0.5) / 2)`
    - Calculer `RiposteScore = BaseRiposte + (NA_effectif - 5) - DistanceRéelle`
    - Calculer `RiposteQuality = RiposteScore - D100` (jet dédié)
    - Si `RiposteQuality >= 0` et endurance suffisante → riposte autorisée
    - Calculer `DistanceRiposte = Math.max(1, DistanceRéelle - 2)`
    - Résoudre l'attaque de riposte avec les formules standard à `DistanceRiposte`
    - Incrémenter `Phase` de `WeaponWeight_DEF`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

  - [x] 7.4 Écrire le test property pour la riposte
    - **Property 12: Riposte resolution**
    - **Valide: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 11.10, 11.11**

  - [x] 7.5 Implémenter `resolveDefenderReaction` (ATT non attaquant)
    - Créer `resolveDefenderReaction(...)` pour gérer la réaction de DEF quand ATT se repositionne ou récupère
    - Jet `D10_EO_DEF` dédié pour déterminer l'intention de DEF
    - Si `D10 <= EO_DEF` et endurance suffisante → DEF attaque (inversion des rôles, Req 7 + Req 10)
    - Si endurance insuffisante → dégradation d'action (Req 6 critères 3–6)
    - Si `D10 > EO_DEF` et `DistanceRéelle != Distance_Souhaitée_DEF` → tentative de repositionnement avec `ScoreRepo = Math.floor((vitesse × 0.6 + intelligence × 0.4) × 5)`
    - Si `ScoreRepo - D100 >= 0` → repositionnement de DEF appliqué
    - Si à distance souhaitée ou échec → Récupération
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 7.6 Écrire le test property pour la réaction de DEF
    - **Property 13: Defender reaction when ATT does not attack**
    - **Valide: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7**

- [x] 8. Calcul des dégâts
  - [x] 8.1 Adapter `computeDamage` pour les nouvelles formules (affinité, type de dégâts)
    - Adapter la fonction existante `computeDamage(weaponDef, weaponItem, attackerStats, armorReduction)`
    - Calculer `baseArme = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))`
    - Appliquer `modMatériau` depuis la table discrète [1.0, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0]
    - Calculer `coefStats = 1 + Σ((stat - 12) × 0.02 × weight)`
    - Ajouter `modAffinité = affinité / 100` (défaut 0 si absent)
    - Ajouter `modTypeDégâts = 1.0` (armures non implémentées)
    - Calculer `TotalDamage = Math.floor(baseArme × modMatériau × coefStats × modAffinité × modTypeDégâts)`
    - Calculer `dégâtsFinaux = Math.max(0, TotalDamage - réductionArmure)` (réductionArmure = 0)
    - Clamper les PV dans `[0, hpMax]` après application
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x] 8.2 Écrire le test property pour la formule de dégâts
    - **Property 14: Damage formula**
    - **Valide: Requirements 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.9, 13.10**

- [x] 9. Checkpoint — Vérifier que les tests passent
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Boucle principale et gestion des minutes
  - [x] 10.1 Refactorer `resolveCombat` : initialisation de l'état de combat
    - Initialiser `Minute = 1`, `Phase = 1`, `nbPhaseParMinute = 60`
    - Initialiser `DistanceRéelle = 10`
    - Initialiser `Momentum_A = 0`, `Momentum_B = 0` (placeholder)
    - Calculer `EndInit` pour chaque combattant
    - Initialiser `hpMax` à la valeur `hp` fournie
    - Calculer `Charge`, `Portage`, `SurcoutEndurance` pour chaque combattant
    - Calculer `NA_effectif` initial (minute 1)
    - Supporter `options.devMode` et `options.rollDie` (injection de dés)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 17.8, 17.9_

  - [x] 10.2 Écrire le test property pour l'initialisation du combat
    - **Property 1: Combat initialization invariant**
    - **Valide: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [x] 10.3 Implémenter la boucle tick-par-tick avec gestion des phases et minutes
    - Remplacer `resolveCombatMinute` par `resolveCombatTick` (résout un tick unique)
    - Boucler sur les ticks tant que `Minute <= 20` et PV > 0
    - Incrémenter `Phase` selon l'action (WeaponWeight, 2, 1)
    - Quand `Phase >= nbPhaseParMinute` : incrémenter `Minute`, réinitialiser `Phase = 1`, recalculer `NA_effectif`
    - Utiliser les paramètres tactiques de la minute courante (index `m-1` pour joueur, `min{m}` pour créature)
    - Si `Minute > 5` : utiliser les paramètres de la minute 5
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 10.4 Écrire le test property pour l'avancement des phases et transitions de minute
    - **Property 15: Phase advancement and minute transitions**
    - **Valide: Requirements 7.7, 8.2, 9.2, 10.8, 10.10, 15.1**

  - [x] 10.5 Implémenter les conditions de fin de combat
    - Terminer immédiatement quand les PV d'un combattant atteignent 0
    - Terminer en match nul quand `Minute > 20` au passage de minute
    - Retourner `{ log, playerHpFinal, creatureHpFinal, winner }` avec `winner ∈ {"player", "creature", "draw"}`
    - _Requirements: 15.4, 15.5, 15.6, 15.7_

  - [x] 10.6 Écrire le test property pour les conditions de terminaison
    - **Property 16: Combat termination conditions**
    - **Valide: Requirements 15.4, 15.5, 15.6, 15.7**

- [x] 11. Journal de combat (log) et DEV_MODE
  - [x] 11.1 Implémenter le système de log complet avec les 23 types valides
    - Conserver le helper `line(type, text)` existant
    - Produire des entrées pour chaque événement significatif (initiative, action, attaque, miss, etc.)
    - Rédiger le champ `text` en français avec les noms des combattants
    - Inclure les valeurs numériques clés dans les types pertinents (scores, jets, qualités, PV)
    - Ajouter un `"separator"` au début de chaque minute et avant la ligne de fin
    - Ajouter la ligne finale `"victory"`, `"defeat"` ou `"draw"` selon le résultat
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 11.2 Implémenter le logging DEV_MODE conditionnel
    - Recevoir `DEV_MODE` via `options.devMode` (booléen)
    - En mode DEV : produire des entrées `"debug"` avec les états internes complets
    - Inclure : passage de Phase, début de minute avec EO/NA/EN, endurance après action, distance après repositionnement, NA_effectif, jets de dés, choix d'action/dégradation, choix de défense, détail calcul dégâts
    - En mode non-DEV : ne pas inclure les entrées `"debug"`
    - _Requirements: 16.6, 16.7, 16.8_

  - [x] 11.3 Écrire le test property pour l'intégrité du log
    - **Property 17: Log integrity**
    - **Valide: Requirements 15.8, 15.9, 15.10, 16.1, 16.2, 16.5, 16.7, 16.8**

- [x] 12. Checkpoint — Vérifier que les tests passent
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Intégration et câblage final
  - [x] 13.1 Adapter `server/index.js` pour le nouveau système (strategy → tactic, DEV_MODE)
    - Renommer le champ `strategy` en `tactic` dans le handler `combat:resolve`
    - Passer `options.devMode` depuis `process.env.DEV_MODE === "true"`
    - Vérifier la compatibilité avec les structures `playerData`/`creatureData` existantes
    - S'assurer que l'appel `resolveCombat(playerData, creatureData, options)` fonctionne
    - _Requirements: 17.8, 17.9_

  - [x] 13.2 Supprimer l'import de `rollDie` depuis `player.js` et internaliser les jets de dés
    - Créer une fonction interne de jet de dés dans `combat.js` (ou utiliser `options.rollDie`)
    - Permettre l'injection d'un générateur de dés pour les tests déterministes
    - Supprimer la dépendance à `rollDie` de `player.js` pour le module combat
    - _Requirements: 17.6, 5.5_

  - [x] 13.3 Écrire les tests d'intégration
    - Vérifier que `resolveCombat` fonctionne avec des structures réelles de `server/index.js`
    - Vérifier le renommage `strategy` → `tactic` dans le socket handler
    - Vérifier l'intégration des données d'armes depuis `weapons.json`
    - Vérifier le passage du paramètre `DEV_MODE`
    - _Requirements: 17.8, 17.9_

- [x] 14. Checkpoint final — Vérifier que tous les tests passent
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Les tâches marquées avec `*` sont optionnelles et peuvent être ignorées pour un MVP plus rapide
- Chaque tâche référence les requirements spécifiques pour la traçabilité
- Les checkpoints assurent une validation incrémentale
- Les property tests valident les propriétés universelles de correction (fast-check, 100+ itérations)
- Les unit tests valident des exemples spécifiques et cas limites
- L'injection de dés via `options.rollDie` permet des tests déterministes
- Le momentum reste à `0` (placeholder) — pas d'implémentation dans cette version (Req 14)
- Les armures restent à `0` — pas d'implémentation dans cette version (Req 2.4, 13.5, 13.8)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.6"] },
    { "id": 5, "tasks": ["4.5", "5.1", "5.3", "5.5", "5.7"] },
    { "id": 6, "tasks": ["5.2", "5.4", "5.6", "7.1", "7.3", "7.5"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.6", "8.1"] },
    { "id": 8, "tasks": ["8.2", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "10.5", "11.1"] },
    { "id": 11, "tasks": ["10.6", "11.2"] },
    { "id": 12, "tasks": ["11.3", "13.1", "13.2"] },
    { "id": 13, "tasks": ["13.3"] }
  ]
}
```
