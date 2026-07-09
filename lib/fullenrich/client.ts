import type {
  FullEnrichBulkLaunchResponse,
  FullEnrichBulkStatusResponse,
  FullEnrichContactInput,
  FullEnrichReverseResponse,
} from './types';

// Le flux est asynchrone (jusqu'à 5 min : POLL_INTERVAL=15 × MAX_ATTEMPTS=20).
// On ne bloque jamais une fonction serverless dessus — voir docs/axe-B-surface.md
// §B3. launchBulkEnrichment rend l'enrichment_id immédiatement ; le sondage se
// fait depuis le client via app/api/fullenrich/status.
// Le reverse email lookup (email → profil + domaine employeur) suit le même
// motif lancer-puis-sonder : launchReverseEmail / getReverseResult.
export interface FullEnrichClient {
  launchBulkEnrichment(contacts: FullEnrichContactInput[]): Promise<FullEnrichBulkLaunchResponse>;
  getBulkStatus(enrichmentId: string): Promise<FullEnrichBulkStatusResponse>;
  launchReverseEmail(emails: string[]): Promise<FullEnrichBulkLaunchResponse>;
  getReverseResult(enrichmentId: string): Promise<FullEnrichReverseResponse>;
}

export class FullEnrichClientError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FullEnrichClientError';
  }
}
