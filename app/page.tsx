import { DossierConsolide } from '@/lib/schema/canonical';
import { DossierView } from '@/components/DossierView';
import dossierExempleRaw from '@/exemple/dossier-consolide.exemple.json';

// B1 : contre l'exemple JSON du contrat partagé (exemple/), validé par
// tests/contrat.test.ts côté moteur — et re-parsé ici : toute dérive entre
// l'exemple et le schéma casse au premier rendu, pas en silence.
const dossierExemple = DossierConsolide.parse(dossierExempleRaw);

export default function Page() {
  return <DossierView dossier={dossierExemple} />;
}
