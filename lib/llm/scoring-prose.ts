import { z } from 'zod/v4'; // requis par zodOutputFormat — voir lib/llm/reconciliation.ts
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Score } from '@/lib/schema/canonical';
import { contenuParse, getAnthropicClient, MODELE_JUGEMENT } from './anthropic';

// B5 — met en PROSE une décomposition déjà calculée par du code pur (axe A).
// Ne calcule ni n'ajuste jamais le chiffre : le score et sa décomposition
// entrent tels quels, seul `prose` sort de cet appel. Si on laissait le
// modèle produire le score et la justification ensemble, rien ne
// garantirait qu'ils concordent — voir docs/axe-B-surface.md §B5.

const ProseScore = z.object({ prose: z.string() });

export async function mettreEnProseDecompositionIcp(score: Score): Promise<string> {
  const client = getAnthropicClient();

  const decompositionTexte = score.decomposition
    .map((d) => `- ${d.critere} : valeur ${d.valeur} × poids ${d.poids} = contribution ${d.contribution}`)
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
          `Score ICP déjà calculé : ${score.valeur}.`,
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
