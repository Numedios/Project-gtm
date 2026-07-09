# Audit — Brief d'architecture « Agent de qualification AE »
### Hackathon GTM : Anthropic × FullEnriched × Sillage

> Note préalable : ce document est un **brief d'architecture technique**, pas encore un pitch. Il est audité comme socle de la solution — donc en jugeant la solution qu'il décrit, pas sa mise en forme (critère « présentation » exclu de cet audit à la demande de l'auteur).

Barème : 3 critères × 25 points = **75 points au total**.

---

## 1. Business impact / pertinence du problème — **17/25**

**Points forts**
- Le problème est réel et bien identifié : transformer un lead brut en dossier exploitable est une vraie perte de temps pour un AE.
- La distinction **score ICP vs score de complétude** (§8 du brief) est une vraie trouvaille produit — beaucoup de solutions confondent les deux, et ça montre une compréhension fine du métier de qualification.
- Le branchement « nouveau lead » vs « mise à jour » (§7) colle à un cas d'usage réel (un AE ne traite pas un lead existant comme un prospect vierge).

**Points faibles**
- **Aucune quantification** : pas de « X minutes économisées par lead », pas d'estimation du volume de leads/mois, pas de comparaison avant/après. Pour un jury GTM, c'est le premier réflexe attendu.
- La mémoire long-terme par AE (§9) est un raffinement UX élégant, mais **mobilise beaucoup d'architecture (store persistant, invariant fond/forme) pour un gain business marginal** — à un jury pressé, ça peut lire comme du temps investi ailleurs que sur la valeur cœur.
- Pas de récit d'usage concret (persona AE, exemple de lead réel bout en bout) qui rendrait le problème palpable.

**Recommandation** : ouvrir la présentation par un cas concret chiffré (« un AE passe 20-30 min à qualifier un lead entrant, on le réduit à 2 min de relecture »), et documenter en une phrase pourquoi la personnalisation mémoire est un différenciateur et pas un gadget.

---

## 2. Profondeur d'usage IA & workflow, Anthropic — **20/25**

**Points forts**
- Architecture multi-agents bien pensée : orchestrateur sans tool métier, 3 agents de collecte **en parallèle**, checkpoint de réconciliation, puis scoring séquentiel — c'est un vrai design agentique, pas un simple chaînage de prompts.
- La séparation **déterministe vs jugement LLM** est le meilleur élément du document : réconciliation par règles ordonnées + code pour le scoring, LLM réservé aux jugements sémantiques (« même personne ? », équivalence de titres). C'est exactement le type d'arbitrage qu'un jury technique Anthropic va valoriser — ça montre que vous savez *où* Claude apporte de la valeur et où il ne faut pas lui faire porter du calcul qui doit être auditable.
- Task boundaries explicites par sous-agent (§10) — bon réflexe pour un design en Claude Agent SDK.

**Points faibles**
- Aucune mention de fonctionnalités Claude spécifiques (sorties structurées, extended thinking pour la réconciliation, prompt caching pour le profil AE relu à chaque run, gestion d'erreurs/retry d'un sous-agent).
- Le score de confiance par donnée (`confiance_source: 0.8` dans l'exemple JSON) n'est jamais expliqué : vient-il de la source elle-même, d'une heuristique, d'un jugement LLM ? Zone floue sur un point qui est censé être un pilier de traçabilité.
- Pas de stratégie d'évaluation (comment sait-on que la réconciliation ou le scoring sont corrects ?) ni de gestion des échecs partiels (un agent de collecte qui timeout ne bloque-t-il pas tout ?).

**Recommandation** : ajouter un paragraphe sur l'observabilité/eval (même minimal pour un hackathon) et clarifier l'origine du score de confiance — c'est un détail qui saute aux yeux d'un jury technique.

---

## 3. Profondeur d'usage des données externes, Sillage & FullEnrich — **13/25**

**Points forts**
- Répartition des rôles claire et fidèle au positionnement réel des produits : Sillage = firmographie + account mapping + signaux, FullEnrich = strictement contacts. Pas de confusion de périmètre.
- Le croisement CRM (lecture) × données fraîches externes, avec règles d'arbitrage par recency/autorité de source (§6), est un **usage réellement profond** de la donnée — ce n'est pas juste « appeler une API et afficher le résultat », c'est de la réconciliation multi-sources avec logique métier.

**Points faibles — c'est le point le plus fragile du dossier**
- **Asymétrie forte** : Sillage est mobilisé dans les 3 agents de collecte + le scoring, alors que FullEnrich n'intervient que dans **un seul agent**, pour un seul type de donnée (coordonnées). Sur un critère noté à égalité entre les deux sponsors, ça peut se lire comme « FullEnrich est un plugin annexe ».
- Le document ne référence aucune capacité Sillage précise (par ex. les signaux typés, la persona ICP, les watchlists, l'enrichissement société) — il reste au niveau « on appelle Sillage » plutôt que de montrer une intégration fine des primitives réellement disponibles côté Sillage (get_persona, list_signals, get_signal_playbook, enrich_company, watchlists…), ce qui donnerait plus de crédibilité et de profondeur démontrable.
- FullEnrich pourrait probablement apporter plus qu'un simple lookup de coordonnées (vérification, waterfall multi-fournisseurs) — non exploré.

**Recommandation** : soit enrichir l'usage FullEnrich (vérification de contact, cascade de fallback si Sillage n'a pas l'info), soit assumer et justifier explicitement l'asymétrie dans la présentation (« FullEnrich comble un blind spot précis de Sillage : les coordonnées directes ») pour éviter que le jury la perçoive comme un manque.

---

## Score total estimé — **50/75**

| Critère | Score |
|---|---|
| Business impact | 17/25 |
| Profondeur IA/Anthropic | 20/25 |
| Profondeur données externes | 13/25 |
| **Total** | **50/75** |

**Priorité n°1 avant la démo** : rééquilibrer l'usage de FullEnrich (critère le plus faible et le plus risqué vu la double sponsorisation), et quantifier l'impact business (temps économisé, volume de leads) — ce brief est solide comme fondation d'ingénierie, mais ces deux points sont ceux qui pèseront le plus sur la note finale du jury.