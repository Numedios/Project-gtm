# 05 — Connecteurs : Sillage, FullEnriched, CRM

---

## 5.1 Sillage via MCP : le risque à vérifier en premier

**MCP est un protocole, pas une fonctionnalité LLM.** Il y a deux façons très différentes de
consommer un serveur MCP Sillage, et une seule est compatible avec la décision « collecteurs
déterministes » ([04](04-architecture-collecteurs.md)).

| Voie | Mécanisme | Compatible ? |
|---|---|---|
| **Client MCP direct depuis Python** (paquet `mcp`, transport stdio ou HTTP) | On appelle `list_tools()` puis `call_tool()` nous-mêmes. Aucun modèle dans la boucle. | **Oui** |
| **Connecteur MCP de l'API Messages** (`mcp_servers` + `mcp_toolset`) | Les outils transitent par le modèle, qui décide quoi appeler. | **Non** — réintroduit un agent LLM dans le collecteur |

Si l'on passe par MCP, c'est donc obligatoirement la première voie.

### Le risque, à vérifier avant d'écrire le connecteur

Beaucoup de serveurs MCP renvoient du **texte en prose**, formaté pour être lu par un LLM, plutôt
que du JSON typé.

Si les outils Sillage renvoient de la prose, alors extraire `effectif`, `secteur` et surtout
`date_donnee` de leur sortie **exige un LLM** — et le non-déterminisme rentre par la fenêtre dans
un collecteur qu'on vient tout juste de décider déterministe.

Pire : `date_donnee` pilote la **règle d'arbitrage n°2** (récence). Les estampilles de provenance
du §6, censées être le socle factuel de tout l'arbitrage, deviendraient elles-mêmes le produit
d'une extraction par modèle.

### Vérification à faire en premier

Appeler `list_tools()` sur le serveur MCP Sillage et inspecter, pour chaque outil pertinent, si la
réponse expose du contenu **structuré et typé** ou du texte libre.

### Arbre de décision

- **REST Sillage disponible** et couvre firmographie + account mapping + signaux → **prendre
  REST**. Le plus simple, typé, versionné.
- **Pas de REST, MCP structuré** → **client MCP direct** en Python. Bon.
- **Pas de REST, MCP en prose** → **problème réel**. Deux options :
  - (a) demander à Sillage un accès REST ;
  - (b) accepter un LLM d'extraction *dans* le collecteur — mais alors le journaliser et le mettre
    en cache comme pour la résolution d'entités
    ([02 §2.2](02-trous-de-specification.md#22-la-résolution-dentités-est-le-point-dur-et-nest-pas-spécifiée)),
    et **ne jamais lui laisser fabriquer `date_donnee` ni `confiance_source`**. Ces deux champs
    doivent provenir de métadonnées, pas d'une extraction.

Dans tous les cas : cacher le transport derrière un `Protocol` Python `SillageClient`, pour que le
choix REST/MCP ne contamine pas le reste du code.

---

## 5.2 FullEnriched

Contrainte ferme du §2 : **uniquement l'enrichissement de contacts**. Pas de données entreprise.

**À vérifier avant de spécifier l'arbitrage :** les coordonnées renvoyées portent-elles une
métadonnée de fraîcheur exploitable ? S'il n'y a pas de `date_donnee`, la **règle d'arbitrage n°2**
(récence) est **inapplicable aux coordonnées**, et la règle 4 (pas de date → pas de résolution auto
→ question à l'AE) s'appliquera systématiquement. Il faut le savoir maintenant, pas au moment où
chaque contact génère une question.

---

## 5.3 Le CRM mocké est une opportunité de design, pas une corvée

Le CRM est la **seule source qu'on contrôle entièrement**. Trois conséquences.

### 1. Le contrat « CRM en lecture seule » devient trivialement vérifiable

On écrit le mock avec **uniquement des méthodes de lecture**. L'invariant du §10 est alors garanti
par le type, pas par un prompt ni par une revue de code. C'est la meilleure façon possible de tenir
cette promesse.

### 2. Le mock est l'endroit où l'on *fabrique* les scénarios de conflit

Ce n'est pas un bouchon à remplir de données plausibles : **c'est le jeu de tests de la
réconciliation.** Il doit contenir, délibérément, exactement les cas que le §6 prétend gérer.

Les fixtures ci-dessous exercent la table de décision arrêtée en
[01 §1.1](01-incoherences-internes.md#11-lexemple-du-6-contredit-la-règle-darbitrage-n1---résolue) :
règle d'arbitrage unique (récence), sortie déterminée par le marqueur `stable | volatile`.

| # | Fixture | Ce qu'elle teste | Sortie attendue |
|---|---|---|---|
| 1 | Titre périmé divergeant de Sillage | Champ **volatile** | **Signal** « changement de décisionnaire », **aucune** question |
| 2 | `pays_siege` divergent, deux sources fraîches, `SEUIL_ECART = 0` | Champ **stable**, `resolution: auto` + **signalé** | **Conflit** → question de **confirmation** |
| 3 | `pays_siege` divergent, `SEUIL_ECART` relevé | Champ **stable**, `resolution: auto` + **non signalé** | Valeur retenue **en silence**, aucun conflit. Teste que le bouton de réglage fonctionne |
| 4 | Valeur retenue elle-même périmée (`age > SEUIL_AGE`) | Angle mort du brief : les **deux** sources sont vieilles | **Conflit** → question de confirmation |
| 5 | Effectif différant de 6 % | Tolérance (règle 3) | Ni conflit ni signal |
| 6 | Champ **sans date** | Règle 4 → `resolution: impossible` | **Conflit** → question **ouverte** |
| 7 | Deux sources donnant la **même valeur** | Corroboration | Aucun conflit, **confiance rehaussée** |
| 8 | Deux sources, **même date**, valeurs divergentes | Départage par `confiance_source` | Conflit si les confiances sont égales |
| 9 | Décideur ayant fait un deal dans une **autre** entreprise | Cas d'usage explicite du §5 | Historique relationnel remonté, aucun conflit |
| 10 | Compte qui matche **deux fois** | Ambiguïté du branchement ([02 §2.3](02-trous-de-specification.md#23-le-critère--lead-déjà-présent-dans-le-crm--nest-pas-défini)) | NOUVEAU LEAD + conflit signalé |
| 11 | Lead **absent** | Branche du §7 | Dossier NOUVEAU LEAD |

Deux fixtures méritent un commentaire.

La **n°9** : l'historique relationnel n'ayant **qu'une seule source** (le CRM), il ne peut jamais
entrer en conflit. C'est précisément l'observation qui a rendu la règle 1 du brief caduque.

Les **n°2 et n°3** sont la même divergence avec deux réglages de `SEUIL_ECART`. Ensemble, elles
couvrent les deux lignes `auto` du tableau `resolution × a_signaler_AE`
([01 §1.2](01-incoherences-internes.md#12-a_signaler_ae-na-pas-de-règle-de-déclenchement---résolue)) et
prouvent que le seuil est bien un paramètre, pas une constante enfouie dans le code.

Écrire ces onze fixtures **avant** le moteur d'arbitrage transforme le §6 d'un paragraphe de prose
en une spécification exécutable.

### 3. Le mock fige le schéma canonique côté CRM

`historique_deals` et `historique_relationnel` n'existent que chez nous : c'est nous qui les
définissons. Ces deux champs du §6 peuvent donc être spécifiés **dès maintenant**, sans attendre
aucune API tierce. C'est le seul travail de spécification qui n'est bloqué par rien.
