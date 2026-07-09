import type { Signal } from '@/lib/schema/canonical';
import { formaterDate, libelleSource } from '@/lib/ui/format';

const LIBELLE_TYPE: Record<Signal['type'], string> = {
  recrutement: 'Recrutement',
  nouveau_produit: 'Nouveau produit',
  changement_decisionnaire: 'Changement de décisionnaire',
  ex_client: 'Ex-client',
  visites_site: 'Visites du site',
};

// Un signal n'est JAMAIS une question en soi — voir A1 (docs/axe-A-moteur.md) :
// une divergence sur un champ volatile est un changement, pas une erreur.
export function Signaux({ signaux }: { signaux: Signal[] }) {
  if (signaux.length === 0) {
    return <p className="empty-state">Aucun signal d'achat détecté.</p>;
  }

  return (
    <div>
      {signaux.map((s) => (
        <div key={s.id} className="signal-card">
          <div>{s.description}</div>
          <div className="signal-meta">
            {LIBELLE_TYPE[s.type]} · {libelleSource(s.source)} · {formaterDate(s.date)}
          </div>
        </div>
      ))}
    </div>
  );
}
