# 03 — Sécurité : trois entrées non fiables alimentent des prompts

**Sévérité : élevée.** Le brief ne mentionne pas le sujet.

---

## Le problème

Trois flux de **texte libre**, contrôlés au moins partiellement par des tiers, finissent dans des
prompts envoyés au modèle :

| # | Flux | Destination | Aggravant | Statut |
|---|---|---|---|---|
| 1 | **Feedback de l'AE** | Écrit dans le profil de préférence, puis **réinjecté dans le prompt de personnalisation à chaque exécution suivante** | La persistance amplifie : une injection écrite une fois est rejouée indéfiniment | ✅ **Neutralisé par construction** (2026-07-09) — voir ci-dessous |
| 2 | **Notes / historique CRM** | Prompt de réconciliation | Contenu rédigé par des humains, non structuré | ⚠️ Ouvert |
| 3 | **Signaux d'achat Sillage** | Prompt de réconciliation | Contenu externe, hors de notre contrôle | ⚠️ Ouvert |

Le cas 1 était le plus sérieux : c'était le seul où le contenu hostile **survivait à la session** et
contaminait toutes les exécutions futures pour cet AE. La décision du 2026-07-09 (profil AE = schéma
fermé d'énumérations, voir plus bas) le **neutralise par construction** : le feedback libre de l'AE
ne peut plus atteindre le prompt, il ne peut que sélectionner une valeur d'énumération dans un
domaine borné. Le vecteur de persistance disparaît.

Les cas 2 et 3 restent ouverts : ces contenus continuent d'entrer en texte libre dans le prompt de
réconciliation. Ils ne sont **pas** neutralisés et relèvent toujours des atténuations ci-dessous.

---

## Suggestions

### Délimiter les contenus non fiables

Encadrer explicitement ces contenus dans les prompts, et instruire le modèle de ne jamais
traiter leur contenu comme des instructions. C'est une mesure d'atténuation, pas une garantie —
d'où les points suivants.

**Caduc pour le vecteur n°1** depuis le 2026-07-09 : délimiter et échapper le feedback libre de
l'AE n'a plus d'objet, puisque ce feedback ne transite plus vers le prompt (schéma fermé
d'énumérations). Ces atténuations ne concernent donc plus que les vecteurs n°2 (notes CRM) et n°3
(signaux Sillage), qui, eux, restent en texte libre dans le prompt de réconciliation.

### Borner le profil AE — décision arrêtée le 2026-07-09

Le §9 dit *« profil de préférence résumé en texte (léger) »*. Un profil en texte libre qui grossit
à chaque feedback **dérive** et devient impossible à auditer : on ne sait plus quel feedback a
produit quel comportement.

La résolution de [01 §1.3](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme--résolue)
(2026-07-09) **arrête** ce qui n'était ici qu'une esquisse. Le profil AE devient un **schéma fermé**
de slots strictement stylistiques, rendus en texte au moment de construire le prompt. On garde la
légèreté annoncée sans perdre la bornabilité :

```
registre        : formel | familier
longueur        : courte | moyenne | détaillée
tournure        : directe | indirecte
tutoiement      : oui | non
densite_jargon  : faible | moyenne | élevée
```

Aucun autre champ n'est admis. `types de lead` est explicitement **retiré** : c'est du fond, pas de
la forme. Chaque slot a un domaine de valeurs fermé, **énuméré et borné** — aucun texte libre, aucune
valeur libre. Aucun texte libre ne transite du feedback vers le prompt. Le feedback libre de l'AE est
**interprété** pour sélectionner une valeur d'énumération, jamais recopié.

Conséquence directe : ce schéma rend l'invariant du §9 vérifiable **par construction** — un ensemble
de slots stylistiques bornés ne peut structurellement pas encoder un « type de lead ». C'est ce qui
fonde l'invariant (a) du [fichier 08](08-invariants-a-verifier.md#séparation-fond--forme).

### Versionner le profil

Un mauvais feedback ne doit pas être irréversible. Profil versionné, rollback possible.

### Ne pas faire transiter les PII

Les coordonnées de décideurs (FullEnriched) n'ont aucune raison d'entrer dans le prompt de
personnalisation, qui ne travaille que sur la forme des questions. Les exclure réduit la surface
d'exposition sans coût.
