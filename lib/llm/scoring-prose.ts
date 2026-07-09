import { z } from 'zod/v4'; // requis par zodOutputFormat — voir lib/llm/reconciliation.ts
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ScoreIcp } from '@/lib/schema/canonical';
import { contenuParse, getAnthropicClient, MODELE_JUGEMENT } from './anthropic';

// B5 — met en PROSE une décomposition déjà calculée par lib/moteur/scoring
// (axe A). Ne calcule ni n'ajuste jamais le chiffre : le ScoreIcp entre tel
// quel, seule la prose sort. Chaque ligne de la décomposition porte déjà son
// `detail` déterministe — le modèle ne fait que les tisser en un paragraphe.

const ProseScore = z.object({ prose: z.string() });

export async function mettreEnProseDecompositionIcp(score: ScoreIcp): Promise<string> {
  const client = getAnthropicClient();

  const decompositionTexte = score.decomposition
    .map((d) => `- ${d.critere} (poids ${d.poids}, score ${d.score}) : ${d.detail}`)
    .join('\n');

  const reponse = await client.messages.parse({
    model: MODELE_JUGEMENT,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(ProseScore) },
    messages: [
      {
        role: 'user',
        content: [
          `Score ICP déjà calculé : ${score.score}/100.`,
          'Décomposition par critère (déjà calculée, ne pas la recalculer ni la contredire) :',
          decompositionTexte,
          '',
          'Rédige un paragraphe court (3-4 phrases) qui met cette décomposition en mots pour un',
          'Account Executive. Ne mentionne aucun chiffre qui ne figure pas déjà ci-dessus. Ne',
          "propose ni ne suggère un score différent : ton rôle est d'expliquer, pas de juger.",
        ].join('\n'),
      },
    ],
  });

  return contenuParse(reponse).prose;
}
