// Formes REST FullEnrich v2 — enrichissement de CONTACTS uniquement (contrainte
// ferme du brief §2). Jamais de données entreprise via ce connecteur.

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
