import type { ProfilAE, Question } from '@/lib/schema/canonical';
import { getAnthropicClient, MODELE_REDACTION } from './anthropic';

// B6 — la forme, jamais le fond. `messages.create()` : seul point du système
// qui produit du texte destiné à un humain (docs/axe-B-surface.md §B6).
//
// Invariant de bijection : même cardinalité, même ordre, seul `texte` change.
// L'ordre des questions est figé en amont — le réordonner reviendrait à
// hiérarchiser le fond, ce que la personnalisation n'a pas le droit de faire.
// On le VÉRIFIE ici, à la frontière, plutôt que de faire confiance au texte
// libre renvoyé par le modèle : si une ligne manque, on lève plutôt que de
// laisser passer une liste tronquée ou réordonnée en silence.

function formaterQuestion(q: Question, index: number): string {
  return `${index}: [${q.type}] ${q.texte}`;
}

function construirePrompt(questions: Question[], profil: ProfilAE): string {
  const liste = questions.map((q, i) => formaterQuestion(q, i)).join('\n');
  return [
    "Reformule la TOURNURE de chacune des questions ci-dessous selon le profil de style de l'AE.",
    'Ne change jamais le FOND de la question : ne reformule pas pour ajouter ou retirer une',
    "information, n'ajoute et ne supprime aucune question, ne change pas leur ordre.",
    '',
    `Profil de style — registre: ${profil.registre}, longueur: ${profil.longueur}, tournure: ${profil.tournure}, ` +
      `tutoiement: ${profil.tutoiement}, jargon: ${profil.densite_jargon}.`,
    '',
    'Questions (une par ligne, à réécrire à l’identique en nombre et en ordre) :',
    liste,
    '',
    `Réponds avec EXACTEMENT ${questions.length} lignes, au format "N: texte reformulé", une par`,
    'question, dans le même ordre, N correspondant à l’index ci-dessus. Aucun texte avant ou après.',
  ].join('\n');
}

function parserReponse(texte: string, count: number): Map<number, string> {
  const parLigne = new Map<number, string>();
  for (const ligne of texte.split('\n')) {
    const match = ligne.match(/^(\d+):\s*(.+)$/);
    if (!match?.[1] || !match[2]) continue;
    const index = Number(match[1]);
    if (index >= 0 && index < count) parLigne.set(index, match[2].trim());
  }
  return parLigne;
}

export async function personnaliserQuestions(questions: Question[], profil: ProfilAE): Promise<Question[]> {
  if (questions.length === 0) return questions;

  const client = getAnthropicClient();
  const reponse = await client.messages.create({
    model: MODELE_REDACTION,
    max_tokens: 4000,
    messages: [{ role: 'user', content: construirePrompt(questions, profil) }],
  });

  const blocTexte = reponse.content.find((b) => b.type === 'text');
  const parLigne = parserReponse(blocTexte?.type === 'text' ? blocTexte.text : '', questions.length);

  // Bijection non négociable : si le modèle a fusionné, sauté ou décalé une
  // ligne, on ne laisse PAS passer une liste dépareillée — on refuse la
  // personnalisation plutôt que de trahir l'invariant fond/forme.
  if (parLigne.size !== questions.length) {
    throw new Error(
      `Personnalisation rejetée : ${parLigne.size}/${questions.length} questions reformulées — bijection rompue`,
    );
  }

  return questions.map((q, i) => ({ ...q, texte: parLigne.get(i) ?? q.texte }));
}
