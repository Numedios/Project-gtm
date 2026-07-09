import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

// Point d'entrée unique vers l'API Anthropic. Les quatre appels LLM du
// système (B4×2, B5, B6) passent tous par ce client — voir SYNTHESE.md
// "Les quatre points d'appel LLM — et nulle part ailleurs".
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Variable d'environnement manquante : ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const MODELE_JUGEMENT = 'claude-opus-4-8'; // réconciliation (proposeur/vérificateur), mise en prose ICP
export const MODELE_REDACTION = 'claude-sonnet-5'; // personnalisation des questions, seul texte destiné à un humain

// `messages.parse()` attache la sortie structurée validée sur `.parsed_output`
// du message renvoyé (vérifié sur le SDK 0.110 installé). Centralisé ici :
// un seul endroit à corriger si le SDK renomme le champ.
export function contenuParse<T>(reponse: { parsed_output: T | null }): T {
  if (reponse.parsed_output == null) throw new Error('Sortie structurée absente de la réponse Anthropic');
  return reponse.parsed_output;
}
