// Contrat partagé entre l'axe A (moteur) et l'axe B (surface).
// Figé avant que les deux postes divergent — voir SYNTHESE.md.
// Axe B ne fait QUE consommer et produire des données conformes à ce schéma ;
// la logique d'arbitrage / signalement / scoring vit dans lib/engine/ (axe A).

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export const Source = z.enum(['sillage', 'fullenrich', 'crm']);
export type Source = z.infer<typeof Source>;

export const StatutSource = z.enum(['ok', 'indisponible', 'partiel']);
export type StatutSource = z.infer<typeof StatutSource>;

export const StatutParSource = z.record(Source, StatutSource);
export type StatutParSource = z.infer<typeof StatutParSource>;

// ---------------------------------------------------------------------------
// Observation estampillée — le socle factuel. On les conserve TOUTES.
// ---------------------------------------------------------------------------

export const Observation = z.object({
  valeur: z.unknown(),
  source: Source,
  date_donnee: z.string().datetime().nullable(), // null ⇒ pas d'arbitrage possible
  confiance_source: z.number().min(0).max(1),
});
export type Observation = z.infer<typeof Observation>;

export const Volatilite = z.enum(['stable', 'volatile']);
export type Volatilite = z.infer<typeof Volatilite>;

// ---------------------------------------------------------------------------
// Champ consolidé — sortie de l'arbitrage (axe A). Jamais aplati au merge.
// ---------------------------------------------------------------------------

export const ChampConsolide = z.object({
  observations: z.array(Observation), // jamais aplaties
  valeur_retenue: z.unknown(), // DÉRIVÉE des observations
  confiance: z.number().min(0).max(1),
  volatilite: Volatilite,
});
export type ChampConsolide = z.infer<typeof ChampConsolide>;

// ---------------------------------------------------------------------------
// Signalement — resolution et a_signaler_AE sont DÉCOUPLÉS (voir audit/01 §1.2)
// ---------------------------------------------------------------------------

export const Resolution = z.enum(['auto', 'impossible']);
export type Resolution = z.infer<typeof Resolution>;

export const TypeQuestion = z.enum(['confirmation', 'ouverte']);
export type TypeQuestion = z.infer<typeof TypeQuestion>;

// Enregistrement de conflit — sortie Réconciliation/Arbitrage → dossier AE.
export const Conflit = z.object({
  id: z.string(),
  champ: z.string(),
  entite: z.string(), // "entreprise", ou nom du décideur concerné
  valeur_retenue: z.unknown(),
  source_retenue: Source.nullable(),
  date_retenue: z.string().datetime().nullable(),
  valeur_ecartee: z.unknown().nullable(),
  source_ecartee: Source.nullable(),
  date_ecartee: z.string().datetime().nullable(),
  regle: z.enum(['recence', 'tolerance', 'confiance_source', 'aucune_date']),
  ecart_jours: z.number().nullable(),
  resolution: Resolution,
  a_signaler_AE: z.boolean(),
});
export type Conflit = z.infer<typeof Conflit>;

// Question de qualification posée à l'AE — un conflit signalé en devient une.
// L'ordre de la liste est figé par le poste 1 ; B6 ne réécrit que `texte`.
export const Question = z.object({
  id: z.string(),
  ordre: z.number().int().nonnegative(),
  champ: z.string().nullable(), // null pour une question de fond (hors conflit de champ)
  entite: z.string().nullable(),
  type: TypeQuestion,
  texte: z.string(), // forme — réécrite par B6, jamais réordonnée ni ajoutée/supprimée
  conflit_id: z.string().nullable(),
});
export type Question = z.infer<typeof Question>;

// Signal d'achat — daté, sourcé, catégorisé. Jamais une question en soi.
export const TypeSignal = z.enum([
  'recrutement',
  'nouveau_produit',
  'changement_decisionnaire',
  'ex_client',
  'visites_site',
]);
export type TypeSignal = z.infer<typeof TypeSignal>;

export const Signal = z.object({
  id: z.string(),
  type: TypeSignal,
  description: z.string(),
  date: z.string().datetime(),
  source: Source,
  entite_associee: z.string().nullable(),
});
export type Signal = z.infer<typeof Signal>;

// ---------------------------------------------------------------------------
// Historique CRM — une seule source possible, ne peut jamais entrer en conflit.
// ---------------------------------------------------------------------------

export const DealCRM = z.object({
  id: z.string(),
  entreprise: z.string(),
  date: z.string().datetime(),
  statut: z.enum(['gagne', 'perdu', 'en_cours']),
  montant: z.number().nullable(),
  notes: z.string().nullable(), // texte libre tiers — à délimiter avant tout prompt (B4)
});
export type DealCRM = z.infer<typeof DealCRM>;

export const HistoriqueRelationnel = z.object({
  deals: z.array(DealCRM),
  autre_entreprise: z.boolean(), // true si le deal listé concerne une AUTRE entreprise que le lead actuel
});
export type HistoriqueRelationnel = z.infer<typeof HistoriqueRelationnel>;

// ---------------------------------------------------------------------------
// Entreprise — champs firmographiques, chacun consolidé indépendamment.
// ---------------------------------------------------------------------------

export const Entreprise = z.object({
  nom: ChampConsolide,
  pays_siege: ChampConsolide,
  secteur: ChampConsolide,
  effectif: ChampConsolide,
  techno: ChampConsolide,
  competiteurs: ChampConsolide,
  site_web: ChampConsolide,
  description: ChampConsolide,
  historique_deals: z.array(DealCRM), // CRM uniquement — jamais de conflit
});
export type Entreprise = z.infer<typeof Entreprise>;

// ---------------------------------------------------------------------------
// Décideur — un membre de l'organigramme, champs consolidés + coordonnées FE.
// ---------------------------------------------------------------------------

export const Decideur = z.object({
  id: z.string(),
  nom: ChampConsolide,
  titre: ChampConsolide,
  seniorite: ChampConsolide,
  email: ChampConsolide,
  telephone: ChampConsolide,
  linkedin_url: ChampConsolide,
  historique_relationnel: HistoriqueRelationnel, // CRM uniquement — jamais de conflit
});
export type Decideur = z.infer<typeof Decideur>;

// ---------------------------------------------------------------------------
// Scores — fonctions pures côté axe A. B5 met SEULEMENT `prose` en mots.
// ---------------------------------------------------------------------------

export const DecompositionItem = z.object({
  critere: z.string(),
  poids: z.number(),
  valeur: z.number(),
  contribution: z.number(),
});
export type DecompositionItem = z.infer<typeof DecompositionItem>;

export const Score = z.object({
  valeur: z.number(),
  decomposition: z.array(DecompositionItem),
  prose: z.string().nullable(), // rempli par B5 (score_icp) — jamais par le score_completude
});
export type Score = z.infer<typeof Score>;

// ---------------------------------------------------------------------------
// Trace — un événement journalisé par run. Le livrable d'auditabilité.
// ---------------------------------------------------------------------------

export const TraceEvent = z.object({
  horodatage: z.string().datetime(),
  etape: z.string(),
  type: z.enum(['appel_outil', 'decision_arbitrage', 'departage_llm', 'erreur']),
  detail: z.unknown(),
});
export type TraceEvent = z.infer<typeof TraceEvent>;

// ---------------------------------------------------------------------------
// Profil AE — mémoire long-terme. Schéma FERMÉ, cinq slots stylistiques.
// `types de lead` explicitement retiré (audit/01 §1.3). Tout champ inconnu lève.
// ---------------------------------------------------------------------------

export const ProfilAE = z
  .object({
    registre: z.enum(['formel', 'familier']),
    longueur: z.enum(['courte', 'moyenne', 'détaillée']),
    tournure: z.enum(['directe', 'indirecte']),
    tutoiement: z.enum(['oui', 'non']),
    densite_jargon: z.enum(['faible', 'moyenne', 'élevée']),
  })
  .strict(); // tout champ hors des cinq slots fait échouer le parse
export type ProfilAE = z.infer<typeof ProfilAE>;

// ---------------------------------------------------------------------------
// Dossier de qualification — l'assemblage final.
// ---------------------------------------------------------------------------

export const StatutDossier = z.enum(['NOUVEAU_LEAD', 'MISE_A_JOUR']);
export type StatutDossier = z.infer<typeof StatutDossier>;

export const DossierQualification = z.object({
  id: z.string(),
  statut: StatutDossier,
  cree_le: z.string().datetime(),
  entreprise: Entreprise,
  decideurs: z.array(Decideur),
  signaux: z.array(Signal),
  conflits: z.array(Conflit),
  questions: z.array(Question),
  score_icp: Score,
  score_completude: Score,
  statut_par_source: StatutParSource,
  trace: z.array(TraceEvent),
});
export type DossierQualification = z.infer<typeof DossierQualification>;
