import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingDetail,
  SillageCompanyMappingSummary,
  SillageSignalDetection,
} from '@/lib/sillage/types';
import type { CompteCrm, ContactCrm, DealCrm } from '@/lib/crm/mock';

// ---------------------------------------------------------------------------
// Scénario de démo PayFit — TOUTES les données du scénario vivent ici.
//
// Faits réels (licorne française de la paie SaaS) : fondée en 2016 à Paris,
// série E de 254 M€ (mars 2022), présence France/Espagne. L'interlocutrice
// Camille Roussel est FICTIVE.
//
// Le scénario est CALIBRÉ pour la démo :
// - ICP = 95/100 exactement : secteur « saas » ✓ (×3), France ✓ (×2),
//   séniorité décisionnaire ✓ (×3), effectif 625 → hors fourchette 50–500
//   de 25 % → 0.75 (×2). Total (3+1.5+2+3)/10 = 95.
// - Branche MISE_A_JOUR : le compte existe au CRM, avec des valeurs de 2025
//   PÉRIMÉES → deux conflits volatils tranchés par récence (titre
//   « Head of Finance » → « VP Finance », effectif 480 → 625) = signaux.
// - Champs corroborés CRM + Sillage à dates fraîches → confiances ≈ 95 %.
// - Historique relationnel : deal gagné avec Camille chez son employeur
//   précédent (Finexpa) + deal en cours chez PayFit.
//
// Email de démo : camille.roussel@payfit.com (nécessite SILLAGE_USE_MOCK=true
// pour la partie Sillage ; le CRM est local dans tous les cas).
// ---------------------------------------------------------------------------

export const PAYFIT_MAPPING: SillageCompanyMappingSummary = {
  id: 812,
  request_date: '2026-07-05T00:00:00.000Z',
  version: 1,
  status: 'complete',
  company: { id: 1180, name: 'PayFit', domain: 'payfit.com' },
};

export const PAYFIT_MAPPING_DETAIL: SillageCompanyMappingDetail = {
  ...PAYFIT_MAPPING,
  profiles: [
    {
      // L'interlocutrice principale (fictive) — son email matche le lead de
      // démo, elle est donc élue profil principal sans arbitraire.
      id: 91001,
      first_name: 'Camille',
      last_name: 'Roussel',
      position: 'VP Finance',
      position_start_date: '2026-06-01T00:00:00.000Z',
      linkedin_handle: 'camille-roussel-fin',
      linkedin_url: 'https://linkedin.com/in/camille-roussel-fin',
      linkedin_headline: 'VP Finance @ PayFit',
      linkedin_about: null,
      avatar_url: null,
      email: 'camille.roussel@payfit.com',
      phone_number: null,
      location: 'Paris, France',
    },
    {
      // Le CEO (personnage public) — deuxième profil, nom distinct : aucune
      // paire ambiguë, pas d'appel LLM de réconciliation pendant la démo.
      id: 91002,
      first_name: 'Firmin',
      last_name: 'Zocchetto',
      position: 'CEO & Co-founder',
      position_start_date: '2016-04-01T00:00:00.000Z',
      linkedin_handle: 'firmin-zocchetto',
      linkedin_url: 'https://linkedin.com/in/firmin-zocchetto',
      linkedin_headline: 'CEO @ PayFit',
      linkedin_about: null,
      avatar_url: null,
      email: null,
      phone_number: null,
      location: 'Paris, France',
    },
  ],
};

export const PAYFIT_COMPANY: SillageCompanyEnrichment = {
  name: 'PayFit',
  domain: 'payfit.com',
  url: 'https://payfit.com',
  linkedin_url: 'https://linkedin.com/company/payfit',
  location: 'Paris, France',
  locations: [
    { is_hq: true, city: 'Paris', region: 'Île-de-France', country: 'France', country_code: 'FR' },
    { is_hq: false, city: 'Barcelone', region: 'Catalogne', country: 'Espagne', country_code: 'ES' },
  ],
  number_of_employees: 625,
  employee_range: '501-1000',
  founded_year: 2016,
  industries: 'SaaS',
  activity_summary:
    'Solution SaaS de gestion de la paie et des RH pour PME (France, Espagne). ' +
    'Licorne française : série E de 254 M€ en mars 2022 menée par General Atlantic.',
};

export const PAYFIT_SIGNALS: SillageSignalDetection[] = [
  {
    id: 510001,
    signal_type: 'jobUpdate',
    detected_at: '2026-06-02T09:00:00.000Z',
    signal_date: '2026-06-01T00:00:00.000Z',
    lead_id: 91001,
    company_id: PAYFIT_MAPPING.company.id,
    agent_id: 1,
    source_url: 'https://linkedin.com/in/camille-roussel-fin',
    excerpt: 'Camille Roussel a été promue VP Finance chez PayFit.',
  },
  {
    id: 510002,
    signal_type: 'jobPosting',
    detected_at: '2026-06-20T09:00:00.000Z',
    signal_date: '2026-06-19T00:00:00.000Z',
    lead_id: null,
    company_id: PAYFIT_MAPPING.company.id,
    agent_id: 2,
    source_url: 'https://payfit.com/careers',
    excerpt: '12 postes ouverts dans les équipes Revenue et Finance (Paris, Barcelone).',
  },
  {
    id: 510003,
    signal_type: 'keywordDetection',
    detected_at: '2026-07-01T09:00:00.000Z',
    signal_date: '2026-06-30T00:00:00.000Z',
    lead_id: null,
    company_id: PAYFIT_MAPPING.company.id,
    agent_id: 3,
    source_url: 'https://presse.example/payfit-facturation-electronique',
    excerpt: 'PayFit accélère sur la facturation électronique avant l’échéance réglementaire de septembre 2026.',
  },
];

// --- Côté CRM : le compte existe (branche MISE_A_JOUR), avec des valeurs de
// 2025 volontairement périmées — l'arbitrage par récence les remplace et
// produit les signaux « changement détecté » de la démo.

export const PAYFIT_COMPTE_CRM: CompteCrm = {
  id: 'acc_payfit',
  domaine: 'payfit.com',
  champs: {
    nom_legal: { valeur: 'PayFit SAS', date_donnee: '2025-02-10T00:00:00Z' },
    pays_siege: { valeur: 'France', date_donnee: '2025-02-10T00:00:00Z' },
    ville_siege: { valeur: 'Paris', date_donnee: '2025-02-10T00:00:00Z' },
    secteur: { valeur: 'saas', date_donnee: '2025-02-10T00:00:00Z' },
    // Périmé : Sillage voit 625 en juillet 2026 → conflit volatil, récence.
    effectif: { valeur: 480, date_donnee: '2025-03-01T00:00:00Z' },
    site_web: { valeur: 'https://payfit.com', date_donnee: '2025-02-10T00:00:00Z' },
    stade_pipeline: { valeur: 'découverte', date_donnee: '2026-04-15T00:00:00Z' },
    notes_crm: {
      valeur: 'Démo produit faite en avril 2026. Sujet chaud : conformité facturation électronique. Recontacter à la rentrée.',
      date_donnee: null,
    },
  },
};

export const PAYFIT_CONTACT_CRM: ContactCrm = {
  id: 'cnt_camille',
  email: 'camille.roussel@payfit.com',
  compte_id: 'acc_payfit',
  champs: {
    prenom: { valeur: 'Camille', date_donnee: '2025-02-10T00:00:00Z' },
    nom: { valeur: 'Roussel', date_donnee: '2025-02-10T00:00:00Z' },
    // Périmé : promue VP Finance en juin 2026 (profil Sillage + signal).
    titre: { valeur: 'Head of Finance', date_donnee: '2025-02-10T00:00:00Z' },
    // Mono-source CRM — c'est lui qui rend le critère séniorité de l'ICP
    // calculable (« head » est décisionnaire, score 1).
    seniorite: { valeur: 'head', date_donnee: '2025-02-10T00:00:00Z' },
    email: { valeur: 'camille.roussel@payfit.com', date_donnee: '2025-02-10T00:00:00Z' },
  },
};

export const PAYFIT_DEALS_CRM: DealCrm[] = [
  {
    // Deal gagné avec Camille chez son employeur PRÉCÉDENT → historique
    // relationnel (fixture n°9 : « on connaît la personne, pas le compte »).
    id: 'deal_finexpa',
    contact_email: 'camille.roussel@payfit.com',
    entreprise: 'Finexpa SAS',
    domaine_entreprise: 'finexpa.fr',
    statut: 'gagne',
    date: '2024-09-12T00:00:00Z',
  },
  {
    // Deal en cours DANS l'entreprise du lead → historique deals du compte.
    id: 'deal_payfit_en_cours',
    contact_email: 'camille.roussel@payfit.com',
    entreprise: 'PayFit SAS',
    domaine_entreprise: 'payfit.com',
    statut: 'en_cours',
    date: '2026-04-20T00:00:00Z',
  },
];
