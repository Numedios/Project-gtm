import { consoliderDossier } from '@/lib/moteur/consolidation';
import { CRM_MOCK } from '@/lib/crm/mock';
import { getSillageClient } from '@/lib/sillage';
import {
  fusionnerObservations,
  normaliserEntreprise,
  normaliserProfilMapping,
  normaliserSignauxAchat,
  type ObservationsParChamp,
} from '@/lib/sillage/normalize';
import { construireContactsAEnrichir } from '@/lib/fullenrich/waterfall';
import { getFullEnrichClient } from '@/lib/fullenrich';
import { blocageDeterministe, resoudrePaireAmbigue, type CandidatIdentite } from '@/lib/llm/reconciliation';
import { mettreEnProseDecompositionIcp } from '@/lib/llm/scoring-prose';
import { personnaliserQuestions } from '@/lib/llm/personnalisation';
import { getStoreProfilAE } from '@/lib/memoire-ae/store';
import type { DossierConsolide, Source, StatutSource } from '@/lib/schema/canonical';
import type { TraceEvent } from './trace';

// B7 — le pipeline. Un DAG statique : Promise.all des collecteurs, puis
// consoliderDossier (le moteur, axe A : branchement + arbitrage + scores),
// puis mise en prose (B5) et personnalisation (B6). Rien à planifier, donc
// pas d'agent orchestrateur — docs/axe-B-surface.md §B7.

export interface EntreeQualification {
  domaine: string;
  emailContact?: string | undefined;
  aeId: string;
}

export type { TraceEvent } from './trace';

export interface ResultatQualification {
  dossier: DossierConsolide;
  prose_icp: string | null;
  questions_personnalisees: DossierConsolide['questions'] | null;
  fullenrich_enrichment_id: string | null;
  trace: TraceEvent[];
}

export async function qualifierLead(entree: EntreeQualification): Promise<ResultatQualification> {
  const trace: TraceEvent[] = [];
  const statutSources: Record<Source, StatutSource> = { sillage: 'ok', fullenrich: 'ok', crm: 'ok' };

  const pousserTrace = (etape: string, type: TraceEvent['type'], detail: unknown) => {
    trace.push({ horodatage: new Date().toISOString(), etape, type, detail });
  };

  const marquerIndisponible = (source: Source, etape: string, err: unknown) => {
    pousserTrace(etape, 'erreur', { message: err instanceof Error ? err.message : String(err) });
    statutSources[source] = 'indisponible';
  };

  // --- Collecte Sillage (le CRM est local : consoliderDossier le lit lui-même) ---
  const sillage = getSillageClient();

  const mappingSummary = await sillage.findCompanyMappingByDomain(entree.domaine).catch((err) => {
    marquerIndisponible('sillage', 'collecte.sillage', err);
    return null;
  });
  pousserTrace('collecte.sillage', 'appel_outil', {
    outil: 'find_company_mapping_by_domain',
    trouve: !!mappingSummary,
  });

  const [mappingDetail, company, signauxBruts] = mappingSummary
    ? await Promise.all([
        sillage.getCompanyMapping(mappingSummary.id).catch((err) => {
          marquerIndisponible('sillage', 'collecte.sillage.mapping_detail', err);
          return null;
        }),
        sillage.getCompany(mappingSummary.company.id).catch((err) => {
          marquerIndisponible('sillage', 'collecte.sillage.company', err);
          return null;
        }),
        sillage.listRecentSignals({ companyId: mappingSummary.company.id }).catch((err) => {
          marquerIndisponible('sillage', 'collecte.sillage.signaux', err);
          return [];
        }),
      ])
    : [null, null, []];

  // --- Résolution d'identités sur les profils du mapping (B4, étage 1 + 2) ---
  // Le schéma A1 modélise UN interlocuteur par dossier : on déduplique les
  // profils, puis on retient le principal (celui qui matche l'email du lead,
  // sinon le premier).
  const profilsMapping = mappingDetail?.profiles ?? [];
  const candidats: CandidatIdentite[] = profilsMapping.map((p, i) => ({
    id: `sillage:${i}`,
    source: 'sillage',
    nom: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
    email: p.email,
    domaine: mappingSummary?.company.domain ?? null,
    titre: p.position,
  }));

  const { pairesAmbigues } = blocageDeterministe(candidats);
  const fusionnes = new Set<string>();
  for (const [idA, idB] of pairesAmbigues) {
    const a = candidats.find((c) => c.id === idA);
    const b = candidats.find((c) => c.id === idB);
    if (!a || !b) continue;
    const decision = await resoudrePaireAmbigue(a, b);
    trace.push(decision.trace);
    if (decision.memePersonne) fusionnes.add(idB); // B absorbé par A
  }

  const profilsDedupliques = profilsMapping.filter((_, i) => !fusionnes.has(`sillage:${i}`));
  const profilPrincipal =
    (entree.emailContact && profilsDedupliques.find((p) => p.email === entree.emailContact)) ||
    profilsDedupliques[0] ||
    null;

  // --- Observations externes, clés NomChamp du schéma A1 ---
  const observationsExternes: ObservationsParChamp = fusionnerObservations(
    mappingSummary ? normaliserEntreprise(mappingSummary, company) : {},
    profilPrincipal ? normaliserProfilMapping(profilPrincipal, mappingSummary?.request_date ?? null) : {},
    normaliserSignauxAchat(signauxBruts),
  );

  // --- FullEnrich : on LANCE le waterfall, on ne bloque jamais dessus (B3).
  // Les coordonnées arrivent par sondage client (app/api/fullenrich/status) ;
  // elles rejoindront le dossier à la prochaine consolidation.
  let fullenrichEnrichmentId: string | null = null;
  if (profilPrincipal && (profilPrincipal.first_name || profilPrincipal.last_name)) {
    const contacts = construireContactsAEnrichir([
      {
        contactId: 'interlocuteur_principal',
        firstname: profilPrincipal.first_name,
        lastname: profilPrincipal.last_name,
        domain: mappingSummary?.company.domain ?? null,
        companyName: mappingSummary?.company.name ?? null,
        linkedinUrl: profilPrincipal.linkedin_url,
      },
    ]);
    if (contacts.length > 0) {
      try {
        const lancement = await getFullEnrichClient().launchBulkEnrichment(contacts);
        fullenrichEnrichmentId = lancement.enrichment_id;
        pousserTrace('collecte.fullenrich', 'appel_outil', {
          outil: 'launch_bulk_enrichment',
          enrichment_id: fullenrichEnrichmentId,
        });
      } catch (err) {
        marquerIndisponible('fullenrich', 'collecte.fullenrich', err);
      }
    }
  }

  // --- Le moteur (axe A) : branchement CRM, arbitrage, signalement, scores ---
  const dossier = consoliderDossier({
    crm: CRM_MOCK,
    lead: { domaine: entree.domaine, email: entree.emailContact },
    observationsExternes,
    dateReference: new Date().toISOString(),
    statutSources,
  });
  pousserTrace('moteur.consolidation', 'decision_arbitrage', {
    branche: dossier.branche,
    questions: dossier.questions.length,
    signaux: dossier.signaux.length,
    score_icp: dossier.score_icp.score,
    completude: dossier.completude.score,
  });

  // --- B5 : la prose n'entre pas dans le dossier (contrat pur), elle
  // l'accompagne. Échec LLM = dossier sans prose, jamais un dossier bloqué.
  let proseIcp: string | null = null;
  try {
    proseIcp = await mettreEnProseDecompositionIcp(dossier.score_icp);
    pousserTrace('scoring.mise_en_prose', 'appel_outil', { modele: 'claude-opus-4-8' });
  } catch (err) {
    pousserTrace('scoring.mise_en_prose', 'erreur', { message: err instanceof Error ? err.message : String(err) });
  }

  // --- B6 : personnalisation, validée par le moteur (bijection). Échec =
  // questions d'origine servies telles quelles — la forme peut attendre,
  // le fond ne doit jamais être perdu.
  let questionsPersonnalisees: DossierConsolide['questions'] | null = null;
  try {
    const profilAE = await getStoreProfilAE().lire(entree.aeId);
    questionsPersonnalisees = await personnaliserQuestions(dossier.questions, profilAE);
    pousserTrace('personnalisation', 'appel_outil', {
      modele: 'claude-sonnet-5',
      questions: dossier.questions.length,
    });
  } catch (err) {
    pousserTrace('personnalisation', 'erreur', { message: err instanceof Error ? err.message : String(err) });
  }

  return {
    dossier,
    prose_icp: proseIcp,
    questions_personnalisees: questionsPersonnalisees,
    fullenrich_enrichment_id: fullenrichEnrichmentId,
    trace,
  };
}
