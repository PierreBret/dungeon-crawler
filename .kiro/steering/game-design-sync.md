---
inclusion: auto
---

# Règle : Synchronisation de Game_Design.md

**Game_Design.md est le document de référence du projet. Il doit rester à jour à tout moment.**

## Règle obligatoire

À chaque interaction qui modifie une spec, une formule, une règle de jeu, une convention de code, ou toute autre décision de design :

1. Mettre à jour `requirements.md` de la spec concernée
2. Mettre à jour `Game_Design.md` pour refléter le même changement

## Normes de développement (depuis Game_Design.md)

Ces normes s'appliquent à tout code écrit pour ce projet :

- **Arrondi** : toujours `Math.floor` — jamais `Math.round` ou `Math.ceil`
- **Fonctions** : toujours nommées — jamais de fonctions anonymes passées en paramètre
- **Validation** : valider les paramètres en entrée de chaque fonction exportée avec `throw new Error("nomFonction: paramètre manquant")`
- **Single Source of Truth** : chaque donnée n'existe qu'à un seul endroit
- **Données statiques** : armes, armures, bestiaire viennent uniquement des fichiers JSON — jamais dupliqués dans le code
- **Nommage** : variables et fonctions en anglais, affichage (logs, UI) en français
- **Thème visuel** : tout fichier UI importe `THEME` depuis `core/theme.js` — aucune couleur ou police hardcodée
- **Logs internes** : logger avec `console.error` si un résultat attendu est `undefined`
- **Architecture** : toute logique de jeu côté serveur uniquement — jamais côté client

- Formules de combat (endurance, initiative, attaque, défense, dégâts)
- Paramètres stratégiques (EO, NA, EN)
- Conventions de code (arrondi, nommage, validation)
- Structure du donjon, progression, forge
- Tout placeholder ou fonctionnalité "version future"

## Source de vérité

La source de vérité est la conversation avec l'utilisateur.
`Game_Design.md` et `requirements.md` doivent en être le reflet fidèle.
Ne jamais laisser ces fichiers en décalage avec les décisions prises en conversation.

## Fichiers concernés

- `Game_Design.md` (racine du projet)
- `.kiro/specs/combat-enrichi/requirements.md`
