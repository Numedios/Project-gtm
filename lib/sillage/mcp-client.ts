import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { SillageClient } from './client';
import { SillageClientError } from './client';
import type {
  SillageCompanyEnrichment,
  SillageCompanyMappingDetail,
  SillageCompanyMappingSummary,
  SillageLead,
  SillageSignalDetection,
} from './types';

// Client MCP direct : nous appelons listTools()/callTool() nous-mêmes, aucun
// modèle dans la boucle. C'est la seule voie compatible avec la décision
// "collecteurs déterministes" — voir docs/axe-B-surface.md §B2 et
// audit/05-connecteurs.md §5.1. Le risque "MCP renvoie de la prose" a été
// levé le 2026-07-09 : les 35 outils exposent un outputSchema JSON typé.

let clientPromise: Promise<Client> | null = null;

async function getConnectedClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const baseUrl = requireEnv('SILLAGE_API_BASE_URL');
      const apiKey = requireEnv('SILLAGE_API_KEY');

      const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
        requestInit: {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      });

      const client = new Client({ name: 'qualif-ae', version: '0.1.0' }, { capabilities: {} });
      await client.connect(transport);
      return client;
    })().catch((err) => {
      clientPromise = null; // ne pas garder une promesse rejetée en cache
      throw new SillageClientError('Échec de connexion au serveur MCP Sillage', err);
    });
  }
  return clientPromise;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new SillageClientError(`Variable d'environnement manquante : ${name}`);
  return value;
}

// Le serveur préfixe ses outils (`sillage_v2_get_company`, …). On résout le
// nom logique contre le listTools() réel — exact d'abord, suffixe ensuite —
// plutôt que de coder une convention en dur qui casserait à la v3.
let nomsOutilsPromise: Promise<string[]> | null = null;

async function resoudreNomOutil(nomLogique: string): Promise<string> {
  const client = await getConnectedClient();
  if (!nomsOutilsPromise) {
    nomsOutilsPromise = client.listTools().then((r) => r.tools.map((t) => t.name));
    nomsOutilsPromise.catch(() => (nomsOutilsPromise = null));
  }
  const noms = await nomsOutilsPromise;
  const resolu = noms.find((n) => n === nomLogique) ?? noms.find((n) => n.endsWith(`_${nomLogique}`));
  if (!resolu) throw new SillageClientError(`Aucun outil MCP Sillage ne correspond à "${nomLogique}"`);
  return resolu;
}

// Le serveur expose du contenu structuré typé (outputSchema). On lit en
// priorité `structuredContent` ; le fallback texte n'est là que par
// prudence — s'il fallait un jour parser de la prose, ce serait le signal
// que le risque §B2 est réapparu, et ça doit lever, pas être absorbé.
async function callToolJson<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const client = await getConnectedClient();
  const nomReel = await resoudreNomOutil(toolName);
  let result;
  try {
    result = await client.callTool({ name: nomReel, arguments: args });
  } catch (err) {
    throw new SillageClientError(`Appel de l'outil MCP "${nomReel}" en échec`, err);
  }

  if (result.isError) {
    const premierBloc = Array.isArray(result.content) ? result.content[0] : undefined;
    const message = premierBloc?.type === 'text' ? premierBloc.text : 'erreur sans message';
    throw new SillageClientError(`L'outil MCP "${nomReel}" a renvoyé une erreur : ${message}`);
  }

  if (result.structuredContent) {
    return result.structuredContent as T;
  }

  const first = Array.isArray(result.content) ? result.content[0] : undefined;
  if (first?.type === 'text') {
    try {
      return JSON.parse(first.text) as T;
    } catch (err) {
      throw new SillageClientError(
        `L'outil MCP "${toolName}" a renvoyé du texte non structuré — le risque prose a réapparu`,
        err,
      );
    }
  }

  throw new SillageClientError(`L'outil MCP "${toolName}" n'a renvoyé aucun contenu exploitable`);
}

export class SillageMcpClient implements SillageClient {
  async findCompanyMappingByDomain(domaine: string): Promise<SillageCompanyMappingSummary | null> {
    const domaineNormalise = domaine.trim().toLowerCase();
    let page = 1;
    // Le workspace type contient une dizaine à quelques dizaines de comptes
    // (voir get_setup_state) : quelques pages suffisent, pas besoin de cursor infini.
    for (let i = 0; i < 10; i++) {
      const { data, meta } = await callToolJson<{
        data: SillageCompanyMappingSummary[];
        meta: { pagination: { page: number; page_count: number } };
      }>('list_company_mappings', { page, page_size: 100 });

      const match = data.find((m) => m.company.domain?.toLowerCase() === domaineNormalise);
      if (match) return match;

      if (page >= meta.pagination.page_count) return null;
      page += 1;
    }
    return null;
  }

  async getCompanyMapping(mappingId: number): Promise<SillageCompanyMappingDetail> {
    return callToolJson<SillageCompanyMappingDetail>('get_company_mapping', { mapping_id: mappingId });
  }

  async getCompany(companyId: number): Promise<SillageCompanyEnrichment | null> {
    try {
      const { data } = await callToolJson<{ data: SillageCompanyEnrichment }>('get_company', {
        company_id: companyId,
      });
      return data;
    } catch (err) {
      if (err instanceof SillageClientError) return null;
      throw err;
    }
  }

  async getLead(leadId: number): Promise<SillageLead | null> {
    try {
      const { data } = await callToolJson<{ data: SillageLead }>('get_lead', { lead_id: leadId });
      return data;
    } catch (err) {
      if (err instanceof SillageClientError) return null;
      throw err;
    }
  }

  async listRecentSignals(params: { companyId?: number; pageSize?: number }): Promise<SillageSignalDetection[]> {
    const { data } = await callToolJson<{ data: SillageSignalDetection[] }>('list_signals', {
      page_size: params.pageSize ?? 25,
    });
    return params.companyId ? data.filter((s) => s.company_id === params.companyId) : data;
  }
}
