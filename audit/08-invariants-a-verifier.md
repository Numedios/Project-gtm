# 08 — Invariants à vérifier

Le brief annonce six propriétés au §10. Aucune n'est vérifiable en l'état : ce sont des intentions.
Ce fichier les traduit en propriétés **testables**, qui doivent guider la structure du code plutôt
que d'être constatées après coup.

---

## Séparation fond / forme

> Même lead, deux profils AE différents ⇒ la partie non personnalisée du dossier (données
> consolidées, scores, fiche récap, **contenu** des questions **et leur ordre**) est identique
> **octet pour octet**. Seule la **formulation** de chaque question diffère.

Golden test, pas test d'intégration. À écrire **avant** la première ligne de personnalisation.
C'est ce qui rend concrète l'exigence « livrable auditable et comparable entre AE ».

L'**ordre** des questions est dans le périmètre du golden test, pas seulement leur contenu :
réordonner, c'est hiérarchiser, donc influencer le fond perçu. La liste ordonnée est figée en amont
(décision [01 §1.3](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme---résolue),
2026-07-09) ; la personnalisation la reçoit et ne peut que **réécrire le texte** de chaque item.

Deux invariants nouvellement testables en découlent.

**(a) Le profil AE est un schéma fermé.** Il ne contient **aucun** champ hors des cinq slots
stylistiques :

```
{ registre, longueur, tournure, tutoiement, densite_jargon }   -- ensemble exact des clés admises
```

Test : tout champ inconnu dans le profil chargé (à commencer par `types de lead`, retiré le
2026-07-09) doit **lever**, pas être ignoré silencieusement. Chaque slot ne prend qu'une valeur de
son énumération bornée ; une valeur hors domaine lève également. C'est ce qui neutralise par
construction le vecteur d'injection n°1
([03](03-securite-injection-prompt.md#borner-le-profil-ae--décision-arrêtée-le-2026-07-09)).

**(b) La personnalisation est une bijection sur la liste de questions.** Elle réécrit, elle ne
réordonne, n'ajoute ni ne supprime rien :

```
len(questions_out) == len(questions_in)                     -- même cardinalité
[q.id for q in questions_out] == [q.id for q in questions_in]  -- même ordre, mêmes items
```

Seul le champ **texte** de chaque item change entre l'entrée et la sortie. Test : sur une liste
d'entrée donnée, la sortie a la même cardinalité et la même séquence d'identifiants ; toute
divergence d'ordre, tout item ajouté ou retiré, lève.

Voir [01 §1.3](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme---résolue).

---

## CRM strictement en lecture

Vérifié **structurellement**, pas par un prompt ni par une revue : le client CRM n'expose
physiquement aucune méthode d'écriture.

Test : aucun verbe HTTP autre que `GET` n'est atteignable depuis le client. Le CRM étant mocké,
l'invariant est garanti par le type.

---

## Déterminisme de l'arbitrage

> Mêmes entrées estampillées ⇒ mêmes valeurs retenues, mêmes conflits, mêmes signaux.

L'arbitrage repose sur **une seule règle — la récence** — et sur le marqueur `stable | volatile`
de chaque champ (voir [01 §1.1](01-incoherences-internes.md#11-lexemple-du-6-contredit-la-règle-darbitrage-n1---résolue)).
Tests unitaires **table-driven** sur la table de décision, incluant les cas limites :

- **champ volatile divergent** ⇒ signal « changement détecté », **aucun** conflit, **aucune**
  question. C'est le test qui protège l'AE du déluge de questions de confirmation ;
- **champ stable divergent** ⇒ conflit, question à l'AE ;
- **date manquante** sur une source ⇒ conflit, question (règle 4) ;
- **écart numérique sous le seuil de tolérance** ⇒ ni conflit ni signal (règle 3) ;
- **deux sources également fraîches** ⇒ départage par `confiance_source` ; conflit si les
  confiances sont égales. Sans cette règle, l'arbitrage n'est pas déterministe ;
- **deux sources, même valeur** ⇒ corroboration, confiance rehaussée, aucun conflit ;
- **champ absent de toutes les sources** ⇒ pas un conflit, mais la complétude chute.

### Le signalement ne contredit jamais la résolution

Invariant à faire **lever en test** :

```
resolution == "impossible"  &&  a_signaler_AE == false     -- ne doit jamais se produire
```

Un conflit qu'on n'a pas su trancher est toujours signalé. C'est la quatrième ligne du tableau
`resolution × a_signaler_AE`
([01 §1.2](01-incoherences-internes.md#12-a_signaler_ae-na-pas-de-règle-de-déclenchement---résolue)).

Les trois autres lignes sont des cas de test nominaux :

- `auto` + non signalé ⇒ valeur retenue en silence, **aucun** conflit émis ;
- `auto` + signalé ⇒ conflit, question de **confirmation** (une valeur est proposée) ;
- `impossible` + signalé ⇒ conflit, question **ouverte** (aucune valeur proposée).

Les seuils `SEUIL_AGE` et `SEUIL_ECART` doivent être **injectés** dans le moteur, pas codés en dur :
les fixtures n°2 et n°3 ne se distinguent que par leur valeur.

---

### L'union n'écrase pas

Invariant structurel, à tester séparément : le jeu de données consolidé **conserve toutes les
observations estampillées** (source, valeur, date, confiance). La valeur retenue est *dérivée*, pas
substituée. Test : après réconciliation, chaque observation d'entrée est encore retrouvable dans la
sortie, avec sa provenance intacte.

C'est ce qui rend la traçabilité du §10 possible, et ce qui permet à la corroboration de remonter
dans le calcul de confiance.

Les onze fixtures CRM ([05 §5.3](05-connecteurs.md#53-le-crm-mocké-est-une-opportunité-de-design-pas-une-corvée))
sont conçues pour couvrir exactement ces cas.

---

## Déterminisme du scoring

Le tool renvoie `(score, décomposition par critère)`. Le LLM **ne voit jamais le chiffre avant de
le justifier** — il met en prose une décomposition déjà calculée.

Test : pour un même dossier consolidé, le score est stable sur N exécutions ; seule la formulation
de la justification varie.

---

## Déterminisme du départage LLM

La résolution d'entités confie ses cas résiduels à un motif **proposeur / vérificateur** (deux
appels one-shot chaînés, voir
[02 §2.2](02-trous-de-specification.md#22-la-résolution-dentités-est-le-point-dur-et-nest-pas-spécifiée)
et [04](04-architecture-collecteurs.md)). Ce motif introduit le seul aléa probabiliste du système
là où le déterminisme est épuisé ; ces invariants sont ce qui le maintient auditable et rejouable.

**Chaque décision est journalisée avec son entrée exacte.** Proposition comme vérification. Test :
pour chaque paire ambiguë, la trace d'exécution contient l'entrée sérialisée, la proposition du
proposeur, et le verdict du vérificateur. Rien qui ne soit consigné ne peut être rejoué.

**Rejouabilité.** Rejouer la trace produit **exactement** les mêmes rapprochements d'entités, sans
appeler le LLM : le cache doit être consulté. Test : sur une trace enregistrée, un second passage
ne déclenche aucun appel réseau et retrouve les mêmes décisions.

**Le LLM n'est jamais sur le chemin nominal.** Test sur un jeu de fixtures où toutes les entités se
rapprochent par clé normalisée ⇒ **zéro appel LLM**. C'est le test qui protège le budget et la
latence : il échoue à la moindre régression qui ferait fuir un cas trivial vers le départage.

**Le vérificateur s'exécute en contexte frais.** Test structurel : il ne reçoit **jamais**
l'historique de conversation du proposeur, seulement la proposition et les estampilles de
provenance. C'est cette séparation qui lui permet d'attraper ce qu'une auto-critique manquerait.

**Un désaccord n'est jamais tranché en silence.** Lorsque le vérificateur conteste la proposition,
le système ne choisit pas discrètement un camp : il produit un **conflit non résolu**, donc une
**question de qualification** posée à l'AE. C'est la règle produit du brief — « un conflit non
résolu devient une question » — appliquée au départage lui-même. Test : une fixture de désaccord
proposeur / vérificateur doit lever une question, jamais un rapprochement silencieux.

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
