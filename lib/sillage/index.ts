import type { SillageClient } from './client';
import { SillageMcpClient } from './mcp-client';
import { SillageMockClient } from './mock-client';

export type { SillageClient } from './client';
export { SillageClientError } from './client';
export * from './types';
export * from './normalize';
export * from './signaux';

let instance: SillageClient | null = null;

// SILLAGE_USE_MOCK=true (ou clé absente) → mock. Sinon → MCP direct réel.
// C'est la seule fonction de ce module que le reste du code doit appeler.
export function getSillageClient(): SillageClient {
  if (!instance) {
    const useMock = process.env.SILLAGE_USE_MOCK === 'true' || !process.env.SILLAGE_API_KEY;
    instance = useMock ? new SillageMockClient() : new SillageMcpClient();
  }
  return instance;
}
