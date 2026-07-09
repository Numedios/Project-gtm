/**
 * A2 — La consolidation d'un dossier : branchement CRM, arbitrage champ par
 * champ, historique mono-source, scores.
 *
 * Fonction pure : le CRM est injecté (lecture seule par le type), la date de
 * référence aussi. Aucun réseau, aucun modèle, aucune horloge.
 */
import {
  DossierConsolide,
  type ChampConsolide,
  type Observation,
  type Question,
  type Signal,
  type Source,
  type StatutSource,
} from '@/lib/schema/canonical';
import {
  CHAMPS,
  type ConfigMoteur,
  type NomChamp,
} from '@/lib/config/champs';
import { type ConfigIcp, ICP_DEFAUT } from '@/lib/config/icp';
import { CONFIANCE_CRM, type CrmLectureSeule, type DealCrm } from '@/lib/crm/mock';
import { arbitrerChamp } from './arbitrage';
import { calculerCompletude, calculerScoreIcp } from './scoring';

export interface EntreeConsolidation {
  crm: CrmLectureSeule;
  lead: { domaine?: string | undefined; email?: string | undefined };
  /** Observations déjà estampillées par les collecteurs Sillage/FullEnrich.
   *  Elles arrivent sous forme de DONNÉES conformes au schéma canonique —
   *  jamais sous forme d'import du poste 2. */
  observationsExternes: Partial<Record<NomChamp, Observation[]>>;
  /** Injectée — le moteur ne lit jamais l'horloge. */
  dateReference: string;
  config?: Partial<ConfigMoteur> | undefined;
  icp?: ConfigIcp | undefined;
  /** Panne partielle d'une source : la source manquante fait chuter la
   *  complétude, et l'AE lit « indisponible » au lieu d'une absence muette. */
  statutSources?: Record<Source, StatutSource> | undefined;
}

export function consoliderDossier(entree: EntreeConsolidation): DossierConsolide {
  const { crm, lead, dateReference } = entree;

  // ---------------------------------------------------------------------
  // Branchement (audit/02 §2.3) : find_account(domaine) or find_contact(email).
  // Ambigu (≥ 2 comptes) → NOUVEAU_LEAD *et* conflit signalé : la règle
  // « conflit → question » absorbe le cas limite sans mécanisme ad hoc.
  // ---------------------------------------------------------------------
  const comptes = lead.domaine ? crm.findAccountsByDomain(lead.domaine) : [];
  const contact = lead.email ? crm.findContactByEmail(lead.email) : null;

  const questions: Question[] = [];
  let branche: 'MISE_A_JOUR' | 'NOUVEAU_LEAD';
  let compte = null as (typeof comptes)[number] | null;
  let conflitBranchement: ChampConsolide | null = null;

  if (comptes.length >= 2) {
    branche = 'NOUVEAU_LEAD';
    // L'ambiguïté est un CONFLIT SIGNALÉ : chaque compte candidat est une
    // observation du champ compte_crm, l'arbitrage est impossible (rien ne
    // départage deux comptes du même CRM), et la question découle de la
    // règle « conflit → question ».
    conflitBranchement = {
      champ: 'compte_crm',
      observations: comptes.map((c) => ({
        valeur: `${c.id} (${String(c.champs.nom_legal?.valeur ?? c.domaine)})`,
        source: 'crm' as const,
        date_donnee: null,
        confiance_source: CONFIANCE_CRM,
      })),
      valeur_retenue: null,
      confiance: 0,
      volatilite: 'stable',
      resolution: 'impossible',
      a_signaler_AE: true, // l'invariant A6 : impossible ⇒ toujours signalé
    };
    questions.push({
      type: 'ouverte',
      champ: 'compte_crm',
      texte: `Plusieurs comptes CRM correspondent au domaine « ${lead.domaine} ». Lequel est le bon ?`,
    });
  } else if (comptes.length === 1 || contact !== null) {
    branche = 'MISE_A_JOUR';
    compte = comptes[0] ?? null;
  } else {
    branche = 'NOUVEAU_LEAD';
  }

  // ---------------------------------------------------------------------
  // Le CRM devient une source d'observations estampillées comme les autres.
  // En cas d'ambiguïté de compte, on n'injecte AUCUNE donnée de compte :
  // on ne sait pas laquelle serait la bonne.
  // ---------------------------------------------------------------------
  const observationsCrm: Partial<Record<NomChamp, Observation[]>> = {};
  const ajouterCrm = (
    champs: Partial<Record<NomChamp, { valeur: unknown; date_donnee: string | null }>>,
  ) => {
    for (const [nom, v] of Object.entries(champs)) {
      const observation: Observation = {
        valeur: v.valeur,
        source: 'crm',
        date_donnee: v.date_donnee,
        confiance_source: CONFIANCE_CRM,
      };
      (observationsCrm[nom as NomChamp] ??= []).push(observation);
    }
  };
  if (compte) ajouterCrm(compte.champs);
  if (contact) ajouterCrm(contact.champs);

  // ---------------------------------------------------------------------
  // Historique mono-source (fixture n°9) : les deals du contact conclus dans
  // une AUTRE entreprise forment l'historique relationnel. Mono-source ⇒
  // ne peut jamais entrer en conflit.
  // ---------------------------------------------------------------------
  const domaineLead = lead.domaine?.trim().toLowerCase();
  const dealsContact = lead.email ? crm.listDealsByContactEmail(lead.email) : [];
  const relationnel = dealsContact.filter(
    (d) => d.domaine_entreprise !== domaineLead,
  );
  const dealsCompte = compte ? crm.listDealsByAccountId(compte.id) : [];

  const resumerDeals = (deals: readonly DealCrm[]): Observation[] => [
    {
      valeur: deals
        .map((d) => `Deal ${d.statut} avec ${d.entreprise} (${d.date.slice(0, 10)})`)
        .join(' ; '),
      source: 'crm',
      date_donnee: deals.map((d) => d.date).sort().at(-1) ?? null,
      confiance_source: CONFIANCE_CRM,
    },
  ];
  if (relationnel.length > 0) {
    observationsCrm.historique_relationnel = resumerDeals(relationnel);
  }
  if (dealsCompte.length > 0) {
    observationsCrm.historique_deals = resumerDeals(dealsCompte);
  }

  // ---------------------------------------------------------------------
  // Arbitrage champ par champ, dans l'ordre du schéma — l'ordre des
  // questions est FIGÉ ici, la personnalisation n'y touche pas.
  // ---------------------------------------------------------------------
  const champs: Record<string, ChampConsolide> = {};
  const signaux: Signal[] = [];
  if (conflitBranchement) champs[conflitBranchement.champ] = conflitBranchement;

  for (const nom of Object.keys(CHAMPS) as NomChamp[]) {
    const observations = [
      ...(observationsCrm[nom] ?? []),
      ...(entree.observationsExternes[nom] ?? []),
    ];
    const resultat = arbitrerChamp(nom, observations, {
      dateReference,
      config: entree.config,
    });
    champs[nom] = resultat.champ;
    if (resultat.signal) signaux.push(resultat.signal);
    if (resultat.question) questions.push(resultat.question);
  }

  // ---------------------------------------------------------------------
  // Les deux scores — qui ne se confondent pas.
  // ---------------------------------------------------------------------
  const valeursRetenues = Object.fromEntries(
    Object.entries(champs).map(([nom, c]) => [nom, c.valeur_retenue]),
  ) as Partial<Record<NomChamp, unknown>>;

  const completude = calculerCompletude(valeursRetenues);
  const score_icp = calculerScoreIcp(
    {
      secteur: valeursRetenues.secteur,
      effectif: valeursRetenues.effectif,
      pays_siege: valeursRetenues.pays_siege,
      seniorite: valeursRetenues.seniorite,
    },
    entree.icp ?? ICP_DEFAUT,
  );

  // La sortie repasse par le schéma canonique : le contrat est vérifié à la
  // frontière, pas supposé.
  return DossierConsolide.parse({
    branche,
    champs,
    signaux,
    questions,
    statut_sources:
      entree.statutSources ?? { sillage: 'ok', fullenrich: 'ok', crm: 'ok' },
    completude,
    score_icp,
    historique: {
      deals: dealsCompte.map((d) => ({ ...d })),
      relationnel: relationnel.map((d) => ({ ...d })),
    },
  });
}
