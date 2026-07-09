# Synthèse — Agent de qualification AE

Hackathon GTM · Anthropic × FullEnrich × Sillage · état au **2026-07-09**

> Ce document est le point d'entrée. Il dit **où on en est**, **ce qui est décidé**, **ce qui bloque**.
> Il ne remplace ni [`audit/`](audit/README.md) (l'analyse critique du brief) ni les deux documents
> de travail : [`docs/axe-A-moteur.md`](docs/axe-A-moteur.md) et
> [`docs/axe-B-surface.md`](docs/axe-B-surface.md).

---

## La thèse produit, en trois phrases

Un AE passe vingt à trente minutes à transformer un lead entrant en dossier exploitable. On croise
trois sources — CRM, Sillage, FullEnrich — et on produit un dossier consolidé où **chaque champ
porte sa provenance** (source, date, confiance).

Là où les sources se contredisent, on n'invente pas : **un conflit non résolu devient une question
de qualification** posée à l'AE. C'est la meilleure idée du brief, et elle transforme une limite
technique en valeur produit.

Le système est **déterministe partout sauf en quatre points** où un jugement sémantique est
réellement nécessaire. Ces quatre points sont journalisés et rejouables. Le reste se prouve par des
tests.

---

## Où est la difficulté

Elle n'est pas dans l'implémentation. Elle est dans les décisions que le brief avait laissées
ouvertes : le schéma canonique, le marqueur `stable | volatile` par champ, les deux seuils, les
trois formules, les onze fixtures de conflit.

**Ces éléments tiennent dans un fichier de configuration et un fichier de fixtures, et ils portent
toute la valeur du produit.** Le code qui les consomme est mécanique. C'est la conclusion centrale
de l'audit, et elle dicte l'ordre de travail : les fixtures et les tests d'invariants **avant** le
moteur d'arbitrage.

---

## Décisions arrêtées

| Question | Décision | Où c'est développé |
|---|---|---|
| **Runtime** | TypeScript / Next.js, déployé sur Vercel. Révise la décision « Python » prise avant la contrainte Vercel : un moteur Python + une UI TS dupliquerait le schéma canonique en Pydantic **et** en Zod, et ce schéma *est* le produit. | ci-dessous |
| **Collecteurs** | Fonctions déterministes, pas des agents LLM. Le §5 du brief énonce lui-même qu'ils n'arbitrent rien. | [`audit/04`](audit/04-architecture-collecteurs.md) |
| **Multi-agents** | Placé là où le jugement existe : résolution d'entités et arbitrage sémantique, en motif **proposeur / vérificateur** (vérificateur en contexte frais). Deux appels one-shot chaînés, pas une boucle. | [`audit/04`](audit/04-architecture-collecteurs.md) |
| **Arbitrage** | Union des données non conflictuelles ; en cas de conflit, **la récence prime**. La règle 1 du brief est caduque : elle protégeait un ensemble vide. | [`audit/01 §1.1`](audit/01-incoherences-internes.md) |
| **Volatilité** | Chaque champ porte `stable \| volatile`. Une divergence sur un champ volatile est un **changement** (signal), pas une erreur (conflit). | [`audit/02 §2.0`](audit/02-trous-de-specification.md) |
| **Signalement** | `resolution` et `a_signaler_AE` sont **découplés**. Seuils par classe de champ ; `SEUIL_ECART = 0` sur les stables. | [`audit/01 §1.2`](audit/01-incoherences-internes.md) |
| **Mémoire AE** | Schéma **fermé** de cinq slots stylistiques. `types de lead` retiré. **L'ordre des questions est figé** : réordonner, c'est hiérarchiser. | [`audit/01 §1.3`](audit/01-incoherences-internes.md) |
| **CRM** | Mocké, **en lecture seule garantie par le type**. C'est là qu'on fabrique les onze scénarios de conflit. | [`audit/05 §5.3`](audit/05-connecteurs.md) |
| **FullEnrich** | **Waterfall** : vérification de contact + cascade de repli, pas un simple lookup. Corrige le critère sponsor le plus faible. | ci-dessous |

### Pourquoi TypeScript, alors que la mémoire projet disait Python

Parce que la contrainte Vercel est arrivée après. Les deux SDK sont à parité sur ce qui compte :
`client.messages.parse()` existe des deux côtés, avec `zodOutputFormat` là où Python passe un modèle
Pydantic ; le client MCP direct existe aussi en TypeScript. Aucun pilier de la thèse produit ne
dépend du langage — le déterminisme est une propriété du code, les estampilles sont une structure de
données, proposeur/vérificateur ce sont deux appels chaînés.

Le seul coût réel de Python était la **duplication du schéma canonique** à la frontière Python/TS.
On l'évite. On récupère au passage un runtime natif Vercel, sans cold start Python.

---

## Les quatre points d'appel LLM — et nulle part ailleurs

| Étape | Appel | Modèle | Sortie |
|---|---|---|---|
| Réconciliation — **proposeur** | `messages.parse()` | `claude-opus-4-8` | structurée (Zod) |
| Réconciliation — **vérificateur** (contexte frais) | `messages.parse()` | `claude-opus-4-8` | structurée (Zod) |
| Scoring — mise en prose de la décomposition | `messages.parse()` | `claude-opus-4-8` | structurée (Zod) |
| Personnalisation des questions | `messages.create()` | `claude-sonnet-5` | texte, pour un humain |

Le LLM **ne calcule jamais un score**. Il met en mots une décomposition déjà calculée par du code
pur. Si on le laissait produire le chiffre et la justification ensemble, rien ne garantirait qu'ils
concordent — et le §10 exige un livrable auditable.

Ni le **Claude Agent SDK** (c'est Claude Code en librairie, un agent de codage) ni le **Tool Runner**
(qui pilote une boucle agentique) ne sont nécessaires : il n'y a aucune boucle à piloter.

---

## État des connecteurs

| Source | Accès | Statut |
|---|---|---|
| **CRM** | mocké, chez nous | ✅ rien ne bloque |
| **Sillage** | **MCP**, pas REST (`https://api.getsillage.com/api/mcp/v2`) | ✅ **clé valide** ; 35 outils, **JSON typé** (`outputSchema` complet) |
| **FullEnrich** | REST v2, **bulk + polling** | ⚠️ auth non vérifiée ; polling long incompatible Vercel |

### Le risque n°1 — levé le 2026-07-09

Sillage passe par **MCP**, et la crainte était que le serveur renvoie de la **prose** formatée pour
un LLM plutôt que du JSON typé — auquel cas extraire `date_donnee` aurait exigé un appel modèle, et
le non-déterminisme serait rentré par la fenêtre dans un collecteur qu'on a décidé déterministe.

**Vérifié clé en main.** L'`initialize` et `tools/list` répondent en `application/json` (pas de SSE
ni de prose). Les 35 outils exposent un `outputSchema` complet. Et la date que la thèse veut
estampiller existe déjà comme **champ structuré** côté serveur :

- `get_company_mapping` → `request_date`, `status` (`in_progress | complete`), `version`
- `get_lead` / profils → `position_start_date`, géo typée

**Conséquence.** `date_donnee` reste une **métadonnée** lue, jamais une extraction. Le connecteur
Sillage est donc un collecteur **déterministe** comme les autres, et on reste à **quatre appels
LLM**. La règle demeure : `date_donnee` et `confiance_source` viennent de métadonnées, ou n'existent
pas — aucun modèle ne les fabrique.

### FullEnrich et Vercel

Le flux est asynchrone : `POLL_INTERVAL=15`, `MAX_ATTEMPTS=20`, soit **jusqu'à cinq minutes**
d'attente. Ça dépasse la durée maximale d'une fonction serverless. On lance le job, on rend
l'`enrichment_id`, et on fait sonder par le client. À traiter dès l'écriture du connecteur, pas au
moment du déploiement.

---

## Ce qui bloque, ce qui ne bloque pas

**Bloqué — plus rien.** La clé Sillage est régénérée et vérifiée ; le risque n°1 est levé (voir
ci-dessus). Le connecteur Sillage peut viser le vrai serveur, pas seulement un mock.

**Prêt à démarrer, dès maintenant :** le schéma canonique, les ~30 champs et leurs marqueurs, les
champs CRM (c'est nous qui les définissons), les onze fixtures, les trois formules, **tout l'axe A**,
et **tout l'axe B**. Le prochain jalon reste le **contrat partagé** (schéma canonique Zod +
dossier d'exemple), à figer avant que les deux postes divergent.

---

## Les deux axes

Ils se séparent après **une seule chose commune** : `lib/schema/canonical.ts`, figé, plus un
`DossierQualification` d'exemple en JSON. Ensuite ils avancent sans se croiser.

| | [Axe A — le moteur](docs/axe-A-moteur.md) | [Axe B — la surface](docs/axe-B-surface.md) |
|---|---|---|
| Contenu | schéma, fixtures, arbitrage, signalement, scoring, tests | UI Next.js, connecteurs, les 4 appels LLM, pipeline |
| LLM | **aucun** | les quatre points |
| Réseau | **aucun** | Sillage (MCP), FullEnrich (REST), Anthropic |
| Se teste | `vitest run`, sans rien d'autre | contre l'exemple JSON, puis contre mocks |

**Trois points de contact seulement :** le schéma canonique (figé avant la séparation), le pipeline
final qui câble les deux, et la décomposition ICP que l'axe B met en prose et que l'axe A calcule.

---

## Ce qui pèsera sur la note du jury

D'après [`audit_score_solution.md`](audit_score_solution.md) — 50/75 estimé sur le brief seul :

- **Données externes, 13/25** — le point le plus faible et le plus risqué vu la double
  sponsorisation. FullEnrich n'était qu'un lookup de coordonnées. D'où le **waterfall**.
- **Business impact, 17/25** — aucune quantification. Ouvrir la démo sur un chiffre : « un AE passe
  20-30 min à qualifier un lead, on le réduit à 2 min de relecture ».
- **Profondeur IA, 20/25** — le meilleur score. La thèse « déterminisme confiné, LLM là où il juge »
  est exactement ce qu'un jury technique Anthropic valorise. La rendre **visible** dans la démo :
  montrer la trace JSON, montrer un test d'invariant qui passe.

---

## Défauts corrigés en cours de route

- `env` était en **CRLF** : chaque valeur portait un `\r` final qui cassait en-têtes HTTP et URLs,
  silencieusement. Converti en LF.
- `env` contient des **clés en clair** et n'était pas ignoré par git. `.gitignore` ajouté.
- **Douze ancres markdown** cassées dans `audit/` (le slugger GitHub produit trois tirets là où les
  liens en portaient deux, à cause du couple em-dash + emoji dans les titres). Recalculées.
