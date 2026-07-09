# Brief d'architecture — Agent de qualification pour Account Executive

> **But de ce document.** Il sert de **point de départ** à une conversation dont l'objectif est de
> **générer un prompt destiné à un modèle de génération de code (fable 5)** afin de produire un
> **code de qualité production**. Ce document décrit le *quoi* (fonctionnel + architecture) ; la
> conversation suivante traduira ce *quoi* en prompt de génération de code, puis en implémentation.
>
> Hackathon GTM : **Anthropic × FullEnriched × Sillage**.

---

## 1. Objectif produit

Transformer un simple lead entrant (email / formulaire) en **dossier de qualification prêt à l'emploi**
pour l'Account Executive (AE) : enrichir l'entreprise, cartographier les décisionnaires, détecter les
signaux d'achat, scorer l'adéquation ICP, pré-remplir le questionnaire de qualification, et lister les
questions restantes + next steps.

---

## 2. Stack & contraintes fermes

- **Claude** pour tous les agents.
- **Sillage** = toutes les **données entreprise** (firmographie, compétiteurs), l'**account mapping**
  (organigramme décisionnaires) et les **signaux d'achat**.
- **FullEnriched (FE)** = **uniquement** l'enrichissement de **contacts** (coordonnées des décideurs).
  PAS de données entreprise.
- **CRM = LECTURE SEULE** = historique relationnel (deals passés, niveau entreprise ET niveau décideur).
  Aucune écriture dans le CRM.
- **Mémoire long-terme par AE** = profil de préférence persistant (forme des questions, style, types de lead).
- **Aucun autre outil externe** : pas de web search, pas de LinkedIn.

---

## 3. Vue d'ensemble du flux

```
Entrées (Prospect + formulaire de découverte + config AE : ICP, template)
        │
        ▼
   ORCHESTRATEUR (Lead Agent) ── distribue ───┐
        │                                     │
        ▼         (en parallèle)              │
 ┌──────────────┬───────────────────┬─────────────────┐
 │ Enrichissement│ Cartographie      │ Signaux d'achat │   ← 3 agents de collecte
 │ entreprise    │ décisionnaires    │                 │     (lecture seule, champs estampillés)
 └──────────────┴───────────────────┴─────────────────┘
        │
        ▼
   RÉCONCILIATION & CONFIANCE (checkpoint, aucun appel externe)
        │
        ▼
   SCORING & QUALIFICATION ── branche selon existence du lead dans le CRM
        │
        ├── lead existant → dossier « MISE À JOUR »
        └── nouveau lead  → dossier « NOUVEAU LEAD »
        │
        ▼
   PERSONNALISATION DES QUESTIONS (forme seulement, lit la mémoire AE)
        │
        ▼
   AE (USER)  ──feedback──▶ Mémoire long-terme AE (profil de préférence)
```

Sources de données branchées : **Sillage** → les 3 agents de collecte ; **FullEnriched** → uniquement
Cartographie ; **CRM (lecture)** → Enrichissement (niveau entreprise), Cartographie (niveau personne),
Scoring (contexte).

---

## 4. Composants à construire

1. **Orchestrateur** (lead agent) — planification, distribution, assemblage. Aucun tool métier.
2. **Agent Enrichissement entreprise** — Sillage + CRM (lecture).
3. **Agent Cartographie décisionnaires** — Sillage + FullEnriched + CRM (lecture).
4. **Agent Signaux d'achat** — Sillage (lecture).
5. **Agent Réconciliation & Confiance** — Claude + tools déterministes internes, aucun appel externe.
6. **Agent Scoring & Qualification** — ICP/template/CRM (lecture) + tool de scoring déterministe.
7. **Étape Personnalisation des questions** — Claude + lecture mémoire AE (forme uniquement).
8. **Store Mémoire long-terme par AE** — profil de préférence en texte, persistant.
9. **Tools / connecteurs** — clients Sillage, FullEnriched, CRM (lecture).
10. **Moteur de réconciliation déterministe** — matching d'entités, comparaison de champs, règles d'arbitrage.

---

## 5. Détail des agents (rôle · permissions · I/O)

### Orchestrateur (Lead Agent)
- **Actions** : distribue le travail aux sous-agents, assemble le dossier final. **Aucun tool métier.**

### Agents de collecte — exécution EN PARALLÈLE, lecture seule
> Contrat commun : ils **n'arbitrent pas** les conflits. Chaque champ renvoyé est **estampillé**
> avec sa provenance (source, date de la donnée, confiance). Voir §6.

- **Enrichissement entreprise** — *Sillage (lecture) + CRM (lecture, niveau entreprise)*.
  Rôle CRM : a-t-on déjà travaillé avec cette entreprise, comment ça s'est passé ?
  Sortie : firmographie, secteur, taille, techno, compétiteurs + historique entreprise.
- **Cartographie décisionnaires** — *Sillage (account mapping) + FullEnriched (contacts) + CRM (lecture, niveau personne)*.
  Rôle CRM : a-t-on déjà fait un deal avec l'un de ces décideurs dans une autre entreprise ?
  Sortie : organigramme (rôle, séniorité, relation), coordonnées, historique relationnel par personne.
- **Signaux d'achat** — *Sillage (lecture)*.
  Sortie : signaux datés/sourcés/catégorisés — recrutement, nouveau produit, changement de décisionnaire,
  ex-client dans la boîte, nombre de visites du site.

### Réconciliation & Confiance — SÉQUENTIEL, checkpoint
- **Actions** : Claude + tools déterministes internes. **Aucun appel externe.**
- Séquence : (1) rapproche les entités, (2) compare champ par champ (schéma canonique),
  (3) arbitre par règles ordonnées, (4) émet un enregistrement de conflit par divergence.
- LLM réservé aux jugements : « même personne ? », équivalence sémantique de titres,
  « ce signal contredit-il la firmographie ? ».
- Sortie : jeu de données consolidé + score de confiance par donnée + liste d'enregistrements de conflit.
- Règle produit : **un conflit non résolu devient une question de qualification**.

### Scoring & Qualification — SÉQUENTIEL
- **Actions** : lit ICP/template/CRM (lecture) + **tool de scoring déterministe** + remplit le template.
  **N'écrit jamais dans le CRM.**
- **Branche selon l'existence du lead dans le CRM** (voir §7).
- Sortie : score ICP + justification, score de complétude, template pré-rempli (ou highlight de mise à jour),
  questions sur le fond (identiques pour tous les AE), next steps.

### Personnalisation des questions — fin de flux
- **Actions** : Claude + lecture de la mémoire AE. **Ne modifie jamais le fond** des questions ni la fiche récap.
- Rôle : reformuler la **tournure / le style** des questions selon les préférences de l'AE.

---

## 6. Contrats de données

### Schéma canonique (à compléter avec les champs réels de Sillage / FE / CRM)
- Entreprise : `effectif`, `secteur`, `pays_siege`, `techno`, `competiteurs`, `historique_deals`…
- Personne : `nom`, `titre`, `seniorite`, `coordonnees`, `historique_relationnel`…

### Estampille de provenance (émise par chaque agent de collecte, par champ)
```json
{ "champ": "titre_decideur", "entite": "Marie Durand",
  "valeur": "VP Sales", "source": "sillage",
  "date_donnee": "2026-06-30", "confiance_source": 0.8 }
```

### Enregistrement de conflit (sortie Réconciliation → dossier AE)
```json
{ "champ": "titre_decideur", "entite": "Marie Durand",
  "valeur_retenue": "VP Sales",   "source_retenue": "sillage", "date_retenue": "2026-06-30",
  "valeur_ecartee": "Head of Sales", "source_ecartee": "crm", "date_ecartee": "2024-03-01",
  "regle": "recence", "ecart_jours": 852, "a_signaler_AE": true }
```

### Règles d'arbitrage (déterministes, ordonnées)
1. **Autorité de source par type de donnée** : historique relationnel → **CRM fait foi** (même plus ancien) ;
   firmographie/signaux live → source externe la plus fraîche.
2. **Récence** : à catégorie égale, la `date_donnee` la plus récente gagne.
3. **Tolérance** : écart numérique sous seuil (ex. effectif ±10 %) = pas un conflit.
4. **Pas de date OU écart critique** → pas de résolution auto → flag + question à l'AE.

---

## 7. Branchement de sortie (selon le CRM)

- **Lead déjà présent → dossier « MISE À JOUR »** : highlight des données de qualif périmées / divergentes
  à revérifier + questions ciblées de confirmation. (Alimenté par les enregistrements de conflit CRM vs frais.)
- **Lead absent → dossier « NOUVEAU LEAD »** : données enrichies complètes + questions à poser.

---

## 8. Deux indicateurs distincts (ne pas confondre)

- **Score ICP** = mesure d'**adéquation** au profil client idéal.
- **Score de complétude** = mesure de **couverture de la donnée** (ce qu'on a vs ce qui manque :
  interlocuteur identifié ? de quoi juger l'ICP ? champs du template vides ?). **Ce n'est pas un score ICP.**

---

## 9. Mémoire long-terme par AE

- **Portée** : un profil persistant **par Account Executive**.
- **Implémentation retenue** : **profil de préférence résumé en texte** (léger). *(Alternative non retenue : few-shot avant/après.)*
- **Contenu** : tournure/forme préférée des questions, style/ton, types de lead. Préférence de **forme**, pas de données de lead.
- **Lecture** : uniquement par la Personnalisation. **Écriture** : depuis le feedback de l'AE.
- **Invariant fort** : n'influence **que la forme des questions**. Fond, données, scores et fiche récap
  **identiques** quel que soit l'AE.

---

## 10. Exigences non-fonctionnelles & invariants (à respecter dans le code)

- **Parallélisme** des 3 agents de collecte (gain de latence).
- **Déterminisme** là où il faut : réconciliation (comparaison + arbitrage) et scoring reposent sur du **code**,
  pas sur le jugement du LLM.
- **CRM strictement en lecture** partout.
- **Séparation fond / forme** : le contenu est figé en amont ; la personnalisation n'agit qu'en fin de chaîne,
  sur la forme des questions seulement. Livrable **auditable et comparable** entre AE.
- **Checkpoint de vérification** (réconciliation) pour couper la propagation d'erreurs entre agents.
- **Traçabilité** : chaque donnée porte sa source + date ; chaque conflit est journalisé.
- **Task boundaries explicites** par sous-agent (objectif, format de sortie, sources autorisées, limites).

---

## 11. Décisions techniques à trancher avant de coder
*(à résoudre dans la conversation de génération de prompt)*

- **Langage & runtime** : Python ? TypeScript ?
- **Framework d'orchestration** : Claude Agent SDK ? orchestration maison ? autre ?
- **Appels Sillage / FullEnriched / CRM** : vraies API (specs/clés dispo ?) ou **mocks/fixtures** pour la démo hackathon ?
- **Persistance de la mémoire AE** : fichier / SQLite / KV store ?
- **Format du dossier de sortie** : JSON structuré + rendu (Markdown / HTML) ?
- **Exécution parallèle** : async natif, threads, ou orchestration du framework ?
- **Scope démo vs production** : quel sous-ensemble livrer d'abord (cf. « repli » ci-dessous) ?
- **Tests** : niveau attendu (unitaires sur réconciliation/scoring/branchement au minimum).

---

## 12. Stratégie de repli (si le temps manque)

Monter d'abord un axe de bout en bout (Scoring + 1 agent de collecte), puis dupliquer en 3 agents parallèles.
La Réconciliation peut être fusionnée dans l'agrégation de l'orchestrateur ; la Personnalisation par mémoire AE
est indépendante et peut être ajoutée en dernier.

---

## 13. Objectif de la prochaine étape

À partir de ce brief, **produire un prompt** pour fable 5 qui génère un **code de qualité production**
implémentant l'architecture ci-dessus, en tenant compte des décisions de la §11 et des invariants de la §10.
