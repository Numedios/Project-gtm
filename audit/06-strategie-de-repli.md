# 06 — Contre-proposition sur la stratégie de repli (§12)

---

## Ce que propose le brief

> *« La Réconciliation peut être fusionnée dans l'agrégation de l'orchestrateur. »*

## Pourquoi c'est couper la mauvaise branche

La réconciliation **est** la différenciation du produit :

- C'est le **seul endroit** où les trois sources se rencontrent.
- C'est là que vit la règle produit « conflit non résolu → question de qualification », qui est la
  meilleure idée du brief.
- C'est ce qui rend le dossier **auditable**, exigence explicite du §10.

La supprimer laisse un enrichisseur de leads générique — exactement le produit que n'importe quel
concurrent livre déjà.

Inversement, le troisième agent de collecte (Signaux d'achat) est **le plus autonome des trois** :
il ne partage aucune entité avec les autres, sa disparition dégrade le score de complétude et rien
d'autre. C'est le candidat naturel à la coupe.

---

## Ordre de coupe suggéré

Du plus sacrifiable au moins :

1. **Personnalisation par mémoire AE.** Déjà identifiée comme dernière par le brief — d'accord.
   Indépendante du reste, ajoutable en fin de parcours.
2. **Troisième agent de collecte** (Signaux d'achat).
3. **Deuxième agent de collecte.**
4. **Jamais :** réconciliation + arbitrage + scoring + branchement CRM.

---

## Le squelette de démo minimal viable

```
une seule source externe + CRM (lecture)
        ↓
réconciliation sur deux sources
        ↓
arbitrage (les 4 règles du §6)
        ↓
scoring (ICP + complétude)
        ↓
branchement NOUVEAU LEAD / MISE À JOUR
        ↓
questions de qualification
```

Ça démontre **toute la thèse produit** avec un seul connecteur. Le troisième agent de collecte
n'ajoute pas d'idée neuve à la démonstration : il ajoute une colonne de données.

C'est aussi le chemin le plus sûr, parce que le seul connecteur restant peut être le **CRM mocké**
([05 §5.3](05-connecteurs.md#53-le-crm-mocké-est-une-opportunité-de-design-pas-une-corvée)),
qui ne dépend d'aucun accès externe et dont les sept fixtures sont déjà conçues pour exercer les
quatre règles d'arbitrage.
