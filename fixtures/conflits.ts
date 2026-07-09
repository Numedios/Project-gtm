/**
 * A5 — Les fixtures de conflit n°1 à 8 : la spécification exécutable de
 * l'arbitrage. Chaque ligne du tableau de docs/axe-A-moteur.md §A5 est ici,
 * entrée exacte + sortie attendue. Elles s'écrivent AVANT le moteur.
 *
 * Date de référence commune : le moteur ne lit JAMAIS l'horloge — la date
 * lui est injectée (invariant : à entrée identique, sortie identique).
 */
import type { Observation, Resolution } from '@/lib/schema/canonical';
import type { NomChamp, SeuilsClasse } from '@/lib/config/champs';

export const DATE_REFERENCE = '2026-07-09T00:00:00Z';

export type EmissionAttendue =
  | 'rien'
  | 'signal'
  | 'question_confirmation'
  | 'question_ouverte';

export interface FixtureConflit {
  numero: number;
  nom: string;
  champ: NomChamp;
  observations: Observation[];
  /** Le seuil est un bouton, pas une constante (fixtures n°2 vs n°3). */
  seuils?: Partial<SeuilsClasse>;
  attendu: {
    valeur_retenue: unknown;
    resolution: Resolution;
    a_signaler_AE: boolean;
    emission: EmissionAttendue;
    /** n°7 : la corroboration doit faire MONTER la confiance au-dessus de la
     *  meilleure confiance individuelle décayée. */
    confiance_strictement_superieure_a?: number;
  };
}

export const FIXTURES_CONFLITS: FixtureConflit[] = [
  {
    numero: 1,
    nom: 'Titre périmé divergeant de Sillage — champ volatile → signal, aucune question',
    champ: 'titre',
    observations: [
      { valeur: 'Head of Sales', source: 'crm', date_donnee: '2024-11-02T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'VP Sales', source: 'sillage', date_donnee: '2026-06-28T00:00:00Z', confiance_source: 0.85 },
    ],
    attendu: {
      valeur_retenue: 'VP Sales',
      resolution: 'auto',
      a_signaler_AE: false,
      emission: 'signal',
    },
  },
  {
    numero: 2,
    nom: 'pays_siege divergent, 2 sources fraîches, SEUIL_ECART = 0 → auto + signalé → confirmation',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2026-06-20T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    seuils: { SEUIL_ECART: 0 },
    attendu: {
      valeur_retenue: 'Belgique', // la récence prime
      resolution: 'auto',
      a_signaler_AE: true,
      emission: 'question_confirmation',
    },
  },
  {
    numero: 3,
    nom: 'Même divergence, SEUIL_ECART relevé à 30 j → valeur retenue en silence',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2026-06-20T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    seuils: { SEUIL_ECART: 30 }, // écart réel : 11 jours
    attendu: {
      valeur_retenue: 'Belgique',
      resolution: 'auto',
      a_signaler_AE: false,
      emission: 'rien',
    },
  },
  {
    numero: 4,
    nom: 'Valeur retenue elle-même périmée (les DEUX sources sont vieilles) → confirmation',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2025-01-10T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2025-06-01T00:00:00Z', confiance_source: 0.8 },
    ],
    // SEUIL_ECART relevé pour isoler le terme age(valeur_retenue) > SEUIL_AGE :
    // écart 142 j ≤ 365, mais âge de la valeur retenue ≈ 403 j > 180.
    seuils: { SEUIL_ECART: 365, SEUIL_AGE: 180 },
    attendu: {
      valeur_retenue: 'Belgique',
      resolution: 'auto',
      a_signaler_AE: true,
      emission: 'question_confirmation',
    },
  },
  {
    numero: 5,
    nom: 'Effectif différant de ~6 % — tolérance numérique → ni conflit ni signal',
    champ: 'effectif',
    observations: [
      { valeur: 100, source: 'fullenrich', date_donnee: '2026-06-15T00:00:00Z', confiance_source: 0.8 },
      { valeur: 106, source: 'sillage', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.85 },
    ],
    attendu: {
      valeur_retenue: 106, // la plus récente
      resolution: 'auto',
      a_signaler_AE: false,
      emission: 'rien',
    },
  },
  {
    numero: 5.5,
    nom: 'Écart sous tolérance mais AUCUNE date — le garde-fou n°1 prime sur la tolérance',
    champ: 'effectif',
    observations: [
      { valeur: 100, source: 'fullenrich', date_donnee: null, confiance_source: 0.8 },
      { valeur: 106, source: 'sillage', date_donnee: null, confiance_source: 0.8 },
    ],
    attendu: {
      // « La plus récente » est inexécutable sans dates ; aucune ligne de la
      // spec n'autorise un départage silencieux ici. Pas de date, pas
      // d'arbitrage automatique.
      valeur_retenue: null,
      resolution: 'impossible',
      a_signaler_AE: true,
      emission: 'question_ouverte',
    },
  },
  {
    numero: 6,
    nom: 'Champ sans date — pas de date, pas d’arbitrage → question ouverte',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: null, confiance_source: 0.9 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    attendu: {
      valeur_retenue: null,
      resolution: 'impossible',
      a_signaler_AE: true,
      emission: 'question_ouverte',
    },
  },
  {
    numero: 7,
    nom: 'Deux sources, même valeur — corroboration → confiance rehaussée, aucun conflit',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2026-06-20T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'France', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    attendu: {
      valeur_retenue: 'France',
      resolution: 'auto',
      a_signaler_AE: false,
      emission: 'rien',
      // La meilleure confiance individuelle décayée est < 0.9 ; l'union
      // probabiliste doit dépasser strictement 0.9.
      confiance_strictement_superieure_a: 0.9,
    },
  },
  {
    numero: 8,
    nom: 'Même date, valeurs divergentes, confiances INÉGALES → départage par confiance_source',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.9 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    attendu: {
      valeur_retenue: 'France', // confiance_source la plus haute
      resolution: 'auto',
      a_signaler_AE: false, // écart de dates = 0 ⇒ pas > SEUIL_ECART, âges frais
      emission: 'rien',
    },
  },
  {
    numero: 8.5,
    nom: 'Même date, valeurs divergentes, confiances ÉGALES → conflit, question ouverte',
    champ: 'pays_siege',
    observations: [
      { valeur: 'France', source: 'crm', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
      { valeur: 'Belgique', source: 'fullenrich', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
    ],
    attendu: {
      valeur_retenue: null,
      resolution: 'impossible',
      a_signaler_AE: true,
      emission: 'question_ouverte',
    },
  },
];
