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

- **Client** : JavaScript vanilla, HTML5 Canvas (pas de framework)
- **Serveur** : Node.js + Express + Socket.io + better-sqlite3 (SQLite)
- **Tests** : Vitest + fast-check (property-based testing)
- **Architecture** : client/serveur autoritaire — toute logique de jeu côté serveur
- **Convention** : variables et fonctions en anglais, affichage en français

---

## Règles de développement

- **Arrondi** : toujours `Math.floor` — jamais `Math.round` ou `Math.ceil`
- **Fonctions** : toujours nommées — jamais de fonctions anonymes passées en paramètre
- **Validation** : valider les paramètres en entrée de chaque fonction exportée avec `throw new Error("nomFonction: paramètre manquant")`
- **Single Source of Truth** : chaque donnée n'existe qu'à un seul endroit
- **Données statiques** : armes, armures, bestiaire viennent uniquement des fichiers JSON — jamais dupliqués dans le code
- **Nommage** : variables et fonctions en anglais, affichage (logs, UI) en français
- **Thème visuel** : tout fichier UI importe `THEME` depuis `core/theme.js` — aucune couleur ou police hardcodée
- **Logs internes** : logger avec `console.error` si un résultat attendu est `undefined`
- **Architecture** : toute logique de jeu côté serveur uniquement — jamais côté client

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

### Thème visuel
Tout fichier UI importe `THEME` depuis `core/theme.js` et utilise ses valeurs
pour les couleurs et polices. Aucune couleur ou police hardcodée dans le code UI.
Règle appliquée progressivement : chaque modification d'un fichier UI inclut
la migration vers THEME pour ce fichier.

```javascript
import { THEME } from "../core/theme.js";
ctx.fillStyle = THEME.text.primary;
ctx.font      = THEME.font.body;
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

- 84 étages
- 5 créatures par étage (sélection aléatoire parmi le bestiaire éligible pour le niveau)
- 1 forge par étage (utilisable à volonté)
- 1 terrain d'entraînement par étage (usage unique, sauf en DEV_MODE)
- 1 trésor par étage (coffre à ouvrir, usage unique)
- 1 passage vers l'étage suivant

**Règles :**
- Les créatures tuées le sont définitivement
- Les créatures sont mobiles (IA avec vision en ligne droite, poursuite, déplacement aléatoire)
- Les créatures peuvent initier le combat en atteignant le joueur
- Les étages ne sont pas persistants — passer à l'étage suivant génère un nouveau donjon, revenir en arrière n'est pas possible
- Chaque étage est généré procéduralement (labyrinthe DFS + passages supplémentaires)
- La mort est définitive (roguelite)
- Pas de marchand en v1

**Configuration du donjon (server/config.js) :**
- Grille : 21 lignes × 31 colonnes (impairs)
- Passages supplémentaires : 30% (extraPaths)
- Anti grandes salles : aucun rectangle 3×3, 4×2 ou 2×4 ouvert

---

## IA des créatures

Chaque créature a un compteur de pas (`stepCounter`) et une valeur `step` (définie dans bestiary.json).
La créature ne bouge que quand `stepCounter >= step` (puis reset).

**États :**
- **A — Joueur visible** : vision en ligne droite (cardinale). Mémorise la position du joueur, passe en poursuite, se déplace vers le joueur.
- **B — Poursuite** : se dirige vers la dernière position connue du joueur. Si atteinte sans revoir le joueur → passage en état C.
- **C — Aléatoire** : déplacement aléatoire (exclut la case précédente pour éviter le ping-pong).
- **D — Demi-tour** : si la seule option est la case précédente (cul-de-sac).

Si une créature atteint la case du joueur → combat automatique (pas de confirmation).

**Mise à jour de la vision** : à chaque pas du joueur, toutes les créatures vérifient si elles voient le joueur (indépendamment de leur stepCounter).

---

## Progression méta (roguelite) — non implémentée



### Prime de départ (prévue)

```
targetTotal = 70 + Math.floor(niveauMaxFranchiDernierRun / 3)
```

### Génération des candidats (implémentée)

**3d7 par stat** (min=3, max=21 par stat). Somme totale exacte = 70.
Le joueur choisit parmi **3 candidats** générés avec ce système.
Chaque candidat a un nom aléatoire (préfixe + racine + suffixe).

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

### Points de vie (HP)

```javascript
hpMax = Math.floor((constitution × 19 + taille × 5 + volonté × 2) / 4)
```

### Endurance initiale

```javascript
enduranceMax = (force + constitution + volonté) × 3
```

### Entraînement

Usage unique par terrain d'entraînement (illimité en DEV_MODE).
Stats entraînables : force, constitution, intelligence, volonté, vitesse, adresse.
Taille : non entraînable. Stats à 21 : grisées.

**Formule de chance :**
```javascript
chanceBase = ((volonté - 3) / 18) × 50 + 50
chance     = Math.floor(chanceBase / Math.pow(2, nbAugmentations))
// Roll d100 : succès si roll <= chance
```

**Durée de l'animation :**
```javascript
durée = DEV_MODE ? 0 : 5 × (1 + nbAugmentationsDéjàEffectuées) // secondes
```

Stats stockées en BDD : valeur actuelle + augmentations (JSON `{stat: nbAugmentations}`).

---

## Système de combat

> La logique complète de résolution du combat est dans **`.kiro/specs/combat-enrichi/requirements.md`**.

### Vue d'ensemble

Combat tick-par-tick, résolution automatique côté serveur (~1500 lignes dans `combat.js`).
Le joueur définit sa stratégie (EO/NA/EN) avant le combat. Le combat se termine quand un combattant tombe à 0 PV ou après 20 minutes (match nul).

### Paramètres stratégiques

| Paramètre | Signification | Plage |
|-----------|--------------|-------|
| **EO** (Effort Offensif) | Probabilité d'attaquer plutôt que se repositionner | 1–10 |
| **NA** (Niveau d'Activité) | Intensité physique — influence l'initiative et les coûts d'endurance | 1–10 |
| **EN** (Engagement) | Distance souhaitée (1=loin, 10=corps à corps) | 1–10 |

**Distance souhaitée** = `11 - EN`
**Distance initiale** = 10

### Compétences dérivées (6)

Calculées à partir des stats primaires × coefficients (définis dans `variables.js`) :
- **Vivacité** : TAI×6, INT×12, VIT×7, ADR×8
- **Initiative** : INT×4, VOL×6, VIT×9
- **Attaque** : FOR×6, INT×10, VOL×6, ADR×10
- **Parade** : FOR×6, VOL×6, ADR×10, TAI_INV×6
- **Esquive** : INT×10, VOL×6, VIT×5, ADR×10, TAI_INV×6
- **Riposte** : INT×6, VIT×10, ADR×10

(TAI_INV = 24 - TAI)

### Phases du combat (par tick)

1. **Phase Positionnement** — ajustement de la distance réelle
2. **Phase Attaque** — jet EO pour décider attaque vs repositionnement, dégradation si endurance insuffisante
3. **Phase Défense** — esquive ou parade automatique (meilleur score), dégradation si endurance insuffisante
4. **Phase Résolution Dégâts** — si attaque touche et défense échoue
5. **Phase Initiative** — scoreVivacité détermine qui agit au tick suivant
6. **Phase Riposte** — si attaque ratée, DEF peut riposter
7. **Phase Fin de boucle** — test d'endurance ATT et DEF, recalcul compétences
8. **Phase Vivacité** — détermination de l'attaquant suivant

### Endurance

- **Endurance initiale** : `Math.floor((constitution + volonté + 10) × 2)`
- **Coûts** : Attaque = WeaponWeight + CoûtNA + Surcoût ; Esquive = 5 + CoûtNA + Surcoût ; Parade = 2 + CoûtNA + Surcoût ; Repositionnement = 1 + CoûtNA + Surcoût
- **Récupération** : +1 par action de récupération
- **CoûtNA** = `Math.floor(NA_effectif / 2)`
- **Surcoût** = `Math.floor(Math.max(0, Charge - Portage) × 10 / 26)`
- **Fatigue** : NA_effectif plafonné par endurance en début de minute

### Seuils d'endurance (variables.js)

| Seuil | Valeur |
|---|---|
| seuilEndurance1 | 40% |
| seuilEndurance2 | 30% |
| seuilEndurance3 | 20% |
| seuilEndurance4 | 10% |

### Scan de créature

Le joueur peut scanner une créature adjacente (touche E) pour voir son nom et sa description.
**Malus de scan** : si le joueur combat une créature non scannée, il subit un malus.

### Présentation narrative

Au début du combat, chaque combattant reçoit une description narrative générée à partir de matrices 5×5 (fichier `presentation.json`). Les matrices couvrent : physique, vivacité, attaque, esquive, parade, initiative, riposte.

---

## Formule de dégâts

```javascript
baseArme      = Math.floor(damFirst + (damLast - damFirst) × (tier - 1) / Math.max(nbTiers - 1, 1))
modMatériau   = 1 + (materiau - 1) × 0.25   // materiau interne 1-8
coefStats     = 1 + (FOR-12)×0.02×weightFO + (TAI-12)×0.02×weightTA + (INT-12)×0.02×weightIN + (VIT-12)×0.02×weightVI + (ADR-12)×0.02×weightAD
modAffinité   = affinité_arme_vs_famille / 100   // 0 à 2
modTypeDégâts = 1.0   // placeholder — armures non localisées
TotalDamage   = Math.floor(baseArme × modMatériau × coefStats × modAffinité × modTypeDégâts)
dégâtsFinaux  = Math.max(0, TotalDamage - réductionArmure)
```

**réductionArmure** = tier de l'armure corps du défenseur (les autres pièces contribuent au poids mais pas à la réduction).

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
// Équiper une arme déséquipe automatiquement le slot
```

---

## Armes

### Table des armes

| Code | Type d'arme | Dam first | Dam last | nb tiers | Mains | Type dégâts | poids FOR | poids TAI | poids INT | poids VIT | poids ADR | Dist idéale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DA | Dague | 10 | 42 | 7 | 1 | Piercing | 0.6 | 0.0 | 0.3 | 0.7 | 1.4 | 1 |
| SH | Epée courte | 11 | 44 | 7 | 1 | Piercing | 0.7 | 0.1 | 0.3 | 0.7 | 1.2 | 3 |
| SA | Sabre | 13 | 54 | 7 | 1 | Edged | 0.7 | 0.2 | 0.2 | 1.1 | 0.8 | 4 |
| EP | Rapière | 12 | 59 | 4 | 1 | Piercing | 0.4 | 0.0 | 0.6 | 0.8 | 1.2 | 7 |
| LO | Epée longue | 12 | 56 | 6 | 1 | Edged | 0.9 | 0.3 | 0.3 | 0.7 | 0.8 | 5 |
| BS | Epée large | 13 | 54 | 5 | 1 | Impact | 1.3 | 0.6 | 0.1 | 0.4 | 0.6 | 4 |
| GS | Epée à 2 mains | 21 | 79 | 5 | 2 | Impact | 1.2 | 0.8 | 0.2 | 0.4 | 0.4 | 6 |
| HA | Hachette | 10 | 41 | 4 | 1 | Impact | 1.2 | 0.4 | 0.2 | 0.6 | 0.6 | 3 |
| BA | Hache de bataille | 13 | 56 | 5 | 1 | Edged | 1.2 | 0.7 | 0.1 | 0.3 | 0.7 | 4 |
| GA | Hache à 2 mains | 21 | 80 | 4 | 2 | Edged | 1.2 | 0.8 | 0.1 | 0.2 | 0.7 | 6 |
| MA | Masse | 11 | 47 | 7 | 1 | Blunt | 1.3 | 0.5 | 0.1 | 0.2 | 0.9 | 4 |
| FL | Fléau | 12 | 60 | 5 | 1 | Blunt | 0.9 | 0.4 | 0.8 | 0.3 | 0.6 | 5 |
| WH | Marteau de guerre | 24 | 84 | 5 | 2 | Blunt | 1.3 | 0.7 | 0.1 | 0.1 | 0.8 | 3 |
| SS | Lance courte | 12 | 51 | 6 | 1 | Piercing | 0.6 | 0.4 | 0.4 | 0.7 | 0.9 | 6 |
| LS | Lance à 2 mains | 22 | 79 | 8 | 2 | Piercing | 0.6 | 0.7 | 0.3 | 0.5 | 0.9 | 10 |
| PA | Arme d'hast | 23 | 87 | 7 | 2 | Impact | 1.0 | 0.9 | 0.3 | 0.4 | 0.4 | 9 |
| QS | Baton de combat | 19 | 71 | 6 | 2 | Blunt | 0.7 | 0.7 | 0.4 | 0.6 | 0.6 | 7 |
| SC | Faux | 23 | 84 | 6 | 2 | Edged | 0.8 | 0.9 | 0.4 | 0.4 | 0.5 | 9 |

### nb tiers
Le nombre de tiers est déduit du nombre de modèles dans `items.json`.
Ajouter ou supprimer un modèle met automatiquement à jour le calcul des dégâts.

---

## Matériaux des armes

8 matériaux, dimension indépendante du tier. Définis dans `server/game/variables.js`.

```
Index 0 : Bois
Index 1 : Cuivre
Index 2 : Étain
Index 3 : Bronze
Index 4 : Fer
Index 5 : Fonte
Index 6 : Acier
Index 7 : Adamante
```

### Influence sur les dégâts (modMatériau)

Le matériau est stocké en BDD comme index 0-7. En interne combat, il est converti en 1-8.

```
Bois            = 1.000  (index 0, interne 1)
Cuivre          = 1.250  (index 1, interne 2)
Étain           = 1.375  (index 2, interne 3)
Bronze          = 1.500  (index 3, interne 4)
Fer             = 1.625  (index 4, interne 5)
Fonte           = 1.750  (index 5, interne 6)
Acier           = 1.875  (index 6, interne 7)
Adamante        = 2.000  (index 7, interne 8)
```

Formule : `modMatériau = 1 + (matériauInterne - 1) × 0.25`

---

## Armures

4 emplacements : corps, tête, bras, jambes.
16 tiers par emplacement. Pas de matériau — il est implicite dans le nom.
**Poids** = tier × 2 par pièce (contribue à la Charge).
**Réduction flat** = tier de la pièce corps uniquement (pas de localisation des dégâts).

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

## Forge

### Compatibilité

- Armes : même code d'arme (même type)
- Armures : même slot
- Boucliers : même type suffit

### Tier résultant — Armes

```
T(n) + T(n+1) = T(n+2)
T(max-1) + T(max-1) = T(max)
```

Recette non définie :
```javascript
tierRésultant = Math.min(Math.floor((tierA + tierB) / 2), maxTier)
```

### Tier résultant — Armures et Boucliers

```
T(n) + T(n+1) = T(n+2)   ← jusqu'à T(max-3)
T(max-2) + T(max-2) = T(max-1)
T(max-1) + T(max-1) = T(max)
```

Recette non définie :
```javascript
tierRésultant = Math.min(Math.floor((tierA + tierB) / 2), maxTier)
```

### Matériau résultant

```
Bois(0)   + Cuivre(1) = Étain(2)
Cuivre(1) + Étain(2)  = Bronze(3)
Étain(2)  + Bronze(3) = Fer(4)
Fer(4)    + Fer(4)    = Fonte(5)
Fonte(5)  + Bronze(3) = Acier(6)
Acier(6)  + Acier(6)  = Adamante(7)
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

### Les 7 familles

```
Bestial, Élémentaire, Gigante, Thériomorphe, Reptilien, Eidolon, Primordial
```

### Système d'affinité

Vaincre un ennemi → **+2** sur sa famille, **-1** sur les 2 familles suivantes (circulaire).

**Ordre circulaire :** Bestial → Élémentaire → Gigante → Thériomorphe → Reptilien → Eidolon → Primordial → (retour à Bestial)

**Exemple :** Battre un Eidolon → +2 Eidolon, -1 Primordial, -1 Bestial.

**Affinité max : 100** (utilisée dans la formule de dégâts : modAffinité = affinité / 100)

L'affinité est stockée par arme (pas par joueur). Forger deux armes moyenne les affinités.

---

## Système de Loot (Butin)

### Principes fondamentaux

- **Tiers = Models** : dans `items.json`, le tableau `models` de chaque item représente ses tiers (tier 1 = premier model, tier N = dernier model). Le nombre de tiers d'un type d'item = `models.length`.
- **Matériau indépendant** : le matériau (index 0-7, défini dans `variables.js`) est un axe indépendant du tier. Un item a un tier ET un matériau, déterminés séparément.
- **Drop pondéré par nombre de tiers** : la probabilité de drop d'un type d'item est proportionnelle à son nombre de tiers (`models.length`).
- **Armes naturelles exclues** : les items avec `natural: true` sont des armes de monstres — jamais droppables.
- **Pool unique** : tous les types d'items droppables (armes, armures, boucliers) sont dans un même pool pondéré — pas de tirage par catégorie d'abord.
- **Séquence de tirage** : 1) type d'item (pondéré par nb de tiers) → 2) tier → 3) matériau (si applicable).
- **Même règle combat/trésor** : la table de drop est identique pour les récompenses de combat et les trésors.

### Restrictions actuelles (progression)

- **Tier max = 2** : les drops (combat et trésor) sont limités à tier 1 ou 2 maximum.
- **Matériau max = index 1** : pour les armes/boucliers, le matériau est tiré entre 0 (Bois) et 1 (Cuivre).
- **Armures sans matériau** : les armures ont un matériau fixe à 0.

### Déclencheurs de drop

- **Victoire en combat** : un drop automatique après chaque créature vaincue.
- **Trésor** : un coffre par étage, drop identique au combat.

---

## Écrans du jeu (7)

| Écran | Clé | Description |
|---|---|---|
| Création de personnage | `characterCreation` | Choix parmi 3 candidats (←/→ + Entrée) |
| Camp | `camp` | Hub central — menu avec options |
| Donjon | `dungeon` | Exploration de la grille, brouillard de guerre, minimap |
| Entraînement | `training` | Sélection stat → animation → résultat |
| Préparation combat | `combatPrep` | Réglage EO/NA/EN + stats de la créature |
| Vue combat | `combatView` | Lecture du log ligne par ligne (Entrée pour avancer) |
| Game Over | `gameOver` | Écran de mort, Entrée pour recommencer |

### Menu du camp

| Option | Action |
|---|---|
| Explorer le donjon | Retour au donjon |
| Equipement (armes) | Panneau d'équipement armes (main droite/gauche) |
| Equipement (armures) | Panneau d'équipement armures (4 slots) |
| Se reposer | Non implémenté (placeholder) |
| Abandonner | Retour à la création de personnage |

Note : la forge est accessible depuis le donjon (case spéciale) et non depuis le menu du camp.

---

## Représentation visuelle

### Dans le donjon (canvas)

- Joueur : 🧙
- Ennemis : emoji défini dans bestiary.json (ex: 👺)
- Escalier : 🔽
- Forge : ⚒️
- Terrain d'entraînement : 🎯
- Trésor : 💎 (non ouvert) / rien (ouvert)
- Brouillard de guerre : cases non visitées masquées
- Minimap : vue d'ensemble en haut à droite

### Navigation

Toute case spéciale requiert une confirmation avant d'y entrer :
- "Êtes-vous sûr de vouloir affronter [nom créature] ?"
- "Êtes-vous sûr de vouloir aller au terrain d'entraînement ?"
- "Êtes-vous sûr de vouloir utiliser la forge ?"
- "Êtes-vous sûr de vouloir ouvrir le trésor ?"
- "Êtes-vous sûr de vouloir passer à l'étage suivant ?"

En cas de refus, le joueur reste sur sa case adjacente.
Navigation dialog : ←/→ pour Oui/Non, Entrée pour valider. Non par défaut.

---

## Architecture des données

### Données statiques (fichiers JSON)

```
server/data/
├── items.json          — Référentiel unifié (armes, boucliers, armures)
├── armors.json         — Définitions armures par slot (models, images)
├── bestiary.json       — Créatures (stats, equipment, tactic, family, levelMin/Max, step)
└── presentation.json   — Matrices narratives 5×5 pour la présentation de combat
```

**items.json** contient tous les types d'items :
- Armes (codes DA, SH, SA, EP, LO, BS, GS, HA, BA, GA, MA, FL, WH, SS, LS, PA, QS, SC)
- Boucliers (code SB)
- Armures (codes BO=corps, HE=tête, AR=bras, LE=jambes)
- Armes naturelles (natural: true — monstres uniquement)

### Données dynamiques (SQLite)

```sql
players       — id, name, niveauMaxFranchi, createdAt
runs          — id, playerId, etageActuel, statut (actif|mort|victoire), createdAt
characters    — id, runId, 7 stats, hp, endurance, augmentations (JSON), 7 stats_base
inventory     — id, runId, itemType, itemCode, slot, tier, material, 6 affinités, equipped, equippedSlot
```

### Structure client

```
client/js/
├── main.js                 — Boucle de jeu (requestAnimationFrame)
├── core/
│   ├── init.js             — Setup canvas, état initial, requête candidats
│   ├── input.js            — Gestion clavier (dispatch par écran)
│   ├── update.js           — Update loop (minimal)
│   ├── socket.js           — Connexion Socket.io
│   ├── gamedata.js         — Chargement items/armors/bestiary depuis API
│   ├── constants.js        — SCREENS, CAMP_OPTIONS, LAYOUT, MATERIALS
│   ├── damagecalc.js       — Formule dégâts (affichage, lecture seule)
│   ├── equipchecks.js      — Contraintes de maniement
│   ├── dungeon.js          — Génération labyrinthe (référence)
│   ├── player.js           — Génération candidats (partagé)
│   ├── assets.js           — Chargement images avatars
│   └── theme.js            — THEME — couleurs et polices
└── ui/
    ├── gameRenderer.js     — Dispatcher d'écrans
    ├── characterCreation.js
    ├── render.js           — Vue donjon (grille, créatures, brouillard, minimap)
    ├── camp.js             — Camp (menu, équip armes, équip armures, forge)
    ├── training.js         — Entraînement
    ├── combatprep.js       — Préparation combat
    ├── combatview.js       — Visualisation log combat
    ├── gameover.js         — Écran de mort
    └── components/
        ├── characterCard.js    — Carte de stats joueur
        ├── equippanel.js       — Panneau équipement armes
        ├── equiparmorpanel.js  — Panneau équipement armures
        └── forgepanel.js       — Interface forge
```

### Structure serveur

```
server/
├── index.js            — Point d'entrée, routes Socket.io, API REST
├── config.js           — Configuration donjon (rows, cols, extraPaths)
├── game/
│   ├── combat.js       — Résolveur de combat (~1500 lignes)
│   ├── forge.js        — Logique de fusion
│   ├── loot.js         — Système de drop (table pondérée)
│   ├── player.js       — Génération candidats, dés, HP/endurance
│   ├── world.js        — Génération donjon, déplacements, IA créatures
│   ├── variables.js    — Configuration combat, matériaux, DEV_MODE
│   └── __tests__/      — Tests Vitest (27 fichiers combat)
├── state/
│   └── gameState.js    — Sessions en mémoire (Map<socketId, GameSession>)
├── db/
│   ├── database.js     — Connexion SQLite (better-sqlite3)
│   ├── schema.js       — Création tables
│   └── queries.js      — Requêtes CRUD
└── data/
    ├── items.json
    ├── armors.json
    ├── bestiary.json
    └── presentation.json
```

### Communication client-serveur (Socket.io)

| Événement | Direction | Description |
|---|---|---|
| `game:candidates` | C→S | Demande 3 candidats |
| `game:start` | C→S | Démarrage avec candidat choisi |
| `player:action` | C→S | Mouvement (move, move:confirm) |
| `creature:scan` | C→S | Scanner créature adjacente |
| `inventory:get` | C→S | Récupérer inventaire |
| `inventory:equip` | C→S | Équiper un item |
| `inventory:unequip` | C→S | Déséquiper un item |
| `inventory:drop` | C→S | Jeter un item |
| `forge:preview` | C→S | Prévisualiser une fusion |
| `forge:confirm` | C→S | Confirmer une fusion |
| `training:attempt` | C→S | Tenter un entraînement |
| `combat:resolve` | C→S | Résoudre un combat (tactic + creatureIndex) |
| `treasure:loot` | C→S | Ouvrir un trésor |
| `dungeon:next` | C→S | Passer à l'étage suivant |

### API REST

| Route | Description |
|---|---|
| `GET /api/data/items` | Données items (armes, boucliers, armures) |
| `GET /api/data/armors` | Données armures (models, images par slot) |
| `GET /api/data/bestiary` | Données bestiaire |

---

## État d'avancement

### Implémenté ✅

| Système | Statut |
|---|---|
| Création de personnage (3 candidats, 3d7, total=70) | ✅ |
| Donjon procédural (labyrinthe DFS + passages) | ✅ |
| Navigation (déplacement, confirmation cases spéciales) | ✅ |
| IA créatures (vision, poursuite, aléatoire, combat auto) | ✅ |
| Inventaire (CRUD complet, BDD) | ✅ |
| Équipement armes (main droite/gauche, 2 mains, contraintes) | ✅ |
| Équipement armures (4 slots) | ✅ |
| Forge (armes, armures, boucliers — tier + matériau + affinités) | ✅ |
| Entraînement (sélection stat, animation, chance décroissante) | ✅ |
| Combat complet (tick-par-tick, endurance, distance, phases) | ✅ |
| Système de loot (pool pondéré, combat + trésor) | ✅ |
| Affinités arme/famille (gain +2/-1 circulaire) | ✅ |
| Scan de créature (touche E, malus si non scanné) | ✅ |
| Présentation narrative (matrices 5×5) | ✅ |
| Brouillard de guerre + minimap | ✅ |
| Persistance BDD (SQLite, inventory, characters) | ✅ |
| Tests combat (27 fichiers, Vitest + fast-check) | ✅ |

### Non implémenté / Prévu 🔲

| Système | Notes |
|---|---|
| Repos (récupération HP) | Placeholder dans le menu camp |
| Momentum | Placeholder fixé à 0 |
| Combat à deux armes (main gauche offensive) | Données existent, combat utilise main droite uniquement |
| Mécanique de blocage bouclier | Données existent, pas de résolution spécifique |
| Localisation des dégâts | Tous les coups touchent le corps |
| Type dégâts vs type armure (modTypeDégâts) | Fixé à 1.0 |
| Gardiens (boss tous les 10 étages) | Flag `boss` dans bestiary, exclus de la génération |
| Progression méta (prime de départ selon niveauMaxFranchi) | Table `players.niveauMaxFranchi` existe, pas utilisée |
| Créatures mobiles avancées (furtivité) | IA basique implémentée |
| Marchand | Prévu v2 |
| Multijoueur PvPvE | Prévu v2 |

---

## DEV_MODE

Activé via `server/game/variables.js` (`DEV_MODE = true/false`).

Effets :
- Toutes les armes tier 1 données au départ (au lieu d'une épée courte)
- Une armure tier 1 par slot donnée au départ
- Entraînement illimité (pas de restriction "une fois par terrain")
- Animation d'entraînement instantanée (durée = 0)
- Logs de debug dans le combat
