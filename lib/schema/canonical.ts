/**
 * Contrat partagé entre le poste 1 (moteur) et le poste 2 (surface).
 * Une seule source de vérité, en Zod. Toute donnée qui traverse la frontière
 * entre les deux postes est conforme à ce fichier — jamais un import croisé.
 *
 * Voir docs/axe-A-moteur.md « Le contrat partagé ».
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sources et estampilles
// ---------------------------------------------------------------------------

export const Source = z.enum(['sillage', 'fullenrich', 'crm']);
export type Source = z.infer<typeof Source>;

/**
 * Une observation estampillée. On les conserve TOUTES : l'union n'écrase pas.
 * `date_donnee: null` ⇒ pas d'arbitrage automatique possible sur ce prétendant.
 */
export const Observation = z.object({
  valeur: z.unknown(),
  source: Source,
  date_donnee: z.iso.datetime().nullable(),
  confiance_source: z.number().min(0).max(1),
});
export type Observation = z.infer<typeof Observation>;

export const Volatilite = z.enum(['stable', 'volatile']);
export type Volatilite = z.infer<typeof Volatilite>;

// ---------------------------------------------------------------------------
// Résolution et signalement — deux notions découplées (A3)
// ---------------------------------------------------------------------------

/**
 * `auto`       — l'arbitrage a su trancher.
 * `impossible` — il n'a pas su (date manquante, confiances égales à date égale).
 * `absente`    — rien à arbitrer : aucune source ne renseigne le champ.
 *                Ce n'est PAS un conflit (audit/02 §2.4) ; ça fait chuter la
 *                complétude et alimente une question ouverte.
 */
export const Resolution = z.enum(['auto', 'impossible', 'absente']);
export type Resolution = z.infer<typeof Resolution>;

// ---------------------------------------------------------------------------
// Émissions : signaux et questions
// ---------------------------------------------------------------------------

/** Divergence sur un champ volatile : un changement, pas une erreur. */
export const Signal = z.object({
  type: z.literal('changement'),
  champ: z.string(),
  ancienne_valeur: z.unknown(),
  nouvelle_valeur: z.unknown(),
  source_nouvelle: Source,
  message: z.string(),
});
export type Signal = z.infer<typeof Signal>;

/**
 * `confirmation` — l'arbitrage a tranché mais il faut faire vérifier
 *                  (« Le siège est-il bien en France ? »).
 * `ouverte`      — l'arbitrage n'a pas pu trancher, ou le champ est absent
 *                  (« Où se situe le siège social ? »).
 */
export const Question = z.object({
  type: z.enum(['confirmation', 'ouverte']),
  champ: z.string(),
  texte: z.string(),
});
export type Question = z.infer<typeof Question>;

// ---------------------------------------------------------------------------
// Champ consolidé
// ---------------------------------------------------------------------------

export const ChampConsolide = z.object({
  champ: z.string(),
  observations: z.array(Observation), // jamais aplaties
  valeur_retenue: z.unknown(),        // DÉRIVÉE des observations ; null si non tranché
  confiance: z.number().min(0).max(1),
  volatilite: Volatilite,
  resolution: Resolution,
  a_signaler_AE: z.boolean(),
});
export type ChampConsolide = z.infer<typeof ChampConsolide>;

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/** Une ligne de la décomposition ICP. Le LLM (B5) met ces lignes en prose,
 *  il ne calcule ni n'ajuste jamais `score`. */
export const CritereIcp = z.object({
  critere: z.string(),
  poids: z.number().min(0),
  score: z.number().min(0).max(1), // contribution normalisée du critère
  valeur_observee: z.unknown(),    // ce qui a été comparé à la cible
  detail: z.string(),              // explication déterministe, template
});
export type CritereIcp = z.infer<typeof CritereIcp>;

export const ScoreIcp = z.object({
  score: z.number().min(0).max(100),
  decomposition: z.array(CritereIcp),
});
export type ScoreIcp = z.infer<typeof ScoreIcp>;

export const Completude = z.object({
  score: z.number().min(0).max(1),
  couverture_ponderee: z.number().min(0).max(1),
  interlocuteur_identifie: z.boolean(),
  champs_icp_presents: z.number().min(0).max(1),
  champs_manquants: z.array(z.string()),
});
export type Completude = z.infer<typeof Completude>;

// ---------------------------------------------------------------------------
// Dossier consolidé — la sortie du moteur
// ---------------------------------------------------------------------------

export const Branche = z.enum(['MISE_A_JOUR', 'NOUVEAU_LEAD']);
export type Branche = z.infer<typeof Branche>;

/** Panne partielle d'une source (audit/02 §2.5) : l'AE lit « indisponible »,
 *  il ne constate pas une absence silencieuse. */
export const StatutSource = z.enum(['ok', 'indisponible']);
export type StatutSource = z.infer<typeof StatutSource>;

export const DossierConsolide = z.object({
  branche: Branche,
  champs: z.record(z.string(), ChampConsolide),
  signaux: z.array(Signal),
  questions: z.array(Question),
  statut_sources: z.record(Source, StatutSource),
  completude: Completude,
  score_icp: ScoreIcp,
  /** Historique CRM mono-source (deals, relationnel) : remonté tel quel,
   *  ne peut jamais entrer en conflit. */
  historique: z.object({
    deals: z.array(z.unknown()),
    relationnel: z.array(z.unknown()),
  }),
});
export type DossierConsolide = z.infer<typeof DossierConsolide>;

// ---------------------------------------------------------------------------
// Profil AE — schéma FERMÉ de cinq slots stylistiques (audit/01 §1.3)
// ---------------------------------------------------------------------------

/**
 * Énumérations bornées, objet strict : tout champ inconnu lève à la validation.
 * C'est ce qui neutralise par construction le vecteur d'injection n°1
 * (feedback AE persisté). Ne JAMAIS élargir sans repasser par l'audit.
 */
export const ProfilAE = z.strictObject({
  registre: z.enum(['formel', 'neutre', 'direct']),
  longueur: z.enum(['courte', 'moyenne', 'detaillee']),
  tournure: z.enum(['interrogative', 'affirmative']),
  tutoiement: z.enum(['tu', 'vous']),
  densite_jargon: z.enum(['grand_public', 'metier', 'expert']),
});
export type ProfilAE = z.infer<typeof ProfilAE>;
