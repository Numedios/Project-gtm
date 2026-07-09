'use client';

import { useState, type FormEvent } from 'react';
import { DossierConsolide } from '@/lib/schema/canonical';
import type { TraceEvent } from '@/lib/pipeline/trace';
import { DossierView } from './DossierView';

// B1, côté saisie : le formulaire qui déclenche POST /api/qualify et rend le
// dossier consolidé. La réponse est re-parsée par le schéma A1 à la frontière
// (comme l'exemple statique l'était avant) : toute dérive entre le pipeline
// et le contrat casse ici, pas en silence. Les questions personnalisées (B6)
// remplacent les questions d'origine AVANT le parse — la bijection ayant déjà
// été validée par le moteur, le dossier reste conforme au contrat.

interface EtatResultat {
  dossier: DossierConsolide;
  proseIcp: string | null;
  trace: TraceEvent[];
}

export function QualifierLead() {
  const [domaine, setDomaine] = useState('acme-corp.example');
  const [email, setEmail] = useState('');
  const [aeId, setAeId] = useState('ae-demo');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<EtatResultat | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);

    try {
      const reponse = await fetch('/api/qualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domaine: domaine.trim(),
          ...(email.trim() ? { email_contact: email.trim() } : {}),
          ae_id: aeId.trim(),
        }),
      });

      const json = await reponse.json();
      if (!reponse.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : `Requête rejetée (${reponse.status})`);
      }

      const dossier = DossierConsolide.parse({
        ...json.dossier,
        questions: json.questions_personnalisees ?? json.dossier.questions,
      });
      setResultat({ dossier, proseIcp: json.prose_icp ?? null, trace: json.trace ?? [] });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue');
      setResultat(null);
    } finally {
      setEnCours(false);
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
              Domaine
              <input
                value={domaine}
                onChange={(e) => setDomaine(e.target.value)}
                placeholder="acme-corp.example"
                required
              />
            </label>
            <label>
              Email du contact (optionnel)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marie.durand@acme-corp.example"
              />
            </label>
            <label>
              AE
              <input value={aeId} onChange={(e) => setAeId(e.target.value)} required />
            </label>
          </div>
          <button type="submit" disabled={enCours || !domaine.trim() || !aeId.trim()}>
            {enCours ? 'Qualification…' : 'Qualifier le lead'}
          </button>
        </form>

        {erreur && (
          <div className="panel" style={{ borderColor: 'var(--danger)' }}>
            <span className="badge badge-danger">Erreur</span>
            <div style={{ marginTop: 8 }}>{erreur}</div>
          </div>
        )}
      </main>

      {resultat && (
        <>
          <DossierView dossier={resultat.dossier} proseIcp={resultat.proseIcp} />
          <main style={{ paddingTop: 0 }}>
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
