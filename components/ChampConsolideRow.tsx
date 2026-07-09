import type { ChampConsolide } from '@/lib/schema/canonical';
import { formaterDate, formaterPourcentage, formaterValeur, libelleChamp, libelleSource } from '@/lib/ui/format';

// La provenance visible par champ (source, date, confiance) EST l'argument
// d'auditabilité du produit — pas un détail d'affichage. Voir
// docs/axe-B-surface.md §B1. `resolution` et `a_signaler_AE` viennent du
// moteur : l'UI les montre, elle ne les recalcule jamais.
export function ChampConsolideRow({ valeur }: { valeur: ChampConsolide }) {
  const enEchec = valeur.resolution !== 'auto';

  return (
    <div className="champ-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span className="champ-label">{libelleChamp(valeur.champ)}</span>
        <span className="champ-valeur">
          {formaterValeur(valeur.valeur_retenue)}{' '}
          {!enEchec && (
            <span className="badge badge-neutral" title="confiance">
              {formaterPourcentage(valeur.confiance)}
            </span>
          )}
          {valeur.resolution === 'absente' && <span className="badge badge-warn">absent</span>}
          {valeur.resolution === 'impossible' && <span className="badge badge-danger">non tranché</span>}
          {valeur.a_signaler_AE && valeur.resolution === 'auto' && (
            <span className="badge badge-warn">à confirmer</span>
          )}
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
