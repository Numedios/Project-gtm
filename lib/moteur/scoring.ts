/**
 * A4 — Les trois formules : confiance, complétude, ICP.
 *
 * Fonctions PURES et déterministes du dossier consolidé. Aucun réseau, aucun
 * modèle, aucune horloge : la date de référence est injectée.
 *
 * Le LLM (poste 2, B5) met la décomposition ICP en prose ; il ne calcule ni
 * n'ajuste jamais un chiffre de ce fichier.
 */
import type { Observation, Completude, ScoreIcp, CritereIcp } from '@/lib/schema/canonical';
import {
  CHAMPS,
  POIDS_IMPORTANCE,
  CONFIG_DEFAUT,
  type ConfigMoteur,
  type NomChamp,
} from '@/lib/config/champs';
import { ICP_DEFAUT, type ConfigIcp } from '@/lib/config/icp';

const MS_PAR_JOUR = 86_400_000;

/** Âge en jours d'une estampille, relatif à la date de référence injectée.
 *  null si la donnée n'est pas datée. */
export function ageJours(
  date_donnee: string | null,
  dateReference: string,
): number | null {
  if (date_donnee === null) return null;
  return (Date.parse(dateReference) - Date.parse(date_donnee)) / MS_PAR_JOUR;
}

/**
 * Confiance d'UNE observation : décroissance exponentielle par âge.
 * Une date inconnue vaut exactement une demi-vie (facteur 0.5) — pénalité
 * déterministe, ni gratuite ni fatale.
 */
export function confianceDecayee(
  obs: Observation,
  dateReference: string,
  config: ConfigMoteur = CONFIG_DEFAUT,
): number {
  const age = ageJours(obs.date_donnee, dateReference);
  const facteur =
    age === null
      ? 0.5
      : Math.pow(0.5, Math.max(0, age) / config.DEMI_VIE_CONFIANCE);
  return obs.confiance_source * facteur;
}

/**
 * Formule 1 — confiance d'un champ : UNION PROBABILISTE des observations
 * CONCORDANTES (décision du 2026-07-09).
 *
 *   confiance = 1 − Π (1 − conf_décayée(obs_i))
 *
 * Garantit par construction l'invariant : corroboration ⇒ la confiance monte,
 * sans jamais dépasser 1.
 */
export function confianceObservations(
  observations: readonly Observation[],
  dateReference: string,
  config: ConfigMoteur = CONFIG_DEFAUT,
): number {
  if (observations.length === 0) return 0;
  let produit = 1;
  for (const obs of observations) {
    produit *= 1 - confianceDecayee(obs, dateReference, config);
  }
  return 1 - produit;
}

// ---------------------------------------------------------------------------
// Formule 2 — complétude
// ---------------------------------------------------------------------------

/** Les champs nécessaires au jugement ICP (troisième terme de la formule). */
export const CHAMPS_ICP: readonly NomChamp[] = [
  'secteur',
  'effectif',
  'pays_siege',
  'seniorite',
];

const estPresente = (v: unknown): boolean => v !== null && v !== undefined;

/**
 * complétude = 0.70 × couverture pondérée des champs du template
 *            + 0.15 × au moins un interlocuteur identifié
 *            + 0.15 × présence des champs nécessaires au jugement ICP
 */
export function calculerCompletude(
  valeursRetenues: Partial<Record<NomChamp, unknown>>,
): Completude {
  let poidsTotal = 0;
  let poidsCouverts = 0;
  const champsManquants: string[] = [];

  for (const [nom, spec] of Object.entries(CHAMPS)) {
    const poids = POIDS_IMPORTANCE[spec.importance];
    poidsTotal += poids;
    if (estPresente(valeursRetenues[nom as NomChamp])) {
      poidsCouverts += poids;
    } else {
      champsManquants.push(nom);
    }
  }

  const couverture = poidsTotal === 0 ? 0 : poidsCouverts / poidsTotal;
  const interlocuteur =
    estPresente(valeursRetenues.email) ||
    (estPresente(valeursRetenues.prenom) && estPresente(valeursRetenues.nom));
  const icpPresents =
    CHAMPS_ICP.filter((c) => estPresente(valeursRetenues[c])).length /
    CHAMPS_ICP.length;

  return {
    score: 0.7 * couverture + 0.15 * (interlocuteur ? 1 : 0) + 0.15 * icpPresents,
    couverture_ponderee: couverture,
    interlocuteur_identifie: interlocuteur,
    champs_icp_presents: icpPresents,
    champs_manquants: champsManquants,
  };
}

// ---------------------------------------------------------------------------
// Formule 3 — score ICP : (score, décomposition par critère)
// ---------------------------------------------------------------------------

const normaliser = (v: unknown): string => String(v).trim().toLowerCase();

/**
 * Renvoie le score ET sa décomposition. `score` est exactement la moyenne
 * pondérée des critères × 100 — le test de recomposition en dépend.
 */
export function calculerScoreIcp(
  valeurs: {
    secteur?: unknown;
    effectif?: unknown;
    pays_siege?: unknown;
    seniorite?: unknown;
  },
  icp: ConfigIcp = ICP_DEFAUT,
): ScoreIcp {
  const decomposition: CritereIcp[] = [];

  // Secteur — appartenance à la liste cible (taxonomie normalisée en amont, B4).
  {
    const v = valeurs.secteur;
    const atteint =
      estPresente(v) && icp.secteurs_cibles.includes(normaliser(v));
    decomposition.push({
      critere: 'secteur',
      poids: icp.poids.secteur,
      score: atteint ? 1 : 0,
      valeur_observee: v ?? null,
      detail: !estPresente(v)
        ? 'Secteur non renseigné.'
        : atteint
          ? `Secteur « ${normaliser(v)} » dans la cible (${icp.secteurs_cibles.join(', ')}).`
          : `Secteur « ${normaliser(v)} » hors cible (${icp.secteurs_cibles.join(', ')}).`,
    });
  }

  // Effectif — dégradation PROGRESSIVE hors fourchette, pas binaire.
  {
    const v = valeurs.effectif;
    let score = 0;
    let detail = 'Effectif non renseigné.';
    if (typeof v === 'number' && Number.isFinite(v)) {
      const { min, max } = icp.effectif;
      if (v >= min && v <= max) {
        score = 1;
        detail = `Effectif ${v} dans la fourchette cible ${min}–${max}.`;
      } else {
        const distance = v < min ? (min - v) / min : (v - max) / max;
        score = Math.max(0, 1 - distance);
        detail = `Effectif ${v} hors fourchette ${min}–${max} (écart relatif ${(distance * 100).toFixed(0)} %).`;
      }
    }
    decomposition.push({
      critere: 'effectif',
      poids: icp.poids.effectif,
      score,
      valeur_observee: v ?? null,
      detail,
    });
  }

  // Géographie — pays du siège dans la zone de chalandise.
  {
    const v = valeurs.pays_siege;
    const cibles = icp.pays_cibles.map(normaliser);
    const atteint = estPresente(v) && cibles.includes(normaliser(v));
    decomposition.push({
      critere: 'geographie',
      poids: icp.poids.geographie,
      score: atteint ? 1 : 0,
      valeur_observee: v ?? null,
      detail: !estPresente(v)
        ? 'Pays du siège non renseigné.'
        : atteint
          ? `Pays « ${String(v)} » dans la zone cible.`
          : `Pays « ${String(v)} » hors zone cible (${icp.pays_cibles.join(', ')}).`,
    });
  }

  // Séniorité — niveau décisionnaire de l'interlocuteur.
  {
    const v = valeurs.seniorite;
    const score = estPresente(v) ? (icp.seniorites[normaliser(v)] ?? 0) : 0;
    decomposition.push({
      critere: 'seniorite',
      poids: icp.poids.seniorite,
      score,
      valeur_observee: v ?? null,
      detail: !estPresente(v)
        ? 'Séniorité non renseignée.'
        : score > 0
          ? `Séniorité « ${normaliser(v)} » décisionnaire (score ${score}).`
          : `Séniorité « ${normaliser(v)} » non décisionnaire.`,
    });
  }

  const totalPoids = decomposition.reduce((s, c) => s + c.poids, 0);
  const score =
    totalPoids === 0
      ? 0
      : (decomposition.reduce((s, c) => s + c.poids * c.score, 0) / totalPoids) * 100;

  return { score, decomposition };
}
