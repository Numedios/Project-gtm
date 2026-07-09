import type { FullEnrichClient } from './client';
import { FullEnrichClientError } from './client';
import type { FullEnrichBulkLaunchResponse, FullEnrichBulkStatusResponse, FullEnrichContactInput } from './types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new FullEnrichClientError(`Variable d'environnement manquante : ${name}`);
  return value;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const timeoutMs = Number(process.env.FULLENRICH_TIMEOUT ?? '30') * 1000;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((err) => {
    throw new FullEnrichClientError(`Requête FullEnrich en échec vers ${url}`, err);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<corps illisible>');
    throw new FullEnrichClientError(`FullEnrich a répondu ${res.status} sur ${url} : ${body}`);
  }
  return res.json() as Promise<T>;
}

export class FullEnrichHttpClient implements FullEnrichClient {
  private baseUrl(): string {
    return requireEnv('FULLENRICH_API_BASE_URL').replace(/\/$/, '');
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${requireEnv('FULLENRICH_API_KEY')}`,
      'Content-Type': 'application/json',
    };
  }

  async launchBulkEnrichment(contacts: FullEnrichContactInput[]): Promise<FullEnrichBulkLaunchResponse> {
    const limit = Number(process.env.FULLENRICH_BULK_LIMIT ?? '100');
    if (contacts.length > limit) {
      throw new FullEnrichClientError(`Lot de ${contacts.length} contacts au-delà de la limite (${limit})`);
    }
    if (contacts.length === 0) {
      throw new FullEnrichClientError('Aucun contact à enrichir');
    }

    return fetchJson<FullEnrichBulkLaunchResponse>(`${this.baseUrl()}/contact/enrich/bulk`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name: `qualif-ae-${new Date().toISOString()}`,
        datas: contacts.map((c) => ({
          contact_id: c.contact_id,
          firstname: c.firstname,
          lastname: c.lastname,
          domain: c.domain,
          company_name: c.company_name,
          linkedin_url: c.linkedin_url,
          enrich_fields: ['contact.emails', 'contact.phones'],
        })),
      }),
    });
  }

  async getBulkStatus(enrichmentId: string): Promise<FullEnrichBulkStatusResponse> {
    return fetchJson<FullEnrichBulkStatusResponse>(`${this.baseUrl()}/contact/enrich/bulk/${enrichmentId}`, {
      method: 'GET',
      headers: this.headers(),
    });
  }
}
