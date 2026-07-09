# 10 — Audit de toutes les références au mock dans le produit

Audit réalisé le **2026-07-09** sur l'ensemble du code (`lib/`, `components/`, `app/`).
Objet : recenser chaque endroit où un **mock** intervient, comment il est activé, et surtout
**s'il peut être servi à la place de données réelles sans que personne ne le sache**.

## Verdict en une phrase

Trois sources de données sur trois ont un mock, ce qui est sain pour la démo — mais **deux
d'entre elles basculent silencieusement sur le mock quand la clé API manque**, aucune trace
n'est remontée à l'exécution, et **rien dans l'API ni dans l'UI n'indique à l'utilisateur qu'il
regarde des données fabriquées**.

---

## 1. Inventaire des mocks (code produit)

| Source | Mock | Activation | Repli si clé absente |
|---|---|---|---|
| **Sillage** | `SillageMockClient` (`lib/sillage/mock-client.ts`) | `lib/sillage/index.ts:17` | **silencieux → mock** |
| **FullEnrich** | `FullEnrichMockClient` (`lib/fullenrich/mock-client.ts`) | `lib/fullenrich/index.ts:20` | **silencieux → mock** |
| **CRM** | `MockCrm` / `CRM_MOCK` (`lib/crm/mock.ts`) | `lib/pipeline/qualifier.ts:258` | **toujours mock** (aucune implémentation réelle) |
| Mémoire AE | `StoreProfilAEMemoire` (`lib/memoire-ae/store.ts`) | toujours en mémoire | non persistée (voir §4) |

### Sillage — `lib/sillage/index.ts:17`
```ts
const useMock = process.env.SILLAGE_USE_MOCK === 'true' || !process.env.SILLAGE_API_KEY;
instance = useMock ? new SillageMockClient() : new SillageMcpClient();
```
Le mock ne répond que pour le domaine `acme-corp.example` et renvoie `null` ailleurs
(`mock-client.ts:156`) — comportement réaliste, il ne fabrique pas de données pour un domaine
arbitraire. C'est un bon mock ; le problème n'est pas sa qualité, c'est sa **sélection
silencieuse**.

### FullEnrich — `lib/fullenrich/index.ts:20`
Même logique de repli. Le mock est *stateful* (retient les lots lancés) et vit sur `globalThis`
pour survivre au découpage par route de Next.js (`index.ts:11-14`) — détail correct. Il génère
ses `enrichment_id` via `Math.random()` (`mock-client.ts:17,49`).

### CRM — `lib/crm/mock.ts` + `lib/pipeline/qualifier.ts:258`
Le CRM est **toujours** mocké : `CRM_MOCK` est importé et passé en dur à `consoliderDossier`,
sans aucun toggle ni client réel. C'est **assumé par le brief** (« CRM mocké ») et bien fait :
lecture seule garantie par le type `CrmLectureSeule`, données gelées par `Object.freeze` profond
(`mock.ts:66-72`). Seule remarque : aucun chemin vers un vrai CRM n'existe, donc toute démo « mise
à jour d'un lead connu » repose sur le jeu de données figé de `mock.ts:115`.

---

## 2. Le risque central — asymétrie du repli silencieux

Les connecteurs ne traitent pas l'absence de clé de la même façon :

| Connecteur | Clé manquante | Fichier |
|---|---|---|
| **Anthropic** | **lève une exception** (`throw`) | `lib/llm/anthropic.ts:11` |
| **Sillage** | **repli silencieux sur mock** | `lib/sillage/index.ts:17` |
| **FullEnrich** | **repli silencieux sur mock** | `lib/fullenrich/index.ts:20` |

Conséquence sur un déploiement (Vercel) où les clés Sillage / FullEnrich ne seraient **pas
configurées, ou mal orthographiées** : le produit sert des **données mock comme si elles étaient
réelles**, sans erreur, sans log, sans avertissement — alors que l'étape LLM, elle, planterait.
Le pire scénario pour une démo de hackathon : croire présenter des données Sillage réelles et
montrer en fait `acme-corp.example`.

---

## 3. Aucun signal de mode nulle part

- **API** : aucune des routes (`app/api/qualify`, `app/api/feedback`, `app/api/fullenrich/status`)
  n'expose le mode actif. `grep -i mock app/` ne renvoie **rien**.
- **`statut_sources`** : le dossier porte un statut par source (`ok | indisponible`), mais un mock
  qui répond est marqué `ok`. Il n'existe **aucune distinction entre « ok réel » et « ok mock »**.
- **UI** (`components/QualifierLead.tsx`) : aucun badge de mode. Les seules mentions de « mock »
  (lignes 47-51) sont des **libellés statiques** collés aux emails d'exemple
  (« scénario riche (mock Sillage) »), pas un reflet de l'état d'exécution.

Autrement dit : même si le repli mock est déclenché, l'AE n'a aucun moyen de le savoir.

---

## 4. Mémoire AE — un stub non étiqueté « mock »

`lib/memoire-ae/store.ts` n'expose que `StoreProfilAEMemoire` (en mémoire, sur `globalThis`).
Il n'y a **ni backend persistant ni toggle** : le profil AE est perdu au moindre redémarrage /
recyclage d'instance serverless. Ce n'est pas nommé « mock », mais c'est fonctionnellement un
**stub** de la « mémoire long-terme par AE » promise (brief §9). Le commentaire `store.ts:40`
renvoie d'ailleurs lui-même au « même piège que le mock FullEnrich ». À traiter comme un mock
implicite : soit persister, soit l'afficher clairement comme éphémère.

---

## 5. Références au mock hors produit (légitimes)

Tests et fixtures — attendu, aucune action :
`tests/fixtures-dossiers.test.ts`, `tests/scoring.test.ts`, `tests/invariants.test.ts`,
`tests/signaux-sans-mapping.test.ts`, `fixtures/dossiers.ts`.
Documentation / audit — `SYNTHESE.md`, `docs/axe-A-moteur.md`, `docs/axe-B-surface.md`,
`brief-architecture-qualif-ae.md`, `audit/05-connecteurs.md`, `audit/06`, `audit/07`, `audit/08`.

---

## 6. Recommandations (par ordre d'impact)

1. **Échouer bruyamment en production.** Quand `NODE_ENV === 'production'`, si la clé est absente
   *et* que `*_USE_MOCK` n'est pas explicitement à `true`, **lever une exception** au lieu de
   basculer sur le mock — comme le fait déjà Anthropic (`anthropic.ts:11`). Le mock doit être un
   **opt-in explicite**, jamais un défaut par omission.
2. **Exposer le mode.** Ajouter un champ `mode` / `sources_mode` (`reel | mock`) à la réponse de
   `/api/qualify`, et un **badge visible** dans l'UI (« Données de démonstration »). Distinguer
   `ok` réel de `ok` mock dans `statut_sources`.
3. **Logguer au démarrage** quel client chaque connecteur a résolu (réel vs mock) — une ligne par
   connecteur suffit à rendre le repli audible.
4. **Trancher la mémoire AE** : persister le store, ou l'étiqueter explicitement comme éphémère
   pour ne pas faire une promesse (§9) que le déploiement annule silencieusement.
