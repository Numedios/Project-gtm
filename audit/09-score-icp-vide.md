# 09 — Pourquoi le score ICP ne se remplit pas

Audit réalisé le **2026-07-09** sur le code (`lib/moteur/scoring.ts` et sa chaîne
d'alimentation), à la suite du constat « le score ICP reste bas / vide ».

## Verdict en une phrase

Le calcul du score (`lib/moteur/scoring.ts`) est correct ; le problème est **en amont** :
deux des quatre critères — et ce sont les deux plus lourds (poids 3 + 3 sur 10, soit
**60 % du poids total**) — ne reçoivent jamais de valeur exploitable, donc lisent 0
systématiquement, même pour un lead parfait.

---

## Démonstration chiffrée (données mock par défaut)

Sans clé API, `getSillageClient()` renvoie le mock (`lib/sillage/index.ts`). Le lead idéal
du mock — SaaS français, 220 salariés, « VP Sales » — devrait scorer ~100. En réalité :

| Critère | Poids | Valeur reçue par le scoring | Score |
|---|---|---|---|
| secteur | 3 | `'SaaS B2B'` ≠ `'saas'` | **0** |
| effectif | 2 | 220 ∈ [50–500] | 1 |
| geographie | 2 | `France` ∈ cibles | 1 |
| seniorite | 3 | `undefined` (jamais alimenté) | **0** |

`(3×0 + 2×1 + 2×1 + 3×0) / 10 × 100 =` **40/100** au lieu de ~100.

---

## Cause n°1 — `seniorite` n'est alimentée par *aucun* collecteur (poids 3/10)

- Le champ existe (`lib/config/champs.ts:99`) et est lu par le scoring
  (`lib/moteur/consolidation.ts:177` → `lib/moteur/scoring.ts:208`).
- Mais `grep seniorite lib/` ne renvoie **que** la ligne de lecture `consolidation.ts:177`.
  **Aucun normaliseur ne l'écrit** :
  - `normaliserProfilMapping` (`lib/sillage/normalize.ts:79`) capture bien
    `titre = 'VP Sales'`… mais jamais `seniorite`.
  - `normaliserDecideur` (`lib/sillage/normalize.ts:70`) le dit explicitement :
    « Pas de champ séniorité structuré côté Sillage… on ne l'invente pas ».
  - Les normaliseurs FullEnrich (`reverse.ts`, `waterfall.ts`) ne l'écrivent pas non plus.
- **Conséquence** : `valeursRetenues.seniorite === undefined` → critère `seniorite` = 0
  **systématiquement**. À lui seul, il plafonne l'ICP à 70/100, même pour un décideur idéal.

## Cause n°2 — `secteur` compare du texte libre Sillage à une taxonomie exacte (poids 3/10)

- `lib/moteur/scoring.ts:150` : `icp.secteurs_cibles.includes(normaliser(v))` — égalité stricte
  contre `['saas', 'fintech', 'martech']` (`lib/config/icp.ts:28`).
- Or Sillage renvoie du **texte libre** (`industries: string`) : le mock donne `'SaaS B2B'`
  → `normaliser` → `'saas b2b'`, qui n'est **pas égal** à `'saas'` → 0. La 2ᵉ société mock
  (`'Intelligence artificielle'`) → 0 également.
- Le code **assume une étape de normalisation qui n'a jamais été implémentée** :
  `scoring.ts:146` dit « taxonomie normalisée en amont, B4 » et `lib/moteur/arbitrage.ts:23`
  la liste comme « prérequis en amont ». Pourtant `lib/sillage/normalize.ts:48` passe
  `company.industries` **brut**, sans mapping de taxonomie.

## Effet combiné

Les deux critères les plus lourds (secteur + séniorité = 60 % du poids) tombent à 0 pour
**tout lead NOUVEAU_LEAD sourcé via Sillage**. Seuls effectif et géographie remontent, d'où
un score plafonné autour de 40 même pour un ICP parfait.

> Asymétrie à noter : un lead en **MISE_A_JOUR** rattaché au compte CRM mock récupère
> `secteur: 'saas'` déjà normalisé (`lib/crm/mock.ts:124`). L'incohérence ne se voit donc
> que sur les nouveaux leads — ce qui la rend d'autant plus facile à manquer.

## Pourquoi les tests restent verts

`tests/scoring.test.ts:66-69` injecte directement des observations **déjà normalisées**
(`secteur: 'saas'`, `seniorite: 'vp'`) et obtient bien 100. Les tests court-circuitent les
collecteurs : ils valident la **formule**, jamais la **chaîne d'alimentation réelle**, ce qui
masque exactement ce trou d'intégration.

---

## Corrections recommandées (par ordre d'impact)

1. **Dériver `seniorite` depuis `titre`** dans `normaliserProfilMapping` (et le normaliseur
   FullEnrich) : un mapping déterministe de mots-clés
   (`vp | head | director | manager | c-level | cxo | chief`) suffit pour la démo ; sinon un
   petit jugement LLM. Sans ça, 30 % du score est perdu d'office.
2. **Normaliser `secteur`** — trois options, de la plus propre à la plus rapide :
   - implémenter l'étape « B4 » manquante (map industries Sillage → taxonomie cible dans
     `lib/sillage/normalize.ts`) ; **ou**
   - rendre le matching tolérant dans `scoring.ts:150` :
     `icp.secteurs_cibles.some((c) => normaliser(v).includes(c))` ; **ou**
   - recalibrer `secteurs_cibles` sur les libellés réels renvoyés par Sillage.
3. **Ajouter un test d'intégration** qui passe par `consoliderDossier` / `qualifierLead` avec
   les clients mock et vérifie `score_icp.score > 0` (et la décomposition attendue) pour le lead
   idéal — pour que le trou ne puisse pas revenir silencieusement.
