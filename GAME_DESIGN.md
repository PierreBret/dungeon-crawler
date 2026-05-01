# GAME DESIGN — Dungeon Crawler (DC)

---

## Vision générale

Jeu tactique de type die-and-retry. Le combat est la conséquence des préparations — équipement, forge, affinités, stratégie. Multijoueur PvPvE prévu en v2.

**Inspirations principales :**
- **Duel2 (Duelmasters)** — combat par stratégie prédéfinie, résolution automatique, profondeur tactique
- **Vagrant Story** — affinités arme/ennemi, progression forge, profondeur des builds
- **Dark Souls** — difficulté, die-and-retry, progression longue et exigeante
- **Slay the Spire** — navigation dans le donjon avec chemins multiples (influence visuelle uniquement)

---

## Stack technique

- **Client** : JavaScript, Canvas (pas de Phaser pour l'instant)
- **Serveur** : Node.js + Express + Socket.io
- **Architecture** : client/serveur autoritaire — toute logique de jeu côté serveur
- **Convention** : variables et fonctions en anglais, affichage en français

---

## Règles de développement

- Single Source of Truth : chaque donnée n'existe qu'à un seul endroit
- Les données statiques (armes, armures, bestiaire) viennent uniquement des fichiers JSON
- Pas de duplication de données dans le code client ou serveur
- Avant d'écrire du code, vérifier que la donnée n'existe pas déjà

---

## Principes fondamentaux

- Tout arrondi se fait avec `Math.floor` — toujours au détriment du joueur (anti sur-optimisation)
- Une seule source d'aléa par étape de résolution
- Chaque action produit une qualité — le combat est une opposition de qualités
- Jeu tactique — pas de pression temporelle, pas de réflexes requis
- Les valeurs numériques sont des placeholders à ajuster pendant l'équilibrage

---

## Structure du donjon

- 100 étages
- 4 créatures par étage (positions aléatoires à la génération)
- 1 gardien tous les 10 étages (tier supérieur)
- 1 forge en libre service par étage (utilisable à volonté)
- 1 terrain d'entraînement par étage (usage unique)
- 1 passage vers l'étage suivant (double sens)

**Règles :**
- Les créatures tuées le sont définitivement
- Les étages déjà traversés sont persistants dans le run
- Chaque étage est généré procéduralement à sa première découverte
- La mort est définitive (roguelite)
- Pas de marchand en v1

**Répartition des tiers par zone :**

| Étages | Tiers dominants |
|---|---|
| 1-10 | Tier 1 majoritaire |
| 11-20 | Tier 2 dominant |
| 21-35 | Tiers 2-3 |
| 36-50 | Tier 3 dominant |
| 51-65 | Tiers 3-4 |
| 66-80 | Tier 4 dominant |
| 81-95 | Tiers 4-5 |
| 96-100 | Tiers 5-6, endgame brutal |

**Gardiens :**

| Étage | Tier gardien |
|---|---|
| 10 | Tier 2 |
| 20 | Tier 3 |
| 30 | Tier 3 élite |
| 40 | Tier 4 |
| 50 | Tier 4 élite |
| 60 | Tier 5 |
| 70 | Tier 5 élite |
| 80 | Tier 6 |
| 90 | Tier 6 élite |
| 100 | Tier 7 (boss final) |

---

## Progression méta (roguelite)

### Prime de départ

Le total des stats du nouveau personnage dépend du niveau maximum franchi lors de la dernière partie :

```
Débutant (jamais joué)  → targetTotal = 70  (moyenne 10 par stat)
Niveau 50 franchi       → targetTotal = 84  (moyenne 12 par stat)
Niveau 100 franchi      → targetTotal = 98  (moyenne 14 par stat)
```

```javascript
targetTotal = 70 + Math.floor(niveauMaxFranchi / 100 * 28)
```

### Génération des candidats

**3d7 par stat** (min=3, max=21 par stat), sans bonus. Somme totale exacte = `targetTotal`.

```javascript
function isStatsValid(stats, targetTotal) {
  const total = Object.values(stats).reduce((sum, v) => sum + v, 0)
  const allInRange = Object.values(stats).every(v => v >= 3 && v <= 21)
  return total === targetTotal && allInRange
}
```

Le joueur choisit parmi **3 candidats** générés avec ce système.

### Objectifs endgame

| Objectif | Combats nécessaires |
|---|---|
| Affinité max une famille | ~50 combats |
| Affinité max toutes familles | ~300 combats |
| Finir le donjon | ~400 combats |

---

## Personnage joueur

### Caractéristiques

| Nom affiché | Clé dans le code |
|---|---|
| Force | stats.force |
| Constitution | stats.constitution |
| Taille | stats.taille |
| Intelligence | stats.intelligence |
| Volonté | stats.volonté |
| Vitesse | stats.vitesse |
| Adresse | stats.adresse |

### Scores dérivés (internes, non visibles par le joueur)

```javascript
attack    = adresse * 0.5 + vitesse * 0.3 + intelligence * 0.2
parry     = adresse * 0.4 + force * 0.3 + volonté * 0.3
dodge     = vitesse * 0.5 + adresse * 0.3 - taille * 0.2
damage    = force * 0.6 + taille * 0.4
init      = vitesse * 0.6 + intelligence * 0.4
hp        = constitution * 2 + taille      // à 0 = mort
endurance = constitution + volonté         // à 0 = épuisement
```

### Entraînement

Chance d'augmenter une stat de 1 (sauf taille) — usage unique par étage :
```javascript
chanceEntrainement = (volonté * 5) / (1 + nombreAugmentationsDéjàEffectuées)
// résultat en pourcentage
```

---

## Système de combat

### Philosophie

- Résolution probabiliste multicouches
- Séparation claire : toucher / défense / dégâts
- Forte influence des choix tactiques
- Une seule source d'aléa par étape
- Chaque action produit une qualité — opposition de qualités
- Jeu tactique — pas de pression temporelle, pas de réflexes requis

### Stratégie (définie minute par minute, minutes 1 à 5)

Trois paramètres entre 1 et 10 :

| Paramètre | Signification |
|---|---|
| EO (Effort Offensif) | Ratio attaque/défense |
| NA (Niveau d'Activité) | Intensité physique |
| EN (Engagement) | Distance de combat (1=loin, 10=corps à corps) |

**Modificateurs dérivés (interpolation linéaire 1→10 donne 0.8→1.2) :**

| Modificateur | Paramètres |
|---|---|
| Vivacité | +EO +NA |
| Initiative | +EO +EN |
| Précision (attaque) | +NA +EN |
| Esquive | -EO +NA -EN |
| Parade | -EO -NA +EN |
| Riposte | -EO +NA +EN |
| Fatigue | +EO +NA |

**Archétypes de référence :**

| EO/NA/EN | Style |
|---|---|
| 10/10/10 | Berzerker — aucune défense, épuisement rapide |
| 10/10/1 | Duelliste attaquant |
| 10/1/10 | Attaquant statique corps à corps |
| 1/10/10 | Défenseur mobile corps à corps |
| 1/10/1 | Défenseur mobile désengagé — esquive parfaite |
| 1/1/10 | Contre-attaquant — parade + riposte |
| 1/1/1 | Parade complète — épuise l'adversaire |

### Résolution du combat (boucle par minute)

1. **Vivacité** : chaque combattant tire `vivaciteScore - d100`. Si ≤ 0 → pas d'opportunité. Le plus haut attaque.
2. **Attaque** : `attackQuality = attackScore - d100`. Si ≤ 0 → raté.
3. **Défense** : le défenseur choisit automatiquement la meilleure option selon ses scores et son endurance.
   - Esquive réussie si `dodgeQuality > attackQuality`
   - Parade réussie si `parryQuality > attackQuality`
   - Si endurance insuffisante → subit sans défense
4. **Riposte** : après une attaque ratée, parée ou esquivée, le défenseur tente une riposte.
   - Si attaque ratée → jet de riposte simple
   - Si attaque parée ou esquivée → jet de riposte en opposition avec l'initiative de l'attaquant
5. **Dégâts** : si défense échouée → jet indépendant puis réduction armure
6. **Endurance** : coût par action + coût minimum par minute

### Résolution de la riposte

```javascript
// Score de riposte (modifié par -EO +NA +EN)
riposteScore   = intelligence + adresse * 0.5 + vitesse * 0.5
riposteQuality = riposteScore - d100  // une seule source d'aléa

// Cas 1 — attaque ratée : riposte simple
if (riposteQuality > 0) {
  lancerAttaque(défenseur, attaquant, bonusQualité = +20)
}

// Cas 2 — attaque parée ou esquivée : opposition avec l'initiative de l'attaquant
initQuality = initScore - d100  // jet de l'attaquant

if (riposteQuality > initQuality) {
  // Le défenseur prend l'initiative → riposte avec bonus
  lancerAttaque(défenseur, attaquant, bonusQualité = +20)
} else {
  // L'attaquant conserve l'initiative → pas de riposte
}

// Résolution de l'attaque de riposte
attackQuality = attackScore - d100 + 20  // +20 bonus riposte
// La défense adverse doit battre attackQuality+20 pour esquiver ou parer
// Les dégâts sont identiques à une attaque normale
```

**Principe :** une riposte est plus difficile à défendre, mais ne fait pas plus de dégâts.
Le modificateur `(-EO +NA +EN)` s'applique à `riposteScore` — archétype `(1/10/10)` = meilleur riposteur.

### Calcul des dégâts

```javascript
dégâtsBruts = baseArme * modMatériau * modAffinité * coefStats * modTypeDégats

// Réduction armure (v1 — pas de localisation)
réductionArmure = Math.floor(
  (armure.corps.tier + armure.tête.tier + armure.bras.tier + armure.jambes.tier) / 4
)

dégâtsFinaux = Math.max(0, dégâtsBruts - réductionArmure)

// v2 — localisation des dégâts
// zoneTouchée = aléatoire (40% corps, 25% jambes, 25% bras, 10% tête)
// réductionArmure = armure[zoneTouchée].tier
```

**Détail des composantes :**

```javascript
// baseArme : interpolation linéaire entre damFirst (T1) et damLast (dernier tier)
baseArme = damFirst + (damLast - damFirst) * (tier - 1) / (nbTiers - 1)

// modMatériau : 1.0 (Bois) → 2.5 (Acier damascène) — voir table matériaux

// modAffinité : basé sur l'affinité de l'arme contre la famille de l'ennemi (-100 à +100)
modAffinité = 1 + (affinité / 100)
// affinité -100 → 0 (annule les dégâts)
// affinité    0 → 1 (neutre)
// affinité  100 → 2 (double les dégâts)

// coefStats : influence modérée des stats du combattant (plage 0.8 → 1.2)
coefStats = 1
  + (force - 12)        * 0.02 * poidsForce
  + (adresse - 12)      * 0.02 * poidsAdresse
  + (vitesse - 12)      * 0.02 * poidsVitesse
  + (taille - 12)       * 0.02 * poidsTaille
  + (intelligence - 12) * 0.02 * poidsIntelligence

// modTypeDégats : selon type d'arme et contexte
// Très fort=1.2  Fort=1.1  Faible=0.9  Très faible=0.8
```

**Types de dégâts vs armure et défense :**

| Type | vs Armure lourde | vs Armure légère | vs Parade | vs Esquive |
|---|---|---|---|---|
| Impact | Faible (0.9) | Fort (1.1) | Fort (1.1) | Faible (0.9) |
| Blunt | Très fort (1.2) | Très faible (0.8) | Très fort (1.2) | Très faible (0.8) |
| Pierce | Fort (1.1) | Faible (0.9) | Très faible (0.8) | Très fort (1.2) |
| Edged | Très faible (0.8) | Très fort (1.2) | Faible (0.9) | Fort (1.1) |

*Note : armure lourde = tier armure corps > 8, armure légère = tier ≤ 8*

### Portée optimale par arme

```javascript
écartPortée = Math.abs(EN - portéeOptimale)
modPortée_Precision = 1 - écartPortée * 0.08
modPortée_Degats    = 1 - écartPortée * 0.04
// EN = engagement du combattant (1=loin, 10=corps à corps)
// portéeOptimale définie par arme (ex: dague=9, lance longue=2)
```

### Endurance — coûts

```javascript
poidsPorté    = poidsMainDroite + poidsMainGauche + poidsArmureTotal
// poidsArmureTotal = somme des tiers des 4 pièces équipées
// (poids = tier dans la table armures)

coutAction    = coutBase * poidsPorté
coutMinMinute = Math.floor(NA * 0.2 + EO * 0.1)  // anti-stalemate
```

**Seuils :**
- Endurance < 25% → fatigueRatio appliqué à tous les jets
- Endurance = 0 → épuisé, hors combat

---

## Armes

### Table des armes

| Code | Type d'arme | Dam first | Dam last | nb tiers | Mains | Type dégâts | poids FOR | poids TAI | poids INT | poids VIT | poids ADR | Portée optimale (EN) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DA | Dague | 10 | 42 | 7 | 1 | Piercing | 0.6 | 0.0 | 0.3 | 0.7 | 1.4 | 9 |
| SH | Epée courte | 11 | 44 | 7 | 1 | Piercing | 0.7 | 0.1 | 0.3 | 0.7 | 1.2 | 7 |
| SA | Sabre | 13 | 54 | 7 | 1 | Edged | 0.7 | 0.2 | 0.2 | 1.1 | 0.8 | 7 |
| EP | Rapière | 12 | 59 | 4 | 1 | Piercing | 0.4 | 0.0 | 0.6 | 0.8 | 1.2 | 6 |
| LO | Epée longue | 12 | 56 | 6 | 1 | Edged | 0.9 | 0.3 | 0.3 | 0.7 | 0.8 | 6 |
| BS | Epée large | 13 | 54 | 5 | 1 | Impact | 1.3 | 0.6 | 0.1 | 0.4 | 0.6 | 5 |
| GS | Epée à 2 mains | 21 | 79 | 5 | 2 | Impact | 1.2 | 0.8 | 0.2 | 0.4 | 0.4 | 5 |
| HA | Hachette | 10 | 41 | 4 | 1 | Impact | 1.2 | 0.4 | 0.2 | 0.6 | 0.6 | 6 |
| BA | Hache de bataille | 13 | 56 | 5 | 1 | Edged | 1.2 | 0.7 | 0.1 | 0.3 | 0.7 | 5 |
| GA | Hache à 2 mains | 21 | 80 | 4 | 2 | Edged | 1.2 | 0.8 | 0.1 | 0.2 | 0.7 | 4 |
| MA | Masse | 11 | 47 | 7 | 1 | Blunt | 1.3 | 0.5 | 0.1 | 0.2 | 0.9 | 5 |
| FL | Fléau | 12 | 60 | 5 | 1 | Blunt | 0.9 | 0.4 | 0.8 | 0.3 | 0.6 | 6 |
| WH | Marteau de guerre | 24 | 84 | 5 | 2 | Blunt | 1.3 | 0.7 | 0.1 | 0.1 | 0.8 | 4 |
| SS | Lance courte | 12 | 51 | 6 | 1 | Piercing | 0.6 | 0.4 | 0.4 | 0.7 | 0.9 | 5 |
| LS | Lance à 2 mains | 22 | 79 | 8 | 2 | Piercing | 0.6 | 0.7 | 0.3 | 0.5 | 0.9 | 3 |
| PA | Arme d'hast | 23 | 87 | 7 | 2 | Impact | 1.0 | 0.9 | 0.3 | 0.4 | 0.4 | 3 |
| QS | Baton de combat | 19 | 71 | 6 | 2 | Blunt | 0.7 | 0.7 | 0.4 | 0.6 | 0.6 | 4 |
| SC | Faux | 23 | 84 | 6 | 2 | Edged | 0.8 | 0.9 | 0.4 | 0.4 | 0.5 | 4 |

### Exemple de progression — Masse (7 tiers)

```
Massue (T1) + Gourdain (T2)               = Casse-tête (T3)
Gourdain (T2) + Casse-tête (T3)           = Masse d'arme (T4)
Casse-tête (T3) + Masse d'arme (T4)       = Masse à ailettes (T5)
Masse d'arme (T4) + Masse à ailettes (T5) = Morgenstern (T6)
Morgenstern (T6) + Morgenstern (T6)       = Mjolnir (T7)
```

---

## Matériaux des armes

8 matériaux, dimension indépendante du tier :

```
Bois=0, Cuivre=1, Étain=2, Bronze=3, Fer=4, Fonte=5, Acier=6, Acier damascène=7
```

### Influence sur les dégâts (modMatériau)

```
Bois            = 1.0
Cuivre          = 1.21
Étain           = 1.43
Bronze          = 1.64
Fer             = 1.86
Fonte           = 2.07
Acier           = 2.29
Acier damascène = 2.5
```
*Valeurs à ajuster pendant l'équilibrage.*

### Drops

- Bois et Cuivre disponibles dès l'étage 1
- T1 et T2 (tier et matériau) disponibles dès le début
- Matériaux supérieurs apparaissent progressivement avec les étages

---

## Armures

4 emplacements : corps, tête, bras, jambes.
16 tiers par emplacement. Pas de matériau — il est implicite dans le nom.
**Poids = tier** de la pièce. **Réduction flat = tier** de la pièce.

### Table des armures

| Tier | Corps | Tête | Bras | Jambes |
|---|---|---|---|---|
| 1 | Jerkin | Bandana | Bandage | Sandals |
| 2 | Leather | Leather Cap | Leather Glove | Boots |
| 3 | Padded Leather | Steel Cap | Reinforced Glove | Long Boots |
| 4 | Cuirass | Bone Helm | Knuckles | Cuisse |
| 5 | Banded Mail | Chain Coif | Ring Sleeve | Light Greave |
| 6 | Ring Mail | Spangenhelm | Chain Sleeve | Ring Legging |
| 7 | Chain Mail | Cabasset | Gauntlet | Chain Leggings |
| 8 | Breastplate | Sallet | Vambrace | Fuzzkampf |
| 9 | Segmentata | Barbut | Plate Glove | Poleyn |
| 10 | Scale Armor | Basinet | Rondanche | Jambeau |
| 11 | Brigandine | Armet | Tilt Glove | Missaglia |
| 12 | Plate Mail | Close Helm | Freiturner | Plate Leggings |
| 13 | Fluted Armor | Burgonet | Fluted Glove | Fluted Leggings |
| 14 | Hoplite Armor | Hoplite Helm | Hoplite Glove | Hoplite Leggings |
| 15 | Jazeraint Armor | Jazeraint Helm | Jazeraint Glove | Jazeraint Leggings |
| 16 | Dread Armor | Dread Helm | Dread Glove | Dread Leggings |

### Réduction des dégâts

```javascript
// v1 — pas de localisation
réductionArmure = Math.floor(
  (armure.corps.tier + armure.tête.tier + armure.bras.tier + armure.jambes.tier) / 4
)
dégâtsFinaux = Math.max(0, dégâtsBruts - réductionArmure)

// v2 — localisation des dégâts
// zoneTouchée = aléatoire (40% corps, 25% jambes, 25% bras, 10% tête)
// réductionArmure = armure[zoneTouchée].tier
```

### Poids total d'armure

```javascript
poidsArmureTotal = armure.corps.tier + armure.tête.tier + armure.bras.tier + armure.jambes.tier
// ex: Breastplate(8) + Sallet(8) + Vambrace(8) + Poleyn(9) = 33
```

### Armure lourde vs légère (pour modTypeDégâts)

```javascript
// basé sur le tier du corps uniquement
armureLourde = armure.corps.tier > 8
```

### Progression à la forge

```
T(n) + T(n+1) = T(n+2)   ← règle générale jusqu'à T13
T14  + T14    = T15       ← 1ère rupture : même tier
T15  + T15    = T16       ← 2ème rupture : même tier
```

Recette non définie → `Math.floor((tierA + tierB) / 2) + 1`

Pas de matériau pour les armures — pas de recette matériau.

---

## Forge — Armes

### Tier résultant

```
T(n) + T(n+1) = T(n+2)
T(max-1) + T(max-1) = T(max)  ← exception dernier tier
```

Recette non définie :
```javascript
tierRésultant = Math.floor((tierA + tierB) / 2) + 1
```

### Matériau résultant

Recettes valides :
```
Bois(0)   + Cuivre(1) = Étain(2)
Cuivre(1) + Étain(2)  = Bronze(3)
Étain(2)  + Bronze(3) = Fer(4)
Fer(4)    + Fer(4)    = Fonte(5)           ← 1ère rupture : même matériau
Fonte(5)  + Bronze(3) = Acier(6)           ← 2ème rupture : bronze affine la fonte
Acier(6)  + Acier(6)  = Acier damascène(7) ← 3ème rupture : même matériau
```

**Logique narrative :**
- Fer + Fer : le métal se densifie en se repliant → Fonte
- Fonte + Bronze : le bronze affine et purifie la fonte → Acier
- Acier + Acier : replié sur lui-même, atteint sa forme ultime → Acier damascène

Recette non définie :
```javascript
matériauRésultant = Math.floor((indexA + indexB) / 2)
```

### Affinité résultante

```javascript
affinitéRésultante = Math.floor((affinitéA + affinitéB) / 2)  // par famille
```

### Règles générales

- Le joueur place 2 pièces sur la forge pour voir le résultat avant de confirmer
- Tiers et matériaux non affichés — la découverte des recettes fait partie du jeu
- Toute combinaison non valide = perte ou stagnation

### Exemples

```
T1 Cuivre + T2 Étain  → T3 Bronze         (deux recettes valides)
T1 Fonte  + T2 Bronze → T3 Acier          (tier valide, recette matériau valide)
T1 Acier  + T2 Acier  → T3 Acier          (tier valide, pas de recette → moyenne 6)
Fer       + Fonte     → même tier, Fer    (pas de recette → moyenne floor(4+5/2)=4)
```

---

## Équipement — Main droite et main gauche

### Combinaisons possibles

| Système | Vivacité | Initiative | Parade | Poids porté |
|---|---|---|---|---|
| Arme 1 main seule | Normal | Normal | Sans bonus | Arme |
| Arme 2 mains | Normal | Normal | Sans bonus | Arme |
| 2 armes 1 main | ×1.2 | ×1.2 | ×1.15 | 2 armes |
| Arme 1 main + bouclier | Normal | Normal | ×1.3 + réduction flat | Arme + bouclier |

### Règles d'équipement

```javascript
// Arme 2 mains → vide automatiquement la main gauche
if (arme.mains === 2) mainGauche = null

// Main gauche accepte uniquement :
// - arme 1 main
// - bouclier
// - vide

// Arme 2 mains ne peut jamais être équipée en main gauche
```

### Poids porté

```javascript
poidsPorté = poidsMainDroite + poidsMainGauche + poidsArmureTotal
// poidsMainGauche = 0 si vide, tier du bouclier, ou poids de l'arme gauche
```

### Bouclier — réduction supplémentaire si parade réussie

```javascript
// Parade réussie avec bouclier
réductionParade = bouclier.tier  // flat, comme l'armure

// Dégâts finaux
dégâtsFinaux = Math.max(0, dégâtsBruts - réductionArmure - réductionParade)
```

---

## Boucliers

16 tiers. Même règle de progression à la forge que les armures :
```
T(n) + T(n+1) = T(n+2)   ← règle générale jusqu'à T13
T14  + T14    = T15       ← 1ère rupture
T15  + T15    = T16       ← 2ème rupture
```

Poids = tier. Réduction flat = tier (appliquée si parade réussie).

| Tier | Bouclier |
|---|---|
| 1 | Buckler |
| 2 | Targe |
| 3 | Pelta Shield |
| 4 | Quad Shield |
| 5 | Circle Shield |
| 6 | Tower Shield |
| 7 | Spiked Shield |
| 8 | Round Shield |
| 9 | Kite Shield |
| 10 | Casserole Shield |
| 11 | Heater Shield |
| 12 | Oval Shield |
| 13 | Knight Shield |
| 14 | Hoplite Shield |
| 15 | Jazeraint Shield |
| 16 | Dread Shield |

---

## Familles d'ennemis et affinités

### Les 6 familles

```
Bestial
Élémentaire
Féérique
Démoniaque
Undead
Reptilien
```

### Système d'affinité

Vaincre un ennemi → **+2** sur sa famille, **-1** sur les 2 familles suivantes dans la liste (circulaire).

```
Bestial     → +2  |  Élémentaire -1  |  Féérique -1
Élémentaire → +2  |  Féérique -1     |  Démoniaque -1
Féérique    → +2  |  Démoniaque -1   |  Undead -1
Démoniaque  → +2  |  Undead -1       |  Reptilien -1
Undead      → +2  |  Reptilien -1    |  Bestial -1
Reptilien   → +2  |  Bestial -1      |  Élémentaire -1
```

**Logique narrative :**
- Bestial (chaos) → perd contre loi (Élémentaire, Féérique)
- Élémentaire (matériel) → perd contre autres plans (Féérique, Démoniaque)
- Féérique (divin) → perd contre impie (Démoniaque, Undead)
- Démoniaque (chaud) → perd contre froid (Undead, Reptilien)
- Undead (mort) → perd contre vivant (Reptilien, Bestial)
- Reptilien (calme) → perd contre sauvage (Bestial, Élémentaire)

**Affinité max : 100** (~50 ennemis d'une même famille sans malus)

---

## Représentation visuelle

### Dans le donjon (canvas)

- Joueur : silhouette Unicode
- Ennemis : emojis Unicode (ex: gobelin 👺)
- Escalier : 🔽
- Forge : ⚒️
- Terrain d'entraînement : 🎯

### Interface de combat

1. **Écran de préparation** : choix EO/NA/EN par minute + équipement
2. **Résolution automatique** côté serveur
3. **Écran de résultat** : journal minute par minute avec tags colorés et qualités

**Tags de résultat :**
- 🔴 Touché
- 🟢 Esquivé
- 🔵 Paré
- ⚫ Raté

---

## Roadmap v2

- Localisation des dégâts (40% corps, 25% jambes, 25% bras, 10% tête)
- Effets critiques par zone (malus stats selon zone endommagée)
- Ciblage de zone via la stratégie
- Créatures mobiles dans le donjon
- Furtivité (classes)
- Marchand
- Multijoueur PvPvE
---

## Architecture des données

### Données statiques (fichiers JSON — chargés au démarrage)

```
server/data/
├── weapons.json      // table des 18 types d'armes
├── armors.json       // table des armures par emplacement
├── shields.json      // table des boucliers
└── bestiary.json     // créatures avec stats et stratégies
```

### Données dynamiques (SQLite — progression joueur)

```sql
-- Profil méta (persiste entre les runs)
players
  id, name, niveauMaxFranchi, createdAt

-- Run en cours
runs
  id, playerId, etageActuel, statut (actif/mort), createdAt

-- Personnage du run
character
  id, runId, force, constitution, taille, intelligence,
  volonte, vitesse, adresse, hp, endurance,
  augmentations (JSON — nb augmentations par stat)

-- Inventaire du run
inventory
  id, runId, itemType (weapon/armor/shield), itemCode,
  tier, materiau,
  affinite_bestial, affinite_elementaire, affinite_feerique,
  affinite_demoniaque, affinite_undead, affinite_reptilien,
  equipped (boolean),
  slot (rightHand/leftHand/corps/tete/bras/jambes)

-- Étages visités du run
floors
  id, runId, etage, dungeon (JSON), cleared
```

### Structure serveur

```
server/
├── db/
│   ├── database.js    // connexion SQLite (better-sqlite3)
│   ├── schema.js      // création des tables
│   └── queries.js     // fonctions CRUD
└── data/
    ├── weapons.json
    ├── armors.json
    ├── shields.json
    └── bestiary.json
```

### Ordre de développement

```
1. Donjon enrichi (créatures, forge, entraînement, passage)
2. Inventaire (stockage SQLite)
3. Équipement (armes, armures, bouclier)
4. Forge (fusion tier + matériau + affinité)
5. Entraînement (jet de chance selon volonté)
6. Combat (resolver.js)
```
