import { dossierExemple } from '@/lib/fixtures';
import { DossierView } from '@/components/DossierView';

// B1 : contre l'exemple JSON dès la première minute, sans attendre l'axe A
// ni aucune clé API — voir docs/axe-B-surface.md.
export default function Page() {
  return <DossierView dossier={dossierExemple} />;
}
