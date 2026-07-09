import type { ProfilAE } from '@/lib/schema/canonical';

// Interprète le feedback de l'AE pour SÉLECTIONNER une valeur d'énumération —
// jamais recopier le texte libre. C'est ce qui neutralise par construction le
// vecteur d'injection le plus grave : le feedback était persisté puis rejoué
// à chaque run suivant (docs/axe-B-surface.md §B6). Une classification par
// mots-clés bornés reste hors de la liste des quatre points d'appel LLM :
// le geste ("plus court", "tutoie-moi") est trop simple pour justifier un
// appel modèle, et un classifieur déterministe ne peut structurellement pas
// porter une injection.

const REGLES: [RegExp, Partial<ProfilAE>][] = [
  [/tutoie|tu peux me tutoyer/i, { tutoiement: 'tu' }],
  [/vouvoie|pas de tutoiement/i, { tutoiement: 'vous' }],
  [/plus court|bref|concis/i, { longueur: 'courte' }],
  [/plus détaillé|plus de détails|développe/i, { longueur: 'detaillee' }],
  [/formel|protocolaire/i, { registre: 'formel' }],
  [/direct|va droit au but/i, { registre: 'direct' }],
  [/neutre|standard/i, { registre: 'neutre' }],
  [/affirmati|en affirmant/i, { tournure: 'affirmative' }],
  [/interrogati|sous forme de question/i, { tournure: 'interrogative' }],
  [/grand public|simplifie|évite le jargon|moins de jargon/i, { densite_jargon: 'grand_public' }],
  [/expert|plus technique|plus de jargon/i, { densite_jargon: 'expert' }],
];

export function interpreterFeedback(feedbackTexte: string, profilActuel: ProfilAE): ProfilAE {
  let profil = { ...profilActuel };
  for (const [motif, patch] of REGLES) {
    if (motif.test(feedbackTexte)) profil = { ...profil, ...patch };
  }
  return profil;
}
