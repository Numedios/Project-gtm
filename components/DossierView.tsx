import type { DossierConsolide } from '@/lib/schema/canonical';
import { CHAMPS, type NomChamp } from '@/lib/config/champs';
import { ChampConsolideRow } from './ChampConsolideRow';
import { Questions } from './Questions';
import { Signaux } from './Signaux';
import { CompletudeCard, ScoreIcpCard } from './ScoreCards';
import { StatutParSourceBadges } from './StatutParSourceBadges';
import { formaterValeur } from '@/lib/ui/format';

// L'écran AE (B1) : le dossier consolidé du moteur, les conflits devenus
// questions, les signaux, les deux scores, statut_sources — §B1.

// Groupes d'affichage, dans l'ordre du schéma A1 (lib/config/champs.ts).
const GROUPES: { titre: string; champs: NomChamp[] }[] = [
  {
    titre: 'Entreprise',
    champs: [
      'nom_legal',
      'domaine',
      'pays_siege',
      'ville_siege',
      'secteur',
      'effectif',
      'ca_annuel',
      'site_web',
      'linkedin_entreprise',
      'annee_creation',
      'description',
      'techno_stack',
    ],
  },
  {
    titre: 'Interlocuteur',
    champs: [
      'prenom',
      'nom',
      'titre',
      'seniorite',
      'email',
      'telephone',
      'linkedin_contact',
      'localisation_contact',
      'date_prise_poste',
    ],
  },
  {
    titre: 'Signaux d’achat (Sillage)',
    champs: ['signaux_achat'],
  },
  {
    titre: 'CRM',
    champs: ['historique_deals', 'historique_relationnel', 'notes_crm', 'stade_pipeline'],
  },
];

export function DossierView({ dossier, proseIcp }: { dossier: DossierConsolide; proseIcp?: string | null }) {
  const nomAffiche = dossier.champs.nom_legal?.valeur_retenue ?? dossier.champs.domaine?.valeur_retenue ?? 'Lead';

  // Un champ absent de toutes les sources ET optionnel n'apporte rien à
  // l'écran — on ne montre l'absence que si elle est signalée (question) ou
  // si le champ est essentiel/important.
  const visible = (nom: NomChamp) => {
    const champ = dossier.champs[nom];
    if (!champ) return false;
    if (champ.resolution !== 'absente') return true;
    return champ.a_signaler_AE || CHAMPS[nom].importance !== 'optionnel';
  };

  return (
    <main>
      <div className="header-row">
        <div>
          <h1>{formaterValeur(nomAffiche)}</h1>
          <span className={`badge ${dossier.branche === 'NOUVEAU_LEAD' ? 'badge-ok' : 'badge-warn'}`}>
            {dossier.branche === 'NOUVEAU_LEAD' ? 'Nouveau lead' : 'Mise à jour'}
          </span>
        </div>
        <StatutParSourceBadges statuts={dossier.statut_sources} />
      </div>

      <div className="grid-2">
        <ScoreIcpCard score={dossier.score_icp} prose={proseIcp} />
        <CompletudeCard completude={dossier.completude} />
      </div>

      <div className="panel">
        <h2>Questions de qualification ({dossier.questions.length})</h2>
        <Questions questions={dossier.questions} />
      </div>

      <div className="panel">
        <h2>Changements détectés</h2>
        <Signaux signaux={dossier.signaux} />
      </div>

      {GROUPES.map((groupe) => {
        const champsVisibles = groupe.champs.filter(visible);
        if (champsVisibles.length === 0) return null;
        return (
          <div key={groupe.titre} className="panel">
            <h2>{groupe.titre}</h2>
            {champsVisibles.map((nom) => (
              <ChampConsolideRow key={nom} valeur={dossier.champs[nom]!} />
            ))}
          </div>
        );
      })}

      {(dossier.historique.deals.length > 0 || dossier.historique.relationnel.length > 0) && (
        <div className="panel">
          <h2>Historique CRM (mono-source)</h2>
          {dossier.historique.deals.map((d, i) => (
            <div key={`deal_${i}`} className="observation-list" style={{ marginTop: 6 }}>
              {JSON.stringify(d)}
            </div>
          ))}
          {dossier.historique.relationnel.map((d, i) => (
            <div key={`rel_${i}`} className="observation-list" style={{ marginTop: 6 }}>
              {JSON.stringify(d)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
