/**
 * Invariant du poste 2, vérifié ici sur des données : la personnalisation des
 * questions (B5) est une BIJECTION sur la liste — même cardinalité, même
 * ordre, même champ, même type ; seul le texte de chaque item change.
 *
 * Réordonner, c'est hiérarchiser : l'ordre des questions est figé en amont.
 * Le poste 2 DOIT passer sa sortie par ce validateur avant de l'afficher.
 */
import type { Question } from '@/lib/schema/canonical';

export function estPersonnalisationValide(
  avant: readonly Question[],
  apres: readonly Question[],
): boolean {
  if (avant.length !== apres.length) return false;
  return avant.every((question, i) => {
    const personnalisee = apres[i]!;
    return (
      personnalisee.champ === question.champ &&
      personnalisee.type === question.type
    );
  });
}
