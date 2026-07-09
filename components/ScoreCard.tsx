import type { Score } from '@/lib/schema/canonical';
import { formaterPourcentage } from '@/lib/ui/format';

// Score ICP ≠ score de complétude (A4) : le LLM (B5) met la décomposition
// en PROSE, il ne calcule ni n'ajuste jamais le chiffre.
export function ScoreCard({ titre, score }: { titre: string; score: Score }) {
  return (
    <div className="panel">
      <h2>{titre}</h2>
      <div className="score-value">{formaterPourcentage(score.valeur)}</div>

      {score.decomposition.map((d) => (
        <div key={d.critere} className="decomposition-row">
          <div className="decomposition-head">
            <span>{d.critere}</span>
            <span>{formaterPourcentage(d.valeur)}</span>
          </div>
          <div className="decomposition-bar-track">
            <div className="decomposition-bar-fill" style={{ width: `${Math.round(d.valeur * 100)}%` }} />
          </div>
        </div>
      ))}

      {score.prose && <p className="prose">{score.prose}</p>}
    </div>
  );
}
