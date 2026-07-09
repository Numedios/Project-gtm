# 03 — Sécurité : trois entrées non fiables alimentent des prompts

**Sévérité : élevée.** Le brief ne mentionne pas le sujet.

---

## Le problème

Trois flux de **texte libre**, contrôlés au moins partiellement par des tiers, finissent dans des
prompts envoyés au modèle :

| # | Flux | Destination | Aggravant |
|---|---|---|---|
| 1 | **Feedback de l'AE** | Écrit dans le profil de préférence, puis **réinjecté dans le prompt de personnalisation à chaque exécution suivante** | La persistance amplifie : une injection écrite une fois est rejouée indéfiniment |
| 2 | **Notes / historique CRM** | Prompt de réconciliation | Contenu rédigé par des humains, non structuré |
| 3 | **Signaux d'achat Sillage** | Prompt de réconciliation | Contenu externe, hors de notre contrôle |

Le cas 1 est le plus sérieux : c'est le seul où le contenu hostile **survit à la session** et
contamine toutes les exécutions futures pour cet AE.

---

## Suggestions

### Délimiter les contenus non fiables

Encadrer explicitement ces trois contenus dans les prompts, et instruire le modèle de ne jamais
traiter leur contenu comme des instructions. C'est une mesure d'atténuation, pas une garantie —
d'où les points suivants.

### Borner le profil AE

Le §9 dit *« profil de préférence résumé en texte (léger) »*. Un profil en texte libre qui grossit
à chaque feedback **dérive** et devient impossible à auditer : on ne sait plus quel feedback a
produit quel comportement.

**Suggestion : slots structurés en interne, rendus en texte** au moment de construire le prompt.
On garde la légèreté annoncée sans perdre la bornabilité :

```
registre        : formel | familier
longueur        : courte | moyenne | détaillée
tournure        : directe | indirecte
tutoiement      : oui | non
densité_jargon  : faible | moyenne | élevée
```

Chaque slot a un domaine de valeurs fermé. Aucun texte libre ne transite du feedback vers le
prompt. Le feedback libre de l'AE est **interprété** pour mettre à jour les slots, jamais recopié.

Bénéfice secondaire : ce schéma rend l'invariant du §9 vérifiable par construction (voir
[01-incoherences-internes.md](01-incoherences-internes.md#13-la-mémoire-ae-peut-faire-fuiter-du-fond-dans-la-forme)) — un ensemble de slots stylistiques ne peut
structurellement pas encoder un « type de lead ».

### Versionner le profil

Un mauvais feedback ne doit pas être irréversible. Profil versionné, rollback possible.

### Ne pas faire transiter les PII

Les coordonnées de décideurs (FullEnriched) n'ont aucune raison d'entrer dans le prompt de
personnalisation, qui ne travaille que sur la forme des questions. Les exclure réduit la surface
d'exposition sans coût.
