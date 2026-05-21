---
inclusion: auto
description: Règles d'implémentation stricte des specs et pseudo-code fournis par l'utilisateur
---

# Règle : Implémentation stricte des specs

## Règle obligatoire

Quand l'utilisateur fournit un pseudo-code, une spec, ou des instructions détaillées :

1. **Suivre à la lettre** — implémenter exactement ce qui est écrit, sans adaptation ni interprétation libre
2. **Pas d'hypothèse** — ne jamais supposer qu'un détail est "implicite" ou "évident" et le modifier
3. **Pas d'optimisation non demandée** — ne pas réorganiser, simplifier ou "améliorer" la logique fournie
4. **Ordre des opérations** — respecter exactement l'ordre indiqué (logs, calculs, goto, etc.)
5. **En cas de doute** — demander une clarification plutôt que de deviner ou interpréter

## Ce que ça implique concrètement

- Si la spec dit `goto Phase X` → implémenter ce saut exact, pas un autre flux
- Si la spec montre un log avec des valeurs précises → reproduire exactement ces valeurs
- Si la spec montre un ordre (jet → log → déduction endurance) → respecter cet ordre exact
- Si quelque chose semble incohérent ou améliorable → le signaler et demander confirmation avant de changer

## Normes de développement

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
