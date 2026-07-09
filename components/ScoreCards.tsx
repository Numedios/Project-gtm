import type { Completude, ScoreIcp } from '@/lib/schema/canonical';
import { formaterPourcentage, libelleChamp } from '@/lib/ui/format';

// Score ICP ≠ score de complétude (A4) : deux cartes distinctes, deux formes
// distinctes. Le LLM (B5) met la décomposition ICP en PROSE, il ne calcule
// ni n'ajuste jamais le chiffre — la prose arrive en prop, hors du contrat.

export function ScoreIcpCard({ score, prose }: { score: ScoreIcp; prose?: string | null }) {
  return (
    <div className="panel">
      <h2>Score ICP</h2>
      <div className="score-value">{Math.round(score.score)}/100</div>

      {score.decomposition.map((d) => (
        <div key={d.critere} className="decomposition-row">
          <div className="decomposition-head">
            <span title={d.detail}>
              {d.critere} <span style={{ opacity: 0.6 }}>×{d.poids}</span>
            </span>
            <span>{formaterPourcentage(d.score)}</span>
          </div>
          <div className="decomposition-bar-track">
            <div className="decomposition-bar-fill" style={{ width: `${Math.round(d.score * 100)}%` }} />
          </div>
          <div className="signal-meta">{d.detail}</div>
        </div>
      ))}

      {prose && <p className="prose">{prose}</p>}
    </div>
  );
}

export function CompletudeCard({ completude }: { completude: Completude }) {
  return (
    <div className="panel">
      <h2>Score de complétude</h2>
      <div className="score-value">{formaterPourcentage(completude.score)}</div>

      <div className="decomposition-row">
        <div className="decomposition-head">
          <span>couverture pondérée des champs</span>
          <span>{formaterPourcentage(completude.couverture_ponderee)}</span>
        </div>
        <div className="decomposition-bar-track">
          <div
            className="decomposition-bar-fill"
            style={{ width: `${Math.round(completude.couverture_ponderee * 100)}%` }}
          />
        </div>
      </div>

      <div className="decomposition-row">
        <div className="decomposition-head">
          <span>champs nécessaires au jugement ICP</span>
          <span>{formaterPourcentage(completude.champs_icp_presents)}</span>
        </div>
        <div className="decomposition-bar-track">
          <div
            className="decomposition-bar-fill"
            style={{ width: `${Math.round(completude.champs_icp_presents * 100)}%` }}
          />
        </div>
      </div>

      <div className="decomposition-row">
        <div className="decomposition-head">
          <span>interlocuteur identifié</span>
          <span className={`badge ${completude.interlocuteur_identifie ? 'badge-ok' : 'badge-danger'}`}>
            {completude.interlocuteur_identifie ? 'oui' : 'non'}
          </span>
        </div>
      </div>

      {completude.champs_manquants.length > 0 && (
        <p className="prose">
          Champs manquants : {completude.champs_manquants.map((c) => libelleChamp(c)).join(', ')}.
        </p>
      )}
    </div>
  );
}
