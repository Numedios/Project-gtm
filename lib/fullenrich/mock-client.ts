import type { FullEnrichClient } from './client';
import type { FullEnrichBulkLaunchResponse, FullEnrichBulkStatusResponse, FullEnrichContactInput } from './types';

// Recoupe volontairement le décideur du dossier d'exemple (Marie Durand) pour
// que la démo B1↔B3 raconte la même histoire de bout en bout.
export class FullEnrichMockClient implements FullEnrichClient {
  private lots = new Map<string, FullEnrichContactInput[]>();

  async launchBulkEnrichment(contacts: FullEnrichContactInput[]): Promise<FullEnrichBulkLaunchResponse> {
    const enrichmentId = `mock_${Math.random().toString(36).slice(2, 10)}`;
    this.lots.set(enrichmentId, contacts);
    return { enrichment_id: enrichmentId };
  }

  async getBulkStatus(enrichmentId: string): Promise<FullEnrichBulkStatusResponse> {
    const contacts = this.lots.get(enrichmentId);
    if (!contacts) throw new Error(`enrichment_id mock inconnu : ${enrichmentId}`);

    return {
      enrichment_id: enrichmentId,
      status: 'FINISHED',
      datas: contacts.map((c) => ({
        contact_id: c.contact_id,
        status: 'FINISHED',
        contact: {
          emails:
            c.firstname && c.lastname && c.domain
              ? [
                  {
                    email: `${c.firstname.toLowerCase()}.${c.lastname.toLowerCase()}@${c.domain}`,
                    qualification: 'valid',
                  },
                ]
              : null,
          phones: [{ number: '+33 6 12 34 56 78', qualification: 'valid' }],
        },
      })),
    };
  }
}
