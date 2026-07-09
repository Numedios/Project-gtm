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
//
// Hiérarchie d'affichage : scores et questions toujours visibles (le cœur du
// produit), groupes de champs en toggles — Entreprise et Interlocuteur
// ouverts, les groupes secondaires repliés. Chaque groupe est un tableau,
// la provenance se déplie par ligne (ChampConsolideRow).

// Groupes d'affichage, dans l'ordre du schéma A1 (lib/config/champs.ts).
const GROUPES: { titre: string; champs: NomChamp[]; ouvert: boolean }[] = [
  {
    titre: 'Entreprise',
    ouvert: true,
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
    ouvert: true,
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
    ouvert: false,
    champs: ['signaux_achat'],
  },
  {
    titre: 'CRM',
    ouvert: false,
    champs: ['historique_deals', 'historique_relationnel', 'notes_crm', 'stade_pipeline'],
  },
];

const ENTETES_CHAMPS = (
  <thead>
    <tr>
      <th>Champ</th>
      <th>Valeur retenue</th>
      <th className="cell-num">Confiance</th>
      <th>Statut</th>
      <th className="cell-num">Provenance</th>
    </tr>
  </thead>
);

// Historique CRM : objets libres du CRM (z.unknown() dans le contrat) —
// rendu générique clé/valeur, sans présumer de leur forme.
function TableauObjetsLibres({ objets }: { objets: unknown[] }) {
  return (
    <table className="tableau">
      <tbody>
        {objets.map((objet, i) => (
          <tr key={i}>
            <td className="cell-label">#{i + 1}</td>
            <td>
              {objet && typeof objet === 'object' ? (
                Object.entries(objet as Record<string, unknown>).map(([cle, val]) => (
                  <div key={cle}>
                    <span className="cell-label">{cle} : </span>
                    <span className="cell-valeur">{formaterValeur(val)}</span>
                  </div>
                ))
              ) : (
                <span className="cell-valeur">{formaterValeur(objet)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DossierView({
  dossier,
  proseIcp,
  stylePersonnalise,
}: {
  dossier: DossierConsolide;
  proseIcp?: string | null;
  // Les questions affichées sont-elles passées par B6 (mémoire AE) ?
  // L'info vient de l'appelant : le dossier lui-même ne distingue pas.
  stylePersonnalise?: boolean;
}) {
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

  const aHistorique = dossier.historique.deals.length > 0 || dossier.historique.relationnel.length > 0;

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
        <h2>
          Questions de qualification ({dossier.questions.length}){' '}
          {stylePersonnalise && <span className="badge badge-ok">style AE appliqué</span>}
        </h2>
        <Questions questions={dossier.questions} />
      </div>

      <details className="panel panel-toggle" open={dossier.signaux.length > 0}>
        <summary>
          Changements détectés
          <span className={`badge ${dossier.signaux.length > 0 ? 'badge-warn' : 'badge-neutral'}`}>
            {dossier.signaux.length}
          </span>
        </summary>
        <div className="panel-toggle-corps table-scroll">
          <Signaux signaux={dossier.signaux} />
        </div>
      </details>

      {GROUPES.map((groupe) => {
        const champsVisibles = groupe.champs.filter(visible);
        if (champsVisibles.length === 0) return null;
        const aConfirmer = champsVisibles.filter((nom) => dossier.champs[nom]!.a_signaler_AE).length;
        return (
          <details key={groupe.titre} className="panel panel-toggle" open={groupe.ouvert}>
            <summary>
              {groupe.titre}
              <span className="badge badge-neutral">{champsVisibles.length}</span>
              {aConfirmer > 0 && <span className="badge badge-warn">{aConfirmer} à confirmer</span>}
            </summary>
            <div className="panel-toggle-corps table-scroll">
              <table className="tableau">
                {ENTETES_CHAMPS}
                <tbody>
                  {champsVisibles.map((nom) => (
                    <ChampConsolideRow key={nom} valeur={dossier.champs[nom]!} />
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}

      {aHistorique && (
        <details className="panel panel-toggle">
          <summary>
            Historique CRM (mono-source)
            <span className="badge badge-neutral">
              {dossier.historique.deals.length + dossier.historique.relationnel.length}
            </span>
          </summary>
          <div className="panel-toggle-corps">
            {dossier.historique.deals.length > 0 && (
              <>
                <h2 style={{ marginTop: 8 }}>Deals</h2>
                <TableauObjetsLibres objets={dossier.historique.deals} />
              </>
            )}
            {dossier.historique.relationnel.length > 0 && (
              <>
                <h2 style={{ marginTop: 12 }}>Relationnel</h2>
                <TableauObjetsLibres objets={dossier.historique.relationnel} />
              </>
            )}
          </div>
        </details>
      )}
    </main>
  );
}
