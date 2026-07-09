// Formes REST FullEnrich v2 — enrichissement de CONTACTS uniquement (contrainte
// ferme du brief §2). Seule donnée « entreprise » admise : le DOMAINE de
// l'employeur actuel, rapporté par le reverse email lookup — c'est une
// propriété du contact (son employeur), et c'est ce qui permet de qualifier
// un lead dont on ne connaît que l'email.

export interface FullEnrichContactInput {
  contact_id: string; // notre id interne, repris tel quel dans la réponse
  firstname: string | null;
  lastname: string | null;
  domain: string | null;
  company_name: string | null;
  linkedin_url: string | null;
}

export interface FullEnrichBulkLaunchResponse {
  enrichment_id: string;
}

export type FullEnrichBulkStatus = 'IN_PROGRESS' | 'FINISHED' | 'FAILED';

export interface FullEnrichContactResult {
  contact_id: string;
  status: 'FINISHED' | 'FAILED' | 'NOT_FOUND';
  contact: {
    emails: { email: string; qualification: string | null }[] | null;
    phones: { number: string; qualification: string | null }[] | null;
  } | null;
}

export interface FullEnrichBulkStatusResponse {
  enrichment_id: string;
  status: FullEnrichBulkStatus;
  datas: FullEnrichContactResult[];
}

// --- Reverse email lookup : email → profil personne + employeur actuel ---
// POST /contact/reverse/email/bulk puis GET /contact/reverse/email/bulk/{id}
// (asynchrone, même motif lancer-puis-sonder que le waterfall). Formes
// vérifiées contre docs.fullenrich.com le 2026-07-09.

export type FullEnrichReverseStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'CANCELED'
  | 'CREDITS_INSUFFICIENT'
  | 'FINISHED'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface FullEnrichReverseEmployment {
  title: string | null;
  seniority: string | null;
  is_current: boolean;
  start_at: string | null;
  end_at: string | null;
  company: {
    name: string | null;
    domain: string | null;
  } | null;
}

export interface FullEnrichReverseProfile {
  first_name: string | null;
  last_name: string | null;
  location: {
    country: string | null;
    city: string | null;
  } | null;
  social_profiles: {
    professional_network: { url: string | null } | null;
  } | null;
  employment: {
    current: FullEnrichReverseEmployment | null;
    all: FullEnrichReverseEmployment[];
  } | null;
}

export interface FullEnrichReverseRecord {
  input: { email: string };
  /** null quand personne n'a été trouvé derrière l'email. */
  profile: FullEnrichReverseProfile | null;
}

export interface FullEnrichReverseResponse {
  id: string;
  status: FullEnrichReverseStatus;
  data: FullEnrichReverseRecord[];
}
