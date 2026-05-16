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
