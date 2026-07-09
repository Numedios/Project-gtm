# 08 — Invariants à vérifier

Le brief annonce six propriétés au §10. Aucune n'est vérifiable en l'état : ce sont des intentions.
Ce fichier les traduit en propriétés **testables**, qui doivent guider la structure du code plutôt
que d'être constatées après coup.

---

## Séparation fond / forme

> Même lead, deux profils AE différents ⇒ la partie non personnalisée du dossier (données
> consolidées, scores, fiche récap, **contenu** des questions) est identique **octet pour octet**.

Golden test, pas test d'intégration. À écrire **avant** la première ligne de personnalisation.
C'est ce qui rend concrète l'exigence « livrable auditable et comparable entre AE ».

Voir [01 §1.3](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme).

---

## CRM strictement en lecture

Vérifié **structurellement**, pas par un prompt ni par une revue : le client CRM n'expose
physiquement aucune méthode d'écriture.

Test : aucun verbe HTTP autre que `GET` n'est atteignable depuis le client. Le CRM étant mocké,
l'invariant est garanti par le type.

---

## Déterminisme de l'arbitrage

> Mêmes entrées estampillées ⇒ mêmes valeurs retenues, mêmes enregistrements de conflit.

Tests unitaires **table-driven** sur les quatre règles du §6, incluant les cas limites :

- date manquante sur une source (règle 4) ;
- écart numérique sous le seuil de tolérance (règle 3 — ce n'est pas un conflit) ;
- deux sources **également fraîches** (la règle 2 ne départage pas — que fait-on ?) ;
- champ absent de toutes les sources (ce n'est pas un conflit, mais la complétude chute).

Les sept fixtures CRM ([05 §5.3](05-connecteurs.md#53-le-crm-mocké-est-une-opportunité-de-design-pas-une-corvée))
sont conçues pour couvrir ces cas.

---

## Déterminisme du scoring

Le tool renvoie `(score, décomposition par critère)`. Le LLM **ne voit jamais le chiffre avant de
le justifier** — il met en prose une décomposition déjà calculée.

Test : pour un même dossier consolidé, le score est stable sur N exécutions ; seule la formulation
de la justification varie.

---

## Branchement CRM

| Cas | Attendu |
|---|---|
| Lead présent | Dossier **MISE À JOUR** |
| Lead absent | Dossier **NOUVEAU LEAD** |
| Match ambigu (plusieurs comptes) | **NOUVEAU LEAD** + conflit `a_signaler_AE` |

---

## Dégradation sur panne de source

Une source en échec produit un dossier **partiel**, avec statut de source explicite dans la sortie
et score de complétude abaissé. **Jamais une absence silencieuse.**

C'est une propriété que l'architecture offre gratuitement — le score de complétude reflète
mécaniquement la source manquante — mais qui doit être testée pour ne pas être perdue.

---

## Traçabilité

Chaque run produit une trace JSON : chaque appel outil, chaque décision d'arbitrage avec la règle
appliquée, chaque départage LLM avec son entrée exacte (donc rejouable).

C'est ce qui matérialise l'exigence de traçabilité du §10, et ce qui permet de préserver le
déterminisme du **chemin de code** même là où un LLM départage
([02 §2.2](02-trous-de-specification.md#22-la-résolution-dentités-est-le-point-dur-et-nest-pas-spécifiée)).
