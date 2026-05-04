# Algorithme de Combat — Dungeon Crawler

> Ce document décrit l'intégralité de la logique de résolution du combat.
> Les données statiques (armes, armures, matériaux) restent dans les fichiers JSON et game_design.md.

---

## Philosophie

- Résolution probabiliste multicouches
- Séparation claire : toucher / défense / dégâts
- Forte influence des choix tactiques
- Une seule source d'aléa par étape
- Chaque action produit une qualité — opposition de qualités
- Jeu tactique — pas de pression temporelle, pas de réflexes requis

---

## Paramètres stratégiques (définis minute par minute, minutes 1 à 5)

| Paramètre | Signification | Plage |
|-----------|--------------|-------|
| **EO** (Effort Offensif) | Ratio attaque/défense | 1–10 |
| **NA** (Niveau d'Activité) | Intensité physique | 1–10 |
| **EN** (Engagement) | Distance de combat (1=loin, 10=corps à corps) | 1–10 |

**Distance souhaitée** = `11 - EN`

### Modificateurs dérivés (interpolation linéaire 1→10 donne 0.8→1.2)

| Modificateur | Paramètres |
|---|---|
| Vivacité | +EO +NA |
| Initiative | +EO +EN |
| Précision (attaque) | +NA +EN |
| Esquive | -EO +NA -EN |
| Parade | -EO -NA +EN |
| Riposte | -EO +NA +EN |
| Fatigue | +EO +NA |

### Archétypes de référence

| EO/NA/EN | Style | Vecteur de victoire |
|---|---|---|
| 10/10/10 | Berserker | Submerge vite, s'effondre si ça dure |
| 10/10/1 | Duelliste harceleur | Touche à distance, conserve plus longtemps |
| 10/1/10 | Étrangleur | Étouffe au corps à corps, lent mais implacable |
| 10/1/1 | Attaquant statique désengagé | Attaque sans se fatiguer, reste loin |
| 1/10/10 | Défenseur mobile engagé | Mobile au contact |
| 1/10/1 | Esquiveur parfait | Épuise l'adversaire par évitement |
| 1/1/10 | Contre-attaquant classique | Parade + riposte, attend l'erreur |
| 1/1/1 | Tortue | Épuise l'adversaire, ne prend aucun risque |

---

## Initialisation du combat

```
Minute = 1
Phase = 1
nbPhaseParMinute = 60
Endurance_A = (CON + VOL) × 5
Endurance_B = (CON + VOL) × 5
DistanceRéelle = 10
Momentum_A = 0
Momentum_B = 0
```

---

## Boucle de combat

### Début de minute

```
NA_effectif = NA × (endurance / endurance_max)
// Le NA est borné par la fatigue courante
```

---

### TICK DE COMBAT

#### 1. Phase d'initiative

```
scoreVivacité = Strat_NA + VIT×0.6 + INT×0.4 + d10 + momentum_bonus
momentum_bonus = momentum / 5  // arrondi

// Le combattant avec le score le plus élevé devient ATT (actif)
// L'autre devient DEF (non actif)
```

---

#### 2. Action du combattant actif (ATT)

**Choix de l'action :**
```
EO élevé  → attaque
EO faible → repositionnement ou récupération
```

**Test d'endurance :**
```
si endurance suffisante → action choisie effectuée
sinon → action dégradée :
    attaque          → repositionnement
    repositionnement → récupération
```

---

##### Action : Attaque

```
endurance -= NA × 0.1
Phase += weightWeapon  // défini dans weapon.json, ex: dague=1, warhammer=8

// Jet pour toucher
BaseAttack    = (ADR×0.5 + VIT×0.3 + INT×0.2) × 4
modEN         = abs(DistanceRéelle - WeaponEN) × 2
AttackScore   = BaseAttack - modEN
AttackQuality = AttackScore - D100

si AttackQuality > 0 → attaque touche
sinon               → attaque ratée
```

---

##### Action : Repositionnement

```
endurance -= NA × 0.05
Phase += 2

// La distance évolue vers la distance souhaitée par ATT
DistanceRéelle += (distanceSouhaitée_ATT - DistanceRéelle) × 0.5
```

---

##### Action : Récupération

```
endurance += 2 - NA × 0.1
// NA élevé → récupère moins vite (corps toujours en tension)
Phase += 1
```

---

#### 3. Réaction du combattant non actif (DEF)

```
si ATT a attaqué et touché :
    → défense obligatoire

si ATT a attaqué et raté :
    → possibilité de riposte

si ATT s'est repositionné ou a récupéré :
    si EO élevé
        → attaque (mêmes formules qu'ATT)
    sinon si distanceRéelle ≠ distanceSouhaitée_DEF
        → test de repositionnement : scoreRepo = (VIT×0.6 + INT×0.4) × 5
          RepoQuality = scoreRepo - D100
          si RepoQuality > 0 → repositionnement réussi, annule l'action d'ATT
    sinon
        → récupération
```

---

##### Réaction : Défense

```
// DEF choisit l'option la plus favorable
ScoreEsquive = [à définir]
ScoreParade  = [à définir]
Options : esquive / parade / encaisse
```

---

##### Réaction : Riposte (si ATT a raté)

```
// La riposte est une attaque avec bonus — mêmes contraintes d'endurance qu'une attaque normale
BaseRiposte    = (INT + ADR×0.5 + VIT×0.5) / 2
RiposteScore   = BaseRiposte + NA - DistanceRéelle
RiposteQuality = RiposteScore - D100

si RiposteQuality > 0 :
    DEF riposte
    DEF devient automatiquement ATT au prochain tick
    bonus précision +30% au jet d'attaque (si endurance suffisante)
```

---

#### 4. Résolution — Dégâts

```javascript
dégâtsBruts  = baseArme * modMatériau * modAffinité * coefStats * modTypeDégâts * modPortée

// Réduction armure (v1 — pas de localisation)
réductionArmure = Math.floor(
  (armure.corps.tier + armure.tête.tier + armure.bras.tier + armure.jambes.tier) / 4
)

dégâtsFinaux = Math.max(0, dégâtsBruts - réductionArmure)

// Bouclier — réduction supplémentaire si parade réussie
dégâtsFinaux = Math.max(0, dégâtsBruts - réductionArmure - bouclier.tier)

PV -= dégâtsFinaux

// v2 — localisation des dégâts
// zoneTouchée = aléatoire (40% corps, 25% jambes, 25% bras, 10% tête)
// réductionArmure = armure[zoneTouchée].tier
```

**baseArme** — interpolation linéaire entre damFirst (T1) et damLast (dernier tier) :
```javascript
baseArme = damFirst + (damLast - damFirst) * (tier - 1) / (nbTiers - 1)
// nbTiers déduit du nombre de modèles dans weapons.json
```

**modMatériau** — voir table matériaux dans game_design.md (1.0 Bois → 2.0 Acier damascène)

**modAffinité** — basé sur l'affinité de l'arme contre la famille de l'ennemi (-100 à +100) :
```javascript
modAffinité = 1 + (affinité / 100)
```

**coefStats** — influence modérée des stats du combattant (plage 0.8 → 1.2) :
```javascript
coefStats = 1
  + (force - 12)        * 0.02 * poidsForce
  + (adresse - 12)      * 0.02 * poidsAdresse
  + (vitesse - 12)      * 0.02 * poidsVitesse
  + (taille - 12)       * 0.02 * poidsTaille
  + (intelligence - 12) * 0.02 * poidsIntelligence
```

**modPortée** — pénalité si distance réelle éloignée de la portée optimale de l'arme :
```javascript
écartPortée        = Math.abs(EN - portéeOptimale)
modPortée_Précision = 1 - écartPortée * 0.08
modPortée_Dégâts    = 1 - écartPortée * 0.04
```

**modTypeDégâts** — selon le type de l'arme vs armure et défense :

| Type | vs Armure lourde | vs Armure légère | vs Parade | vs Esquive |
|---|---|---|---|---|
| Impact | Faible (0.9) | Fort (1.1) | Fort (1.1) | Faible (0.9) |
| Blunt | Très fort (1.2) | Très faible (0.8) | Très fort (1.2) | Très faible (0.8) |
| Pierce | Fort (1.1) | Faible (0.9) | Très faible (0.8) | Très fort (1.2) |
| Edged | Très faible (0.8) | Très fort (1.2) | Faible (0.9) | Fort (1.1) |

*Armure lourde = tier armure corps > 8, armure légère = tier ≤ 8*

---

#### 5. Mise à jour du momentum

| Événement | Variation |
|-----------|-----------|
| Touche infligée | +2 |
| Touche critique | +3 |
| Attaque parée | -1 |
| Attaque esquivée | -1 |
| Distance imposée (EN gagne) | +1 |
| Initiative gagnée plusieurs fois de suite | +1 |

```
momentum = clamp(momentum, -10, 10)
```

---

#### 6. Fin de tick — mise à jour des états

```
si Phase >= nbPhaseParMinute :
    Endurance_A -= Strat_NA_A
    Endurance_B -= Strat_NA_B
    Phase = 1
    Minute++
    → Début minute
sinon :
    → Nouveau tick
```

---

## Interface de combat

1. **Écran de préparation** : choix EO/NA/EN par minute + équipement
2. **Résolution automatique** côté serveur
3. **Écran de résultat** : journal minute par minute

**Tags de résultat :**
- 🔴 Touché — 🟢 Esquivé — 🔵 Paré — ⚫ Raté

---

## Points ouverts

- Formules complètes de défense (esquive / parade)
- Gestion des états altérés (essoufflé, déséquilibré, acculé, brisé)
- Localisation des touches (v2)