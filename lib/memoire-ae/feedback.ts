import type { ProfilAE } from '@/lib/schema/canonical';

// Interprète le feedback de l'AE pour SÉLECTIONNER une valeur d'énumération —
// jamais recopier le texte libre. C'est ce qui neutralise par construction le
// vecteur d'injection le plus grave : le feedback était persisté puis rejoué
// à chaque run suivant (docs/axe-B-surface.md §B6). Une classification par
// mots-clés bornés reste hors de la liste des quatre points d'appel LLM :
// le geste ("plus court", "tutoie-moi") est trop simple pour justifier un
// appel modèle, et un classifieur déterministe ne peut structurellement pas
// porter une injection — contrairement à un LLM qui lirait le texte brut.

const REGLES: [RegExp, Partial<ProfilAE>][] = [
  [/tutoie|tu peux me tutoyer/i, { tutoiement: 'oui' }],
  [/vouvoie|restons vouvoyer|pas de tutoiement/i, { tutoiement: 'non' }],
  [/plus court|bref|concis/i, { longueur: 'courte' }],
  [/plus détaillé|plus de détails|développe/i, { longueur: 'détaillée' }],
  [/formel|professionnel/i, { registre: 'formel' }],
  [/familier|décontracté|casual/i, { registre: 'familier' }],
  [/direct|va droit au but/i, { tournure: 'directe' }],
  [/indirect|en douceur|diplomate/i, { tournure: 'indirecte' }],
  [/moins de jargon|simplifie|évite le jargon/i, { densite_jargon: 'faible' }],
  [/plus technique|plus de jargon/i, { densite_jargon: 'élevée' }],
];

export function interpreterFeedback(feedbackTexte: string, profilActuel: ProfilAE): ProfilAE {
  let profil = { ...profilActuel };
  for (const [motif, patch] of REGLES) {
    if (motif.test(feedbackTexte)) profil = { ...profil, ...patch };
  }
  return profil;
}
