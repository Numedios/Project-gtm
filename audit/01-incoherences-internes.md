# 01 — Incohérences internes du brief

**Sévérité : bloquant.** Ces trois points n'étaient pas des détails d'implémentation : tant qu'ils
n'étaient pas tranchés, le moteur d'arbitrage n'était pas spécifiable et l'invariant fond/forme
n'était pas tenable. Les trois sont désormais tranchés (2026-07-09) ; les décisions retenues sont
consignées ci-dessous.

| # | Sujet | Statut |
|---|---|---|
| 1.1 | Le titre du décideur — règle 1 vs exemple du §6 | ✅ **Résolue** (2026-07-09) |
| 1.2 | `a_signaler_AE` sur un conflit résolu | ✅ **Résolue** (2026-07-09) |
| 1.3 | La mémoire AE viole son propre invariant | ✅ **Résolue** (2026-07-09) |

---

## 1.1 L'exemple du §6 contredit la règle d'arbitrage n°1 — ✅ RÉSOLUE

### Le problème constaté

Le brief énonce deux choses incompatibles :

- **Règle 1** (§6) : *« Autorité de source par type de donnée : historique relationnel → CRM fait
  foi (même plus ancien) ; firmographie/signaux live → source externe la plus fraîche. »*
- **Exemple d'enregistrement de conflit** (§6) : `titre_decideur` est arbitré par **récence**,
  Sillage (2026-06-30) l'emporte sur le CRM (2024-03-01).

Le CRM perd. Or si le titre d'un décideur relève de l'historique relationnel, la règle 1 dit qu'il
devrait gagner — *même plus ancien*, c'est le mot exact du brief.

Diagnostic initial : la taxonomie de la règle 1 **n'est pas une partition**. Elle définit deux
classes — historique relationnel, firmographie/signaux. La firmographie décrit une *entreprise*,
l'historique relationnel décrit *notre relation* avec elle. Le titre décrit une **personne**, et le
§6 place bien `nom`, `titre`, `seniorite`, `coordonnees` dans une entité Personne distincte. Tous
ces champs tombent dans un trou de la taxonomie.

---

### Décision retenue (2026-07-09)

> **Union des données non conflictuelles. En cas de conflit, la récence prime.**

**La règle 1 du brief est caduque. La règle 2 (récence) devient la règle d'arbitrage unique.**

### Pourquoi la règle 1 peut être supprimée plutôt qu'arbitrée

Elle protège un **ensemble vide**. D'après les contraintes fermes du §2 :

- L'**historique relationnel** n'est fourni que par le **CRM**. Sillage ne le connaît pas ;
  FullEnriched ne fait que du contact. Il n'y a donc jamais deux prétendants sur ces champs, donc
  jamais de conflit, donc **l'union suffit**. La clause « CRM fait foi, même plus ancien » ne
  s'applique à aucun cas réel.
- Les seuls champs réellement disputés sont la **firmographie** (Sillage contre un snapshot CRM
  figé au dernier deal) et les **attributs de personne** (Sillage, FullEnriched, CRM). Sur tous, la
  source externe fraîche a raison contre le snapshot périmé.

L'incohérence n'est donc pas tranchée : elle **disparaît**, parce que le classement de
`titre_decideur` n'a plus d'objet.

### Amendement retenu : marqueur `stable | volatile` par champ

La récence dit *qui gagne*, pas *ce qu'on affiche*. Sans ce marqueur, chaque décideur promu depuis
le dernier deal génère une question de confirmation inutile — le **risque produit n°1** du système.

- Champ **volatile** (`titre`, `seniorite`, `effectif`) : une divergence entre deux dates n'est pas
  une erreur, c'est un **changement**. Les deux valeurs étaient vraies à leur date. La récence
  gagne, et on émet un **signal**, pas un conflit. Aucune question.
- Champ **stable** (`pays_siege`, `nom` légal) : une divergence signifie qu'une source **se
  trompe**. Rien ne garantit que la fraîche ait raison sur un fait qui n'était pas censé bouger. On
  émet un **vrai conflit** et on pose la question.

Le cas du brief — « Head of Sales » en 2024, « VP Sales » en 2026 — cesse d'être un conflit. Marie
Durand a été promue. C'est exactement le **« changement de décisionnaire »** que le §5 liste comme
signal d'achat. Le brief le traitait comme une erreur à résoudre ; c'est une information à remonter.

### Table de décision du moteur d'arbitrage

| Situation | Valeur retenue | Ce qu'on émet |
|---|---|---|
| Un seul prétendant | Union, la valeur | Rien |
| Plusieurs prétendants, valeurs identiques | La valeur | **Confiance rehaussée** (corroboration) |
| Écart numérique sous tolérance | La plus récente | Rien — règle 3 |
| Divergence, champ **volatile** | La plus récente | **Signal** « changement détecté » → alimente les signaux d'achat |
| Divergence, champ **stable** | La plus récente | **Conflit** → question à l'AE |
| Une date manquante | — | **Conflit** → question à l'AE (règle 4) |
| Dates identiques | Confiance de source la plus haute | Conflit si les confiances sont égales |

### Trois garde-fous à ne pas perdre

1. **La récence exige des dates.** La règle 4 reste indispensable : pas de date, pas d'arbitrage.
2. **Dates identiques → départage par `confiance_source`**, sinon l'arbitrage n'est pas
   déterministe et l'invariant du §10 tombe.
3. **L'union ne doit pas écraser.** Deux sources donnant la même valeur, ce n'est pas un doublon à
   dédupliquer, c'est une **corroboration** qui doit faire monter la confiance. Conserver toutes
   les observations estampillées et *dériver* la valeur retenue ; ne jamais aplatir au merge.

### Coût et conséquences

- **Coût :** classer les ~30 champs du schéma canonique en `stable` / `volatile`. Une passe de
  spécification, relue par le métier. Cela **remplace** la table `champ → classe d'autorité`
  initialement proposée, qui n'a plus lieu d'être.
- **Effet sur [1.2](#12-a_signaler_ae-na-pas-de-règle-de-déclenchement) :** une fois les
  changements de champs volatiles sortis du flux des conflits, la question « faut-il signaler un
  conflit pourtant résolu ? » ne se pose plus que sur les champs **stables**, donc rarement.
- **Fichiers impactés :** [02](02-trous-de-specification.md) (le schéma canonique porte le
  marqueur ; la confiance intègre la corroboration), [05](05-connecteurs.md) (fixture n°2
  réécrite), [08](08-invariants-a-verifier.md) (tests de la règle unique).

---

## 1.2 `a_signaler_AE` n'a pas de règle de déclenchement — ✅ RÉSOLUE

### Le problème constaté

Dans le même exemple du §6, le conflit est **résolu automatiquement** (`regle: "recence"`) et
pourtant `a_signaler_AE: true`.

Or la **règle 4** dit : *« Pas de date OU écart critique → pas de résolution auto → flag + question
à l'AE. »* Elle ne flagge donc que les conflits **non** résolus automatiquement. L'exemple viole la
règle qu'il est censé illustrer.

La condition réelle est probablement `ecart_jours > seuil` (852 jours dans l'exemple), mais ce
n'est écrit nulle part.

Sans règle explicite, **le volume de questions générées est imprévisible** : c'est un risque produit
direct, pas seulement une imprécision de spec. Un AE qui reçoit trente questions de confirmation
n'utilisera pas l'outil.

### Ce que la résolution n°1 avait déjà réduit

Depuis qu'un champ **volatile** divergent produit un signal et non un conflit, il ne reste que trois
situations capables d'émettre un conflit : champ **stable** divergent, **date manquante**, **dates
et confiances identiques**. Les deux dernières sont couvertes par la règle 4 sans discussion. Le
débat ne portait donc plus que sur la première.

---

### Décision retenue (2026-07-09)

On **garde** `a_signaler_AE`, et on **découple** deux notions que le brief confond.

```
resolution    : "auto" | "impossible"     -- ai-je su trancher ?
a_signaler_AE : bool                      -- faut-il faire vérifier malgré tout ?

a_signaler_AE = (resolution == "impossible")
             OR (age(valeur_retenue) > SEUIL_AGE)
             OR (ecart_jours         > SEUIL_ECART)
```

| `resolution` | `a_signaler_AE` | Ce que reçoit l'AE |
|---|---|---|
| `auto` | `false` | Rien. Valeur retenue en silence. |
| `auto` | `true` | Question de **confirmation** — on propose une valeur : « Le siège est-il bien en France ? » |
| `impossible` | `true` | Question **ouverte** — aucune valeur fiable : « Où se situe le siège social ? » |
| `impossible` | `false` | **N'existe pas** — invariant à tester |

### Ce que ce découplage corrige

Le terme `age(valeur_retenue) > SEUIL_AGE` couvre **l'angle mort du brief** : quand les *deux*
sources sont périmées, la récence tranche mais ne rassure pas. La plus fraîche des deux peut être
vieille de deux ans. Le brief ne prévoyait rien pour ce cas.

### Réglage par défaut : des seuils **par classe de champ**, pas globaux

Les champs volatiles n'émettent plus de conflits (résolution n°1). Les seuils ne s'appliquent donc
qu'aux champs **stables**.

Sur un champ stable, une divergence ne signifie pas que la donnée a évolué : elle signifie qu'une
source **se trompe**. Un siège social ne change pas de pays en trois semaines. La récence donne une
réponse, pas une certitude — être plus récent ne confère aucune autorité sur un fait immuable.

```
champ stable   : SEUIL_ECART = 0     -- toute divergence est signalée
champ volatile : sans objet          -- aucun conflit n'est émis
```

Avec `SEUIL_ECART = 0` sur les champs stables, le comportement par défaut est sûr, et le mécanisme
reste **tunable** : on relève le seuil si le volume de questions devient gênant en pratique. C'est
précisément ce que ce choix apporte face à une suppression pure du champ — **un bouton de réglage
plutôt qu'une règle figée**.

**Risque résiduel, assumé si les seuils sont relevés :** deux sources fraîches, écart de dates
faible, valeurs divergentes sur un champ stable ⇒ la récence tranche en silence et l'AE n'est pas
averti d'une erreur de donnée.

### Invariant à tester

`resolution == "impossible" && a_signaler_AE == false` **ne doit jamais se produire.** C'est la
quatrième ligne du tableau, et elle doit lever en test.

### Prérequis : l'équivalence sémantique en amont

« Sillage dit *SaaS*, le CRM dit *Logiciel* » n'est pas une divergence, c'est une différence de
**taxonomie**. Elle doit être absorbée en amont du moteur d'arbitrage par l'équivalence sémantique
(table de synonymes, puis LLM en repli — voir
[02 §2.2](02-trous-de-specification.md#22-la-résolution-dentités-est-le-point-dur-et-nest-pas-spécifiée)).

Si elle atteignait l'arbitrage sous forme de conflit, `SEUIL_ECART = 0` produirait un flot de
fausses questions — exactement le risque produit que ce réglage cherche à éviter.

---

## 1.3 La mémoire AE peut faire fuiter du fond dans la forme — ✅ RÉSOLUE

### Le problème constaté

Le §9 pose comme **invariant fort** :

> *« N'influence que la forme des questions. Fond, données, scores et fiche récap identiques quel
> que soit l'AE. »*

Puis, trois lignes plus haut, il liste le contenu de cette mémoire :

> *« Tournure/forme préférée des questions, style/ton, **types de lead**. »*

Le **type de lead est un signal de fond**, pas de style. L'invariant et le contenu de la mémoire
sont incompatibles : une mémoire qui encode un « type de lead » peut, à terme, faire varier ce que
l'AE voit — quelles questions, dans quel ordre — d'un AE à l'autre. C'est exactement ce que le §9
interdit.

---

### Décision retenue (2026-07-09)

> **Le profil AE est un schéma fermé de slots strictement stylistiques. Il ne porte aucun signal
> de fond, et il ne peut que réécrire le texte des questions — jamais leur nombre ni leur ordre.**

**`types de lead` est retiré du contenu de la mémoire AE.** C'est un signal de fond, pas de forme ;
il n'a rien à faire dans un profil censé n'agir que sur le style.

Le profil devient un **schéma fermé** de slots à domaine de valeurs borné, tous stylistiques :

```
registre        : formel | familier
longueur        : courte | moyenne | détaillée
tournure        : directe | indirecte
tutoiement      : oui | non
densite_jargon  : faible | moyenne | élevée
```

**Aucun texte libre ne transite du feedback vers le prompt.** Le feedback de l'AE est *interprété*
pour mettre à jour ces slots, jamais recopié. Un ensemble de slots stylistiques ne peut
structurellement pas encoder un « type de lead ».

**L'ordre des questions est figé en amont.** Réordonner, c'est hiérarchiser, donc influencer le
fond perçu par l'AE — l'ordre est du fond déguisé en forme. La personnalisation reçoit une **liste
ordonnée** de questions et n'a qu'un seul degré de liberté : réécrire le **texte** de chaque item.

| Ce que la personnalisation peut faire | Ce qu'elle ne peut jamais faire |
|---|---|
| Réécrire la formulation d'une question | Réordonner les questions |
| Ajuster registre, longueur, tournure, tutoiement, jargon | Ajouter une question |
| — | Supprimer une question |
| — | Encoder un « type de lead » ou tout autre signal de fond |

**Conséquence sur le brief :** l'invariant du §10 (« livrable auditable et comparable entre AE »)
est tenu au sens fort. Le §9 est **amendé** : la mention `types de lead` dans le contenu de la
mémoire est **caduque**.

### Le golden test qui protège l'invariant

À écrire **avant** la première ligne de personnalisation :

> Même lead + deux profils AE différents ⇒ les données consolidées, les scores, la fiche récap, le
> **contenu** des questions **et leur ordre** doivent être **identiques octet pour octet**. Seule
> la **formulation** de chaque question diffère.

C'est un golden test, pas un test d'intégration. En verrouillant à la fois le contenu **et l'ordre**
des questions, il rend le §10 (« livrable auditable et comparable entre AE ») exécutable au lieu
d'être une intention. Tout écart d'ordre entre deux profils est un échec de test, pas une variation
de style tolérée.

### Fichiers impactés

- [03-securite-injection-prompt.md](03-securite-injection-prompt.md#borner-le-profil-ae--décision-arrêtée-le-2026-07-09) — le
  schéma fermé du profil AE (slots stylistiques, domaines de valeurs bornés, aucun texte libre) y
  est spécifié sous « Borner le profil AE ».
- [08-invariants-a-verifier.md](08-invariants-a-verifier.md#séparation-fond--forme) — le golden
  test « octet pour octet », étendu à l'ordre figé des questions, sous « Séparation fond / forme ».
