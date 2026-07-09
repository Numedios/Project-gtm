'use client';

import { useRef, useState, type FormEvent } from 'react';
import { DossierConsolide, type ProfilAE } from '@/lib/schema/canonical';
import type { TraceEvent } from '@/lib/pipeline/trace';
import { DossierView } from './DossierView';

// B1, côté saisie : le formulaire qui déclenche POST /api/qualify et rend le
// dossier consolidé. La réponse est re-parsée par le schéma A1 à la frontière
// (comme l'exemple statique l'était avant) : toute dérive entre le pipeline
// et le contrat casse ici, pas en silence. Les questions personnalisées (B6)
// remplacent les questions d'origine AVANT le parse — la bijection ayant déjà
// été validée par le moteur, le dossier reste conforme au contrat.
//
// Boucle FullEnrich (B3) : le premier passage rend le dossier sans attendre le
// waterfall ; c'est ICI que le sondage se rythme (jamais un sleep serveur,
// contrainte Vercel — voir app/api/fullenrich/status). Quand le lot est prêt,
// on re-qualifie avec l'enrichment_id : les coordonnées entrent dans la
// consolidation comme n'importe quelle source et le dossier affiché est
// remplacé entier — jamais de patch local d'un champ.

interface EtatResultat {
  dossier: DossierConsolide;
  proseIcp: string | null;
  trace: TraceEvent[];
}

type StatutFullenrich = 'en_cours' | 'integre' | 'echec' | null;

const INTERVALLE_SONDAGE_MS = 4000;
const MAX_SONDAGES = 20;

function parserResultat(json: {
  dossier: unknown;
  questions_personnalisees?: unknown;
  prose_icp?: string | null;
  trace?: TraceEvent[];
}): EtatResultat {
  const brut = json.dossier as { questions: unknown };
  const dossier = DossierConsolide.parse({
    ...(json.dossier as Record<string, unknown>),
    questions: json.questions_personnalisees ?? brut.questions,
  });
  return { dossier, proseIcp: json.prose_icp ?? null, trace: json.trace ?? [] };
}

export function QualifierLead() {
  const [email, setEmail] = useState('marie.durand@acme-corp.example');
  const [aeId, setAeId] = useState('ae-demo');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<EtatResultat | null>(null);
  const [statutFullenrich, setStatutFullenrich] = useState<StatutFullenrich>(null);
  const [feedbackTexte, setFeedbackTexte] = useState('');
  const [feedbackEnCours, setFeedbackEnCours] = useState(false);
  const [profilAE, setProfilAE] = useState<{ profil: ProfilAE; slotsModifies: string[] } | null>(null);

  // Chaque soumission invalide les sondages de la précédente.
  const runRef = useRef(0);

  async function appelerQualify(corps: Record<string, string>): Promise<{
    etat: EtatResultat;
    fullenrichId: string | null;
    reverseId: string | null;
  }> {
    const reponse = await fetch('/api/qualify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const json = await reponse.json();
    if (!reponse.ok) {
      throw new Error(typeof json?.error === 'string' ? json.error : `Requête rejetée (${reponse.status})`);
    }
    return {
      etat: parserResultat(json),
      fullenrichId: json.fullenrich_enrichment_id ?? null,
      reverseId: json.fullenrich_reverse_id ?? null,
    };
  }

  // Deux enrichissements FullEnrich en vol possibles : le waterfall de
  // coordonnées (`contacts`) et le reverse email lookup (`reverse`). On sonde
  // les deux et on ne re-qualifie qu'UNE fois, quand tout ce qui est en vol
  // est terminal — jamais de patch local d'un champ, toujours un dossier
  // entier re-consolidé.
  async function suivreEnrichissements(
    ids: { contacts: string | null; reverse: string | null },
    corpsInitial: Record<string, string>,
    run: number,
  ) {
    const enVol = new Map<'contacts' | 'reverse', string>();
    if (ids.contacts) enVol.set('contacts', ids.contacts);
    if (ids.reverse) enVol.set('reverse', ids.reverse);
    const termines: Partial<Record<'contacts' | 'reverse', string>> = {};

    for (let tentative = 0; tentative < MAX_SONDAGES && runRef.current === run && enVol.size > 0; tentative++) {
      for (const [kind, id] of [...enVol]) {
        try {
          const reponse = await fetch(
            `/api/fullenrich/status?enrichment_id=${encodeURIComponent(id)}&kind=${kind === 'reverse' ? 'reverse' : 'contacts'}`,
          );
          const json = await reponse.json();
          if (!reponse.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'statut FullEnrich illisible');

          if (json.status === 'FINISHED') {
            termines[kind] = id;
            enVol.delete(kind);
          } else if (json.status !== 'IN_PROGRESS' && json.status !== 'CREATED') {
            enVol.delete(kind); // FAILED, CANCELED, CREDITS_INSUFFICIENT… : terminal sans résultat
          }
        } catch {
          enVol.delete(kind);
        }
      }
      if (enVol.size > 0) await new Promise((r) => setTimeout(r, INTERVALLE_SONDAGE_MS));
    }
    if (runRef.current !== run) return;

    // Toujours en vol après MAX_SONDAGES : on arrête d'espérer, le dossier
    // affiché reste valable sans ces données.
    if (!termines.contacts && !termines.reverse) {
      setStatutFullenrich('echec');
      return;
    }

    try {
      const corps = { ...corpsInitial };
      if (termines.contacts) corps.fullenrich_enrichment_id = termines.contacts;
      if (termines.reverse) corps.fullenrich_reverse_id = termines.reverse;
      const { etat, fullenrichId, reverseId } = await appelerQualify(corps);
      if (runRef.current !== run) return;
      setResultat(etat);
      // La re-consolidation peut elle-même lancer un enrichissement : le
      // reverse découvre le domaine → le mapping apparaît → le waterfall de
      // coordonnées ne part QUE maintenant. On enchaîne le sondage avec le
      // corps enrichi ; ça s'arrête tout seul quand plus rien n'est lancé.
      if (fullenrichId || reverseId) {
        void suivreEnrichissements({ contacts: fullenrichId, reverse: reverseId }, corps, run);
        return;
      }
      setStatutFullenrich('integre');
    } catch {
      if (runRef.current === run) setStatutFullenrich('echec');
    }
  }

  // La mémoire AE (§9) : le texte part au classifieur déterministe borné de
  // /api/feedback, qui SÉLECTIONNE des valeurs d'énumération — le texte libre
  // n'est jamais persisté. L'effet se voit à la prochaine qualification (B6
  // lit le profil au moment de personnaliser).
  async function envoyerFeedback(e: FormEvent) {
    e.preventDefault();
    setFeedbackEnCours(true);
    try {
      const reponse = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ae_id: aeId.trim(), feedback: feedbackTexte.trim() }),
      });
      const json = await reponse.json();
      if (!reponse.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : `Feedback rejeté (${reponse.status})`);
      }
      setProfilAE({ profil: json.profil, slotsModifies: json.slots_modifies ?? [] });
      setFeedbackTexte('');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setFeedbackEnCours(false);
    }
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const run = ++runRef.current;
    setEnCours(true);
    setErreur(null);
    setStatutFullenrich(null);

    const corps: Record<string, string> = {
      email: email.trim(),
      ae_id: aeId.trim(),
    };

    try {
      const { etat, fullenrichId, reverseId } = await appelerQualify(corps);
      if (runRef.current !== run) return;
      setResultat(etat);
      if (fullenrichId || reverseId) {
        setStatutFullenrich('en_cours');
        void suivreEnrichissements({ contacts: fullenrichId, reverse: reverseId }, corps, run);
      }
    } catch (err) {
      if (runRef.current !== run) return;
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue');
      setResultat(null);
    } finally {
      if (runRef.current === run) setEnCours(false);
    }
  }

  return (
    <>
      <main style={{ paddingBottom: 0 }}>
        <div className="header-row">
          <div>
            <h1>Qualif AE</h1>
            <span className="badge badge-neutral">Pipeline de qualification</span>
          </div>
        </div>

        <form className="panel lead-form" onSubmit={soumettre}>
          <div className="lead-form-fields">
            <label>
              Email du lead
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marie.durand@acme-corp.example"
                required
              />
            </label>
            <label>
              AE
              <input value={aeId} onChange={(e) => setAeId(e.target.value)} required />
            </label>
          </div>
          <button type="submit" disabled={enCours || !email.trim() || !aeId.trim()}>
            {enCours ? 'Qualification…' : 'Qualifier le lead'}
          </button>
        </form>

        {erreur && (
          <div className="panel" style={{ borderColor: 'var(--danger)' }}>
            <span className="badge badge-danger">Erreur</span>
            <div style={{ marginTop: 8 }}>{erreur}</div>
          </div>
        )}

        {statutFullenrich && (
          <div className="panel" style={{ padding: '10px 20px' }}>
            {statutFullenrich === 'en_cours' && (
              <span className="badge badge-warn">Coordonnées : waterfall FullEnrich en cours…</span>
            )}
            {statutFullenrich === 'integre' && (
              <span className="badge badge-ok">Coordonnées FullEnrich intégrées au dossier</span>
            )}
            {statutFullenrich === 'echec' && (
              <span className="badge badge-danger">FullEnrich indisponible — dossier rendu sans les coordonnées</span>
            )}
          </div>
        )}
      </main>

      {resultat && (
        <>
          <DossierView dossier={resultat.dossier} proseIcp={resultat.proseIcp} />
          <main style={{ paddingTop: 0 }}>
            <form className="panel lead-form" onSubmit={envoyerFeedback}>
              <h2>Feedback sur le style des questions</h2>
              <div className="lead-form-fields" style={{ gridTemplateColumns: '1fr' }}>
                <label>
                  Ex. « tutoie-moi », « plus court », « évite le jargon »
                  <input
                    value={feedbackTexte}
                    onChange={(e) => setFeedbackTexte(e.target.value)}
                    placeholder="Comment préférez-vous que les questions soient formulées ?"
                  />
                </label>
              </div>
              <button type="submit" disabled={feedbackEnCours || !feedbackTexte.trim()}>
                {feedbackEnCours ? 'Envoi…' : 'Mémoriser ma préférence'}
              </button>
              {profilAE && (
                <div style={{ marginTop: 10 }}>
                  {profilAE.slotsModifies.length > 0 ? (
                    <span className="badge badge-ok">
                      Profil mis à jour ({profilAE.slotsModifies.join(', ')}) — relancez une qualification pour voir
                      les questions reformulées
                    </span>
                  ) : (
                    <span className="badge badge-neutral">Feedback reçu, aucun slot du profil ne correspond</span>
                  )}
                  <div className="question-meta" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                    {Object.entries(profilAE.profil).map(([slot, valeur]) => (
                      <span key={slot} className="badge badge-neutral">
                        {slot} : {valeur}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </form>

            <details className="panel provenance">
              <summary>Trace du run ({resultat.trace.length} évènements)</summary>
              <div className="observation-list">
                {resultat.trace.map((t, i) => (
                  <div key={i}>
                    <span className={t.type === 'erreur' ? 'badge badge-danger' : 'source-tag'}>{t.etape}</span>{' '}
                    {JSON.stringify(t.detail)}
                  </div>
                ))}
              </div>
            </details>
          </main>
        </>
      )}
    </>
  );
}
