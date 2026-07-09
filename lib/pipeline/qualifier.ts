import { moteur } from '@/lib/engine';
import { getSillageClient } from '@/lib/sillage';
import { normaliserEntreprise, normaliserProfilMapping, normaliserSignal } from '@/lib/sillage/normalize';
import { construireContactsAEnrichir, type CandidatContact } from '@/lib/fullenrich/waterfall';
import { getFullEnrichClient } from '@/lib/fullenrich';
import {
  blocageDeterministe,
  resoudrePaireAmbigue,
  type CandidatIdentite,
} from '@/lib/llm/reconciliation';
import { mettreEnProseDecompositionIcp } from '@/lib/llm/scoring-prose';
import { personnaliserQuestions } from '@/lib/llm/personnalisation';
import { getStoreProfilAE } from '@/lib/memoire-ae/store';
import type {
  ChampConsolide,
  Conflit,
  DossierQualification,
  Observation,
  Question,
  Signal,
  StatutParSource,
  StatutSource,
  TraceEvent,
  Volatilite,
} from '@/lib/schema/canonical';
import { DossierQualification as DossierQualificationSchema } from '@/lib/schema/canonical';

// B7 — le pipeline. Un DAG statique : Promise.all des collecteurs, puis
// réconciliation (checkpoint), puis arbitrage + scoring (axe A), puis
// branchement, puis personnalisation. Rien à planifier, donc pas d'agent
// orchestrateur — voir docs/axe-B-surface.md §B7.

export interface EntreeQualification {
  domaine: string;
  emailContact?: string;
  aeId: string;
}

const VOLATILITE_PAR_CHAMP: Record<string, Volatilite> = {
  nom: 'stable',
  pays_siege: 'stable',
  site_web: 'stable',
  secteur: 'volatile',
  effectif: 'volatile',
  techno: 'volatile',
  competiteurs: 'volatile',
  description: 'volatile',
  titre: 'volatile',
  seniorite: 'volatile',
  email: 'volatile',
  telephone: 'volatile',
  linkedin_url: 'stable',
};

export async function qualifierLead(entree: EntreeQualification): Promise<{
  dossier: DossierQualification;
  fullenrichEnrichmentId: string | null;
}> {
  const trace: TraceEvent[] = [];
  const statutParSource: StatutParSource = { sillage: 'ok', fullenrich: 'ok', crm: 'ok' };
  const debut = Date.now();

  const pousserTrace = (etape: string, type: TraceEvent['type'], detail: unknown) => {
    trace.push({ horodatage: new Date().toISOString(), etape, type, detail });
  };

  const marquerIndisponible = (source: keyof StatutParSource, etape: string, err: unknown): StatutSource => {
    pousserTrace(etape, 'erreur', { message: err instanceof Error ? err.message : String(err) });
    statutParSource[source] = 'indisponible';
    return 'indisponible';
  };

  // --- Collecte, en parallèle : Sillage et CRM ne dépendent l'un de l'autre en rien. ---
  const sillage = getSillageClient();

  const [mappingSummary, crmCompte] = await Promise.all([
    sillage.findCompanyMappingByDomain(entree.domaine).catch((err) => {
      marquerIndisponible('sillage', 'collecte.sillage', err);
      return null;
    }),
    moteur.chercherCompteCrm(entree.domaine).catch((err) => {
      marquerIndisponible('crm', 'collecte.crm', err);
      return { matches: 0, historiqueDeals: [] };
    }),
  ]);
  pousserTrace('collecte.sillage', 'appel_outil', { outil: 'find_company_mapping_by_domain', trouve: !!mappingSummary });
  pousserTrace('collecte.crm', 'appel_outil', { outil: 'chercher_compte_crm', matches: crmCompte.matches });

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

  // --- Observations entreprise ---
  const observationsEntreprise: Record<string, Observation[]> = {};
  if (mappingSummary) {
    const champsEntreprise = normaliserEntreprise(mappingSummary, company);
    for (const [champ, observation] of Object.entries(champsEntreprise)) {
      observationsEntreprise[champ] = [...(observationsEntreprise[champ] ?? []), observation as Observation];
    }
  }

  // --- Identités décideurs (résolution d'entités, B4 étage 1) ---
  const profilsMapping = mappingDetail?.profiles ?? [];
  const candidatsIdentite: CandidatIdentite[] = profilsMapping.map((p, i) => ({
    id: `sillage:${i}`,
    source: 'sillage',
    nom: p.name,
    email: p.email,
    domaine: mappingSummary?.company.domain ?? null,
    titre: p.position,
  }));

  const { groupes, pairesAmbigues, distincts } = blocageDeterministe(candidatsIdentite);
  for (const [idA, idB] of pairesAmbigues) {
    const a = candidatsIdentite.find((c) => c.id === idA);
    const b = candidatsIdentite.find((c) => c.id === idB);
    if (!a || !b) continue;
    const decision = await resoudrePaireAmbigue(a, b);
    trace.push(decision.trace);
    if (decision.memePersonne) groupes.push([idA, idB]);
    else distincts.push(idA, idB);
  }

  // Un groupe = un décideur consolidé (ids repris pour aller chercher ses observations).
  const groupesDecideurs = [...groupes, ...distincts.map((id) => [id])];

  const decideursObservations: {
    id: string;
    contact: CandidatContact;
    champs: Record<string, Observation[]>;
  }[] = groupesDecideurs.map((ids, index) => {
    const membres = ids.map((id) => candidatsIdentite.find((c) => c.id === id)!).filter(Boolean);
    const champs: Record<string, Observation[]> = {};
    for (const idxStr of ids) {
      const profilIndex = Number(idxStr.split(':')[1]);
      const profil = profilsMapping[profilIndex];
      if (!profil) continue;
      const obsProfil = normaliserProfilMapping(profil, mappingSummary?.request_date ?? null);
      for (const [champ, observation] of Object.entries(obsProfil)) {
        champs[champ] = [...(champs[champ] ?? []), observation as Observation];
      }
    }
    const premier = membres[0];
    return {
      id: `decideur_${index}`,
      contact: {
        contactId: `decideur_${index}`,
        firstname: premier?.nom?.split(' ')[0] ?? null,
        lastname: premier?.nom?.split(' ').slice(1).join(' ') || null,
        domain: mappingSummary?.company.domain ?? null,
        companyName: mappingSummary?.company.name ?? null,
        linkedinUrl: null,
      },
      champs,
    };
  });

  // --- FullEnrich : on LANCE le waterfall, on ne bloque jamais dessus (B3). ---
  let fullenrichEnrichmentId: string | null = null;
  const contactsAEnrichir = construireContactsAEnrichir(decideursObservations.map((d) => d.contact));
  if (contactsAEnrichir.length > 0) {
    try {
      const lancement = await getFullEnrichClient().launchBulkEnrichment(contactsAEnrichir);
      fullenrichEnrichmentId = lancement.enrichment_id;
      statutParSource.fullenrich = 'partiel'; // job lancé, résultat sondé côté client
      pousserTrace('collecte.fullenrich', 'appel_outil', {
        outil: 'launch_bulk_enrichment',
        enrichment_id: fullenrichEnrichmentId,
        contacts: contactsAEnrichir.length,
      });
    } catch (err) {
      marquerIndisponible('fullenrich', 'collecte.fullenrich', err);
    }
  } else {
    statutParSource.fullenrich = 'partiel';
  }

  // --- Arbitrage, champ par champ (axe A) ---
  const champsEntrepriseConsolides: Record<string, unknown> = {};
  const conflits: Conflit[] = [];

  for (const [champ, observations] of Object.entries(observationsEntreprise)) {
    const sortie = moteur.arbitrerChamp({
      champ,
      entite: 'entreprise',
      observations,
      volatilite: VOLATILITE_PAR_CHAMP[champ] ?? 'volatile',
    });
    champsEntrepriseConsolides[champ] = sortie.champConsolide;
    if (sortie.conflit) conflits.push(sortie.conflit);
    pousserTrace(`arbitrage.entreprise.${champ}`, 'decision_arbitrage', { champ, conflit: !!sortie.conflit });
  }

  // --- Arbitrage par décideur, même logique champ par champ ---
  const CHAMPS_DECIDEUR = ['nom', 'titre', 'seniorite', 'email', 'telephone', 'linkedin_url'] as const;
  const decideurs = decideursObservations.map((d) => {
    const champsConsolides: Record<string, unknown> = {};
    for (const champ of CHAMPS_DECIDEUR) {
      const sortie = moteur.arbitrerChamp({
        champ,
        entite: d.id,
        observations: d.champs[champ] ?? [],
        volatilite: VOLATILITE_PAR_CHAMP[champ] ?? 'volatile',
      });
      champsConsolides[champ] = sortie.champConsolide;
      if (sortie.conflit) conflits.push(sortie.conflit);
    }
    return {
      id: d.id,
      nom: champsConsolides.nom,
      titre: champsConsolides.titre,
      seniorite: champsConsolides.seniorite,
      email: champsConsolides.email,
      telephone: champsConsolides.telephone,
      linkedin_url: champsConsolides.linkedin_url,
      // Rapprocher ce décideur à son historique CRM personnel suppose la
      // même résolution d'entités qu'à l'étage 1 — non câblée ici par souci
      // de lisibilité du pipeline ; moteur.chercherContactCrm() existe déjà
      // pour ça (voir contrat-moteur.ts) et se branche au même endroit que
      // chercherCompteCrm() ci-dessus.
      historique_relationnel: { deals: [], autre_entreprise: false },
    };
  });
  pousserTrace('arbitrage.decideurs', 'decision_arbitrage', { nombre: decideurs.length });

  // --- Scoring (axe A) puis mise en prose (B5) ---
  const sortieScoring = moteur.scorer({
    entreprise: champsEntrepriseConsolides as Record<string, ChampConsolide>,
    nombreDecideursIdentifies: decideursObservations.length,
    signauxRecents: signauxBruts.length,
    historiqueDeals: crmCompte.historiqueDeals,
  });

  const proseIcp = await mettreEnProseDecompositionIcp(sortieScoring.scoreIcp);
  const scoreIcp = { ...sortieScoring.scoreIcp, prose: proseIcp };
  pousserTrace('scoring.mise_en_prose', 'appel_outil', { modele: 'claude-opus-4-8' });

  // --- Branchement NOUVEAU_LEAD / MISE_À_JOUR ---
  const statut = crmCompte.matches === 1 ? 'MISE_A_JOUR' : 'NOUVEAU_LEAD';
  if (crmCompte.matches > 1) {
    conflits.push({
      id: `conflit_branchement_${entree.domaine}`,
      champ: 'compte_crm',
      entite: 'entreprise',
      valeur_retenue: null,
      source_retenue: null,
      date_retenue: null,
      valeur_ecartee: null,
      source_ecartee: 'crm',
      date_ecartee: null,
      regle: 'aucune_date',
      ecart_jours: null,
      resolution: 'impossible',
      a_signaler_AE: true,
    });
  }
  pousserTrace('branchement', 'decision_arbitrage', { statut, matches_crm: crmCompte.matches });

  // --- Questions : conflits signalés + questions de fond, ordre figé ici ---
  let ordre = 0;
  const questions: Question[] = [];
  for (const conflit of conflits) {
    if (!conflit.a_signaler_AE) continue;
    questions.push({
      id: `question_${conflit.id}`,
      ordre: ordre++,
      champ: conflit.champ,
      entite: conflit.entite,
      type: conflit.resolution === 'impossible' ? 'ouverte' : 'confirmation',
      texte:
        conflit.resolution === 'impossible'
          ? `Quelle est la valeur correcte de « ${conflit.champ} » pour ${conflit.entite} ?`
          : `Confirmez-vous « ${conflit.valeur_retenue} » pour « ${conflit.champ} » (${conflit.entite}) ?`,
      conflit_id: conflit.id,
    });
  }
  for (const q of sortieScoring.questionsDeFond) {
    questions.push({
      id: `question_fond_${ordre}`,
      ordre: ordre++,
      champ: null,
      entite: null,
      type: q.type,
      texte: q.texte,
      conflit_id: null,
    });
  }

  const profilAE = await getStoreProfilAE().lire(entree.aeId);
  let questionsFinales = questions;
  try {
    questionsFinales = await personnaliserQuestions(questions, profilAE);
    pousserTrace('personnalisation', 'appel_outil', { modele: 'claude-sonnet-5', questions: questions.length });
  } catch (err) {
    // Bijection rompue ou appel en échec : on sert les questions non
    // personnalisées plutôt que de bloquer le dossier — la forme peut
    // attendre, le fond ne doit jamais être perdu.
    pousserTrace('personnalisation', 'erreur', { message: err instanceof Error ? err.message : String(err) });
  }

  const signaux: Signal[] = signauxBruts.map(normaliserSignal);

  const dossierBrut = {
    id: `dossier_${entree.domaine}_${debut}`,
    statut,
    cree_le: new Date(debut).toISOString(),
    entreprise: {
      nom: champsEntrepriseConsolides.nom,
      pays_siege: champsEntrepriseConsolides.pays_siege,
      secteur: champsEntrepriseConsolides.secteur,
      effectif: champsEntrepriseConsolides.effectif,
      techno: champsEntrepriseConsolides.techno,
      competiteurs: champsEntrepriseConsolides.competiteurs,
      site_web: champsEntrepriseConsolides.site_web,
      description: champsEntrepriseConsolides.description,
      historique_deals: crmCompte.historiqueDeals,
    },
    decideurs,
    signaux,
    conflits,
    questions: questionsFinales,
    score_icp: scoreIcp,
    score_completude: sortieScoring.scoreCompletude,
    statut_par_source: statutParSource,
    trace,
  };

  return { dossier: DossierQualificationSchema.parse(dossierBrut), fullenrichEnrichmentId };
}
