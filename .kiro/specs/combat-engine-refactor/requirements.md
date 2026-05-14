# Document d'Exigences — Refonte du Moteur de Combat

## Introduction

Ce document spécifie les exigences pour la refonte complète du moteur de combat du jeu Dungeon Crawler. Le nouveau système remplace intégralement l'ancien système de combat et introduit un modèle basé sur des échanges au sein de minutes (ticks), avec un système de compétences dérivées des statistiques, des tactiques configurables par minute, et une résolution de dégâts multi-facteurs. Toutes les formules doivent être externalisées dans un fichier de configuration (`combatConfig.js`) pour faciliter l'équilibrage.

## Glossaire

- **Moteur_de_Combat** : Module serveur (`server/game/combat.js`) responsable de la résolution complète d'un affrontement entre deux combattants.
- **Combattant** : Entité participant au combat (joueur ou créature), possédant des statistiques, des compétences dérivées, des tactiques et un équipement.
- **Statistique_Primaire** : L'une des 7 caractéristiques de base d'un combattant : Force (FOR), Constitution (CON), Taille (TAI), Intelligence (INT), Volonté (VOL), Vitesse (VIT), Adresse (ADR). Valeurs entre 1 et 24.
- **Compétence_Dérivée** : Valeur calculée à partir des statistiques primaires : Vivacité, Initiative, Attaque, Parade, Esquive, Riposte.
- **Tactique** : Ensemble de trois paramètres configurés par minute : Effort Offensif (EO), Niveau d'Activité (NA), Engagement (EN), chacun entre 1 et 10.
- **Minute** : Unité temporelle principale du combat, contenant un nombre fixe de tempos (échanges).
- **Tempo** : Sous-unité d'une minute ; chaque minute contient `nbTempoParMinute` tempos (valeur par défaut : 20).
- **ATT** : Combattant ayant l'initiative offensive pour un échange donné.
- **DEF** : Combattant en posture défensive pour un échange donné.
- **Distance** : Écart spatial entre les deux combattants (1 à 10).
- **HP** : Points de vie du combattant. Le combat se termine quand HP ≤ 0.
- **Endurance** : Ressource consommée par les actions. Limite les actions possibles quand elle est basse.
- **Fatigue** : Malus appliqué aux jets de dés quand l'endurance est basse.
- **Charge** : Poids total de l'équipement porté par un combattant.
- **Portage** : Capacité de transport d'un combattant, dérivée de Force et Taille.
- **Surcoût_Endurance** : Coût supplémentaire en endurance dû à la surcharge.
- **D100** : Jet de dé à 100 faces (valeur entière entre 1 et 100, tirage uniforme).
- **CombatConfig** : Fichier de configuration (`server/game/combatConfig.js`) contenant toutes les constantes et formules paramétrables du système de combat.
- **Qualité_de_Jet** : Résultat d'un jet = Compétence_eff - D100 - Fatigue. ≥ 0 = succès, < 0 = échec.
- **modMateriel** : Multiplicateur de dégâts basé sur le matériau de l'arme.
- **coef_STATS** : Coefficient de dégâts basé sur les statistiques de l'attaquant pondérées par les poids de l'arme.
- **modAffinité** : Multiplicateur de dégâts basé sur l'affinité de l'arme envers le type de créature ciblée.

## Exigences

### Exigence 1 : Structure des Combattants

**User Story :** En tant que développeur, je veux que chaque combattant possède une structure de données complète et normalisée, afin que le moteur de combat puisse résoudre les échanges de manière déterministe.

#### Critères d'Acceptation

1. THE Moteur_de_Combat SHALL représenter chaque Combattant avec 7 Statistiques_Primaires : Force, Constitution, Taille, Intelligence, Volonté, Vitesse, Adresse, chacune comprise entre 1 et 24 (valeurs entières).
2. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer les HP maximaux selon la formule : HPMAX = CON×19 + TAI×5 + VOL×2, avec un minimum de 78 et un maximum de 546, et fixer les HP courants à HPMAX.
3. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer l'endurance maximale selon la formule : ENDMAX = (FOR + CON + VOL) × 3, avec un minimum de 27 et un maximum de 189, et fixer l'endurance courante à ENDMAX.
4. THE Moteur_de_Combat SHALL associer à chaque Combattant un ensemble de Tactiques (une par minute, la dernière tactique définie étant réutilisée pour toute minute au-delà), chacune définissant EO, NA et EN comme des valeurs entières entre 1 et 10.
5. THE Moteur_de_Combat SHALL associer à chaque Combattant un équipement comprenant une arme (avec poids entier entre 1 et 14, distance optimale entière entre 1 et 10, dégâts de base, matériau indexé de 0 à 7, affinités par famille de créature en pourcentage de -100 à 100) et une armure (avec valeur de réduction entière ≥ 0).
6. IF une Statistique_Primaire fournie est en dehors de la plage 1–24 ou si une valeur de Tactique (EO, NA, EN) est en dehors de la plage 1–10, THEN THE Moteur_de_Combat SHALL rejeter l'initialisation du combat avec une erreur indiquant le champ invalide.
7. IF un Combattant ne possède pas au moins une Tactique définie ou si l'équipement (arme avec champ distance optimale) est absent, THEN THE Moteur_de_Combat SHALL rejeter l'initialisation du combat avec une erreur indiquant la donnée manquante.

#### Propriétés de Correction

- **P1.1** : Pour toute combinaison de statistiques primaires dans [1,24], HPMAX est dans [78, 546].
- **P1.2** : Pour toute combinaison de FOR, CON, VOL dans [1,24], ENDMAX est dans [27, 189].
- **P1.3** : Toute entrée avec une statistique hors [1,24] produit une erreur de validation.

### Exigence 2 : Calcul des Compétences Dérivées

**User Story :** En tant que développeur, je veux que les compétences de combat soient calculées à partir des statistiques primaires selon des formules précises, afin d'obtenir des valeurs cohérentes et équilibrées.

#### Critères d'Acceptation

1. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer la Vivacité de base selon : Vivacité = TAI×6 + INT×12 + VIT×7 + ADR×8, produisant un résultat entier compris entre 33 et 792.
2. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer l'Initiative de base selon : Initiative = INT×4 + VOL×6 + VIT×9, produisant un résultat entier compris entre 19 et 456.
3. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer l'Attaque de base selon : Attaque = FOR×6 + INT×10 + VOL×6 + ADR×10, produisant un résultat entier compris entre 32 et 768.
4. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer la Parade de base selon : Parade = FOR×6 + VOL×6 + ADR×10 + (24-TAI)×6, produisant un résultat entier compris entre 22 et 666.
5. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer l'Esquive de base selon : Esquive = INT×10 + VOL×6 + VIT×5 + ADR×10 + (24-TAI)×6, produisant un résultat entier compris entre 52 et 888.
6. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL calculer la Riposte de base selon : Riposte = INT×6 + VIT×10 + ADR×10, produisant un résultat entier compris entre 26 et 624.
7. WHEN un combat est initialisé, THE Moteur_de_Combat SHALL stocker les six Compétences_Dérivées calculées sur l'objet Combattant pour utilisation durant les phases de combat.
8. IF une Statistique_Primaire requise pour le calcul est absente ou hors de la plage 1-24, THEN THE Moteur_de_Combat SHALL interrompre l'initialisation du combat et signaler une erreur indiquant la statistique invalide.

#### Propriétés de Correction

- **P2.1** : Pour toute combinaison de stats dans [1,24], chaque compétence dérivée est dans sa plage théorique.
- **P2.2** : Le calcul est déterministe — mêmes stats en entrée produisent toujours les mêmes compétences.

### Exigence 3 : Transformation en Pourcentage des Compétences

**User Story :** En tant que développeur, je veux que les compétences brutes soient normalisées en pourcentages (plage 12.5% à 87.5%), afin d'obtenir des probabilités de succès cohérentes pour les jets de dés.

#### Critères d'Acceptation

1. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer la Vivacité en pourcentage selon : Vivacité% = Vivacité × 50 / 396, le résultat étant arrondi à deux décimales près.
2. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer l'Initiative en pourcentage selon : Initiative% = Initiative × 50 / 228, le résultat étant arrondi à deux décimales près.
3. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer l'Attaque en pourcentage selon : Attaque% = Attaque × 50 / 384, le résultat étant arrondi à deux décimales près.
4. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer l'Esquive en pourcentage selon : Esquive% = Esquive × 50 / 444, le résultat étant arrondi à deux décimales près.
5. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer la Parade en pourcentage selon : Parade% = Parade × 50 / 336, le résultat étant arrondi à deux décimales près.
6. WHEN les compétences de base sont calculées, THE Moteur_de_Combat SHALL transformer la Riposte en pourcentage selon : Riposte% = Riposte × 50 / 312, le résultat étant arrondi à deux décimales près.
7. IF une valeur de pourcentage calculée est inférieure à 12.5, THEN THE Moteur_de_Combat SHALL plafonner cette valeur à 12.5.
8. IF une valeur de pourcentage calculée est supérieure à 87.5, THEN THE Moteur_de_Combat SHALL plafonner cette valeur à 87.5.

#### Propriétés de Correction

- **P3.1** : Pour toute compétence brute valide, le pourcentage résultant est dans [12.5, 87.5].
- **P3.2** : La transformation est monotone — une compétence brute plus élevée produit un pourcentage ≥.


### Exigence 4 : Ajustements Tactiques des Compétences

**User Story :** En tant que développeur, je veux que les tactiques choisies par minute modifient les compétences effectives, afin que les choix tactiques aient un impact direct sur les probabilités de succès.

#### Critères d'Acceptation

1. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster la Vivacité effective de chaque Combattant selon : Vivacité_eff = Vivacité% + (EO-5)×2 + (NA-5), où EO et NA sont les valeurs tactiques du Combattant pour cette minute (après application du plafonnement de fatigue sur NA).
2. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster l'Initiative effective de chaque Combattant selon : Initiative_eff = Initiative% + (EO-5) + (NA-5) + (EN-5), où EO, NA et EN sont les valeurs tactiques du Combattant pour cette minute (après application du plafonnement de fatigue sur NA).
3. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster l'Attaque effective de chaque Combattant selon : Attaque_eff = Attaque% + (EO-5) + (5-|DistanceArme - Distance|)×2, où DistanceArme est la distance optimale de l'arme du Combattant et Distance est la distance courante entre les deux Combattants (valeur entre 1 et 10).
4. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster l'Esquive effective de chaque Combattant selon : Esquive_eff = Esquive% + (5-EO) + (NA-5) + (5-EN), où EO, NA et EN sont les valeurs tactiques du Combattant pour cette minute (après application du plafonnement de fatigue sur NA).
5. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster la Parade effective de chaque Combattant selon : Parade_eff = Parade% + (5-EO) + (5-NA) + (5-EN), où EO, NA et EN sont les valeurs tactiques du Combattant pour cette minute (après application du plafonnement de fatigue sur NA).
6. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL ajuster la Riposte effective de chaque Combattant selon : Riposte_eff = Riposte% + (5-EO) + (5-NA) + (EN-5)×2, où EO, NA et EN sont les valeurs tactiques du Combattant pour cette minute (après application du plafonnement de fatigue sur NA).
7. WHEN les compétences effectives sont calculées, THE Moteur_de_Combat SHALL borner chaque valeur effective dans la plage 1 à 99 (minimum 1, maximum 99).
8. WHEN la Distance change au cours d'une minute (repositionnement), THE Moteur_de_Combat SHALL recalculer l'Attaque_eff des deux Combattants en utilisant la nouvelle Distance.

#### Propriétés de Correction

- **P4.1** : Pour toute combinaison de tactiques [1,10] et pourcentage [12.5, 87.5], la compétence effective est dans [1, 99].
- **P4.2** : Avec EO=NA=EN=5 et Distance=DistanceArme, les ajustements tactiques sont nuls (compétence_eff = compétence%).

### Exigence 5 : Système de Jets de Dés

**User Story :** En tant que développeur, je veux un système de jets uniforme basé sur la qualité (compétence - D100 - fatigue), afin que chaque action soit résolue de manière cohérente et prévisible.

#### Critères d'Acceptation

1. WHEN un jet de Vivacité est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéVivacité = Vivacité_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100] et Fatigue est la valeur de fatigue courante du Combattant (0, 5, 10, 15 ou 20 selon l'Exigence 7).
2. WHEN un jet d'Initiative est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéInitiative = Initiative_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100].
3. WHEN un jet d'Attaque est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéAttaque = Attaque_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100].
4. WHEN un jet d'Esquive est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéEsquive = Esquive_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100].
5. WHEN un jet de Parade est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéParade = Parade_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100].
6. WHEN un jet de Riposte est effectué pour un Combattant, THE Moteur_de_Combat SHALL calculer la qualité selon : QualitéRiposte = Riposte_eff - D100 - Fatigue, où D100 est un entier tiré uniformément dans [1, 100].
7. THE Moteur_de_Combat SHALL considérer un jet comme réussi quand la Qualité_de_Jet est supérieure ou égale à zéro, et comme échoué quand la Qualité_de_Jet est strictement inférieure à zéro.
8. THE Moteur_de_Combat SHALL utiliser un tirage D100 indépendant pour chaque jet de compétence, de sorte que deux jets effectués dans le même tempo utilisent chacun leur propre valeur aléatoire.

#### Propriétés de Correction

- **P5.1** : La qualité d'un jet est toujours égale à compétence_eff - D100 - fatigue (formule uniforme).
- **P5.2** : Chaque D100 est indépendant et uniformément distribué dans [1, 100].
- **P5.3** : Un jet est réussi si et seulement si qualité ≥ 0.

### Exigence 6 : Système d'Endurance et Fatigue

**User Story :** En tant que développeur, je veux un système d'endurance qui limite les actions des combattants fatigués et impose des malus progressifs, afin de simuler l'épuisement physique au cours du combat.

#### Critères d'Acceptation

1. THE Moteur_de_Combat SHALL calculer la Charge selon : Charge = Poids_Armes_Équipées + Math.floor(Poids_Armures / 4), avec une plage résultante de 2 à 30.
2. THE Moteur_de_Combat SHALL calculer le Portage selon : Portage = Force + Math.floor(Taille / 2), avec une plage résultante de 4 à 31.
3. THE Moteur_de_Combat SHALL calculer le Surcoût_Endurance selon : Surcoût = Math.floor(Math.max(0, Charge - Portage) × 10 / 26), avec une plage résultante de 0 à 10.
4. WHEN un Combattant effectue une attaque, THE Moteur_de_Combat SHALL déduire un coût d'endurance de : CoutAttaque = Poids_Arme (1-8) + NA (1-10) + Surcoût_Endurance (0-10).
5. WHEN un Combattant effectue une esquive, THE Moteur_de_Combat SHALL déduire un coût d'endurance de : CoutEsquive = NA (1-10) + Surcoût_Endurance (0-10).
6. WHEN un Combattant effectue une parade, THE Moteur_de_Combat SHALL déduire un coût d'endurance de : CoutParade = NA (1-10) + Surcoût_Endurance (0-10).
7. WHEN un Combattant effectue une récupération, THE Moteur_de_Combat SHALL ajouter 1 point d'endurance (GainEnduranceRecup = 1), sans dépasser ENDMAX.

#### Propriétés de Correction

- **P6.1** : Pour toute combinaison de FOR et TAI dans [1,24], Portage est dans [4, 31].
- **P6.2** : Surcoût_Endurance est toujours dans [0, 10].
- **P6.3** : L'endurance ne peut jamais dépasser ENDMAX après récupération.

### Exigence 7 : Test d'Endurance et Fatigue Progressive

**User Story :** En tant que développeur, je veux que l'endurance basse impose des malus de fatigue et des plafonds sur le Niveau d'Activité, afin de pénaliser progressivement les combattants épuisés.

#### Critères d'Acceptation

1. WHILE l'endurance d'un Combattant est inférieure ou égale à 10, THE Moteur_de_Combat SHALL appliquer une fatigue de 20 (soustraite de chaque Qualité_de_Jet) et plafonner le NA_effectif à Math.min(NA_effectif, 2) pour ce Combattant.
2. WHILE l'endurance d'un Combattant est inférieure ou égale à 20 et supérieure à 10, THE Moteur_de_Combat SHALL appliquer une fatigue de 15 et plafonner le NA_effectif à Math.min(NA_effectif, 4).
3. WHILE l'endurance d'un Combattant est inférieure ou égale à 30 et supérieure à 20, THE Moteur_de_Combat SHALL appliquer une fatigue de 10 et plafonner le NA_effectif à Math.min(NA_effectif, 6).
4. WHILE l'endurance d'un Combattant est inférieure ou égale à 40 et supérieure à 30, THE Moteur_de_Combat SHALL appliquer une fatigue de 5 et plafonner le NA_effectif à Math.min(NA_effectif, 8).
5. WHILE l'endurance d'un Combattant est supérieure à 40, THE Moteur_de_Combat SHALL appliquer une fatigue de 0 sans plafonnement du NA.
6. WHEN un Combattant effectue une action qui consomme de l'endurance, THE Moteur_de_Combat SHALL réévaluer le palier de fatigue immédiatement après la déduction d'endurance, en utilisant la nouvelle valeur pour les jets suivants.
7. WHEN le palier de fatigue impose un plafond NA inférieur au NA_effectif courant, THE Moteur_de_Combat SHALL réduire le NA_effectif au plafond du palier pour le reste de la minute en cours.

#### Propriétés de Correction

- **P7.1** : La fatigue est toujours l'une des valeurs {0, 5, 10, 15, 20} et correspond au palier d'endurance.
- **P7.2** : Le plafond NA est monotone décroissant avec l'endurance (endurance plus basse → plafond plus bas).
- **P7.3** : Après chaque action consommant de l'endurance, le palier est réévalué.


### Exigence 8 : Boucle de Combat Principale

**User Story :** En tant que développeur, je veux une boucle de combat structurée en minutes et tempos avec des phases clairement définies, afin de résoudre le combat de manière séquentielle et déterministe.

#### Critères d'Acceptation

1. WHEN un combat démarre, THE Moteur_de_Combat SHALL initialiser NumMinute à 1, Tempo à 1, nbTempoParMinute à 20, Distance à 10, les HP de chaque Combattant à leur HPMAX, et l'Endurance de chaque Combattant à leur ENDMAX.
2. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL résoudre la Phase Vivacité (jets de Vivacité pour désigner ATT et DEF) une unique fois pour la minute entière, puis appliquer les ajustements tactiques de la minute.
3. WHILE une minute est en cours, THE Moteur_de_Combat SHALL exécuter pour chaque tempo la séquence de phases suivante dans cet ordre : Phase Attaque → Phase Défense → Phase Résolution Dégâts → Phase Initiative → Phase Riposte.
4. WHEN le Tempo atteint nbTempoParMinute et que la séquence de phases du dernier tempo est terminée, THE Moteur_de_Combat SHALL incrémenter NumMinute et réinitialiser le Tempo à 1.
5. WHEN les HP d'un Combattant atteignent 0 ou moins à l'issue d'une Phase Résolution Dégâts, THE Moteur_de_Combat SHALL terminer le combat immédiatement avec une victoire pour l'autre Combattant.
6. IF les deux Combattants atteignent 0 HP ou moins lors de la même Phase Résolution Dégâts, THEN THE Moteur_de_Combat SHALL déclarer un match nul.
7. WHEN NumMinute dépasse 20 sans qu'un Combattant atteigne 0 HP, THE Moteur_de_Combat SHALL déclarer un match nul.

#### Propriétés de Correction

- **P8.1** : Le combat se termine toujours (soit par HP ≤ 0, soit par dépassement de 20 minutes).
- **P8.2** : Le nombre maximum de tempos est 20 × 20 = 400.
- **P8.3** : La vivacité n'est résolue qu'une fois par minute, pas à chaque tempo.

### Exigence 9 : Phase de Vivacité

**User Story :** En tant que développeur, je veux que la vivacité détermine quel combattant a l'initiative offensive au début de chaque minute, afin de créer un système dynamique d'échanges offensifs/défensifs.

#### Critères d'Acceptation

1. WHEN une nouvelle minute commence, THE Moteur_de_Combat SHALL faire effectuer un jet de Vivacité (QualitéVivacité = Vivacité_eff - D100 - Fatigue) à chaque Combattant pour déterminer le premier attaquant de cette minute.
2. WHEN les jets de Vivacité sont résolus, THE Moteur_de_Combat SHALL désigner le Combattant avec la QualitéVivacité la plus élevée comme ATT et l'autre comme DEF, indépendamment du signe des deux valeurs.
3. IF les deux Combattants obtiennent la même QualitéVivacité, THEN THE Moteur_de_Combat SHALL départager par un tirage aléatoire équiprobable (probabilité de 50% pour chaque Combattant).
4. WHEN les rôles ATT et DEF sont attribués par la phase de Vivacité, THE Moteur_de_Combat SHALL conserver cette attribution uniquement jusqu'à ce qu'un échange Initiative/Riposte inverse les rôles ou que la minute se termine.

#### Propriétés de Correction

- **P9.1** : Exactement un combattant est ATT et l'autre DEF après la phase de vivacité.
- **P9.2** : En cas d'égalité, le départage est équiprobable (50/50).

### Exigence 10 : Phase d'Attaque

**User Story :** En tant que développeur, je veux que l'attaquant puisse ajuster la distance avant de frapper et que la résolution d'attaque tienne compte de la distance à l'arme, afin de simuler le positionnement tactique.

#### Critères d'Acceptation

1. WHEN la phase d'attaque commence, THE Moteur_de_Combat SHALL calculer la distance souhaitée par ATT selon : DistanceSouhaitée = 11 - EN (plage résultante : 1 à 10).
2. IF DistanceSouhaitée est différente de la Distance actuelle, THEN THE Moteur_de_Combat SHALL déplacer la Distance d'un pas maximal de floor(NA/2) vers la DistanceSouhaitée, en maintenant la Distance dans les bornes 1 et 10.
3. IF DistanceSouhaitée est égale à la Distance actuelle, THEN THE Moteur_de_Combat SHALL conserver la Distance inchangée.
4. IF ATT ne peut pas payer le coût d'endurance de l'attaque (Poids_Arme + NA + Surcoût_Endurance > Endurance courante), THEN THE Moteur_de_Combat SHALL faire récupérer les deux Combattants (gain de 1 point d'endurance chacun), ignorer les phases Défense, Résolution Dégâts, Initiative et Riposte, et passer au tempo suivant.
5. WHEN ATT attaque, THE Moteur_de_Combat SHALL déduire le coût d'endurance de l'attaque de l'endurance d'ATT, puis résoudre le jet d'Attaque selon QualitéAttaque = Attaque_eff - D100 - Fatigue.
6. IF QualitéAttaque est supérieure ou égale à 0, THEN THE Moteur_de_Combat SHALL considérer l'attaque comme touchée et passer à la phase Défense.
7. IF QualitéAttaque est inférieure à 0, THEN THE Moteur_de_Combat SHALL considérer l'attaque comme ratée, ignorer les phases Défense et Résolution Dégâts, et passer directement à la phase Initiative.

#### Propriétés de Correction

- **P10.1** : La Distance reste toujours dans [1, 10] après repositionnement.
- **P10.2** : Le déplacement par tempo ne dépasse jamais floor(NA/2).
- **P10.3** : Si l'endurance est insuffisante, aucune attaque n'est résolue et les deux combattants récupèrent.

### Exigence 11 : Phase de Défense

**User Story :** En tant que développeur, je veux que le défenseur choisisse automatiquement entre esquive et parade selon ses compétences et son endurance, afin de simuler un choix défensif réaliste.

#### Critères d'Acceptation

1. WHEN ATT touche DEF, THE Moteur_de_Combat SHALL déterminer la défense de DEF en comparant Esquive_eff et Parade_eff : si Esquive_eff est strictement supérieure à Parade_eff, l'esquive est préférée ; sinon (Parade_eff ≥ Esquive_eff), la parade est préférée.
2. IF DEF ne peut pas payer le coût d'endurance de la défense préférée (endurance < coût de la défense préférée), THEN THE Moteur_de_Combat SHALL dégrader vers l'autre défense si l'endurance est suffisante pour la payer, ou vers un encaissement direct si aucune défense n'est payable.
3. WHEN DEF tente une esquive, THE Moteur_de_Combat SHALL résoudre un jet d'Esquive (QualitéEsquive = Esquive_eff - D100 - Fatigue ≥ 0 = succès) et déduire CoutEsquive de l'endurance de DEF.
4. WHEN DEF tente une parade, THE Moteur_de_Combat SHALL résoudre un jet de Parade (QualitéParade = Parade_eff - D100 - Fatigue ≥ 0 = succès) et déduire CoutParade de l'endurance de DEF.
5. IF DEF ne peut payer aucune défense (endurance < CoutEsquive ET endurance < CoutParade), THEN THE Moteur_de_Combat SHALL appliquer les dégâts directement sans jet défensif.
6. WHEN la défense de DEF réussit (esquive ou parade), THE Moteur_de_Combat SHALL annuler les dégâts de l'attaque et passer à la phase d'Initiative.

#### Propriétés de Correction

- **P11.1** : La défense choisie est toujours la meilleure option payable par l'endurance.
- **P11.2** : Si aucune défense n'est payable, les dégâts sont appliqués directement.
- **P11.3** : Une défense réussie annule toujours les dégâts.

### Exigence 12 : Phase d'Initiative et Riposte

**User Story :** En tant que développeur, je veux que l'attaquant puisse conserver l'initiative ou la perdre au profit d'une riposte du défenseur, afin de créer des retournements de situation dynamiques.

#### Critères d'Acceptation

1. WHEN ATT a résolu son attaque (touche ou rate), THE Moteur_de_Combat SHALL faire effectuer un jet d'Initiative à ATT selon : QualitéInitiative = Initiative_eff - D100 - Fatigue.
2. WHEN le jet d'Initiative d'ATT réussit (QualitéInitiative ≥ 0), THE Moteur_de_Combat SHALL permettre à ATT de conserver l'initiative et de retourner à la phase d'attaque.
3. WHEN le jet d'Initiative d'ATT échoue (QualitéInitiative < 0), THE Moteur_de_Combat SHALL déclencher la phase de Riposte pour DEF.
4. WHEN la phase de Riposte est déclenchée, THE Moteur_de_Combat SHALL faire effectuer un jet de Riposte à DEF selon : QualitéRiposte = Riposte_eff - D100 - Fatigue.
5. WHEN le jet de Riposte de DEF réussit (QualitéRiposte ≥ 0), THE Moteur_de_Combat SHALL inverser les rôles (DEF devient ATT, ATT devient DEF) et retourner à la phase d'attaque.
6. WHEN le jet de Riposte de DEF échoue (QualitéRiposte < 0), THE Moteur_de_Combat SHALL passer au tempo suivant.

#### Propriétés de Correction

- **P12.1** : Après la phase initiative/riposte, soit ATT conserve l'initiative, soit les rôles sont inversés, soit le tempo se termine.
- **P12.2** : Une riposte réussie inverse toujours les rôles ATT/DEF.

### Exigence 13 : Résolution des Dégâts

**User Story :** En tant que développeur, je veux un calcul de dégâts multi-facteurs prenant en compte l'arme, le matériau, les statistiques et les affinités, afin de produire des dégâts réalistes et variés.

#### Critères d'Acceptation

1. WHEN une attaque touche et la défense échoue, THE Moteur_de_Combat SHALL calculer les dégâts bruts selon : TotalDamage = Math.floor(BaseArme × modMateriau × coef_STATS × modAffinité × modTypeDégâts).
2. THE Moteur_de_Combat SHALL appliquer le modMateriau selon la table indexée par l'indice matériau (0-7) : 0=Bois→1.000, 1=Cuivre→1.250, 2=Étain→1.375, 3=Bronze→1.500, 4=Fer→1.625, 5=Fonte→1.750, 6=Acier→1.875, 7=Acier_damascène→2.000.
3. THE Moteur_de_Combat SHALL calculer coef_STATS selon : coef_STATS = 1 + (FOR-12)×0.02×poids_FOR + (ADR-12)×0.02×poids_ADR + (VIT-12)×0.02×poids_VIT + (TAI-12)×0.02×poids_TAI + (INT-12)×0.02×poids_INT, où chaque poids est un entier défini par le type d'arme.
4. THE Moteur_de_Combat SHALL calculer modAffinité selon : modAffinité = 1 + (Affinité_arme / 100), où Affinité_arme est la valeur d'affinité de l'arme envers la famille de la cible (comprise entre -100 et +100), avec une valeur par défaut de 0 si l'affinité est absente.
5. THE Moteur_de_Combat SHALL fixer modTypeDégâts à 1.0 (réservé pour développement futur).
6. WHEN les dégâts bruts sont calculés, THE Moteur_de_Combat SHALL appliquer la réduction d'armure selon : DégâtsFinals = Math.max(0, TotalDamage - Armure), garantissant que les dégâts finals sont toujours un entier non négatif.

#### Propriétés de Correction

- **P13.1** : TotalDamage est toujours ≥ 0 (tous les multiplicateurs sont positifs ou nuls).
- **P13.2** : DégâtsFinals est toujours ≥ 0 grâce au Math.max(0, ...).
- **P13.3** : coef_STATS est dans la plage [0.8, 1.2] pour des stats dans [1, 24].
- **P13.4** : modAffinité est dans la plage [0, 2] pour une affinité dans [-100, +100].

### Exigence 14 : Externalisation de la Configuration

**User Story :** En tant que développeur, je veux que toutes les constantes, formules et tables soient externalisées dans un fichier de configuration unique, afin de pouvoir ajuster l'équilibrage sans modifier la logique de combat.

#### Critères d'Acceptation

1. THE CombatConfig SHALL contenir toutes les constantes numériques utilisées dans les formules de combat (coefficients de compétences, diviseurs de normalisation, seuils de fatigue, table des matériaux), organisées en sections logiques.
2. THE CombatConfig SHALL contenir les paramètres de la boucle de combat (nbTempoParMinute, maxMinutes, distanceInitiale, distanceMin, distanceMax).
3. THE CombatConfig SHALL contenir les coûts d'endurance de base et les gains de récupération.
4. THE CombatConfig SHALL contenir les seuils et malus du système de fatigue sous forme de tableau indexé par palier.
5. THE Moteur_de_Combat SHALL lire toutes les constantes depuis le CombatConfig sans valeur codée en dur dans la logique de combat.
6. THE CombatConfig SHALL être un module JavaScript exportant un objet unique, importable via `require('./combatConfig')`.

#### Propriétés de Correction

- **P14.1** : Aucune constante numérique n'est codée en dur dans le module de combat (toutes proviennent du CombatConfig).
- **P14.2** : La modification d'une valeur dans CombatConfig modifie le comportement du combat sans recompilation.

### Exigence 15 : Remplacement de l'Ancien Système

**User Story :** En tant que développeur, je veux que le nouveau moteur de combat remplace intégralement l'ancien système, afin d'éliminer le code obsolète et d'assurer une base propre pour les développements futurs.

#### Critères d'Acceptation

1. WHEN le nouveau Moteur_de_Combat est déployé, THE Moteur_de_Combat SHALL remplacer l'intégralité du code de combat existant dans `server/game/combat.js`, de sorte qu'aucune fonction ni variable de l'ancienne implémentation ne subsiste.
2. THE Moteur_de_Combat SHALL exporter une fonction principale acceptant les données joueur et créature et retournant un objet contenant le log de combat, le vainqueur, et les HP finaux des deux combattants.
3. THE Moteur_de_Combat SHALL supprimer toute référence aux anciennes formules et mécaniques qui ne font pas partie de la nouvelle spécification.
4. THE Moteur_de_Combat SHALL conserver le même chemin d'import (`server/game/combat.js`) afin que les modules appelants n'aient pas besoin de modification.

#### Propriétés de Correction

- **P15.1** : Après déploiement, aucun code de l'ancien système ne subsiste dans combat.js.
- **P15.2** : L'interface d'entrée/sortie reste compatible avec les appelants existants.

### Exigence 16 : Extensibilité Future

**User Story :** En tant que développeur, je veux que l'architecture du moteur de combat soit conçue pour accueillir des extensions futures, afin de faciliter l'ajout de nouvelles mécaniques sans refonte majeure.

#### Critères d'Acceptation

1. THE Moteur_de_Combat SHALL isoler le calcul des dégâts dans une fonction dédiée qui reçoit modTypeDégâts en paramètre depuis le CombatConfig, de sorte que le remplacement de la valeur fixe 1.0 par une fonction de calcul ne nécessite aucune modification de la boucle principale.
2. THE Moteur_de_Combat SHALL isoler chaque phase de la boucle de combat (Vivacité, Attaque, Défense, Résolution Dégâts, Initiative, Riposte) dans une fonction distincte acceptant l'état du combat en entrée et retournant l'état modifié.
3. THE Moteur_de_Combat SHALL structurer les données du Combattant de manière à ce que l'ajout de propriétés supplémentaires (zones du corps, seconde arme, bouclier) ne nécessite aucune modification des fonctions existantes.
4. THE Moteur_de_Combat SHALL externaliser dans le CombatConfig la liste ordonnée des phases exécutées par tempo, de sorte que l'ajout ou la réorganisation de phases se fasse par modification de la configuration.

#### Propriétés de Correction

- **P16.1** : Chaque phase est une fonction isolée avec une interface entrée/sortie claire.
- **P16.2** : L'ajout d'une propriété au Combattant ne casse pas les fonctions existantes.
- **P16.3** : La séquence de phases est configurable sans modification du code.
