// Formes brutes renvoyées par le serveur MCP Sillage — vérifiées en session
// contre l'API réelle (workspace de test, clé sk_live_…) le 2026-07-09.
// Sillage ne renvoie JAMAIS d'email ni de téléphone sur un lead : c'est ce qui
// justifie le waterfall FullEnrich (B3), ce n'est pas une hypothèse de design.

export interface SillageCompanyMappingSummary {
  id: number;
  request_date: string; // ISO — sert de date_donnee pour tout ce qui vient de ce mapping
  version: number;
  status: 'in_progress' | 'complete';
  company: { id: number; name: string; domain: string | null };
}

export interface SillageCompanyMappingProfile {
  id: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_start_date: string | null;
  linkedin_handle: string | null;
  linkedin_url: string | null;
  linkedin_headline: string | null;
  linkedin_about: string | null;
  avatar_url: string | null;
  email: string | null;
  phone_number: string | null;
  location: string | null;
}

export interface SillageCompanyMappingDetail extends SillageCompanyMappingSummary {
  profiles: SillageCompanyMappingProfile[];
}

export interface SillageCompanyLocation {
  is_hq: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
}

export interface SillageCompanyEnrichment {
  name: string | null;
  domain: string | null;
  url: string | null;
  linkedin_url: string | null;
  location: string | null;
  locations: SillageCompanyLocation[];
  number_of_employees: number | null;
  employee_range: string | null;
  founded_year: number | null;
  industries: string | null;
  activity_summary: string | null;
}

export interface SillageLeadExperience {
  title: string;
  company_name: string;
  company_linkedin_url: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface SillageLeadCompany {
  id: number;
  name: string | null;
  domain: string | null;
  employee_range: string | null;
  location: string | null;
  activity_summary: string | null;
}

export interface SillageLead {
  id: number;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  linkedin_headline: string | null;
  position: string | null;
  location: string | null;
  geo: { city: string | null; region: string | null; country: string | null; country_code: string | null } | null;
  company: SillageLeadCompany | null;
  experiences: SillageLeadExperience[] | null;
}

export interface SillageSignalDetection {
  id: number;
  signal_type: string; // 'keywordDetection' | 'competitor' | 'customer' | 'jobUpdate' | … (voir get_signal_playbook)
  detected_at: string;
  signal_date: string;
  lead_id: number | null;
  company_id: number | null;
  agent_id: number;
  source_url: string | null;
  excerpt?: string | null;
}
