import type { FullEnrichClient } from './client';
import { FullEnrichHttpClient } from './http-client';
import { FullEnrichMockClient } from './mock-client';

export type { FullEnrichClient } from './client';
export { FullEnrichClientError } from './client';
export * from './types';
export * from './waterfall';

// Singleton sur globalThis, pas en variable de module : le mock est STATEFUL
// (il retient les lots lancés) et Next.js compile chaque route dans son propre
// bundle en dev — un module-level `instance` donnerait un mock par route, et
// l'enrichment_id lancé par /api/qualify serait inconnu de /api/fullenrich/status.
const CLE_GLOBALE = Symbol.for('qualif-ae.fullenrich-client');

export function getFullEnrichClient(): FullEnrichClient {
  const registre = globalThis as { [CLE_GLOBALE]?: FullEnrichClient };
  if (!registre[CLE_GLOBALE]) {
    const useMock = process.env.FULLENRICH_USE_MOCK === 'true' || !process.env.FULLENRICH_API_KEY;
    registre[CLE_GLOBALE] = useMock ? new FullEnrichMockClient() : new FullEnrichHttpClient();
  }
  return registre[CLE_GLOBALE];
}
