import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingDetail,
  SillageCompanyMappingSummary,
  SillageLead,
  SillageSignalDetection,
} from './types';

// Cache le transport (MCP direct aujourd'hui, REST demain si Sillage l'ouvre)
// derrière une interface, pour que le choix ne contamine jamais le reste du
// code — voir docs/axe-B-surface.md §B2.
export interface SillageClient {
  findCompanyMappingByDomain(domaine: string): Promise<SillageCompanyMappingSummary | null>;
  getCompanyMapping(mappingId: number): Promise<SillageCompanyMappingDetail>;
  getCompany(companyId: number): Promise<SillageCompanyEnrichment | null>;
  getLead(leadId: number): Promise<SillageLead | null>;
  listRecentSignals(params: { companyId?: number; pageSize?: number }): Promise<SillageSignalDetection[]>;
}

export class SillageClientError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SillageClientError';
  }
}
