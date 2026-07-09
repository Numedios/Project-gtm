import type { StatutParSource, StatutSource } from '@/lib/schema/canonical';
import { libelleSource } from '@/lib/ui/format';

const CLASSE_PAR_STATUT: Record<StatutSource, string> = {
  ok: 'badge-ok',
  partiel: 'badge-warn',
  indisponible: 'badge-danger',
};

const LIBELLE_PAR_STATUT: Record<StatutSource, string> = {
  ok: 'OK',
  partiel: 'partiel',
  indisponible: 'indisponible',
};

// Si Sillage tombe, l'AE doit LIRE "Signaux d'achat : indisponible", pas
// constater une absence silencieuse. Dégradation propre, pas une rustine —
// docs/axe-B-surface.md §B1.
export function StatutParSourceBadges({ statuts }: { statuts: StatutParSource }) {
  return (
    <div className="source-status-row">
      {Object.entries(statuts).map(([source, statut]) => (
        <span key={source} className={`badge ${CLASSE_PAR_STATUT[statut]}`}>
          {libelleSource(source)} · {LIBELLE_PAR_STATUT[statut]}
        </span>
      ))}
    </div>
  );
}
