# Axe A — Le moteur déterministe

**Poste 1.** Aucun LLM, aucun réseau, aucune UI. Se teste entièrement avec `npx vitest run`.

> Ce document est autosuffisant : tu peux implémenter l'axe A sans ouvrir l'audit.
> Contexte général : [`../SYNTHESE.md`](../SYNTHESE.md). L'autre axe :
> [`axe-B-surface.md`](axe-B-surface.md).

---

## Ce que tu construis, et pourquoi c'est le cœur

Le moteur prend des **observations estampillées** venant de trois sources et produit un **dossier
consolidé** où chaque champ porte sa provenance, où les divergences sont soit des signaux, soit des
questions posées à l'AE, et où deux scores sont calculés de façon reproductible.

C'est ici qu'est la valeur du produit. Tout le reste — l'UI, les connecteurs, les appels au modèle —
est du câblage autour de ce noyau.

**Règle absolue : les fixtures (A5) et les tests d'invariants (A6) s'écrivent AVANT le moteur (A2).**
Elles sont la spécification exécutable. Écrire l'arbitrage d'abord, c'est se laisser inventer les
règles en chemin — silencieusement.

---

## Ordre de travail

```
A1  champs + marqueurs stable|volatile     ← relu par un humain metier
A5  CRM mocke + les onze fixtures          ← la specification, sous forme executable
A6  tests d'invariants                     ← ils doivent ECHOUER, il n'y a pas de code
A2  arbitrage                              ← les rend verts
A3  signalement
A4  scoring (les trois formules)
```

---

## Le contrat partagé (figé avec le poste 2 avant de commencer)

`lib/schema/canonical.ts`. Une seule source de vérité, en Zod.

```ts
// Une observation estampillée. On les conserve TOUTES.
export const Observation = z.object({
  valeur: z.unknown(),
  source: z.enum(['sillage', 'fullenrich', 'crm']),
  date_donnee: z.string().datetime().nullable(),  // null ⇒ pas d'arbitrage possible
  confiance_source: z.number().min(0).max(1),
});

export const Volatilite = z.enum(['stable', 'volatile']);

export const ChampConsolide = z.object({
  observations: z.array(Observation),   // jamais aplaties
  valeur_retenue: z.unknown(),          // DÉRIVÉE des observations
  confiance: z.number(),
  volatilite: Volatilite,
});
```

**L'union n'écrase pas.** Deux sources qui donnent la même valeur, ce n'est pas un doublon à
dédupliquer : c'est une **corroboration**, et elle doit faire monter la confiance. Conserver toutes
les observations, et *dériver* `valeur_retenue`. Ne jamais aplatir au merge.

---

## A1 — Les champs et leur marqueur

Le marqueur `stable | volatile` ne dit pas *qui gagne* (c'est toujours la récence). Il dit **ce
qu'on émet** quand deux sources divergent.

- **Champ volatile** (`titre`, `seniorite`, `effectif`) : les deux valeurs étaient vraies à leur
  date. Marie Durand était « Head of Sales » en 2024 et « VP Sales » en 2026 — elle a été promue.
  Ce n'est pas une erreur, c'est un **changement**. On émet un **signal**, aucune question.
- **Champ stable** (`pays_siege`, `nom` légal) : une divergence signifie qu'une source **se trompe**.
  Un siège social ne change pas de pays en trois semaines. Être plus récent ne confère aucune
  autorité sur un fait immuable. On émet un **conflit**, donc une question.

Sans ce marqueur, chaque décideur promu depuis le dernier deal génère une question de confirmation
inutile. **C'est le risque produit n°1 du système.**

Environ trente champs à classer. **À faire relire par un humain métier** — c'est une passe de
spécification, pas une décision technique.

Les champs CRM (`historique_deals`, `historique_relationnel`) n'existent que chez nous : on les
définit librement, et ils ne peuvent **jamais** entrer en conflit puisqu'ils n'ont qu'une source.

---

## A5 — Le CRM mocké : onze fixtures, pas des données plausibles

Le CRM est la seule source qu'on contrôle entièrement. Deux conséquences.

**Le contrat « lecture seule » devient trivialement vérifiable.** On écrit le mock avec uniquement
des méthodes de lecture. L'invariant est alors garanti par le **type**, pas par un prompt ni par une
revue de code.

**Le mock est le jeu de tests de la réconciliation.** Il doit contenir, délibérément, exactement les
cas que le système prétend gérer :

| # | Fixture | Ce qu'elle teste | Sortie attendue |
|---|---|---|---|
| 1 | Titre périmé divergeant de Sillage | champ **volatile** | **signal** « changement de décisionnaire », **aucune** question |
| 2 | `pays_siege` divergent, 2 sources fraîches, `SEUIL_ECART = 0` | champ **stable** | `resolution: auto` + **signalé** → question de **confirmation** |
| 3 | `pays_siege` divergent, `SEUIL_ECART` relevé | le seuil est bien un **paramètre** | valeur retenue **en silence**, aucun conflit |
| 4 | Valeur retenue elle-même périmée (`age > SEUIL_AGE`) | angle mort : les **deux** sources sont vieilles | **conflit** → question de confirmation |
| 5 | Effectif différant de 6 % | tolérance numérique | ni conflit ni signal |
| 6 | Champ **sans date** | pas de date, pas d'arbitrage | `resolution: impossible` → question **ouverte** |
| 7 | Deux sources, **même valeur** | corroboration | aucun conflit, **confiance rehaussée** |
| 8 | Deux sources, **même date**, valeurs divergentes | départage par `confiance_source` | conflit **si** les confiances sont égales |
| 9 | Décideur ayant fait un deal dans une **autre** entreprise | historique relationnel | remonté, aucun conflit |
| 10 | Compte qui matche **deux fois** | ambiguïté du branchement | `NOUVEAU_LEAD` + conflit signalé |
| 11 | Lead **absent** du CRM | branche neuve | dossier `NOUVEAU_LEAD` |

Deux commentaires. La **n°9** : l'historique relationnel n'a qu'une source, il ne peut jamais entrer
en conflit — c'est cette observation qui a rendu caduque la règle d'autorité de source du brief. Les
**n°2 et n°3** sont la même divergence à deux réglages : ensemble, elles prouvent que le seuil est un
bouton, pas une constante enfouie dans le code.

---

## A2 — L'arbitrage : une règle unique

> **Union des données non conflictuelles. En cas de conflit, la récence prime.**

Table de décision, à implémenter ligne par ligne :

| Situation | Valeur retenue | Ce qu'on émet |
|---|---|---|
| Un seul prétendant | la valeur | rien |
| Plusieurs prétendants, valeurs identiques | la valeur | **confiance rehaussée** (corroboration) |
| Écart numérique sous tolérance | la plus récente | rien |
| Divergence, champ **volatile** | la plus récente | **signal** « changement détecté » |
| Divergence, champ **stable** | la plus récente | **conflit** → question |
| Une date manquante | — | **conflit** → question ouverte |
| Dates identiques | la `confiance_source` la plus haute | conflit **si** les confiances sont égales |

**Trois garde-fous à ne pas perdre :**

1. La récence exige des dates. Pas de date, pas d'arbitrage automatique.
2. Dates identiques ⇒ départage par `confiance_source`. Sans ça, l'arbitrage n'est pas déterministe.
3. L'union n'écrase pas (voir plus haut).

**Prérequis, en amont :** « Sillage dit *SaaS*, le CRM dit *Logiciel* » n'est pas une divergence,
c'est une différence de **taxonomie**. Elle est absorbée par l'équivalence sémantique (poste 2, B4)
avant d'atteindre l'arbitrage. Si elle arrivait ici sous forme de conflit, `SEUIL_ECART = 0`
produirait un flot de fausses questions.

---

## A3 — Le signalement : deux notions distinctes

Le brief les confondait. On les découple.

```
resolution    : "auto" | "impossible"     -- ai-je su trancher ?
a_signaler_AE : bool                      -- faut-il faire vérifier malgré tout ?

a_signaler_AE = (resolution === "impossible")
             || (age(valeur_retenue) > SEUIL_AGE)
             || (ecart_jours         > SEUIL_ECART)
```

| `resolution` | `a_signaler_AE` | Ce que reçoit l'AE |
|---|---|---|
| `auto` | `false` | rien — valeur retenue en silence |
| `auto` | `true` | question de **confirmation** : « Le siège est-il bien en France ? » |
| `impossible` | `true` | question **ouverte** : « Où se situe le siège social ? » |
| `impossible` | `false` | **n'existe pas** — doit lever en test |

Le terme `age(valeur_retenue) > SEUIL_AGE` couvre l'angle mort du brief : quand les **deux** sources
sont périmées, la récence tranche mais ne rassure pas.

**Seuils par classe de champ, jamais globaux.** Les champs volatiles n'émettent plus de conflits, les
seuils ne concernent donc que les stables, où le défaut prudent est `SEUIL_ECART = 0`.

Ces deux seuils **déterminent le volume de questions reçues par l'AE**. Un AE qui reçoit trente
questions de confirmation n'utilisera pas l'outil. Ils doivent être des paramètres, calibrables.

---

## A4 — Les trois formules

Elles n'existaient nulle part. Ce sont des **fonctions pures et déterministes** du dossier
consolidé, testables sans réseau ni modèle.

```
confiance(champ)     = f(autorité_source, âge_donnée, corroboration_par_une_autre_source)
completude(dossier)  = couverture pondérée des champs du template
                     + au moins un interlocuteur identifié
                     + présence des champs nécessaires au jugement ICP
score_icp(dossier)   = (score, décomposition_par_critère)
```

**Point critique sur l'ICP.** Le calcul renvoie le score **et sa décomposition par critère**. Le LLM
(poste 2, B5) ne fait que **mettre la décomposition en prose**. Il ne calcule ni n'ajuste jamais le
chiffre. Si on le laissait produire le score et la justification ensemble, rien ne garantirait qu'ils
concordent.

Note produit : **score ICP ≠ score de complétude**. Beaucoup de solutions les confondent. Un lead
peut être parfaitement documenté et ne pas correspondre à l'ICP, ou l'inverse.

**Absence de valeur ≠ conflit.** Un champ absent de *toutes* les sources n'est pas un conflit — il
n'y a rien à arbitrer. Mais ça doit faire chuter la complétude et alimenter une question. Sans règle
explicite, le moteur fabriquera un conflit vide ou ignorera l'absence en silence.

---

## A6 — Les invariants (à écrire en premier)

Vitest, table-driven. Ils doivent **échouer** tant que le moteur n'existe pas.

- `resolution === 'impossible' && a_signaler_AE === false` **ne se produit jamais**.
- À entrée identique, **sortie identique** sur tout le chemin non-LLM.
- Le CRM mocké n'expose **aucune** méthode d'écriture (garanti par le type).
- Deux sources concordantes ⇒ la confiance **monte** ; aucune observation n'est perdue au merge.
- Les onze fixtures produisent chacune exactement la sortie attendue du tableau A5.

Deux invariants concernent le poste 2 mais se testent ici, sur des données :

- Le profil AE ne contient **aucun** champ hors des cinq slots stylistiques ; tout champ inconnu lève.
- La personnalisation est une **bijection** sur la liste de questions : même cardinalité, même ordre,
  seul le texte de chaque item change.

---

## Ce que tu ne fais pas

Tu n'appelles aucun modèle. Tu n'ouvres aucune socket. Tu n'importes rien de `lib/llm/`, rien de
`app/`. Si tu as besoin d'un résultat du poste 2, il arrive sous forme de données conformes au
schéma canonique — pas sous forme d'import.

Le moteur doit tourner, complet et testé, **sans qu'aucune clé API n'existe**.
