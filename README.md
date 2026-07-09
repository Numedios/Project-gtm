# Qualif AE — Agent de qualification de leads

Hackathon GTM · Anthropic × FullEnrich × Sillage

**App en ligne : <https://project-gtm-olive.vercel.app/>**

Un AE passe vingt à trente minutes à transformer un lead entrant en dossier exploitable.
Ce projet croise trois sources — CRM, Sillage, FullEnrich — et produit un **dossier
consolidé où chaque champ porte sa provenance** (source, date, confiance). Quand les
sources se contredisent, le système n'invente pas : le conflit devient une **question de
qualification** posée à l'AE.

Le pipeline est déterministe partout, sauf en quatre points où un jugement sémantique est
réellement nécessaire (réconciliation proposeur/vérificateur, mise en prose du score,
personnalisation des questions). Le LLM ne calcule jamais un score : il met en mots une
décomposition déjà calculée par du code pur.

## Stack

- **Next.js 15 / React 19 / TypeScript**, déployé sur Vercel
- **Zod v4** — le schéma canonique du dossier est le cœur du produit
- **Claude** (`@anthropic-ai/sdk`) pour les quatre points d'appel LLM
- **MCP** (`@modelcontextprotocol/sdk`) pour le connecteur Sillage
- **Vitest** pour les tests d'invariants et de fixtures

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

### Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Appels Claude (réconciliation, scoring, questions) |
| `FULLENRICH_API_KEY` | Enrichissement de contact (waterfall) |
| `SILLAGE_API_KEY` | Signaux Sillage via MCP |
| `FULLENRICH_USE_MOCK` / `SILLAGE_USE_MOCK` | Forcer les mocks (sans clé, les mocks sont utilisés) |

Le CRM est mocké, en lecture seule garantie par le type : c'est là que sont fabriqués les
scénarios de conflit.

## Scripts

```bash
npm run dev          # serveur de développement
npm run build        # build de production
npm test             # tests (vitest)
npm run typecheck    # tsc --noEmit
```

## Structure

```
app/            pages Next.js + routes API (qualify, fullenrich, feedback)
components/     UI du dossier consolidé (champs, scores, signaux, questions)
lib/
  schema/       schéma canonique (Zod) — champs estampillés source/date/confiance
  config/       marqueurs stable|volatile, seuils, config ICP
  crm/          connecteur CRM (mock, lecture seule)
  sillage/      connecteur Sillage (MCP)
  fullenrich/   connecteur FullEnrich (waterfall d'enrichissement)
  moteur/       arbitrage déterministe des conflits + scoring
  llm/          les quatre points d'appel Claude
  memoire-ae/   mémoire stylistique de l'AE (schéma fermé, 5 slots)
  pipeline/     orchestration de la qualification + trace rejouable
fixtures/       scénarios de conflit et dossiers de test
tests/          invariants, contrats, fixtures
docs/           axe A (moteur) et axe B (surface produit)
audit/          analyse critique du brief
```

## Documentation

- [`SYNTHESE.md`](SYNTHESE.md) — point d'entrée : où on en est, ce qui est décidé, ce qui bloque
- [`docs/axe-A-moteur.md`](docs/axe-A-moteur.md) — le moteur d'arbitrage et de scoring
- [`docs/axe-B-surface.md`](docs/axe-B-surface.md) — la surface produit
- [`audit/`](audit/README.md) — l'audit du brief et les décisions d'architecture
