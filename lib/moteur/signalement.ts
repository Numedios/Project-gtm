/**
 * A3 — Le signalement : deux notions découplées.
 *
 *   resolution    : ai-je su trancher ?
 *   a_signaler_AE : faut-il faire vérifier malgré tout ?
 *
 *   a_signaler_AE = (resolution === "impossible")
 *                || (age(valeur_retenue) > SEUIL_AGE)
 *                || (ecart_jours         > SEUIL_ECART)
 *
 * Les seuils ne s'appliquent qu'aux champs STABLES (les volatiles n'émettent
 * plus de conflits) et déterminent le volume de questions reçues par l'AE.
 */
import type { Question } from '@/lib/schema/canonical';
import type { SeuilsClasse } from '@/lib/config/champs';

export function aSignaler(entree: {
  resolution: 'auto' | 'impossible';
  /** Âge (jours) de la valeur retenue ; null si non datée. */
  ageValeurRetenue: number | null;
  /** Écart (jours) entre la valeur retenue et l'observation divergente la
   *  plus récente ; null s'il n'y a pas de divergence. */
  ecartJours: number | null;
  seuils: SeuilsClasse;
}): boolean {
  if (entree.resolution === 'impossible') return true; // l'invariant A6 en dépend
  if (entree.ageValeurRetenue !== null && entree.ageValeurRetenue > entree.seuils.SEUIL_AGE) {
    return true;
  }
  if (entree.ecartJours !== null && entree.ecartJours > entree.seuils.SEUIL_ECART) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Templates de questions — déterministes. La personnalisation (poste 2, B5)
// ne change que le texte, jamais la cardinalité ni l'ordre (bijection).
// ---------------------------------------------------------------------------

const capitaliser = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);

/** « Quel est le… / Quelle est la… / Quels sont les… » selon le libellé. */
function interroger(label: string): string {
  if (label.startsWith('les ')) return `Quels sont ${label} ?`;
  if (label.startsWith('la ')) return `Quelle est ${label} ?`;
  return `Quel est ${label} ?`;
}

/** resolution auto + signalé → l'AE confirme la valeur retenue. */
export function questionConfirmation(
  champ: string,
  label: string,
  valeurRetenue: unknown,
): Question {
  return {
    type: 'confirmation',
    champ,
    texte: `${capitaliser(label)} est-il bien « ${String(valeurRetenue)} » ?`,
  };
}

/** resolution impossible, ou champ absent → question ouverte. */
export function questionOuverte(champ: string, label: string): Question {
  return {
    type: 'ouverte',
    champ,
    texte: interroger(label),
  };
}
