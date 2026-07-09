# Audit du brief d'architecture — Agent de qualification AE

Audit de [`../brief-architecture-qualif-ae.md`](../brief-architecture-qualif-ae.md), réalisé le
**2026-07-09**, avant toute écriture de code (le repo était vide).

## Objet

Le brief se décrit comme un point de départ dont la suite doit produire un prompt de génération de
code « qualité production ». Cet audit liste ce qui doit être **tranché avant** cette génération.
Générer du code sur le brief en l'état produirait un système dont les invariants annoncés au §10
ne tiennent pas.

## Verdict en une phrase

La thèse produit est bonne et doit être préservée ; deux contradictions internes rendent le moteur
d'arbitrage non spécifiable en l'état, et trois formules centrales n'existent pas.

## Index

| Fichier | Contenu | Sévérité |
|---|---|---|
| [01-incoherences-internes.md](01-incoherences-internes.md) | Le brief se contredit sur l'arbitrage et sur l'invariant fond/forme — **2 des 3 résolues** | **Bloquant** |
| [02-trous-de-specification.md](02-trous-de-specification.md) | Formules absentes, résolution d'entités, branchement CRM, sujets non traités | Élevée |
| [03-securite-injection-prompt.md](03-securite-injection-prompt.md) | Trois entrées de texte libre alimentent des prompts sans délimitation | Élevée |
| [04-architecture-collecteurs.md](04-architecture-collecteurs.md) | Les collecteurs ne sont pas des agents ; conséquences sur le §11 | Structurante |
| [05-connecteurs.md](05-connecteurs.md) | Sillage via MCP (risque), FullEnriched, CRM mocké (opportunité) | Élevée |
| [06-strategie-de-repli.md](06-strategie-de-repli.md) | Le §12 sacrifie la mauvaise branche | Moyenne |
| [07-ordre-de-travail.md](07-ordre-de-travail.md) | Séquence à suivre, et blocage actuel | — |
| [08-invariants-a-verifier.md](08-invariants-a-verifier.md) | Propriétés testables qui doivent guider la structure du code | — |

## Ce qui est solide et doit être préservé

- La séparation **fond / forme**, avec personnalisation en toute fin de chaîne (§10).
- L'**estampille de provenance par champ** (source, date, confiance) : c'est ce qui rend la
  réconciliation spécifiable et le dossier auditable.
- Le **checkpoint de réconciliation**, qui coupe la propagation d'erreurs entre agents.
- La règle produit **« un conflit non résolu devient une question de qualification »**. Elle
  transforme une limite technique en valeur produit. C'est la meilleure idée du brief.
- La distinction explicite **score ICP ≠ score de complétude** (§8).

## Décisions arrêtées (2026-07-09)

| Question | Décision |
|---|---|
| Langage / runtime | **Python** (`asyncio.gather`, Pydantic, pytest table-driven) |
| Agents de collecte | **Fonctions déterministes**, pas d'agents LLM. Le §5 du brief énonce lui-même qu'ils n'arbitrent pas. |
| **Multi-agents** | Placé là où le jugement existe : la **résolution d'entités** et l'arbitrage sémantique, en motif **proposeur / vérificateur** (le vérificateur en contexte frais). Deux appels one-shot chaînés, pas une boucle agentique. Voir [04](04-architecture-collecteurs.md). |
| **Arbitrage** | **Union des données non conflictuelles ; en cas de conflit, la récence prime.** La règle 1 du brief est caduque. Chaque champ porte un marqueur `stable \| volatile` qui détermine si une divergence produit un **conflit** (question à l'AE) ou un **signal** (changement détecté). Voir [01 §1.1](01-incoherences-internes.md#11-lexemple-du-6-contredit-la-règle-darbitrage-n1--résolue). |
| **Signalement** | `resolution` (« ai-je su trancher ? ») et `a_signaler_AE` (« faut-il faire vérifier ? ») sont **découplés**. Un conflit résolu peut être signalé si la valeur retenue est périmée ou si l'écart de dates est trop grand. Seuils **par classe de champ** ; défaut `SEUIL_ECART = 0` sur les champs stables. Voir [01 §1.2](01-incoherences-internes.md#12-a_signaler_ae-na-pas-de-règle-de-déclenchement--résolue). |
| Sillage | Clé API disponible ; accès REST ou MCP à trancher (voir [05](05-connecteurs.md)) |
| FullEnriched | Clé API disponible |
| CRM | **Mocké** |

**Reste à trancher :** [1.3](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme)
(mémoire AE).

Conséquence développée dans [04-architecture-collecteurs.md](04-architecture-collecteurs.md) :
il ne reste **aucune boucle agentique** dans le système.
