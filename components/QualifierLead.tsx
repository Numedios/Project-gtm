'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  stylePersonnalise: boolean;
  trace: TraceEvent[];
}

type StatutFullenrich = 'en_cours' | 'integre' | 'echec' | null;

const INTERVALLE_SONDAGE_MS = 4000;
const MAX_SONDAGES = 20;

// Étapes INDICATIVES pendant l'attente : le pipeline ne streame pas sa
// progression, on rythme l'affichage côté client — la trace fait foi après.
const ETAPES_PIPELINE = [
  'Résolution du domaine (reverse lookup si besoin)',
  'Collecte Sillage — mapping, profils, signaux',
  'Réconciliation des identités',
  'Consolidation et arbitrage (moteur)',
  'Scores ICP et complétude, mise en prose',
  'Personnalisation des questions (profil AE)',
];
const CADENCE_ETAPES_MS = 2000;

// Emails d'exemple (le domaine est dérivé de l'email par le pipeline) :
// lesquels répondent dépend du mode — mock ou clés réelles.
const EXEMPLES: { email: string; note: string }[] = [
  { email: 'marie.durand@acme-corp.example', note: 'scénario riche (mock Sillage)' },
  { email: 'contact@acme.fr', note: 'connu du CRM → mise à jour' },
  { email: 'julien@spendesk.com', note: 'données Sillage réelles' },
];

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
  return {
    dossier,
    proseIcp: json.prose_icp ?? null,
    stylePersonnalise: json.questions_personnalisees != null,
    trace: json.trace ?? [],
  };
}

export function QualifierLead() {
  const [email, setEmail] = useState('marie.durand@acme-corp.example');
  const [aeId, setAeId] = useState('ae-demo');
  const [enCours, setEnCours] = useState(false);
  const [etapeIdx, setEtapeIdx] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<EtatResultat | null>(null);
  const [statutFullenrich, setStatutFullenrich] = useState<StatutFullenrich>(null);
  const [feedbackTexte, setFeedbackTexte] = useState('');
  const [feedbackEnCours, setFeedbackEnCours] = useState(false);
  const [profilAE, setProfilAE] = useState<{ profil: ProfilAE; slotsModifies: string[] } | null>(null);

  // Chaque soumission invalide les sondages de la précédente.
  const runRef = useRef(0);

  // Avance les étapes indicatives tant que la qualification tourne.
  useEffect(() => {
    if (!enCours) return;
    setEtapeIdx(0);
    const intervalle = setInterval(
      () => setEtapeIdx((i) => Math.min(i + 1, ETAPES_PIPELINE.length - 1)),
      CADENCE_ETAPES_MS,
    );
    return () => clearInterval(intervalle);
  }, [enCours]);

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

  async function lancerQualification(emailCible: string) {
    const run = ++runRef.current;
    setEnCours(true);
    setErreur(null);
    setStatutFullenrich(null);

    const corps: Record<string, string> = {
      email: emailCible.trim(),
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

  function soumettre(e: FormEvent) {
    e.preventDefault();
    void lancerQualification(email);
  }

  function qualifierExemple(emailExemple: string) {
    setEmail(emailExemple);
    void lancerQualification(emailExemple);
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

        {enCours && (
          <div className="panel">
            <h2>Qualification en cours</h2>
            <div className="etapes-chargement">
              {ETAPES_PIPELINE.map((etape, i) => (
                <div
                  key={etape}
                  className={`etape-chargement${i < etapeIdx ? ' faite' : ''}${i === etapeIdx ? ' active' : ''}`}
                >
                  <span className="puce" />
                  {etape}
                </div>
              ))}
            </div>
          </div>
        )}

        {!enCours && !resultat && !erreur && (
          <div className="panel">
            <h2>Comment ça marche</h2>
            <p style={{ margin: '0 0 4px' }}>
              Trois sources (Sillage, FullEnrich, CRM) sont collectées puis <strong>réconciliées</strong> : chaque
              conflit non tranché devient une question de qualification, chaque champ garde sa provenance. Le
              dossier ressort scoré (ICP, complétude) et les questions sont reformulées au style de l’AE.
            </p>
            <div className="chips-exemples">
              {EXEMPLES.map((ex) => (
                <button key={ex.email} type="button" className="chip" onClick={() => qualifierExemple(ex.email)}>
                  {ex.email}
                  <span className="chip-note">{ex.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
        <div className={enCours ? 'resultat-attenue' : ''}>
          <DossierView
            dossier={resultat.dossier}
            proseIcp={resultat.proseIcp}
            stylePersonnalise={resultat.stylePersonnalise}
          />
          <main style={{ paddingTop: 0 }}>
            <details className="panel panel-toggle" open={!!profilAE}>
              <summary>
                Feedback sur le style des questions
                {profilAE && profilAE.slotsModifies.length > 0 && (
                  <span className="badge badge-ok">profil mis à jour</span>
                )}
              </summary>
              <div className="panel-toggle-corps">
                <form className="lead-form" onSubmit={envoyerFeedback}>
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
                          Profil mis à jour ({profilAE.slotsModifies.join(', ')}) — relancez une qualification pour
                          voir les questions reformulées
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
              </div>
            </details>

            <details className="panel panel-toggle">
              <summary>
                Trace du run
                <span className="badge badge-neutral">{resultat.trace.length} évènements</span>
                {resultat.trace.some((t) => t.type === 'erreur') && (
                  <span className="badge badge-danger">
                    {resultat.trace.filter((t) => t.type === 'erreur').length} erreur(s)
                  </span>
                )}
              </summary>
              <div className="panel-toggle-corps table-scroll">
                {resultat.trace.map((t, i) => (
                  <div key={i} className="trace-ligne">
                    <span className="trace-heure">{t.horodatage.slice(11, 19)}</span>
                    <span className={t.type === 'erreur' ? 'badge badge-danger' : 'source-tag'}>{t.etape}</span>{' '}
                    {JSON.stringify(t.detail)}
                  </div>
                ))}
              </div>
            </details>
          </main>
        </div>
      )}
    </>
  );
}
