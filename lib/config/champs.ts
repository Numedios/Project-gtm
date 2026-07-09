/**
 * A1 — Les champs du dossier et leur marqueur `stable | volatile`.
 *
 * ⚠️ RELECTURE MÉTIER REQUISE. Ce fichier est une passe de spécification, pas
 * une décision technique (docs/axe-A-moteur.md §A1). Chaque marqueur décide de
 * ce que le système ÉMET en cas de divergence :
 *   - volatile → signal « changement détecté », aucune question ;
 *   - stable   → conflit, donc question à l'AE.
 * Mal classer un champ volatile en stable = une question de confirmation
 * inutile à chaque décideur promu. C'est le risque produit n°1.
 *
 * Les seuils sont PAR CLASSE DE CHAMP, jamais globaux (audit/02 §2.1) :
 * ils déterminent le volume de questions reçues par l'AE.
 */
import type { Volatilite } from '@/lib/schema/canonical';

export type TypeChamp = 'texte' | 'numerique' | 'enum' | 'url' | 'date';

/** Poids dans le score de complétude. */
export type Importance = 'essentiel' | 'important' | 'optionnel';

export interface SpecChamp {
  volatilite: Volatilite;
  type: TypeChamp;
  importance: Importance;
  /** Libellé humain — sert aux templates de questions déterministes. */
  label: string;
  /** Sources susceptibles de renseigner ce champ. Un champ mono-source ne
   *  peut jamais entrer en conflit. */
  sources: ReadonlyArray<'sillage' | 'fullenrich' | 'crm'>;
}

/** Seuils par classe de champ. Ils ne s'appliquent qu'aux champs STABLES :
 *  les volatiles n'émettent plus de conflits. */
export interface SeuilsClasse {
  /** Âge (jours) au-delà duquel la valeur retenue déclenche une confirmation
   *  même si l'arbitrage a tranché — l'angle mort « les deux sources sont
   *  vieilles » (fixture n°4). */
  SEUIL_AGE: number;
  /** Écart (jours) entre deux observations divergentes au-delà duquel on
   *  signale. Défaut prudent : 0 — toute divergence sur un stable révèle une
   *  erreur de source. C'est un BOUTON, pas une constante (fixtures n°2/3). */
  SEUIL_ECART: number;
}

export interface ConfigMoteur {
  seuils: SeuilsClasse;
  /** Écart relatif sous lequel deux valeurs numériques sont considérées
   *  concordantes (fixture n°5 : 6 % doit passer en silence). */
  TOLERANCE_NUMERIQUE: number;
  /** Demi-vie (jours) de la décroissance de confiance par âge. */
  DEMI_VIE_CONFIANCE: number;
}

/** Valeurs arrêtées le 2026-07-09 (union probabiliste, 180 j, 10 %). */
export const CONFIG_DEFAUT: ConfigMoteur = {
  seuils: {
    SEUIL_AGE: 180,
    SEUIL_ECART: 0,
  },
  TOLERANCE_NUMERIQUE: 0.10,
  DEMI_VIE_CONFIANCE: 365,
};

// ---------------------------------------------------------------------------
// Le schéma des ~30 champs.
// ---------------------------------------------------------------------------

export const CHAMPS = {
  // --- Compte : identité légale (stable — une divergence = une source se trompe)
  nom_legal:            { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: 'le nom légal',                sources: ['sillage', 'fullenrich', 'crm'] },
  domaine:              { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: 'le domaine',                  sources: ['sillage', 'fullenrich', 'crm'] },
  pays_siege:           { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: 'le pays du siège social',     sources: ['sillage', 'fullenrich', 'crm'] },
  ville_siege:          { volatilite: 'stable',   type: 'texte',     importance: 'important', label: 'la ville du siège',           sources: ['sillage', 'fullenrich', 'crm'] },
  annee_creation:       { volatilite: 'stable',   type: 'numerique', importance: 'optionnel', label: "l'année de création",         sources: ['sillage', 'fullenrich'] },
  linkedin_entreprise:  { volatilite: 'stable',   type: 'url',       importance: 'optionnel', label: 'le LinkedIn de l’entreprise', sources: ['sillage', 'fullenrich'] },
  site_web:             { volatilite: 'stable',   type: 'url',       importance: 'important', label: 'le site web',                 sources: ['sillage', 'fullenrich', 'crm'] },
  forme_juridique:      { volatilite: 'stable',   type: 'texte',     importance: 'optionnel', label: 'la forme juridique',          sources: ['fullenrich', 'crm'] },

  // --- Compte : caractéristiques (volatiles — une divergence = une évolution)
  secteur:              { volatilite: 'stable',   type: 'enum',      importance: 'essentiel', label: "le secteur d'activité",       sources: ['sillage', 'fullenrich', 'crm'] },
  effectif:             { volatilite: 'volatile', type: 'numerique', importance: 'essentiel', label: "l'effectif",                  sources: ['sillage', 'fullenrich', 'crm'] },
  ca_annuel:            { volatilite: 'volatile', type: 'numerique', importance: 'important', label: 'le chiffre d’affaires',       sources: ['sillage', 'fullenrich'] },
  description:          { volatilite: 'volatile', type: 'texte',     importance: 'optionnel', label: 'la description',              sources: ['sillage', 'fullenrich'] },
  techno_stack:         { volatilite: 'volatile', type: 'texte',     importance: 'optionnel', label: 'la stack technique',          sources: ['sillage', 'fullenrich'] },
  financement_total:    { volatilite: 'volatile', type: 'numerique', importance: 'optionnel', label: 'le financement total',        sources: ['sillage', 'fullenrich'] },
  dernier_tour:         { volatilite: 'volatile', type: 'texte',     importance: 'optionnel', label: 'le dernier tour de table',    sources: ['sillage', 'fullenrich'] },
  date_dernier_tour:    { volatilite: 'volatile', type: 'date',      importance: 'optionnel', label: 'la date du dernier tour',     sources: ['sillage', 'fullenrich'] },
  croissance_effectif:  { volatilite: 'volatile', type: 'numerique', importance: 'optionnel', label: 'la croissance des effectifs', sources: ['sillage'] },

  // --- Interlocuteur : identité (stable)
  prenom:               { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: 'le prénom',                   sources: ['sillage', 'fullenrich', 'crm'] },
  nom:                  { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: 'le nom',                      sources: ['sillage', 'fullenrich', 'crm'] },
  email:                { volatilite: 'stable',   type: 'texte',     importance: 'essentiel', label: "l'email",                     sources: ['fullenrich', 'crm'] },
  linkedin_contact:     { volatilite: 'stable',   type: 'url',       importance: 'important', label: 'le LinkedIn du contact',      sources: ['sillage', 'fullenrich', 'crm'] },

  // --- Interlocuteur : situation (volatile — les gens bougent)
  titre:                { volatilite: 'volatile', type: 'texte',     importance: 'essentiel', label: 'le titre',                    sources: ['sillage', 'fullenrich', 'crm'] },
  seniorite:            { volatilite: 'volatile', type: 'enum',      importance: 'important', label: 'la séniorité',                sources: ['sillage', 'fullenrich'] },
  departement:          { volatilite: 'volatile', type: 'texte',     importance: 'optionnel', label: 'le département',              sources: ['sillage', 'fullenrich'] },
  telephone:            { volatilite: 'volatile', type: 'texte',     importance: 'important', label: 'le téléphone',                sources: ['fullenrich', 'crm'] },
  localisation_contact: { volatilite: 'volatile', type: 'texte',     importance: 'optionnel', label: 'la localisation du contact',  sources: ['sillage', 'fullenrich'] },
  date_prise_poste:     { volatilite: 'volatile', type: 'date',      importance: 'optionnel', label: 'la date de prise de poste',   sources: ['sillage', 'fullenrich'] },

  // --- Signaux (mono-source Sillage — jamais de conflit)
  signaux_achat:        { volatilite: 'volatile', type: 'texte',     importance: 'important', label: "les signaux d'achat",         sources: ['sillage'] },

  // --- CRM interne (mono-source — jamais de conflit ; on les définit librement)
  historique_deals:       { volatilite: 'volatile', type: 'texte',   importance: 'important', label: "l'historique des deals",      sources: ['crm'] },
  historique_relationnel: { volatilite: 'volatile', type: 'texte',   importance: 'important', label: "l'historique relationnel",    sources: ['crm'] },
  notes_crm:              { volatilite: 'volatile', type: 'texte',   importance: 'optionnel', label: 'les notes CRM',               sources: ['crm'] },
  stade_pipeline:         { volatilite: 'volatile', type: 'enum',    importance: 'optionnel', label: 'le stade pipeline',           sources: ['crm'] },
} as const satisfies Record<string, SpecChamp>;

export type NomChamp = keyof typeof CHAMPS;

export const POIDS_IMPORTANCE: Record<Importance, number> = {
  essentiel: 3,
  important: 2,
  optionnel: 1,
};
