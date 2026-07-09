import type { Observation } from '@/lib/schema/canonical';
import type { NomChamp } from '@/lib/config/champs';
import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingProfile,
  SillageCompanyMappingSummary,
  SillageLead,
  SillageSignalDetection,
} from './types';

// Normalisation pure : source → Observation, clés = NomChamp du schéma A1
// (lib/config/champs.ts). Aucun arbitrage ici — c'est lib/moteur/ (axe A).
// On ne fabrique JAMAIS date_donnee ni confiance_source par extraction —
// elles viennent de métadonnées vérifiées (request_date, position_start_date),
// voir SYNTHESE.md "Le risque n°1".

const CONFIANCE_FIRMOGRAPHIE = 0.85;
const CONFIANCE_PROFIL_LEAD = 0.75;

export type ObservationsParChamp = Partial<Record<NomChamp, Observation[]>>;

function ajouter(
  cible: ObservationsParChamp,
  champ: NomChamp,
  valeur: unknown,
  dateDonnee: string | null,
  confiance: number,
): void {
  if (valeur === null || valeur === undefined || valeur === '') return;
  (cible[champ] ??= []).push({ valeur, source: 'sillage', date_donnee: dateDonnee, confiance_source: confiance });
}

export function normaliserEntreprise(
  mapping: SillageCompanyMappingSummary,
  company: SillageCompanyEnrichment | null,
): ObservationsParChamp {
  const date = mapping.request_date;
  const observations: ObservationsParChamp = {};

  ajouter(observations, 'nom_legal', company?.name ?? mapping.company.name, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'domaine', mapping.company.domain, date, CONFIANCE_FIRMOGRAPHIE);

  if (!company) return observations;

  const siege = company.locations.find((l) => l.is_hq) ?? company.locations[0];
  ajouter(observations, 'pays_siege', siege?.country, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'ville_siege', siege?.city, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'secteur', company.industries, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'effectif', company.number_of_employees, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'site_web', company.url, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'linkedin_entreprise', company.linkedin_url, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'annee_creation', company.founded_year, date, CONFIANCE_FIRMOGRAPHIE);
  ajouter(observations, 'description', company.activity_summary, date, CONFIANCE_FIRMOGRAPHIE);

  return observations;
}

export function normaliserDecideur(lead: SillageLead): ObservationsParChamp {
  const positionActuelle = lead.experiences?.find((e) => e.is_current) ?? null;
  const dateTitre = positionActuelle?.start_date ?? null;
  const observations: ObservationsParChamp = {};

  ajouter(observations, 'prenom', lead.first_name, dateTitre, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'nom', lead.last_name, dateTitre, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'titre', lead.position, dateTitre, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'linkedin_contact', lead.linkedin_url, dateTitre, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'localisation_contact', lead.location, dateTitre, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'date_prise_poste', positionActuelle?.start_date, dateTitre, CONFIANCE_PROFIL_LEAD);

  // Pas de champ "séniorité" structuré côté Sillage (vérifié sur get_lead) :
  // on ne l'invente pas. Absence ≠ conflit — resolution 'absente' côté moteur.
  return observations;
}

// `get_company_mapping` peut fournir email/téléphone dans ses profils
// (contrairement à get_lead) — sans garantie de couverture. On les remonte
// comme observations normales ; le waterfall FullEnrich (B3) vérifie ou
// complète dans tous les cas.
export function normaliserProfilMapping(
  profil: SillageCompanyMappingProfile,
  dateMapping: string | null,
): ObservationsParChamp {
  const date = profil.position_start_date ?? dateMapping;
  const observations: ObservationsParChamp = {};

  const [prenom, ...resteNom] = (profil.name ?? '').trim().split(/\s+/);
  ajouter(observations, 'prenom', prenom || null, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'nom', resteNom.join(' ') || null, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'titre', profil.position, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'email', profil.email, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'telephone', profil.phone_number, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'localisation_contact', profil.location, date, CONFIANCE_PROFIL_LEAD);
  ajouter(observations, 'date_prise_poste', profil.position_start_date, date, CONFIANCE_PROFIL_LEAD);

  return observations;
}

// Les signaux d'achat sont mono-source Sillage : dans le schéma A1 ils vivent
// dans le champ texte `signaux_achat` (jamais de conflit). Les excerpts sont
// du texte libre tiers — le moteur ne les met dans aucun prompt, et B4 les
// délimite s'il doit les lire.
export function normaliserSignauxAchat(detections: SillageSignalDetection[]): ObservationsParChamp {
  if (detections.length === 0) return {};

  const resume = detections
    .map((d) => `[${d.signal_type} · ${d.signal_date.slice(0, 10)}] ${d.excerpt ?? 'signal détecté'}`)
    .join('\n');
  const dateLaPlusRecente = detections.map((d) => d.signal_date).sort().at(-1) ?? null;

  return {
    signaux_achat: [
      {
        valeur: resume,
        source: 'sillage',
        date_donnee: dateLaPlusRecente,
        confiance_source: 0.7,
      },
    ],
  };
}

export function fusionnerObservations(...sources: ObservationsParChamp[]): ObservationsParChamp {
  const fusion: ObservationsParChamp = {};
  for (const source of sources) {
    for (const [champ, observations] of Object.entries(source)) {
      if (!observations) continue;
      (fusion[champ as NomChamp] ??= []).push(...observations);
    }
  }
  return fusion;
}
