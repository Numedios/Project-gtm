import type { Signal } from '@/lib/schema/canonical';
import { formaterValeur, libelleChamp, libelleSource } from '@/lib/ui/format';

// Un signal du moteur = une divergence sur un champ VOLATILE : un changement,
// pas une erreur (A1). Il informe, il ne questionne jamais.
export function Signaux({ signaux }: { signaux: Signal[] }) {
  if (signaux.length === 0) {
    return <p className="empty-state">Aucun changement détecté.</p>;
  }

  return (
    <table className="tableau">
      <thead>
        <tr>
          <th>Changement</th>
          <th>Champ</th>
          <th>Avant</th>
          <th>Après</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {signaux.map((s, i) => (
          <tr key={i}>
            <td className="cell-valeur">{s.message}</td>
            <td className="cell-label">{libelleChamp(s.champ)}</td>
            <td>{formaterValeur(s.ancienne_valeur)}</td>
            <td className="cell-valeur">{formaterValeur(s.nouvelle_valeur)}</td>
            <td>
              <span className="badge badge-neutral">{libelleSource(s.source_nouvelle)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
