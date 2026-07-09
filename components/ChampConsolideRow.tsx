'use client';

import { useState } from 'react';
import type { ChampConsolide } from '@/lib/schema/canonical';
import { formaterDate, formaterPourcentage, formaterValeur, libelleChamp, libelleSource } from '@/lib/ui/format';

// La provenance visible par champ (source, date, confiance) EST l'argument
// d'auditabilité du produit — pas un détail d'affichage. Voir
// docs/axe-B-surface.md §B1. `resolution` et `a_signaler_AE` viennent du
// moteur : l'UI les montre, elle ne les recalcule jamais.
//
// Rendu en lignes de tableau (le <table> parent vit dans DossierView) :
// une ligne par champ, cliquable quand il y a des observations — la ligne
// de provenance se déplie dessous, colSpan sur toute la largeur.
export function ChampConsolideRow({ valeur }: { valeur: ChampConsolide }) {
  const [ouvert, setOuvert] = useState(false);
  const enEchec = valeur.resolution !== 'auto';
  const aProvenance = valeur.observations.length > 0;

  return (
    <>
      <tr
        className={`champ-tr${aProvenance ? ' cliquable' : ''}`}
        onClick={aProvenance ? () => setOuvert((o) => !o) : undefined}
      >
        <td className="cell-label">{libelleChamp(valeur.champ)}</td>
        <td className="cell-valeur">{formaterValeur(valeur.valeur_retenue)}</td>
        <td className="cell-num">{!enEchec ? formaterPourcentage(valeur.confiance) : '—'}</td>
        <td>
          {valeur.resolution === 'absente' && <span className="badge badge-warn">absent</span>}
          {valeur.resolution === 'impossible' && <span className="badge badge-danger">non tranché</span>}
          {valeur.a_signaler_AE && valeur.resolution === 'auto' && (
            <span className="badge badge-warn">à confirmer</span>
          )}
          {!valeur.a_signaler_AE && valeur.resolution === 'auto' && <span className="badge badge-ok">résolu</span>}
        </td>
        <td className="cell-num">
          {aProvenance && (
            <span className="chevron-sources">
              {ouvert ? '⌃' : '⌵'} {valeur.observations.length} source{valeur.observations.length > 1 ? 's' : ''} ·{' '}
              {valeur.volatilite === 'volatile' ? 'volatile' : 'stable'}
            </span>
          )}
        </td>
      </tr>
      {aProvenance && ouvert && (
        <tr className="provenance-tr">
          <td colSpan={5}>
            <div className="observation-list">
              {valeur.observations.map((obs, i) => (
                <div key={i}>
                  <span className="source-tag">{libelleSource(obs.source)}</span> — {formaterValeur(obs.valeur)} ·{' '}
                  {formaterDate(obs.date_donnee)} · confiance {formaterPourcentage(obs.confiance_source)}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
