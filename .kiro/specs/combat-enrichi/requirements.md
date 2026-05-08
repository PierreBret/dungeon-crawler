# Requirements Document — Combat Enrichi

## Introduction

Ce document décrit les exigences du nouveau système de combat du Dungeon Crawler.
Le système remplace intégralement `server/game/combat.js` et introduit une boucle
tick-par-tick avec gestion de l'endurance, de la distance et de la fatigue liée à la charge.
La logique de jeu reste exclusivement côté serveur.

---

## Glossaire

- **Combat_Resolver** : module serveur (`combat.js`) qui exécute la boucle de combat.
- **Combattant** : entité participant au combat (joueur ou créature).
- **ATT** : combattant actif du tick courant (a remporté l'initiative).
- **DEF** : combattant non actif du tick courant.
- **Tick** : unité atomique de résolution — une action ATT + une réaction DEF.
- **Phase** : compteur interne qui s'incrémente à chaque action ; quand `Phase >= nbPhaseParMinute`, la minute change.
- **Minute** : tranche tactique (1 à 5) ; chaque minute a ses propres paramètres EO/NA/EN.
- **EO** (Effort Offensif) : paramètre tactique 1–10 ; élevé = agressif.
- **NA** (Niveau d'Activité) : paramètre tactique 1–10 ; élevé = intense.
- **NA_tactique** : valeur de NA définie dans la tactique pour la minute courante (synonyme de NA dans le contexte de la tactique saisie).
- **EN** (Engagement) : paramètre tactique 1–10 ; élevé = corps à corps.
- **NA_effectif** : valeur de NA plafonnée par l'endurance restante en début de minute (voir Req 4).
- **Endurance** : ressource de combat consommée par chaque action.
- **EndInit** : endurance initiale d'un Combattant = `Math.floor((constitution + volonté + 10) × 2)`.
- **Charge** : poids total porté (armes + armures/4).
- **Portage** : capacité de charge naturelle du Combattant.
- **Surcoût_Endurance** : pénalité d'endurance liée au dépassement de la Charge.
- **DistanceRéelle** : distance courante entre les deux Combattants (1–10).
- **Distance_Souhaitée** : distance cible d'un Combattant = `11 - EN`.
- **Momentum** : *(placeholder — non implémenté dans cette version)* bonus/malus d'initiative prévu pour une version future ; valeur fixée à `0` pour tous les calculs actuels.
- **WeaponEN** : portée optimale de l'arme (champ `dist` dans `weapons.json`).
- **WeaponWeight** : poids de l'arme (champ `weight` dans `weapons.json`).
- **Arme utilisée** : dans cette version, toutes les attaques utilisent l'arme en main droite (le combat à deux armes n'est pas implémenté).
- **CoûtNA** : coût d'endurance lié au niveau d'activité = `Math.floor(NA_effectif / 2)`.
- **scoreVivacité** : score d'initiative d'un Combattant pour un tick.
- **hpMax** : points de vie maximum d'un Combattant, tels que fournis dans ses données d'entrée.

---

## Requirements

---

### Requirement 1 : Initialisation du combat

**User Story :** En tant que serveur de jeu, je veux initialiser correctement l'état
du combat avant le premier tick, afin que toutes les formules s'appuient sur des
valeurs de départ cohérentes.

#### Acceptance Criteria

1. WHEN le combat démarre, THE Combat_Resolver SHALL initialiser `Minute = 1`, `Phase = 1` et `nbPhaseParMinute = 60`.
2. WHEN le combat démarre, THE Combat_Resolver SHALL initialiser `DistanceRéelle = 10`.
3. WHEN le combat démarre, THE Combat_Resolver SHALL initialiser `Momentum_A = 0` et `Momentum_B = 0` *(placeholder — le momentum n'est pas mis à jour dans cette version)*.
4. WHEN le combat démarre, THE Combat_Resolver SHALL calculer l'endurance initiale de chaque Combattant selon la formule `EndInit = Math.floor((constitution + volonté + 10) × 2)`, avec un plancher de 0.
5. WHEN le combat démarre, THE Combat_Resolver SHALL initialiser `hpMax` de chaque Combattant à la valeur `hp` fournie dans ses données d'entrée.
6. IF `playerData` est absent, null, ou ne contient pas les champs `stats`, `hp` et `tactic`, THEN THE Combat_Resolver SHALL lever une erreur via `throw new Error("resolveCombat: playerData invalide")` et ne pas démarrer le combat.
7. IF `creatureData` est absent, null, ou ne contient pas les champs `stats`, `hp` et `tactic`, THEN THE Combat_Resolver SHALL lever une erreur via `throw new Error("resolveCombat: creatureData invalide")` et ne pas démarrer le combat.

---

### Requirement 2 : Calcul de la Charge et du Surcoût d'Endurance

**User Story :** En tant que système de combat, je veux pénaliser les Combattants
surchargés, afin que le choix de l'équipement ait un impact tactique sur la fatigue.

#### Acceptance Criteria

1. WHEN le Combat_Resolver calcule le coût en endurance d'une action pour un Combattant, THE Combat_Resolver SHALL calculer `Charge = Math.floor(PoidsArmeDroite + PoidsBouclierOuArmeGauche + Math.floor(PoidsArmures / 4))`.
2. WHEN le Combat_Resolver calcule le coût en endurance d'une action pour un Combattant, THE Combat_Resolver SHALL calculer `Portage = Math.floor(force + Math.floor(taille / 2))`.
3. WHEN le Combat_Resolver calcule le coût en endurance d'une action pour un Combattant, THE Combat_Resolver SHALL calculer `Surcoût_Endurance = Math.floor(Math.max(0, Charge - Portage) × 10 / 26)` et l'ajouter au coût en endurance de base de l'action.
4. WHERE les armures ne sont pas implémentées, THE Combat_Resolver SHALL utiliser `PoidsArmures = 0` dans le calcul de la Charge.
5. IF `WeaponWeight` est absent ou non défini pour une arme, THEN THE Combat_Resolver SHALL utiliser `WeaponWeight = 0` pour cette arme.

---

### Requirement 3 : Coûts d'endurance des actions

**User Story :** En tant que système de combat, je veux que chaque action consomme
de l'endurance selon sa nature et la charge du Combattant, afin de modéliser la fatigue.

#### Acceptance Criteria

1. THE Combat_Resolver SHALL calculer `CoûtNA = Math.floor(NA_effectif / 2)` avant chaque action.
2. WHEN un Combattant effectue une Attaque, THE Combat_Resolver SHALL déduire `Math.floor(WeaponWeight_armeUtilisée + CoûtNA + Surcoût_Endurance)` de son endurance, où `WeaponWeight_armeUtilisée` est le poids de l'arme employée pour cette attaque.
3. WHEN un Combattant effectue une Esquive, THE Combat_Resolver SHALL déduire `Math.floor(5 + CoûtNA + Surcoût_Endurance)` de son endurance.
4. WHEN un Combattant effectue une Parade, THE Combat_Resolver SHALL déduire `Math.floor(2 + CoûtNA + Surcoût_Endurance)` de son endurance.
5. WHEN un Combattant effectue un Repositionnement, THE Combat_Resolver SHALL déduire `Math.floor(1 + CoûtNA + Surcoût_Endurance)` de son endurance.
6. WHEN un Combattant effectue une Récupération, THE Combat_Resolver SHALL ajouter `1` à son endurance.
7. WHEN l'endurance d'un Combattant est modifiée, THE Combat_Resolver SHALL immédiatement la contraindre dans la plage `[0, EndInit]` via `endurance = Math.max(0, Math.min(EndInit, endurance))`.

---

### Requirement 4 : Ajustement du NA en début de minute

**User Story :** En tant que système de combat, je veux que le NA effectif soit
plafonné par l'endurance restante en début de minute, afin que l'épuisement
réduise naturellement l'intensité des actions.

#### Acceptance Criteria

1. WHEN une nouvelle minute commence, THE Combat_Resolver SHALL calculer `NA_effectif = Math.min(NA_tactique, Math.floor(Endurance / 2))` pour chaque Combattant ; si l'endurance est ≤ 0, `NA_effectif = 0`.
2. THE Combat_Resolver SHALL utiliser `NA_effectif` (et non `NA_tactique`) pour tous les calculs de coût, de score et de nombre d'actions disponibles de la minute courante.
3. THE Combat_Resolver SHALL fixer `NA_effectif` une seule fois en début de minute et ne pas le recalculer en cours de minute, même si l'endurance change.

---

### Requirement 5 : Phase d'initiative (scoreVivacité)

**User Story :** En tant que système de combat, je veux déterminer quel Combattant
agit en premier à chaque tick, afin de créer une dynamique d'initiative variable.

#### Acceptance Criteria

1. THE Combat_Resolver SHALL calculer `scoreVivacité = Math.floor(NA_effectif + vitesse × 0.6 + intelligence × 0.4 + d10 + momentum)` pour chaque Combattant à chaque tick, où `d10` est un entier tiré uniformément dans `[1, 10]` et `momentum = 0` *(placeholder — non implémenté dans cette version)*.
2. THE Combat_Resolver SHALL désigner ATT comme le Combattant ayant le `scoreVivacité` le plus élevé.
3. WHEN les deux Combattants ont le même `scoreVivacité`, THE Combat_Resolver SHALL désigner ATT comme le Combattant ayant le `NA_effectif` le plus élevé.
4. WHEN les deux Combattants ont le même `scoreVivacité` et le même `NA_effectif`, THE Combat_Resolver SHALL désigner ATT par tirage au sort (probabilité 50/50).
5. THE Combat_Resolver SHALL utiliser un unique jet de dé `d10` par Combattant par tick pour le calcul du `scoreVivacité` ; ce jet est distinct de tout autre jet du même tick.

---

### Requirement 6 : Choix et dégradation de l'action d'ATT

**User Story :** En tant que système de combat, je veux que l'action d'ATT soit
choisie selon son EO et contrainte par son endurance, afin que la fatigue force
des choix tactiques moins favorables.

#### Acceptance Criteria

1. WHEN `D10_EO <= EO_ATT` (jet dédié distinct du jet d'initiative), THE Combat_Resolver SHALL choisir l'action Attaque pour ATT.
2. WHEN `D10_EO > EO_ATT`, THE Combat_Resolver SHALL choisir l'action Repositionnement pour ATT.
3. WHEN l'action choisie est Attaque et l'endurance d'ATT est strictement inférieure à `Math.floor(WeaponWeight_MainDroite + CoûtNA + Surcoût_Endurance)`, THE Combat_Resolver SHALL dégrader l'action en Repositionnement. *(Note : le combat à deux armes n'est pas implémenté ; toutes les attaques utilisent l'arme en main droite.)*
4. WHEN l'endurance d'ATT est strictement inférieure à `Math.floor(1 + CoûtNA + Surcoût_Endurance)` (coût du Repositionnement), THE Combat_Resolver SHALL dégrader l'action en Récupération.
5. THE Combat_Resolver SHALL vérifier la suffisance de l'endurance avant de déduire le coût de l'action ; la déduction n'a lieu qu'après confirmation que l'action est réalisable.
6. THE Combat_Resolver SHALL appliquer les dégradations dans l'ordre : Attaque → Repositionnement → Récupération, en s'arrêtant à la première action réalisable.

---

### Requirement 7 : Résolution de l'Attaque

**User Story :** En tant que système de combat, je veux résoudre les jets d'attaque
en tenant compte de la distance et des stats du Combattant, afin que la portée
de l'arme et le positionnement aient un impact tactique.

#### Acceptance Criteria

1. WHEN ATT attaque, THE Combat_Resolver SHALL calculer `BaseAttack = Math.floor((adresse × 0.5 + vitesse × 0.3 + intelligence × 0.2) × 4)`.
2. WHEN ATT attaque, THE Combat_Resolver SHALL calculer `modEN = Math.floor(Math.abs(DistanceRéelle - WeaponEN) × 2)`.
3. WHEN ATT attaque, THE Combat_Resolver SHALL calculer `AttackScore = BaseAttack - modEN` ; une valeur négative est valide et garantit un échec.
4. WHEN ATT attaque, THE Combat_Resolver SHALL calculer `AttackQuality = AttackScore - D100`, où `D100` est un nouveau jet tiré uniformément dans `[1, 100]`, distinct de tout autre jet du même tick.
5. WHEN `AttackQuality >= 0`, THE Combat_Resolver SHALL enregistrer l'attaque comme touchante.
6. WHEN `AttackQuality < 0`, THE Combat_Resolver SHALL enregistrer l'attaque comme ratée.
7. WHEN ATT attaque, THE Combat_Resolver SHALL incrémenter `Phase` de `WeaponWeight` de l'arme d'ATT.
8. IF `WeaponEN` est absent ou non défini pour l'arme d'ATT, THEN THE Combat_Resolver SHALL lever une erreur explicite, car ce champ est garanti présent dans `weapons.json`.

---

### Requirement 8 : Résolution du Repositionnement

**User Story :** En tant que système de combat, je veux que le Repositionnement
fasse évoluer la distance vers la cible du Combattant actif, afin que la gestion
de la distance soit un enjeu tactique continu.

#### Acceptance Criteria

1. WHEN ATT se repositionne, THE Combat_Resolver SHALL calculer `DistanceRéelle += Math.floor((Distance_Souhaitée_ATT - DistanceRéelle) × 0.5)`, où `Distance_Souhaitée_ATT = 11 - EN_ATT`.
2. WHEN ATT se repositionne, THE Combat_Resolver SHALL incrémenter `Phase` de `2`.
3. WHEN ATT se repositionne, THE Combat_Resolver SHALL contraindre `DistanceRéelle` dans `[1, 10]` : si le résultat est inférieur à 1, `DistanceRéelle = 1` ; si supérieur à 10, `DistanceRéelle = 10`.

---

### Requirement 9 : Résolution de la Récupération

**User Story :** En tant que système de combat, je veux que la Récupération
restaure une petite quantité d'endurance, afin de permettre aux Combattants
épuisés de reprendre leur souffle.

#### Acceptance Criteria

1. WHEN un Combattant récupère, THE Combat_Resolver SHALL ajouter `1` à son endurance, sans dépasser `EndInit` (l'endurance est plafonnée à `EndInit` après la récupération).
2. WHEN un Combattant récupère, THE Combat_Resolver SHALL incrémenter `Phase` de `1`.

---

### Requirement 10 : Réaction de DEF — Défense obligatoire

**User Story :** En tant que système de combat, je veux que DEF puisse se défendre
quand ATT touche, afin que la défense soit une couche tactique distincte de l'attaque.

#### Acceptance Criteria

1. WHEN ATT a attaqué et touché, THE Combat_Resolver SHALL calculer `BaseDodge = vitesse_DEF × 2 + adresse_DEF - taille_DEF` (plage théorique : -12 à 60).
2. WHEN ATT a attaqué et touché, THE Combat_Resolver SHALL calculer `DodgeScore = BaseDodge + (5 - EO_DEF) + (NA_effectif_DEF - 5) + (5 - EN_DEF)`.
3. WHEN ATT a attaqué et touché, THE Combat_Resolver SHALL calculer `BaseParry = adresse_DEF + force_DEF + volonté_DEF` (plage théorique : 9 à 63).
4. WHEN ATT a attaqué et touché, THE Combat_Resolver SHALL calculer `ParryScore = BaseParry + (5 - EO_DEF) + (5 - NA_effectif_DEF) + (EN_DEF - 5)`.
5. WHEN ATT a attaqué et touché, THE Combat_Resolver SHALL choisir automatiquement la défense avec le score le plus élevé entre DodgeScore et ParryScore ; en cas d'égalité, Parade est prioritaire.
6. WHEN DEF choisit l'Esquive mais n'a pas assez d'endurance pour la payer, THE Combat_Resolver SHALL basculer sur la Parade.
7. WHEN DEF choisit la Parade mais n'a pas assez d'endurance pour la payer, THE Combat_Resolver SHALL appliquer les dégâts sans défense (encaisse).
8. WHEN DEF esquive, THE Combat_Resolver SHALL déduire le coût d'Esquive de l'endurance de DEF et incrémenter `Phase` de `2`.
9. WHEN DEF esquive, THE Combat_Resolver SHALL calculer `DodgeQuality = DodgeScore - D100` (jet dédié) ; si `DodgeQuality >= 0`, l'esquive réussit.
10. WHEN DEF pare, THE Combat_Resolver SHALL déduire le coût de Parade de l'endurance de DEF et incrémenter `Phase` de `1`.
11. WHEN DEF pare, THE Combat_Resolver SHALL calculer `ParryQuality = ParryScore - D100` (jet dédié) ; si `ParryQuality >= 0`, la parade réussit.
12. WHEN la défense réussit, THE Combat_Resolver SHALL ne pas appliquer les dégâts à DEF.
13. WHEN la défense échoue ou que DEF encaisse, THE Combat_Resolver SHALL appliquer les dégâts à DEF.

---

### Requirement 11 : Réaction de DEF — Riposte (ATT a raté)

**User Story :** En tant que système de combat, je veux que DEF puisse riposter
quand ATT rate son attaque, afin de récompenser les tactiques défensives.

#### Acceptance Criteria

1. WHEN ATT a attaqué et raté, THE Combat_Resolver SHALL calculer `BaseRiposte_DEF = Math.floor((intelligence_DEF + adresse_DEF × 0.5 + vitesse_DEF × 0.5) / 2)`.
2. WHEN ATT a attaqué et raté, THE Combat_Resolver SHALL calculer `RiposteScore = BaseRiposte_DEF + ModNA_DEF - DistanceRéelle`, où `ModNA_DEF = NA_effectif_DEF - 5`.
3. WHEN ATT a attaqué et raté, THE Combat_Resolver SHALL calculer `RiposteQuality = RiposteScore - D100` (jet dédié).
4. IF `RiposteQuality >= 0`, THEN THE Combat_Resolver SHALL autoriser DEF à riposter.
5. WHEN DEF riposte, THE Combat_Resolver SHALL vérifier que l'endurance de DEF est suffisante pour payer `Math.floor(WeaponWeight_DEF + CoûtNA_DEF + Surcoût_Endurance_DEF)` ; si insuffisante, la riposte est annulée.
6. WHEN DEF riposte, THE Combat_Resolver SHALL incrémenter `Phase` de `WeaponWeight_DEF`.
7. WHEN DEF riposte, THE Combat_Resolver SHALL calculer `DistanceRiposte = Math.max(1, DistanceRéelle - 2)`.
8. WHEN DEF riposte, THE Combat_Resolver SHALL calculer `BaseAttack_DEF = Math.floor((adresse_DEF × 0.5 + vitesse_DEF × 0.3 + intelligence_DEF × 0.2) × 4)`.
9. WHEN DEF riposte, THE Combat_Resolver SHALL calculer `modEN_riposte = Math.floor(Math.abs(DistanceRiposte - WeaponDist_DEF) × 2)`.
10. WHEN DEF riposte, THE Combat_Resolver SHALL calculer `AttackQuality_riposte = BaseAttack_DEF - modEN_riposte - D100` (jet dédié).
11. IF `AttackQuality_riposte >= 0`, THEN THE Combat_Resolver SHALL appliquer les dégâts de la riposte à ATT selon les formules de Req 13 (en utilisant les stats et l'arme de DEF). La riposte est le seul cas où deux attaques peuvent être résolues dans le même tick.

---

### Requirement 12 : Réaction de DEF — Repositionnement ou Récupération (ATT non attaquant)

**User Story :** En tant que système de combat, je veux que DEF réagisse
intelligemment quand ATT ne l'attaque pas, afin que les deux Combattants
interagissent même lors des phases non offensives.

#### Acceptance Criteria

1. WHEN ATT s'est repositionné ou a récupéré, THE Combat_Resolver SHALL tirer un jet `D10_EO_DEF` dédié (distinct de tout autre jet du tick) pour déterminer l'intention de DEF.
2. WHEN `D10_EO_DEF <= EO_DEF` et l'endurance de DEF est suffisante pour une Attaque, THE Combat_Resolver SHALL inverser les rôles (DEF devient ATT, ATT devient DEF) et déclencher une attaque selon les formules de Req 7 ; si cette attaque touche, l'ancien ATT (désormais DEF) a droit à une défense selon Req 10.
3. WHEN `D10_EO_DEF <= EO_DEF` et l'endurance de DEF est insuffisante pour une Attaque, THE Combat_Resolver SHALL appliquer la dégradation d'action (Req 6 critères 3–6) à DEF.
4. WHEN `D10_EO_DEF > EO_DEF` et `DistanceRéelle != Distance_Souhaitée_DEF`, THE Combat_Resolver SHALL tenter un repositionnement de DEF avec `ScoreRepo = Math.floor((vitesse_DEF × 0.6 + intelligence_DEF × 0.4) × 5)`.
5. WHEN `ScoreRepo - D100 >= 0` (jet dédié), THE Combat_Resolver SHALL appliquer le repositionnement de DEF (Req 8 appliqué à DEF) ; le repositionnement de DEF s'applique sur la `DistanceRéelle` courante (déjà modifiée par ATT), ce qui peut annuler, accentuer ou partiellement compenser l'ajustement d'ATT.
6. WHEN `D10_EO_DEF > EO_DEF` et `DistanceRéelle == Distance_Souhaitée_DEF`, THE Combat_Resolver SHALL appliquer une Récupération à DEF (Req 9).
7. WHEN le repositionnement de DEF échoue (`ScoreRepo - D100 < 0`), THE Combat_Resolver SHALL appliquer une Récupération à DEF (Req 9).

---

### Requirement 13 : Calcul et application des dégâts

**User Story :** En tant que système de combat, je veux calculer les dégâts finaux
en tenant compte de l'arme, du matériau, des stats et de l'armure, afin que
l'équipement ait un impact mesurable sur l'issue du combat.

#### Acceptance Criteria

1. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `baseArme = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))`, où `damFirst`, `damLast`, `tier` et `nbTiers` sont lus depuis `weapons.json`.
2. WHEN une attaque touche, THE Combat_Resolver SHALL appliquer `modMatériau` selon la table discrète suivante (index matériau → multiplicateur) : 0→1.000, 1→1.250, 2→1.375, 3→1.500, 4→1.625, 5→1.750, 6→1.875, 7→2.000.
3. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `coefStats = 1 + (force - 12) × 0.02 × weightFO + (taille - 12) × 0.02 × weightTA + (intelligence - 12) × 0.02 × weightIN + (vitesse - 12) × 0.02 × weightVI + (adresse - 12) × 0.02 × weightAD`, où les champs `weightFO`, `weightTA`, `weightIN`, `weightVI`, `weightAD` sont lus depuis `weapons.json`.
4. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `modAffinité = affinité de l'arme contre la famille de l'ennemi / 100` (plage : 0 à 2). *(L'affinité augmente en fonction du type d'ennemis vaincus, à la manière de Vagrant Story ; les données d'affinité sont fournies dans les données d'entrée de l'arme.)*
5. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `modTypeDégâts` selon le type de dégâts de l'arme vs le type d'armure/défense de la cible (plage : 0.8 à 1.2) ; WHERE les armures ne sont pas implémentées, `modTypeDégâts = 1.0`.
6. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `TotalDamage = Math.floor(baseArme × modMatériau × coefStats × modAffinité × modTypeDégâts)`.
7. WHEN une attaque touche, THE Combat_Resolver SHALL calculer `dégâtsFinaux = Math.max(0, TotalDamage - réductionArmure)`.
8. WHERE les armures ne sont pas implémentées, THE Combat_Resolver SHALL utiliser `réductionArmure = 0`.
9. WHEN une attaque touche, THE Combat_Resolver SHALL déduire `dégâtsFinaux` des PV du Combattant touché via `PV -= dégâtsFinaux`.
10. WHEN les PV d'un Combattant sont modifiés, THE Combat_Resolver SHALL les contraindre dans `[0, hpMax]` via `hp = Math.max(0, Math.min(hpMax, hp))`.

---

### Requirement 14 : Mise à jour du Momentum *(placeholder — non implémenté dans cette version)*

**User Story :** En tant que système de combat, je veux que le Momentum évolue
selon les événements du tick, afin de récompenser les séquences offensives
et de pénaliser les défenses subies.

> **Note :** Ce requirement est un placeholder. Le momentum reste fixé à `0` pour tous les combattants dans la version actuelle. Les règles ci-dessous décrivent le comportement prévu pour une version future.

#### Acceptance Criteria

1. *(futur)* WHEN un Combattant inflige une touche (attaque initiale ou riposte réussie), THE Combat_Resolver SHALL ajouter `2` à son Momentum.
2. *(futur)* WHEN une attaque est défendue avec succès par une Parade, THE Combat_Resolver SHALL soustraire `1` au Momentum de l'attaquant.
3. *(futur)* WHEN une attaque est défendue avec succès par une Esquive, THE Combat_Resolver SHALL soustraire `1` au Momentum de l'attaquant.
4. *(futur)* WHEN le Momentum d'un Combattant est modifié, THE Combat_Resolver SHALL le contraindre dans `[−10, 10]`.

---

### Requirement 15 : Gestion des minutes et fin de combat

**User Story :** En tant que système de combat, je veux que la boucle de combat
gère correctement le passage entre minutes et la détection de fin de combat,
afin que le résultat soit déterminé de manière fiable.

#### Acceptance Criteria

1. WHEN `Phase >= nbPhaseParMinute`, THE Combat_Resolver SHALL incrémenter `Minute`, réinitialiser `Phase = 1` et recalculer `NA_effectif` pour chaque Combattant selon Req 4.
2. WHEN `Minute <= 5`, THE Combat_Resolver SHALL utiliser les paramètres tactiques `EO/NA/EN` de la minute courante.
3. WHEN `Minute > 5`, THE Combat_Resolver SHALL continuer le combat en utilisant les paramètres tactiques de la minute 5 (minute 5+).
4. THE Combat_Resolver SHALL terminer le combat uniquement lorsque les PV d'un Combattant atteignent `0`. *(Note : les deux Combattants ne peuvent pas atteindre 0 PV simultanément car les dégâts sont toujours appliqués à un seul Combattant à la fois.)*
5. WHEN les PV d'un Combattant atteignent `0`, THE Combat_Resolver SHALL terminer le combat immédiatement, sans exécuter d'autres ticks.
6. WHEN `Minute > 20` au moment du passage de minute (après incrémentation de `Minute` dans le critère 1), THE Combat_Resolver SHALL terminer le combat en match nul (draw), sans exécuter d'autres ticks.
7. THE Combat_Resolver SHALL retourner `{ log, playerHpFinal, creatureHpFinal, winner }` à la fin du combat, où `winner` vaut `"player"`, `"creature"` ou `"draw"`.
8. WHEN le joueur remporte le combat, THE Combat_Resolver SHALL inclure une ligne de log de type `"victory"` dans le résultat.
9. WHEN la créature remporte le combat, THE Combat_Resolver SHALL inclure une ligne de log de type `"defeat"` dans le résultat.
10. WHEN le combat se termine en match nul, THE Combat_Resolver SHALL inclure une ligne de log de type `"draw"` dans le résultat.

---

### Requirement 16 : Journal de combat (log)

**User Story :** En tant que client de jeu, je veux recevoir un journal détaillé
de chaque tick rédigé en français, afin d'afficher le déroulement du combat
ligne par ligne avec les noms des Combattants.

**User Story :** En tant que développeur, je veux que le mode DEV_MODE (déjà
défini dans le projet via `process.env.DEV_MODE`) enrichisse le log avec
l'intégralité des états internes, afin de pouvoir déboguer et équilibrer le
système de combat.

#### Acceptance Criteria

1. THE Combat_Resolver SHALL produire une entrée de log pour chaque événement significatif du combat ; les types valides sont exactement : `"separator"`, `"initiative"`, `"action"`, `"attack"`, `"miss"`, `"dodge_attempt"`, `"dodge"`, `"parry_attempt"`, `"parry"`, `"defense_fail"`, `"riposte_attempt"`, `"riposte"`, `"riposte_fail"`, `"damage_raw"`, `"hit"`, `"armor"`, `"reposition"`, `"recovery"`, `"noAction"`, `"victory"`, `"defeat"`, `"draw"`, `"debug"`.
2. THE Combat_Resolver SHALL formater chaque entrée de log comme `{ type: string, text: string }`.
3. THE Combat_Resolver SHALL rédiger le champ `text` de chaque entrée de log en français, en utilisant les noms des Combattants (fournis dans les données d'entrée).
4. WHEN une entrée de log est de type `"initiative"`, `"attack"`, `"miss"`, `"dodge_attempt"`, `"parry_attempt"`, `"riposte_attempt"`, `"riposte"`, `"damage_raw"` ou `"hit"`, THE Combat_Resolver SHALL inclure dans le champ `text` les valeurs numériques clés pertinentes (scores, jets de dés, qualités, PV restants).
5. THE Combat_Resolver SHALL inclure une ligne de type `"separator"` au début de chaque minute et avant les lignes de fin de combat (`"victory"`, `"defeat"`, `"draw"`).
6. THE Combat_Resolver SHALL recevoir la valeur de `DEV_MODE` (booléen, déjà défini dans `server/index.js` via `process.env.DEV_MODE === "true"`) en paramètre de `resolveCombat`.
7. WHEN `DEV_MODE` est activé, THE Combat_Resolver SHALL produire des entrées de log supplémentaires de type `"debug"` décrivant l'intégralité des actions et états internes du combat, incluant au minimum :
   - Le passage de Phase (ex: `"Phase passe de 14 à 16"`)
   - Le début de chaque minute et les paramètres EO/NA/EN utilisés (ex: `"Début minute 2 — Guerrier: EO=7 NA=6 EN=8 | Gobelin: EO=5 NA=4 EN=6"`)
   - L'endurance courante après chaque action (ex: `"Endurance de Gobelin : 14 / 35"`)
   - La distance réelle après chaque repositionnement (ex: `"Distance réelle : 6"`)
   - Le NA_effectif calculé en début de minute (ex: `"NA_effectif de Guerrier : 7"`)
   - Le résultat de chaque jet de dé avec son contexte (ex: `"D10 initiative Guerrier : 8"`, `"D100 attaque Gobelin : 43"`)
   - Le choix d'action et les éventuelles dégradations (ex: `"Guerrier : Attaque dégradée en Repositionnement (endurance insuffisante)"`)
   - Le choix de défense et la raison (ex: `"Gobelin choisit Esquive (DodgeScore=42 > ParryScore=38)"`)
   - Le détail du calcul de dégâts (ex: `"Dégâts : baseArme=15 × modMat=1.25 × coefStats=1.08 × modAffinité=1.0 × modType=1.0 = 20"`)
8. WHEN `DEV_MODE` n'est pas activé, THE Combat_Resolver SHALL ne pas inclure les entrées de type `"debug"` dans le log retourné.

---

### Requirement 17 : Contraintes techniques et conventions

**User Story :** En tant que développeur, je veux que le module respecte les
conventions du projet, afin de maintenir la cohérence de la base de code.

#### Acceptance Criteria

1. THE Combat_Resolver SHALL exécuter l'intégralité de la logique de combat côté serveur uniquement ; aucune formule de résolution ne doit être dupliquée côté client.
2. THE Combat_Resolver SHALL utiliser `Math.floor` pour tous les arrondis de valeurs intermédiaires ou finales produisant un résultat non entier.
3. THE Combat_Resolver SHALL nommer toutes les fonctions passées en argument (aucune fonction anonyme).
4. IF un paramètre d'entrée d'une fonction exportée est null, undefined, ou manque de sous-champs requis (`stats`, `hp`, `tactic`), THEN THE Combat_Resolver SHALL lever une erreur via `throw new Error()` avec un message identifiant le paramètre manquant.
5. THE Combat_Resolver SHALL lire le champ `weight` (WeaponWeight) et le champ `dist` (WeaponEN — distance idéale) depuis `weapons.json` pour chaque arme ; ces champs sont garantis présents dans les données.
6. THE Combat_Resolver SHALL être le seul fichier du projet à contenir la logique de résolution du combat ; toute duplication dans un autre fichier constitue une violation de la règle Single Source of Truth.
7. THE Combat_Resolver SHALL valider que le champ `tactic` de `playerData` est un tableau de 5 éléments, chacun contenant les clés `EO`, `NA` et `EN` ; IF la validation échoue, THEN lever une erreur explicite.
8. THE Combat_Resolver SHALL s'intégrer à la structure existante de `server/game/combat.js` en refactorant le code actuel plutôt qu'en le réécrivant entièrement ; les éléments suivants doivent être conservés et adaptés :
   - Le helper `line(type, text)` pour la production des entrées de log.
   - Le pattern d'une fonction de résolution par minute retournant un tableau de lignes de log.
   - La structure d'appel depuis `resolveCombat` qui boucle sur les minutes et agrège le log.
   - Les fonctions utilitaires existantes (`computeScores`, `computeDamage`, `computeArmorReduction`) doivent être adaptées aux nouvelles formules, pas supprimées et recréées. La fonction `computeStrategyMods` doit être renommée et refactorée pour correspondre au nouveau système tactique.
   - La signature de `resolveCombat(playerData, creatureData)` doit rester compatible avec l'appel existant dans `server/index.js` (ajout de paramètres optionnels autorisé, suppression interdite).
9. THE Combat_Resolver SHALL conserver la compatibilité avec les structures de données existantes (`playerData`, `creatureData`) telles qu'assemblées dans le handler `combat:resolve` de `server/index.js` ; tout champ supplémentaire requis par les nouvelles formules doit être ajouté sans casser les champs existants. Le code existant dans `server/index.js` qui n'est pas conforme aux nouvelles specs (ex: champ `strategy` à renommer en `tactic`) doit être refactoré pour s'aligner.
