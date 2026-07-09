import type { FullEnrichClient } from './client';
import { FullEnrichHttpClient } from './http-client';
import { FullEnrichMockClient } from './mock-client';

export type { FullEnrichClient } from './client';
export { FullEnrichClientError } from './client';
export * from './types';
export * from './waterfall';

let instance: FullEnrichClient | null = null;

export function getFullEnrichClient(): FullEnrichClient {
  if (!instance) {
    const useMock = process.env.FULLENRICH_USE_MOCK === 'true' || !process.env.FULLENRICH_API_KEY;
    instance = useMock ? new FullEnrichMockClient() : new FullEnrichHttpClient();
  }
  return instance;
}
