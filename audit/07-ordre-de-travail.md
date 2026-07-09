# 07 — Ordre de travail avant toute génération de code

---

## Blocage actuel

**Constaté le 2026-07-09.** `claude mcp list` ne renvoie **aucun serveur MCP configuré**, et aucune
variable d'environnement Sillage ou FullEnriched n'est présente. Les clés existent, mais pas dans
cet environnement.

Les étapes 1 et 2 ci-dessous sont donc **bloquées** tant que les credentials n'y sont pas amenés :
`claude mcp add` pour le serveur MCP Sillage, ou export des clés API (`.env` non versionné, ou
variables d'environnement).

---

## Séquence

| # | Étape | Bloqué par |
|---|---|---|
| 0 | **Amener les credentials dans l'environnement** | — |
| 1 | **Sonder Sillage** ([05 §5.1](05-connecteurs.md#51-sillage-via-mcp--le-risque-à-vérifier-en-premier)). REST disponible ? Sinon `list_tools()` sur le MCP : réponses structurées ou en prose ? | 0 |
| 2 | **Sonder FullEnriched** ([05 §5.2](05-connecteurs.md#52-fullenriched)). Quels champs, quelles métadonnées de fraîcheur ? | 0 |
| 3 | **Écrire le schéma canonique réel**, champ par champ | 1, 2 — **sauf** les champs CRM |
| 4 | **Écrire la table `champ → classe d'autorité`** ([01 §1.1](01-incoherences-internes.md#11-lexemple-du-6-contredit-la-règle-darbitrage-n1)). Relue par un humain métier | 3 |
| 5 | **Écrire les règles de seuil** : tolérance par champ, `ecart_jours` déclenchant `a_signaler_AE`, seuil de confiance | 4 |
| 6 | **Écrire les trois formules** : confiance, complétude, ICP ([02 §2.1](02-trous-de-specification.md#21-aucune-formule-pour-les-deux-scores-ni-pour-la-confiance)) | 4 |
| 7 | **Écrire les sept fixtures CRM** de conflit ([05 §5.3](05-connecteurs.md#53-le-crm-mocké-est-une-opportunité-de-design-pas-une-corvée)) | 5, 6 |
| 8 | **Rédiger le prompt de génération de code** (§13 du brief) | 7 |

L'étape 1 décide de l'architecture du connecteur Sillage et conditionne la tenue de l'invariant de
déterminisme. **Aucune ligne de code produit ne devrait être écrite avant.**

### Ce qui n'est bloqué par rien

Les champs CRM du schéma canonique (`historique_deals`, `historique_relationnel`) peuvent être
écrits **immédiatement** : c'est nous qui les définissons.

---

## Les étapes 3 à 7 sont de la spécification, pas du code

Elles tiennent dans un fichier de configuration et un fichier de fixtures. **Ce sont elles qui
portent toute la valeur du produit.** Le code qui les consomme est mécanique.

C'est le point le plus important de cet audit : la difficulté du projet n'est pas dans
l'implémentation, elle est dans les décisions que le brief a laissées ouvertes.

---

## Remarque sur le §13 du brief

Viser un **prompt unique** qui génère l'intégralité d'un codebase « qualité production » est
fragile. Une spécification précise (étapes 3 à 7) suivie d'une génération **module par module**,
avec les tests d'invariants écrits en premier, donne un résultat nettement plus fiable.

Les modules déterministes — arbitrage, scoring — sont précisément ceux qui se spécifient et se
testent le mieux, donc ceux qu'un modèle génère le plus sûrement **une fois la spec écrite**.
Ils sont aussi ceux qu'il inventera le plus silencieusement si elle ne l'est pas.
