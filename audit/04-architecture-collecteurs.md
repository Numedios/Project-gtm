# 04 — Les collecteurs ne sont pas des agents

**Constat structurant.** Il ne découle pas d'une préférence, mais de ce que le brief dit lui-même.
Sa conséquence n'est pas « aucun agent nulle part » : c'est **des agents là où il y a un jugement,
des fonctions partout ailleurs**. Le brief place ses agents au mauvais endroit.

---

## L'observation

Le §5 énonce le contrat commun des trois agents de collecte :

> *« Ils **n'arbitrent pas** les conflits. Chaque champ renvoyé est estampillé avec sa provenance. »*

Autrement dit : ils appellent une source, normalisent, estampillent. **Aucune décision.** Ce sont
des **fonctions**, pas des agents. Les trois collecteurs — Enrichissement entreprise, Cartographie
décisionnaires, Signaux d'achat — restent donc des fonctions déterministes.

Les arguments qu'on avance d'habitude pour justifier des agents ne tiennent pas dans ce contexte :

- la **latence** s'obtient par `asyncio.gather` sur trois appels concurrents, pas par un essaim
  d'agents autonomes ;
- un agent **ne rattrape pas** une API en panne : il hérite de la panne exactement comme une
  fonction, et la stratégie de repli se code dans le connecteur (voir [05](05-connecteurs.md)) ;
- ajouter une **quatrième source** demande une entrée de plus dans le schéma canonique et un
  connecteur, pas un quatrième agent.

Le jugement du LLM n'a donc rien à faire dans la collecte. Mais il a un endroit où il est réellement
indispensable, et que le brief expédie en une demi-ligne : la **résolution d'entités** et
l'**arbitrage sémantique**.

---

## Là où le jugement existe vraiment : proposeur / vérificateur

La résolution d'entités est le point dur du système, développé dans
[02 §2.2](02-trous-de-specification.md#22-la-résolution-dentités-est-le-point-dur-et-nest-pas-spécifiée).
Le blocage déterministe (normalisation, clés de rapprochement) tranche l'écrasante majorité des cas,
mais il laisse un **ensemble borné de paires ambiguës** qu'il ne sait pas départager : *« Marie
Durand chez Acme et M. Durand chez Acme Corp sont-elles la même personne ? »*. C'est là, et
seulement là, que le système gagne une vraie dimension multi-agents.

Le motif retenu est **proposeur / vérificateur**, en deux temps :

- un premier appel — le **proposeur** — examine l'ensemble borné de paires ambiguës que le blocage
  déterministe n'a pas su trancher, et propose une décision assortie de sa justification ;
- un second appel — le **vérificateur** — s'exécute dans un **contexte frais**. Il reçoit la
  proposition et les estampilles de provenance, puis la conteste ou la valide. Un vérificateur en
  contexte séparé attrape des erreurs qu'une simple auto-critique, prisonnière de son propre
  raisonnement, ne voit pas.

### Pourquoi ce design se justifie

Trois propriétés le rendent défendable plutôt que décoratif :

- **Coût maîtrisé.** Il ne s'applique qu'à l'ensemble borné des cas que le déterminisme a laissés
  ouverts, pas à tout le flux. On paie le LLM là où il tranche, pas là où une clé de rapprochement
  suffit.
- **Rejouable et cacheable.** Chaque décision est journalisée avec son **entrée exacte** ; elle est
  donc rejouable et mise en cache. Le **chemin de code** reste déterministe au sens du §10 : à
  entrée identique, sortie identique. Ce qui est probabiliste est isolé, tracé, et se rejoue à
  l'identique une fois la décision figée.
- **Qualité là où elle est difficile.** Le motif améliore la justesse au point dur du système, au
  lieu d'ajouter du LLM là où la réponse est déjà acquise par le code.

### Même motif pour l'équivalence de titres

Le départage sémantique des titres (« VP Sales » ≡ « Head of Sales ») suit la même logique :
**table de synonymes d'abord**, et proposeur / vérificateur seulement en repli, sur les titres que
la table ne couvre pas. On ne convoque le jugement qu'une fois le déterminisme épuisé.

### Ce n'est pas une boucle agentique

Point crucial de cohérence : proposeur et vérificateur sont **deux appels one-shot chaînés**, pas
une boucle agentique. Aucun des deux ne planifie, ne choisit ses outils, ni ne décide de se relancer.
L'affirmation centrale de ce fichier reste donc vraie : **il n'y a aucune boucle à piloter**. Ce qui
change n'est pas la nature du système, mais le **nombre de points d'appel LLM** : **quatre** au lieu
de trois.

---

## Conséquences (collecteurs déterministes, orchestrateur = pipeline)

- Le **parallélisme du §10** devient un `asyncio.gather` trivial. Il reste souhaitable pour la
  latence, mais il ne justifie plus aucune infrastructure d'agents.
- L'**orchestrateur devient une fonction de pipeline**. Le flux du §3 est un **DAG statique** : il
  n'y a rien à planifier, donc rien à confier à un lead agent. Le §4 le concède déjà en lui
  interdisant tout tool métier — un agent LLM sans tool et sans décision est décoratif.
- Le système reste **déterministe partout sauf aux quatre points d'appel LLM**, dont les deux de
  réconciliation sont eux-mêmes journalisés et rejouables. C'est exactement la propriété que le §10
  réclame, et que les tests de [08](08-invariants-a-verifier.md#déterminisme-de-larbitrage) doivent
  prouver.
- Le coût et la latence restent contenus : le LLM n'est convoqué que sur l'ensemble borné des cas
  qui le méritent.

---

## Correction factuelle sur le §11 : « Claude Agent SDK ? »

Le brief confond deux paquets distincts. Compte tenu de la décision ci-dessus, **aucun des deux
n'est nécessaire** — mais la confusion mérite d'être levée, car elle réapparaîtra dans le prompt de
génération de code.

- **Claude Agent SDK** (`claude-agent-sdk`) est Claude Code packagé en librairie : outils intégrés
  Read / Write / Edit / Bash / Grep, harnais d'agent de **codage**. Sans rapport avec ce produit.
- **Tool Runner de l'API Claude** (`client.beta.messages.tool_runner`) pilote une boucle agentique
  sur vos propres outils. Il aurait été le bon choix *si* on avait gardé des agents LLM en boucle.
  Or proposeur et vérificateur sont deux appels one-shot chaînés : il n'y a aucune boucle à piloter.

### Ce qu'il faut réellement

Le SDK Anthropic Python standard (`anthropic`), et **quatre appels one-shot** — deux d'entre eux
simplement chaînés (proposeur puis vérificateur).

| Étape | Appel | Modèle |
|---|---|---|
| Réconciliation — proposeur (résolution d'entités, équivalence de titres) | `messages.parse()` + Pydantic | `claude-opus-4-8` |
| Réconciliation — vérificateur (contexte frais) | `messages.parse()` + Pydantic | `claude-opus-4-8` |
| Scoring — mise en prose de la décomposition | `messages.parse()` + Pydantic | `claude-opus-4-8` |
| Personnalisation des questions | `messages.create()` | `claude-sonnet-5` |

Sorties structurées partout où le résultat est consommé par du code — c'est-à-dire aux trois
premières étapes, dont les propositions et vérifications qui doivent être journalisées et remises au
schéma canonique. Seule la personnalisation produit du texte destiné à un humain.

Le « framework d'orchestration » du §11 est donc une **non-question** : c'est une fonction de
pipeline `async` de quelques dizaines de lignes, avec un simple chaînage proposeur → vérificateur au
point de réconciliation. Cela allège considérablement le prompt de génération de code à produire
(§13).

> **Ne pas confondre deux usages de modèle.** Le §13 prévoit `claude-fable-5` pour **générer le
> code**. C'est un choix défendable (modèle le plus capable), sans aucun rapport avec les modèles
> appelés au **runtime** dans le tableau ci-dessus.

---

## L'arbitrage produit

Il faut le dire honnêtement. Un essaim d'agents collecteurs ferait une démo plus « multi-agents »,
et cela a une valeur propre dans un hackathon Anthropic : ça se montre bien. Mais la thèse
d'ingénierie la plus forte est l'inverse — **confiner délibérément le LLM aux seuls endroits où il
juge réellement** (la résolution d'entités et l'arbitrage sémantique), et **prouver par des tests
que tout le reste est déterministe et auditable**. C'est très exactement ce que réclame le §10. Le
design proposeur / vérificateur donne d'ailleurs une vraie histoire multi-agents, mais placée là où
elle change la qualité de la sortie plutôt que là où elle décore l'architecture. Cet arbitrage a été
tranché en faveur du déterminisme confiné le 2026-07-09.
