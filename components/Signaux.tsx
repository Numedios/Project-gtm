import type { Signal } from '@/lib/schema/canonical';
import { formaterValeur, libelleChamp, libelleSource } from '@/lib/ui/format';

// Un signal du moteur = une divergence sur un champ VOLATILE : un changement,
// pas une erreur (A1). Il informe, il ne questionne jamais.
export function Signaux({ signaux }: { signaux: Signal[] }) {
  if (signaux.length === 0) {
    return <p className="empty-state">Aucun changement détecté.</p>;
  }

  return (
    <div>
      {signaux.map((s, i) => (
        <div key={i} className="signal-card">
          <div>{s.message}</div>
          <div className="signal-meta">
            {libelleChamp(s.champ)} : {formaterValeur(s.ancienne_valeur)} → {formaterValeur(s.nouvelle_valeur)} ·
            source {libelleSource(s.source_nouvelle)}
          </div>
        </div>
      ))}
    </div>
  );
}
