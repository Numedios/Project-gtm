# 01 — Incohérences internes du brief

**Sévérité : bloquant.** Ces trois points ne sont pas des détails d'implémentation. Tant qu'ils ne
sont pas tranchés, le moteur d'arbitrage n'est pas spécifiable et l'invariant fond/forme n'est pas
tenable.

---

## 1.1 L'exemple du §6 contredit la règle d'arbitrage n°1

Le brief énonce deux choses incompatibles :

- **Règle 1** (§6) : *« Autorité de source par type de donnée : historique relationnel → CRM fait
  foi (même plus ancien) ; firmographie/signaux live → source externe la plus fraîche. »*
- **Exemple d'enregistrement de conflit** (§6) : `titre_decideur` est arbitré par **récence**,
  Sillage (2026-06-30) l'emporte sur le CRM (2024-03-01).

Le titre d'un décideur relève-t-il de la firmographie ou de l'historique relationnel ? Le brief ne
tranche pas. Les deux règles s'appliquent donc simultanément et donnent des résultats opposés.

### Suggestion

Produire une table exhaustive `champ canonique → classe d'autorité`, où **chaque** champ du schéma
du §6 appartient à **exactement une** classe. Sans elle, le moteur d'arbitrage n'est pas
implémentable — un modèle de génération de code inventera une réponse, silencieusement.

C'est un artefact de **configuration**, pas de code. Il doit être relu par un humain métier, parce
que le classement de `titre_decideur` est une décision produit (fait-on davantage confiance à la
fraîcheur d'une source externe, ou à la connaissance relationnelle interne ?), pas technique.

---

## 1.2 `a_signaler_AE` n'a pas de règle de déclenchement

Dans le même exemple du §6, le conflit est **résolu automatiquement** (`regle: "recence"`) et
pourtant `a_signaler_AE: true`.

Or la **règle 4** dit : *« Pas de date OU écart critique → pas de résolution auto → flag + question
à l'AE. »* Elle ne flagge donc que les conflits **non** résolus automatiquement. L'exemple viole la
règle qu'il est censé illustrer.

La condition réelle est probablement `ecart_jours > seuil` (852 jours dans l'exemple), mais ce
n'est écrit nulle part.

### Suggestion

Décorréler explicitement deux notions distinctes dans l'enregistrement de conflit :

- `resolution: "auto" | "manuelle"` — a-t-on pu appliquer une règle d'arbitrage ?
- `a_signaler_AE: bool` — l'AE doit-il vérifier **malgré** la résolution ?

et écrire la condition du second (vraisemblablement `ecart_jours > seuil` ou
`confiance_retenue < seuil`).

Sans cette règle, **le volume de questions générées est imprévisible** : c'est un risque produit
direct, pas seulement une imprécision de spec. Un AE qui reçoit trente questions de confirmation
n'utilisera pas l'outil.

---

## 1.3 La mémoire AE peut faire fuiter du fond dans la forme

Le §9 pose comme **invariant fort** :

> *« N'influence que la forme des questions. Fond, données, scores et fiche récap identiques quel
> que soit l'AE. »*

Puis, trois lignes plus haut, il liste le contenu de cette mémoire :

> *« Tournure/forme préférée des questions, style/ton, **types de lead**. »*

Le **type de lead est un signal de fond**, pas de style. L'invariant et le contenu de la mémoire
sont incompatibles.

### Suggestion

Retirer `types de lead` du contenu de la mémoire, et restreindre le schéma du profil à des slots
**strictement stylistiques** : registre, longueur, tournure directe/indirecte, tutoiement, densité
de jargon.

Noter que même l'**ordre** des questions est discutable : réordonner, c'est hiérarchiser, donc
influencer le fond perçu par l'AE. Si l'on veut tenir l'invariant au sens fort, l'ordre est figé en
amont lui aussi.

### Le test qui protège l'invariant

À écrire **avant** la première ligne de personnalisation :

> Même lead + deux profils AE différents ⇒ la partie non personnalisée du dossier (données
> consolidées, scores, fiche récap, **contenu** des questions) doit être **identique octet pour
> octet**.

C'est un golden test, pas un test d'intégration. Il rend le §10 (« livrable auditable et comparable
entre AE ») exécutable au lieu d'être une intention.
