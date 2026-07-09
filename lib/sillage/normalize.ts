import type { Observation, Signal, TypeSignal } from '@/lib/schema/canonical';
import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingProfile,
  SillageCompanyMappingSummary,
  SillageLead,
  SillageSignalDetection,
} from './types';

// Normalisation pure : source → Observation. Aucun arbitrage ici (c'est
// lib/engine/, axe A). On ne fabrique JAMAIS date_donnee ni confiance_source
// par extraction — elles viennent de métadonnées vérifiées (request_date,
// position_start_date), voir SYNTHESE.md "Le risque n°1".

const CONFIANCE_FIRMOGRAPHIE = 0.85;
const CONFIANCE_PROFIL_LEAD = 0.75;
const CONFIANCE_SIGNAL = 0.7;

function obs(valeur: unknown, dateDonnee: string | null, confiance: number): Observation {
  return { valeur, source: 'sillage', date_donnee: dateDonnee, confiance_source: confiance };
}

export function normaliserEntreprise(
  mapping: SillageCompanyMappingSummary,
  company: SillageCompanyEnrichment | null,
): Partial<Record<'nom' | 'pays_siege' | 'secteur' | 'effectif' | 'site_web' | 'description', Observation>> {
  const date = mapping.request_date;
  const observations: Partial<
    Record<'nom' | 'pays_siege' | 'secteur' | 'effectif' | 'site_web' | 'description', Observation>
  > = {
    nom: obs(company?.name ?? mapping.company.name, date, CONFIANCE_FIRMOGRAPHIE),
  };

  if (!company) return observations;

  const siege = company.locations.find((l) => l.is_hq) ?? company.locations[0];
  if (siege?.country) observations.pays_siege = obs(siege.country, date, CONFIANCE_FIRMOGRAPHIE);
  if (company.industries) observations.secteur = obs(company.industries, date, CONFIANCE_FIRMOGRAPHIE);
  if (company.number_of_employees != null) {
    observations.effectif = obs(company.number_of_employees, date, CONFIANCE_FIRMOGRAPHIE);
  }
  if (company.url) observations.site_web = obs(company.url, date, CONFIANCE_FIRMOGRAPHIE);
  if (company.activity_summary) {
    observations.description = obs(company.activity_summary, date, CONFIANCE_FIRMOGRAPHIE);
  }
  return observations;
}

export function normaliserDecideur(
  lead: SillageLead,
): Partial<Record<'nom' | 'titre' | 'linkedin_url', Observation>> {
  const positionActuelle = lead.experiences?.find((e) => e.is_current) ?? null;
  const dateTitre = positionActuelle?.start_date ?? null;

  const observations: Partial<Record<'nom' | 'titre' | 'linkedin_url', Observation>> = {};

  const nomComplet = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  if (nomComplet) observations.nom = obs(nomComplet, dateTitre, CONFIANCE_PROFIL_LEAD);
  if (lead.position) observations.titre = obs(lead.position, dateTitre, CONFIANCE_PROFIL_LEAD);
  if (lead.linkedin_url) observations.linkedin_url = obs(lead.linkedin_url, dateTitre, CONFIANCE_PROFIL_LEAD);

  // Pas de champ "séniorité" structuré côté Sillage (vérifié sur get_lead) :
  // on ne l'invente pas ici. Absence ≠ conflit (axe A, A4) — le champ restera
  // simplement sans observation Sillage pour ce décideur.
  return observations;
}

// `get_company_mapping` peut fournir email/téléphone directement dans ses
// profils (contrairement à get_lead, qui ne les fournit jamais) — mais sans
// garantie de couverture. On les remonte comme observations Sillage
// normales ; le waterfall FullEnrich (B3) vérifie ou complète dans tous
// les cas, jamais en branche conditionnelle sur leur présence.
export function normaliserProfilMapping(
  profil: SillageCompanyMappingProfile,
  dateDonnee: string | null,
): Partial<Record<'nom' | 'titre' | 'email' | 'telephone', Observation>> {
  const observations: Partial<Record<'nom' | 'titre' | 'email' | 'telephone', Observation>> = {};
  const date = profil.position_start_date ?? dateDonnee;

  if (profil.name) observations.nom = obs(profil.name, date, CONFIANCE_PROFIL_LEAD);
  if (profil.position) observations.titre = obs(profil.position, date, CONFIANCE_PROFIL_LEAD);
  if (profil.email) observations.email = obs(profil.email, date, CONFIANCE_PROFIL_LEAD);
  if (profil.phone_number) observations.telephone = obs(profil.phone_number, date, CONFIANCE_PROFIL_LEAD);

  return observations;
}

const TYPE_SIGNAL_PAR_SIGNAL_TYPE: Record<string, TypeSignal> = {
  jobUpdate: 'changement_decisionnaire',
  jobPosting: 'recrutement',
  jobPostingKeywordDetection: 'recrutement',
  competitor: 'ex_client', // recoupement le plus proche du schéma canonique actuel
  customer: 'ex_client',
  keywordDetection: 'ex_client',
};

export function normaliserSignal(detection: SillageSignalDetection): Signal {
  return {
    id: `sillage_${detection.id}`,
    type: TYPE_SIGNAL_PAR_SIGNAL_TYPE[detection.signal_type] ?? 'recrutement',
    description: detection.excerpt ?? `Signal ${detection.signal_type} détecté.`,
    date: detection.signal_date,
    source: 'sillage',
    entite_associee: detection.lead_id ? String(detection.lead_id) : null,
  };
}
