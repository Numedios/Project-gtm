import type { DossierQualification } from '@/lib/schema/canonical';
import { ChampConsolideRow } from './ChampConsolideRow';
import { DecideurCard } from './DecideurCard';
import { Questions } from './Questions';
import { Signaux } from './Signaux';
import { ScoreCard } from './ScoreCard';
import { StatutParSourceBadges } from './StatutParSourceBadges';

const CHAMPS_ENTREPRISE = [
  'nom',
  'pays_siege',
  'secteur',
  'effectif',
  'techno',
  'competiteurs',
  'site_web',
  'description',
] as const;

// L'écran AE : le dossier consolidé, les conflits devenus questions, les
// signaux, les deux scores, statut_par_source — voir docs/axe-B-surface.md §B1.
export function DossierView({ dossier }: { dossier: DossierQualification }) {
  return (
    <main>
      <div className="header-row">
        <div>
          <h1>{String(dossier.entreprise.nom.valeur_retenue)}</h1>
          <span className={`badge ${dossier.statut === 'NOUVEAU_LEAD' ? 'badge-ok' : 'badge-warn'}`}>
            {dossier.statut === 'NOUVEAU_LEAD' ? 'Nouveau lead' : 'Mise à jour'}
          </span>
        </div>
        <StatutParSourceBadges statuts={dossier.statut_par_source} />
      </div>

      <div className="grid-2">
        <ScoreCard titre="Score ICP" score={dossier.score_icp} />
        <ScoreCard titre="Score de complétude" score={dossier.score_completude} />
      </div>

      <div className="panel">
        <h2>Entreprise</h2>
        {CHAMPS_ENTREPRISE.map((champ) => (
          <ChampConsolideRow key={champ} champ={champ} valeur={dossier.entreprise[champ]} />
        ))}
      </div>

      <div className="panel">
        <h2>Questions de qualification ({dossier.questions.length})</h2>
        <Questions questions={dossier.questions} />
      </div>

      <div className="panel">
        <h2>Signaux d'achat</h2>
        <Signaux signaux={dossier.signaux} />
      </div>

      <div className="panel">
        <h2>Décideurs</h2>
        {dossier.decideurs.length === 0 ? (
          <p className="empty-state">Aucun décideur identifié.</p>
        ) : (
          <div className="grid-2">
            {dossier.decideurs.map((d) => (
              <DecideurCard key={d.id} decideur={d} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
