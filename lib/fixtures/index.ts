import { DossierQualification } from '@/lib/schema/canonical';
import dossierExempleRaw from './dossier-exemple.json';

// Parsé au chargement : toute dérive entre la fixture et le schéma canonique
// casse immédiatement, plutôt que de se découvrir au premier rendu de l'UI.
export const dossierExemple: DossierQualification = DossierQualification.parse(dossierExempleRaw);
