# 04 — Les collecteurs ne sont pas des agents

**Constat structurant.** Il ne découle pas d'une préférence, mais de ce que le brief dit lui-même.

---

## L'observation

Le §5 énonce le contrat commun des trois agents de collecte :

> *« Ils **n'arbitrent pas** les conflits. Chaque champ renvoyé est estampillé avec sa provenance. »*

Autrement dit : ils appellent une source, normalisent, estampillent. **Aucune décision.** Ce sont
des **fonctions**, pas des agents.

Le jugement LLM est d'ailleurs déjà correctement confiné par le brief aux trois seuls endroits où
il apporte de la valeur :

1. **Réconciliation** — départages sémantiques (« même personne ? », équivalence de titres,
   « ce signal contredit-il la firmographie ? »).
2. **Scoring** — mise en prose de la décomposition par critère produite par le tool déterministe.
3. **Personnalisation** — reformulation stylistique des questions.

---

## Conséquences (décision retenue : collecteurs déterministes)

- Le **parallélisme du §10** devient un `asyncio.gather` trivial. Il reste souhaitable pour la
  latence, mais il ne justifie plus aucune infrastructure d'agents.
- L'**orchestrateur devient une fonction de pipeline**. Le flux du §3 est un **DAG statique** : il
  n'y a rien à planifier, donc rien à confier à un lead agent. Le §4 le concède déjà en lui
  interdisant tout tool métier — un agent LLM sans tool et sans décision est décoratif.
- Le système devient **déterministe partout sauf aux trois points prévus**, ce qui est exactement
  la propriété que le §10 réclame.
- Le coût et la latence chutent.

**Contrepartie assumée.** Un tel système ressemble beaucoup moins à une démo multi-agents, ce qui a
peut-être une valeur propre dans un hackathon Anthropic. C'est un arbitrage **produit**, pas
technique. Il a été tranché en faveur du déterminisme le 2026-07-09.

---

## Correction factuelle sur le §11 : « Claude Agent SDK ? »

Le brief confond deux paquets distincts. Compte tenu de la décision ci-dessus, **aucun des deux
n'est nécessaire** — mais la confusion mérite d'être levée, car elle réapparaîtra dans le prompt de
génération de code.

- **Claude Agent SDK** (`claude-agent-sdk`) est Claude Code packagé en librairie : outils intégrés
  Read / Write / Edit / Bash / Grep, harnais d'agent de **codage**. Sans rapport avec ce produit.
- **Tool Runner de l'API Claude** (`client.beta.messages.tool_runner`) pilote une boucle agentique
  sur vos propres outils. Il aurait été le bon choix *si* on avait gardé des agents LLM. Avec des
  collecteurs déterministes, il n'y a plus de boucle à piloter.

### Ce qu'il faut réellement

Le SDK Anthropic Python standard (`anthropic`), et **trois appels one-shot**.

| Étape | Appel | Modèle |
|---|---|---|
| Réconciliation — départages sémantiques | `messages.parse()` + modèle Pydantic | `claude-opus-4-8` |
| Scoring — mise en prose de la décomposition | `messages.parse()` + modèle Pydantic | `claude-opus-4-8` |
| Personnalisation des questions | `messages.create()` | `claude-sonnet-5` |

Sorties structurées partout où le résultat est consommé par du code — c'est-à-dire aux deux
premières étapes. Seule la personnalisation produit du texte destiné à un humain.

Le « framework d'orchestration » du §11 est donc une **non-question** : c'est une fonction de
pipeline `async` de quelques dizaines de lignes. Cela allège considérablement le prompt de
génération de code à produire (§13).

> **Ne pas confondre deux usages de modèle.** Le §13 prévoit `claude-fable-5` pour **générer le
> code**. C'est un choix défendable (modèle le plus capable), sans aucun rapport avec les modèles
> appelés au **runtime** dans le tableau ci-dessus.
