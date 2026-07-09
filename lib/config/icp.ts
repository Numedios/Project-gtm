/**
 * A4 — Configuration du score ICP.
 *
 * Quatre critères pondérés, tous configurables ici. Le calcul (lib/moteur/scoring.ts)
 * renvoie le score ET sa décomposition par critère ; le LLM (poste 2, B5) met la
 * décomposition en prose, il ne calcule ni n'ajuste jamais le chiffre.
 *
 * ⚠️ RELECTURE MÉTIER REQUISE : cibles et poids sont des placeholders raisonnables,
 * à calibrer avec l'équipe commerciale.
 */

export interface ConfigIcp {
  secteurs_cibles: readonly string[];
  effectif: { min: number; max: number };
  pays_cibles: readonly string[];
  /** Séniorités considérées décisionnaires, avec leur score. Tout niveau
   *  absent de la table vaut 0. */
  seniorites: Readonly<Record<string, number>>;
  poids: {
    secteur: number;
    effectif: number;
    geographie: number;
    seniorite: number;
  };
}

export const ICP_DEFAUT: ConfigIcp = {
  secteurs_cibles: ['saas', 'fintech', 'martech'],
  effectif: { min: 50, max: 500 },
  pays_cibles: ['France', 'Belgique', 'Suisse', 'Luxembourg'],
  seniorites: {
    'c-level': 1,
    vp: 1,
    head: 1,
    director: 0.75,
    manager: 0.5,
  },
  poids: {
    secteur: 3,
    effectif: 2,
    geographie: 2,
    seniorite: 3,
  },
};
