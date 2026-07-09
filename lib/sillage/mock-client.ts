import type { SillageClient } from './client';
import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingDetail,
  SillageCompanyMappingSummary,
  SillageLead,
  SillageSignalDetection,
} from './types';

// Pour construire contre, dès maintenant, sans réseau ni clé — voir
// docs/axe-B-surface.md §B2 : "Tu travailles contre le mock dès maintenant."
// Les données recoupent délibérément le dossier d'exemple
// (lib/fixtures/dossier-exemple.json) : même domaine, même décideur.

const MAPPING: SillageCompanyMappingSummary = {
  id: 741,
  request_date: '2026-06-28T00:00:00.000Z',
  version: 1,
  status: 'complete',
  company: { id: 540, name: 'Acme Corp', domain: 'acme-corp.example' },
};

const MAPPING_DETAIL: SillageCompanyMappingDetail = {
  ...MAPPING,
  profiles: [
    {
      id: 90001,
      first_name: 'Marie',
      last_name: 'Durand',
      position: 'VP Sales',
      position_start_date: '2026-06-30T00:00:00.000Z',
      linkedin_handle: 'marie-durand-example',
      linkedin_url: 'https://linkedin.com/in/marie-durand-example',
      linkedin_headline: 'VP Sales @ Acme Corp',
      linkedin_about: null,
      avatar_url: null,
      email: null,
      phone_number: null,
      location: 'Paris, France',
    },
  ],
};

const COMPANY: SillageCompanyEnrichment = {
  name: 'Acme Corp',
  domain: 'acme-corp.example',
  url: 'https://acme-corp.example',
  linkedin_url: 'https://linkedin.com/company/acme-corp-example',
  location: 'Paris, France',
  locations: [{ is_hq: true, city: 'Paris', region: 'Île-de-France', country: 'France', country_code: 'FR' }],
  number_of_employees: 220,
  employee_range: '201-500',
  founded_year: 2016,
  industries: 'SaaS B2B',
  activity_summary: 'Plateforme SaaS de gestion de la relation client pour PME.',
};

const LEAD: SillageLead = {
  id: 90001,
  first_name: 'Marie',
  last_name: 'Durand',
  linkedin_url: 'https://linkedin.com/in/marie-durand-example',
  linkedin_headline: 'VP Sales @ Acme Corp',
  position: 'VP Sales',
  location: 'Paris, France',
  geo: { city: 'Paris', region: 'Île-de-France', country: 'France', country_code: 'FR' },
  company: {
    id: 540,
    name: 'Acme Corp',
    domain: 'acme-corp.example',
    employee_range: '201-500',
    location: 'Paris, France',
    activity_summary: 'Plateforme SaaS de gestion de la relation client pour PME.',
  },
  experiences: [
    {
      title: 'VP Sales',
      company_name: 'Acme Corp',
      company_linkedin_url: 'https://linkedin.com/company/acme-corp-example',
      location: 'Paris, France',
      start_date: '2026-06-30T00:00:00.000Z',
      end_date: null,
      is_current: true,
    },
    {
      title: 'Head of Sales',
      company_name: 'Acme Corp',
      company_linkedin_url: 'https://linkedin.com/company/acme-corp-example',
      location: 'Paris, France',
      start_date: '2023-01-15T00:00:00.000Z',
      end_date: '2026-06-30T00:00:00.000Z',
      is_current: false,
    },
  ],
};

const SIGNALS: SillageSignalDetection[] = [
  {
    id: 500001,
    signal_type: 'jobUpdate',
    detected_at: '2026-06-30T09:00:00.000Z',
    signal_date: '2026-06-30T00:00:00.000Z',
    lead_id: 90001,
    company_id: 540,
    agent_id: 1,
    source_url: 'https://linkedin.com/in/marie-durand-example',
    excerpt: 'Marie Durand a été promue VP Sales chez Acme Corp.',
  },
  {
    id: 500002,
    signal_type: 'jobPosting',
    detected_at: '2026-06-25T09:00:00.000Z',
    signal_date: '2026-06-25T00:00:00.000Z',
    lead_id: null,
    company_id: 540,
    agent_id: 2,
    source_url: 'https://acme-corp.example/careers',
    excerpt: '4 postes commerciaux ouverts en France.',
  },
];

export class SillageMockClient implements SillageClient {
  async findCompanyMappingByDomain(domaine: string): Promise<SillageCompanyMappingSummary | null> {
    return domaine.trim().toLowerCase() === MAPPING.company.domain ? MAPPING : null;
  }

  async getCompanyMapping(mappingId: number): Promise<SillageCompanyMappingDetail> {
    if (mappingId !== MAPPING.id) throw new Error(`Mapping mock inconnu : ${mappingId}`);
    return MAPPING_DETAIL;
  }

  async getCompany(companyId: number): Promise<SillageCompanyEnrichment | null> {
    return companyId === MAPPING.company.id ? COMPANY : null;
  }

  async getLead(leadId: number): Promise<SillageLead | null> {
    return leadId === LEAD.id ? LEAD : null;
  }

  async listRecentSignals(params: { companyId?: number }): Promise<SillageSignalDetection[]> {
    return params.companyId ? SIGNALS.filter((s) => s.company_id === params.companyId) : SIGNALS;
  }
}
