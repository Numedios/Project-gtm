import type { ChampConsolide } from '@/lib/schema/canonical';
import { formaterDate, formaterPourcentage, formaterValeur, libelleChamp, libelleSource } from '@/lib/ui/format';

// La provenance visible par champ (source, date, confiance) EST l'argument
// d'auditabilité du produit — pas un détail d'affichage. Voir
// docs/axe-B-surface.md §B1.
export function ChampConsolideRow({ champ, valeur }: { champ: string; valeur: ChampConsolide }) {
  return (
    <div className="champ-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span className="champ-label">{libelleChamp(champ)}</span>
        <span className="champ-valeur">
          {formaterValeur(valeur.valeur_retenue)}{' '}
          <span className="badge badge-neutral" title="confiance">
            {formaterPourcentage(valeur.confiance)}
          </span>
        </span>
      </div>
      {valeur.observations.length > 0 && (
        <details className="provenance">
          <summary>
            {valeur.observations.length} source{valeur.observations.length > 1 ? 's' : ''} ·{' '}
            {valeur.volatilite === 'volatile' ? 'volatile' : 'stable'}
          </summary>
          <div className="observation-list">
            {valeur.observations.map((obs, i) => (
              <div key={i}>
                <span className="source-tag">{libelleSource(obs.source)}</span> — {formaterValeur(obs.valeur)} ·{' '}
                {formaterDate(obs.date_donnee)} · confiance {formaterPourcentage(obs.confiance_source)}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
