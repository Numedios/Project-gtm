# Axe B — La surface

**Poste 2.** Next.js sur Vercel, les connecteurs, les quatre appels LLM, le pipeline.

> Ce document est autosuffisant. Contexte général : [`../SYNTHESE.md`](../SYNTHESE.md).
> L'autre axe : [`axe-A-moteur.md`](axe-A-moteur.md).

---

## Tu démarres sans attendre le poste 1

Le contrat est figé avant la séparation : `lib/schema/canonical.ts` **plus un
`DossierQualification` d'exemple en JSON**, complet et valide. Tu construis l'UI contre cet exemple
dès la première minute. Tu ne touches **jamais** à `lib/engine/`.

---

## Ordre de travail

```
B1  UI, contre l'exemple JSON            ← visible tout de suite, demontrable
B2  connecteur Sillage (interface + mock)
B3  connecteur FullEnrich (waterfall)
B4  reconciliation : proposeur / verificateur
B5  mise en prose de la decomposition ICP
B6  personnalisation des questions
B7  pipeline — cable les deux axes, en dernier
```

---

## B1 — L'écran AE

L'écran montre : le dossier consolidé, les **conflits** devenus questions, les **signaux** (« changement
de décisionnaire »), les deux scores avec leur décomposition, et `statut_par_source`.

**La provenance visible par champ (source, date, confiance) *est* l'argument d'auditabilité.** Ce
n'est pas un détail d'affichage : c'est ce qui distingue ce produit d'un enrichisseur de leads
générique. Le montrer à l'écran, c'est montrer la thèse.

`statut_par_source` mérite un mot : si Sillage tombe, l'AE doit lire « Signaux d'achat :
indisponible », pas constater une absence silencieuse. La dégradation propre est un **point fort de
l'architecture**, pas une rustine — la source manquante fait chuter la complétude, et c'est tout.

---

## B2 — Sillage : le risque à lever en premier

`SILLAGE_API_BASE_URL = https://api.getsillage.com/api/mcp/v2` — c'est du **MCP**, pas du REST.

**MCP est un protocole, pas une fonctionnalité LLM.** Il y a deux façons de le consommer, et une
seule est compatible avec la décision « collecteurs déterministes » :

| Voie | Mécanisme | Compatible ? |
|---|---|---|
| **Client MCP direct** (`@modelcontextprotocol/sdk`) | on appelle `listTools()` puis `callTool()` nous-mêmes ; aucun modèle dans la boucle | **oui** |
| Connecteur `mcp_servers` de l'API Messages | les outils transitent par le modèle, qui décide quoi appeler | **non** — réintroduit un agent LLM dans le collecteur |

### Le risque, à vérifier avant d'écrire le connecteur

Beaucoup de serveurs MCP renvoient du **texte en prose**, formaté pour être lu par un LLM, plutôt que
du JSON typé. Si les outils Sillage sont dans ce cas, extraire `effectif`, `secteur` et surtout
`date_donnee` **exigerait un LLM** — et le non-déterminisme rentrerait par la fenêtre dans le
collecteur qu'on vient de décider déterministe.

Pire : `date_donnee` pilote toute la règle d'arbitrage par récence. Les estampilles de provenance,
socle factuel du système, deviendraient elles-mêmes le produit d'une extraction par modèle.

**Vérification :** `listTools()` sur le serveur, et inspecter si les réponses exposent du contenu
structuré et typé ou du texte libre.

**Statut : impossible aujourd'hui.** La clé `SILLAGE_API_KEY` est invalide — `401 Invalid or expired
API key` sur quatre schémas d'authentification (`Authorization: Bearer`, `Authorization:` nu,
`x-api-key`, `X-API-Key`). À régénérer côté dashboard Sillage → Settings → API.

### Arbre de décision

- **REST disponible** et couvrant firmographie + décideurs + signaux → **prendre REST**. Typé,
  versionné, simple.
- **MCP structuré** → **client MCP direct**. Bon.
- **MCP en prose** → problème réel. Soit demander un accès REST à Sillage, soit accepter un LLM
  d'extraction *dans* le collecteur — mais alors le **journaliser et le mettre en cache**, et **ne
  jamais** lui laisser fabriquer `date_donnee` ni `confiance_source`. Ces deux champs proviennent de
  métadonnées, ou n'existent pas.

Dans tous les cas : cacher le transport derrière une interface `SillageClient`, avec un **mock**, pour
que le choix REST/MCP ne contamine pas le reste du code. **Tu travailles contre le mock dès
maintenant.**

---

## B3 — FullEnrich : waterfall, pas lookup

Contrainte ferme : **uniquement l'enrichissement de contacts**, pas de données entreprise.

L'audit de notation place ce critère à **13/25** — le plus faible du barème, et le plus risqué vu la
double sponsorisation. Le brief n'en faisait qu'un lookup de coordonnées, mobilisé dans un seul
collecteur, pendant que Sillage l'était dans quatre endroits. Un jury lira ça comme « FullEnrich est
un plugin annexe ».

**D'où le waterfall.** FullEnrich devient :

1. **vérification** du contact fourni par une autre source ;
2. **cascade de repli** quand Sillage n'a pas la coordonnée.

Le bénéfice est aussi architectural : deux sources qui donnent la même coordonnée, ce n'est pas un
doublon — c'est une **corroboration**, qui fait monter la confiance dans le moteur. Le waterfall
s'intègre nativement dans la réconciliation au lieu de s'y greffer.

**À vérifier avant de spécifier l'arbitrage :** les coordonnées renvoyées portent-elles une
métadonnée de fraîcheur ? S'il n'y a pas de `date_donnee`, la règle de récence est **inapplicable aux
coordonnées**, et la règle « pas de date → question à l'AE » s'appliquera systématiquement. Il faut
le savoir maintenant, pas au moment où chaque contact génère une question.

### La contrainte Vercel

`POLL_INTERVAL=15`, `MAX_ATTEMPTS=20` — soit **jusqu'à cinq minutes** d'attente. Ça dépasse la durée
maximale d'une fonction serverless.

On ne bloque pas dans la fonction. On lance le job, on rend l'`enrichment_id`, et le client sonde.
À traiter dès l'écriture du connecteur, pas au moment du déploiement.

---

## B4 — Réconciliation : proposeur / vérificateur

C'est le point dur du système, et **le seul endroit où le multi-agents se justifie**.

**Deux étages :**

1. **Blocage déterministe** sur clé normalisée : email normalisé en priorité, puis
   `nom + domaine entreprise`. Résout l'écrasante majorité des cas, sans LLM, donc reproductible.
2. **Départage LLM** sur l'ensemble **borné** de paires ambiguës que l'étage 1 n'a pas su trancher.
   *« Marie Durand chez Acme et M. Durand chez Acme Corp sont-elles la même personne ? »*

Le motif, en deux temps :

- le **proposeur** examine les paires ambiguës et propose une décision assortie de sa justification ;
- le **vérificateur** s'exécute dans un **contexte frais**, reçoit la proposition et les estampilles
  de provenance, puis la conteste ou la valide.

Un vérificateur en contexte séparé attrape des erreurs qu'une auto-critique, prisonnière de son
propre raisonnement, ne voit pas.

**Ce n'est pas une boucle agentique.** Deux appels one-shot chaînés. Aucun des deux ne planifie, ne
choisit ses outils, ni ne décide de se relancer. Donc : SDK Anthropic standard, pas de Tool Runner,
pas de Claude Agent SDK.

```ts
const res = await client.messages.parse({
  model: 'claude-opus-4-8',
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  output_config: { format: zodOutputFormat(PropositionSchema) },
  messages: [...],
});
```

**Chaque décision est journalisée avec son entrée exacte** — donc rejouable et cacheable. Le chemin
de code reste déterministe : à entrée identique, sortie identique. Ce qui est probabiliste est isolé,
tracé, et se rejoue à l'identique une fois la décision figée.

**Même motif pour l'équivalence de titres** (« VP Sales » ≡ « Head of Sales ») : **table de synonymes
d'abord**, proposeur/vérificateur seulement en repli. On ne convoque le jugement qu'une fois le
déterminisme épuisé.

### Sécurité — deux vecteurs d'injection restent ouverts ici

Les **notes CRM** et les **signaux Sillage** sont du texte libre rédigé par des tiers, et ils entrent
dans ce prompt. Les **délimiter** explicitement, et instruire le modèle de ne jamais traiter leur
contenu comme des instructions. C'est une atténuation, pas une garantie.

(Le troisième vecteur, le feedback AE persisté, est neutralisé par construction — voir B6.)

---

## B5 — Mise en prose de la décomposition ICP

`messages.parse()`, `claude-opus-4-8`.

Le poste 1 calcule le score **et sa décomposition par critère**. Ton appel **met la décomposition en
prose**. Il ne calcule ni n'ajuste **jamais** le chiffre.

Si on laissait le modèle produire le score et la justification ensemble, rien ne garantirait que les
deux concordent — et l'exigence d'un livrable auditable tomberait.

---

## B6 — Personnalisation : la forme, jamais le fond

`messages.create()`, `claude-sonnet-5`. Seul point du système qui produit du texte destiné à un
humain.

Le profil AE est un **schéma fermé** de slots strictement stylistiques, à énumération bornée :

```
registre        : formel | familier
longueur        : courte | moyenne | détaillée
tournure        : directe | indirecte
tutoiement      : oui | non
densite_jargon  : faible | moyenne | élevée
```

Aucun autre champ n'est admis. `types de lead` en est explicitement **retiré** : c'est un signal de
fond, pas de style. **Aucun texte libre ne transite du feedback vers le prompt** — le feedback de
l'AE est *interprété* pour sélectionner une valeur d'énumération, jamais recopié.

C'est ce qui **neutralise par construction** le vecteur d'injection le plus grave : le feedback AE
était persisté puis rejoué à chaque exécution suivante, donc une injection écrite une fois se serait
répétée indéfiniment. Un ensemble de slots bornés ne peut structurellement pas la porter.

**L'ordre des questions est figé en amont.** Réordonner, c'est hiérarchiser, donc influencer le fond
perçu par l'AE. La personnalisation reçoit une **liste ordonnée** et n'a qu'un seul degré de liberté :
réécrire le **texte** de chaque item.

| Elle peut | Elle ne peut jamais |
|---|---|
| réécrire la formulation d'une question | réordonner les questions |
| ajuster registre, longueur, tournure, tutoiement, jargon | ajouter ou supprimer une question |

**PII :** FullEnrich renvoie des coordonnées de décideurs. Ne pas les journaliser, et ne pas les faire
transiter dans ce prompt — elles n'y servent à rien.

---

## B7 — Le pipeline

`app/api/qualify/route.ts`. C'est une fonction `async` de quelques dizaines de lignes.

Le flux est un **DAG statique** : il n'y a rien à planifier, donc rien à confier à un agent
orchestrateur. Un agent LLM sans tool et sans décision serait décoratif. Le parallélisme des trois
collecteurs, c'est `Promise.all`.

```
Promise.all([ sillage, fullenrich, crm ])
        ↓
réconciliation (B4)   ← checkpoint : coupe la propagation d'erreurs entre sources
        ↓
arbitrage + signalement (poste 1)
        ↓
scoring (poste 1) → mise en prose (B5)
        ↓
branchement NOUVEAU_LEAD / MISE_À_JOUR
        ↓
questions de qualification → personnalisation (B6)
```

Le **branchement** repose sur un lookup déterministe explicite : `findAccount(domaine) ?? findContact(email)`.
Cas ambigu — plusieurs comptes matchent — → traiter comme **nouveau lead** *et* émettre un conflit
signalé. La règle produit « conflit → question » absorbe le cas limite gratuitement ; c'est bon signe.

**Émettre une trace JSON par run** : chaque appel outil, chaque décision d'arbitrage, chaque départage
LLM. C'est le livrable qui matérialise la traçabilité — et ce qu'on montre au jury.

---

## Stratégie de repli, si le temps manque

Ordre de coupe, du plus sacrifiable au moins :

1. la personnalisation (B6) — indépendante, ajoutable en fin de parcours ;
2. le troisième collecteur (signaux d'achat) — le plus autonome ; sa disparition dégrade la
   complétude et rien d'autre ;
3. le deuxième collecteur ;
4. **jamais** : réconciliation, arbitrage, scoring, branchement CRM.

**Ne jamais fusionner la réconciliation dans l'agrégation.** C'est le seul endroit où les trois
sources se rencontrent, c'est là que vit la règle « conflit → question », et c'est ce qui rend le
dossier auditable. La supprimer laisse un enrichisseur de leads générique — exactement le produit que
n'importe quel concurrent livre déjà.

Le squelette minimal viable — **une source externe + le CRM mocké** — démontre déjà toute la thèse.
