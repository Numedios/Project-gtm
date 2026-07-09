# 02 — Trous de spécification

**Sévérité : élevée.** Non bloquants au sens strict, mais chacun sera comblé par une invention
arbitraire du modèle de génération de code s'il n'est pas tranché avant.

---

## 2.0 Le schéma canonique doit porter un marqueur `stable | volatile`

Conséquence de la résolution de l'incohérence n°1
([01 §1.1](01-incoherences-internes.md#11-lexemple-du-6-contredit-la-règle-darbitrage-n1--résolue)).

La règle d'arbitrage est unique — **la récence prime** — mais ce qu'on *émet* dépend de la nature
du champ :

- champ **volatile** (`titre`, `seniorite`, `effectif`) : une divergence est un **changement**, pas
  une erreur. Signal d'achat, pas conflit, pas de question à l'AE ;
- champ **stable** (`pays_siege`, `nom` légal) : une divergence signifie qu'une source **se
  trompe**. Vrai conflit, question à l'AE.

Chaque champ du schéma du §6 doit donc porter ce marqueur. C'est une passe de spécification
d'environ trente champs, relue par le métier. Elle **remplace** la table
`champ → classe d'autorité` que suggérait la version initiale de cet audit : la règle 1 du brief
étant caduque, il n'y a plus de classe d'autorité à définir.

**Corollaire sur la structure du jeu de données consolidé :** l'union **ne doit pas écraser**.
Conserver toutes les observations estampillées (source, valeur, date, confiance) et *dériver* la
valeur retenue. Deux sources qui donnent la même valeur ne forment pas un doublon à dédupliquer :
c'est une **corroboration**, et elle doit remonter dans le calcul de confiance (voir §2.1).

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

### Deux seuils à spécifier également

Conséquence de la résolution de l'incohérence n°2
([01 §1.2](01-incoherences-internes.md#12-a_signaler_ae-na-pas-de-règle-de-déclenchement--résolue)) :

```
a_signaler_AE = (resolution == "impossible")
             OR (age(valeur_retenue) > SEUIL_AGE)
             OR (ecart_jours         > SEUIL_ECART)
```

Ces deux seuils sont **paramétrés par classe de champ, jamais globalement**. Les champs volatiles
n'émettant plus de conflits, ils ne s'appliquent qu'aux champs **stables**, où le défaut prudent
est `SEUIL_ECART = 0` — toute divergence est signalée, puisqu'elle révèle une erreur de source et
non une évolution de la donnée.

Ce sont les deux paramètres qui **déterminent le volume de questions reçues par l'AE**. Ils doivent
être calibrés sur des données réelles, pas devinés.

---

## 2.2 La résolution d'entités est le point dur, et n'est pas spécifiée

Rapprocher les entités à travers Sillage, FullEnriched et le CRM — **sans web search ni LinkedIn**
(contrainte ferme du §2) — est le cœur de difficulté de la réconciliation. Le brief y consacre une
demi-ligne : *« (1) rapproche les entités »*.

### Suggestion : deux étages, dont le second est un motif proposeur / vérificateur

1. **Blocage déterministe** sur clé normalisée. Email normalisé en priorité, puis
   `nom + domaine entreprise`. Résout l'écrasante majorité des cas, sans LLM, donc reproductible.
2. **Départage LLM en motif proposeur / vérificateur**, sur l'ensemble **borné** de paires
   ambiguës que l'étage 1 n'a pas su trancher. Un premier appel — le **proposeur** — propose une
   décision assortie de sa justification. Un second appel — le **vérificateur** — s'exécute dans un
   **contexte frais**, reçoit la proposition et les estampilles de provenance, puis la conteste ou
   la valide. Un vérificateur en contexte séparé attrape des erreurs qu'une simple auto-critique ne
   voit pas. Ce sont **deux appels one-shot chaînés**, pas une boucle agentique. Chaque décision —
   proposition comme vérification — est journalisée avec son entrée exacte (donc rejouable) et mise
   en cache. Le détail du motif est développé dans [04](04-architecture-collecteurs.md).

Cette structure préserve l'exigence de déterminisme du §10 **au niveau du chemin de code** : le
LLM n'est jamais sur le chemin nominal, seulement sur les cas résiduels, et ses décisions sont
tracées et rejouables à l'identique. À entrée identique, sortie identique.

Le même schéma vaut pour l'équivalence sémantique de titres (« VP Sales » ≡ « Head of Sales ») :
table de synonymes d'abord, proposeur / vérificateur seulement en repli, sur les titres que la
table ne couvre pas.

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
