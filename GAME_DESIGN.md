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

## Conventions de code

Tous les noms des fichiers js sont en minuscule.

### Fonctions passées en paramètre
Toujours nommer les fonctions passées en argument — jamais de fonctions anonymes.
Les fonctions anonymes sont invisibles pour l'IDE (Ctrl+Shift+O) et difficiles à débugger.

```javascript
// ❌ Interdit — fonction anonyme, invisible pour l'IDE
handleEquipKeys(e, state.camp, (itemId, slot) => { ... });

// ✅ Correct — fonction nommée, trouvable et débugable
function onEquip(itemId, slot) { ... }
handleEquipKeys(e, state.camp, onEquip);
```

Les fonctions locales à une autre fonction sont autorisées si elles ont un nom
et accèdent au scope parent (closure) — c'est le cas typique des callbacks socket.

### Thème visuel
Tout fichier UI importe `THEME` depuis `core/theme.js` et utilise ses valeurs
pour les couleurs et polices. Aucune couleur ou police hardcodée dans le code UI.
Règle appliquée progressivement : chaque modification d'un fichier UI inclut
la migration vers THEME pour ce fichier.

```javascript
import { THEME } from "../core/theme.js";
ctx.fillStyle = THEME.text.primary;
ctx.font      = THEME.font.body;
// Stats (uniforme dans toute l'application) :
ctx.font      = THEME.components.statLabel.font;
ctx.fillStyle = THEME.components.statLabel.color;
```

---

## Règles de validation du code

### Fonctions exportées
Toujours valider les paramètres en entrée avec `throw new Error()` :
```javascript
export function maFonction(param1, callback) {
  if (!param1)                        throw new Error("maFonction: param1 manquant");
  if (typeof callback !== "function") throw new Error("maFonction: callback doit être une fonction");
}
```

### Routes socket.io
Toujours valider les données reçues avant traitement :
```javascript
socket.on("mon:event", (data, callback) => {
  if (!data.itemId) {
    console.error("[mon:event] itemId manquant :", data);
    return callback({ ok: false, error: "itemId manquant" });
  }
});
```

### Fonctions internes critiques
Logger si un résultat attendu est `undefined` :
```javascript
const def = gameData.weapons.find(w => w.code === item.itemCode);
if (!def) console.error(`getWeaponDef: aucune def trouvée pour itemCode="${item.itemCode}"`);
```

### Principe général
Valider au point d'entrée de chaque fonction publique et au point de réception
de chaque route serveur. Transformer les bugs silencieux en erreurs explicites.

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

Chance d'augmenter une stat de 1 (sauf taille) — usage unique par étage (désactivé en dev) :
```javascript
chanceEntrainement = Math.min((volonté * 5) / (1 + nombreAugmentations), 95)
// résultat en pourcentage — nombreAugmentations = nb fois cette stat a été augmentée
```

Durée de l'animation d'entraînement :
```javascript
duréeAnimation = 5 * (1 + nombreAugmentationsDéjàEffectuées) // secondes
```

Stats entraînables : force, constitution, intelligence, volonté, vitesse, adresse.
Taille : non entraînable. Stats à 21 : grisées.

Stats stockées en BDD : valeur actuelle + valeur de base à la création (`force_base`, etc.)
pour permettre de calculer le nombre d'augmentations par stat.

---

## Système de combat

> La logique complète de résolution du combat (boucle, formules, dégâts) est dans **combat_algorithm.md**.

---

## Contraintes de maniement des armes

Vérifiées à l'équipement et affichées dans le panneau droit (mode équip).

- `stat_joueur + 2 < stat_arme` → message critique
- `stat_joueur < stat_arme` → message léger
- Stats testées : force, taille, intelligence, adresse
- Main gauche : adresse requise = `arme.ad + 5`
- Ambidextrie (2 armes, pas bouclier) : seuil = `arme_droite.fo + arme_gauche.fo + 10`
- Boucliers : test de force uniquement

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
if (arme.mains === 2) mainGauche = null
// Main gauche : arme 1 main, bouclier, ou vide
// Arme 2 mains : main droite uniquement
```

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

### nb tiers
Le nombre de tiers est déduit du nombre de modèles dans `weapons.json`.
Ajouter ou supprimer un modèle met automatiquement à jour le calcul des dégâts.

---

## Matériaux des armes

8 matériaux, dimension indépendante du tier. Définis dans `client/js/core/gamedata.js`.

```
Bois=0, Cuivre=1, Étain=2, Bronze=3, Fer=4, Fonte=5, Acier=6, Acier damascène=7
```

### Influence sur les dégâts (modMatériau)

```
Bois            = 1.000
Cuivre          = 1.250
Étain           = 1.375
Bronze          = 1.500
Fer             = 1.625
Fonte           = 1.750
Acier           = 1.875
Acier damascène = 2.000
```
*Valeurs à ajuster pendant l'équilibrage.*

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

### Progression à la forge

```
T(n) + T(n+1) = T(n+2)   ← règle générale jusqu'à T13
T14  + T14    = T15
T15  + T15    = T16
```

---

## Boucliers

16 tiers. Poids = tier. Réduction flat = tier (si parade réussie).

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

## Forge — Armes

### Tier résultant

```
T(n) + T(n+1) = T(n+2)
T(max-1) + T(max-1) = T(max)
```

Recette non définie :
```javascript
tierRésultant = Math.floor((tierA + tierB) / 2) + 1
```

### Matériau résultant

```
Bois(0)   + Cuivre(1) = Étain(2)
Cuivre(1) + Étain(2)  = Bronze(3)
Étain(2)  + Bronze(3) = Fer(4)
Fer(4)    + Fer(4)    = Fonte(5)
Fonte(5)  + Bronze(3) = Acier(6)
Acier(6)  + Acier(6)  = Acier damascène(7)
```

Recette non définie :
```javascript
matériauRésultant = Math.floor((indexA + indexB) / 2)
```

### Affinité résultante

```javascript
affinitéRésultante = Math.floor((affinitéA + affinitéB) / 2)
```

---

## Familles d'ennemis et affinités

### Les 6 familles

```
Bestial, Élémentaire, Féérique, Démoniaque, Undead, Reptilien
```

### Système d'affinité

Vaincre un ennemi → **+2** sur sa famille, **-1** sur les 2 familles suivantes (circulaire).

**Affinité max : 100**

---

## Représentation visuelle

### Dans le donjon (canvas)

- Joueur : 🧙
- Ennemis : 👺
- Escalier : 🔽
- Forge : ⚒️
- Terrain d'entraînement : 🎯

### Navigation

Toute case spéciale requiert une confirmation avant d'y entrer :
- "Êtes-vous sûr de vouloir affronter cette créature ?"
- "Êtes-vous sûr de vouloir aller au terrain d'entraînement ?"
- "Êtes-vous sûr de vouloir utiliser la forge ?"
- "Êtes-vous sûr de vouloir passer à l'étage suivant ?"

En cas de refus, le joueur reste sur sa case adjacente.
Navigation dialog : ←/→ pour Oui/Non, Entrée pour valider. Non par défaut.

---

## Roadmap v2

- Localisation des dégâts
- Effets critiques par zone
- Créatures mobiles
- Furtivité
- Marchand
- Multijoueur PvPvE

---

## Architecture des données

### Données statiques (fichiers JSON)

```
server/data/
├── weapons.json
├── armors.json
├── shields.json
└── bestiary.json
```

### Données dynamiques (SQLite)

```sql
players
  id, name, niveauMaxFranchi, createdAt

runs
  id, playerId, etageActuel, statut, createdAt

characters
  id, runId,
  force, constitution, taille, intelligence, volonte, vitesse, adresse,
  force_base, constitution_base, taille_base, intelligence_base,
  volonte_base, vitesse_base, adresse_base,
  hp, endurance,
  augmentations (JSON — nb augmentations par stat)

inventory
  id, runId, itemType, itemCode,
  tier, material,
  aff_bestial, aff_elementaire, aff_feerique,
  aff_demoniaque, aff_undead, aff_reptilien,
  equipped,
  slot (corps/tete/bras/jambes),
  equippedSlot (rightHand/leftHand)

floors
  id, runId, etage, dungeon (JSON), cleared
```

### Structure client

```
client/js/
├── core/
│   ├── constants.js    // SCREENS, LAYOUT, getLayout()
│   ├── theme.js        // THEME — couleurs et polices
│   ├── gamedata.js     // données statiques + MATERIALS
│   ├── damagecalc.js   // calcul dégâts côté client
│   └── equipchecks.js  // contraintes de maniement
└── ui/
    ├── camp.js
    ├── training.js
    ├── render.js
    └── components/
        ├── characterCard.js
        └── equipPanel.js
```

### Ordre de développement

```
1. Donjon enrichi (créatures, forge, entraînement, passage) ✅
2. Inventaire ✅
3. Équipement (armes) ✅
4. Entraînement ✅
5. Forge
6. Combat (resolver.js)
7. Armures et boucliers
```