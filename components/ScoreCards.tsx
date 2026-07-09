import type { Completude, ScoreIcp } from '@/lib/schema/canonical';
import { couleurScore, formaterPourcentage, libelleChamp } from '@/lib/ui/format';

// Score ICP ≠ score de complétude (A4) : deux cartes distinctes, deux formes
// distinctes. Le LLM (B5) met la décomposition ICP en PROSE, il ne calcule
// ni n'ajuste jamais le chiffre — la prose arrive en prop, hors du contrat.

export function ScoreIcpCard({ score, prose }: { score: ScoreIcp; prose?: string | null }) {
  return (
    <div className="panel">
      <h2>Score ICP</h2>
      <div className="score-value" style={{ color: couleurScore(score.score / 100) }}>
        {Math.round(score.score)}/100
      </div>

      <table className="tableau" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Critère</th>
            <th className="cell-num">Poids</th>
            <th className="cell-num">Score</th>
          </tr>
        </thead>
        <tbody>
          {score.decomposition.map((d) => (
            <tr key={d.critere}>
              <td className="cell-label" title={d.detail}>
                {d.critere}
              </td>
              <td className="cell-num">×{d.poids}</td>
              <td className="cell-num">
                {formaterPourcentage(d.score)}
                <span className="mini-barre">
                  <div style={{ width: `${Math.round(d.score * 100)}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {prose && <p className="prose">{prose}</p>}
    </div>
  );
}

export function CompletudeCard({ completude }: { completude: Completude }) {
  return (
    <div className="panel">
      <h2>Score de complétude</h2>
      <div className="score-value" style={{ color: couleurScore(completude.score) }}>
        {formaterPourcentage(completude.score)}
      </div>

      <table className="tableau" style={{ marginTop: 8 }}>
        <tbody>
          <tr>
            <td className="cell-label">Couverture pondérée des champs</td>
            <td className="cell-num">
              {formaterPourcentage(completude.couverture_ponderee)}
              <span className="mini-barre">
                <div style={{ width: `${Math.round(completude.couverture_ponderee * 100)}%` }} />
              </span>
            </td>
          </tr>
          <tr>
            <td className="cell-label">Champs nécessaires au jugement ICP</td>
            <td className="cell-num">
              {formaterPourcentage(completude.champs_icp_presents)}
              <span className="mini-barre">
                <div style={{ width: `${Math.round(completude.champs_icp_presents * 100)}%` }} />
              </span>
            </td>
          </tr>
          <tr>
            <td className="cell-label">Interlocuteur identifié</td>
            <td className="cell-num">
              <span className={`badge ${completude.interlocuteur_identifie ? 'badge-ok' : 'badge-danger'}`}>
                {completude.interlocuteur_identifie ? 'oui' : 'non'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {completude.champs_manquants.length > 0 && (
        <details className="provenance" style={{ marginTop: 10 }}>
          <summary>{completude.champs_manquants.length} champs manquants</summary>
          <div className="observation-list">
            {completude.champs_manquants.map((c) => (
              <div key={c}>{libelleChamp(c)}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
