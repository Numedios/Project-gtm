import type { Source, StatutSource } from '@/lib/schema/canonical';
import { libelleSource } from '@/lib/ui/format';

// Si Sillage tombe, l'AE doit LIRE « indisponible », pas constater une
// absence silencieuse. Dégradation propre, pas une rustine — §B1.
export function StatutParSourceBadges({ statuts }: { statuts: Partial<Record<Source, StatutSource>> }) {
  return (
    <div className="source-status-row">
      {Object.entries(statuts).map(([source, statut]) => (
        <span key={source} className={`badge ${statut === 'ok' ? 'badge-ok' : 'badge-danger'}`}>
          {libelleSource(source)} · {statut === 'ok' ? 'OK' : 'indisponible'}
        </span>
      ))}
    </div>
  );
}
