// La trace JSON par run — le livrable de traçabilité (§10 du brief) : chaque
// appel outil, chaque décision d'arbitrage, chaque départage LLM. Concept de
// la SURFACE (axe B) : le moteur, lui, est pur et n'a pas de journal.
export interface TraceEvent {
  horodatage: string;
  etape: string;
  type: 'appel_outil' | 'decision_arbitrage' | 'departage_llm' | 'erreur';
  detail: unknown;
}
