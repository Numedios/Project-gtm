# 02 — Trous de spécification

**Sévérité : élevée.** Non bloquants au sens strict, mais chacun sera comblé par une invention
arbitraire du modèle de génération de code s'il n'est pas tranché avant.

---

## 2.1 Aucune formule pour les deux scores ni pour la confiance

Le brief manipule trois quantités numériques sans jamais dire comment les calculer.

- `confiance_source: 0.8` apparaît dans l'exemple d'estampille du §6. D'où vient ce nombre ?
- Le **score de complétude** (§8) est décrit par ce qu'il mesure, jamais par comment il le mesure.
- Le **score ICP** est confié à un « tool de scoring déterministe » dont l'algorithme n'existe pas.

### Suggestion

Les trois doivent être des **fonctions pures et déterministes** du jeu de données consolidé, donc
testables unitairement sans appel réseau ni LLM.

```
confiance(champ)   = f(autorité_source, âge_donnée, corroboration_par_une_autre_source)
complétude(dossier) = couverture pondérée des champs du template
                      + au moins un interlocuteur identifié
                      + présence des champs nécessaires au jugement ICP
score_ICP(dossier)  = tool déterministe → (score, décomposition par critère)
```

**Point critique sur le score ICP.** Le tool renvoie le score **et sa décomposition par critère**.
Le LLM ne calcule ni n'ajuste jamais le score : il **met la décomposition en prose**. Si on laisse
le modèle produire le chiffre et la justification ensemble, rien ne garantit que les deux
concordent — et le §10 exige un livrable auditable.

---

## 2.2 La résolution d'entités est le point dur, et n'est pas spécifiée

Rapprocher les entités à travers Sillage, FullEnriched et le CRM — **sans web search ni LinkedIn**
(contrainte ferme du §2) — est le cœur de difficulté de la réconciliation. Le brief y consacre une
demi-ligne : *« (1) rapproche les entités »*.

### Suggestion : deux étages

1. **Blocage déterministe** sur clé normalisée. Email normalisé en priorité, puis
   `nom + domaine entreprise`. Résout la grande majorité des cas, sans LLM, donc reproductible.
2. **LLM en départage uniquement**, sur l'ensemble **borné** de paires ambiguës que l'étage 1 n'a
   pas résolues. Chaque décision est journalisée avec son entrée exacte (donc rejouable) et mise en
   cache.

Cette structure préserve l'exigence de déterminisme du §10 **au niveau du chemin de code** : le
LLM n'est jamais sur le chemin nominal, seulement sur les cas résiduels, et ses décisions sont
traçables.

Le même schéma vaut pour l'équivalence sémantique de titres (« VP Sales » ≡ « Head of Sales ») :
table de synonymes d'abord, LLM en repli.

---

## 2.3 Le critère « lead déjà présent dans le CRM » n'est pas défini

Le branchement du §7 (dossier MISE À JOUR vs NOUVEAU LEAD) repose **entièrement** sur ce critère.
Sur quoi matche-t-on ? Domaine de l'entreprise, email du contact, raison sociale ?

### Suggestion

Lookup déterministe explicite : `find_account(domaine) or find_contact(email)`.

Cas ambigu (plusieurs comptes matchent) → traiter comme **nouveau lead** *et* émettre un conflit
avec `a_signaler_AE: true`. La règle produit « conflit → question » couvre déjà ce cas,
gratuitement. C'est un bon signe : la règle est bien posée si elle absorbe les cas limites sans
mécanisme ad hoc.

---

## 2.4 Absence de valeur ≠ conflit

Le brief ne dit pas comment traiter un champ absent de **toutes** les sources.

Ce n'est pas un conflit — il n'y a rien à arbitrer. Mais ça doit faire chuter le **score de
complétude** et alimenter une question de qualification. Sans règle explicite, le moteur
d'arbitrage risque de fabriquer un conflit vide, ou d'ignorer l'absence silencieusement.

---

## 2.5 Sujets entièrement absents du brief

| Sujet | Pourquoi ça compte ici |
|---|---|
| **Panne partielle d'une source** | Si Sillage timeout, le dossier doit-il sortir dégradé ? Le design le permet gratuitement : la source manquante fait chuter la complétude. À expliciter — c'est un point fort de l'architecture, pas une rustine. |
| **Statut par source dans la sortie** | Corollaire du point ci-dessus. L'AE doit lire « Signaux d'achat : indisponible » plutôt que constater une absence silencieuse. |
| **PII** | FullEnriched renvoie des coordonnées de décideurs. Ne pas les journaliser ; ne pas les faire transiter dans le prompt de personnalisation, où elles ne servent à rien. |
| **Injection de prompt** | Voir [03-securite-injection-prompt.md](03-securite-injection-prompt.md). |
| **Trace d'exécution** | Le §10 exige la traçabilité. Une trace JSON par run (chaque appel outil, chaque décision d'arbitrage, chaque départage LLM) est le livrable qui la matérialise. |
| **Budget de latence** | Le parallélisme du §10 est justifié par la latence. Aucune cible chiffrée n'est donnée, donc rien ne permet de dire si le parallélisme est nécessaire. |
| **Idempotence / cache / coût** | Un même lead requalifié deux fois doit-il retaper les trois sources ? |
