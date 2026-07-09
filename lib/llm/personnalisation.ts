import type { ProfilAE, Question } from '@/lib/schema/canonical';
import { estPersonnalisationValide } from '@/lib/moteur/personnalisation';
import { getAnthropicClient, MODELE_REDACTION } from './anthropic';

// B6 — la forme, jamais le fond. `messages.create()` : seul point du système
// qui produit du texte destiné à un humain (docs/axe-B-surface.md §B6).
//
// Invariant de bijection : même cardinalité, même ordre, même champ, même
// type ; seul `texte` change. L'ordre des questions est FIGÉ par le moteur
// (consoliderDossier) — le réordonner reviendrait à hiérarchiser le fond.
// La sortie passe par le validateur du moteur (estPersonnalisationValide),
// comme son en-tête l'exige : on vérifie à la frontière plutôt que de faire
// confiance au texte libre renvoyé par le modèle.

const LIBELLE_PROFIL: Record<keyof ProfilAE, Record<string, string>> = {
  registre: { formel: 'registre formel', neutre: 'registre neutre', direct: 'registre direct, sans détour' },
  longueur: { courte: 'phrases courtes', moyenne: 'longueur moyenne', detaillee: 'formulations détaillées' },
  tournure: { interrogative: 'tournure interrogative', affirmative: 'tournure affirmative (« Confirmez que… »)' },
  tutoiement: { tu: 'tutoiement', vous: 'vouvoiement' },
  densite_jargon: {
    grand_public: 'vocabulaire grand public, zéro jargon',
    metier: 'vocabulaire métier usuel',
    expert: 'vocabulaire expert, jargon bienvenu',
  },
};

function construirePrompt(questions: Question[], profil: ProfilAE): string {
  const style = (Object.keys(LIBELLE_PROFIL) as (keyof ProfilAE)[])
    .map((slot) => LIBELLE_PROFIL[slot][profil[slot]])
    .join(', ');
  const liste = questions.map((q, i) => `${i}: [${q.type}] ${q.texte}`).join('\n');

  return [
    "Reformule la TOURNURE de chacune des questions ci-dessous selon le style de l'AE.",
    'Ne change jamais le FOND : ne rajoute ni ne retire aucune information, aucune question,',
    'et ne change pas leur ordre.',
    '',
    `Style : ${style}.`,
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

  if (parLigne.size !== questions.length) {
    throw new Error(
      `Personnalisation rejetée : ${parLigne.size}/${questions.length} questions reformulées — bijection rompue`,
    );
  }

  const personnalisees = questions.map((q, i) => ({ ...q, texte: parLigne.get(i) ?? q.texte }));

  // Le validateur du MOTEUR a le dernier mot — même champ, même type, même
  // ordre. S'il refuse, on lève : l'appelant sert les questions d'origine.
  if (!estPersonnalisationValide(questions, personnalisees)) {
    throw new Error('Personnalisation rejetée par estPersonnalisationValide — bijection rompue');
  }

  return personnalisees;
}
