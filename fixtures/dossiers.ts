/**
 * A5 — Les fixtures n°9, 10, 11 : le niveau dossier (branchement CRM,
 * historique relationnel). Elles s'exécutent contre CRM_MOCK.
 */
import type { Observation } from '@/lib/schema/canonical';
import type { NomChamp } from '@/lib/config/champs';
import { DATE_REFERENCE } from './conflits';

export { DATE_REFERENCE };

export interface FixtureDossier {
  numero: number;
  nom: string;
  lead: { domaine?: string; email?: string };
  /** Observations déjà estampillées par les collecteurs Sillage/FullEnrich.
   *  Le CRM, lui, est lu via CRM_MOCK par le moteur. */
  observationsExternes: Partial<Record<NomChamp, Observation[]>>;
  attendu: {
    branche: 'MISE_A_JOUR' | 'NOUVEAU_LEAD';
    /** n°9 : le deal Globex remonte dans historique.relationnel. */
    relationnel_contient?: string;
    /** n°9, contre-exemple : le deal dans l'entreprise du lead remonte dans
     *  historique.deals et JAMAIS dans le relationnel — c'est ce qui rend le
     *  filtre « autre entreprise » discriminant. */
    deals_contient?: string;
    relationnel_ne_contient_pas?: string;
    /** n°9 : aucun conflit ni question sur l'historique (mono-source). */
    aucune_question_sur?: NomChamp[];
    /** n°10 : l'ambiguïté du branchement est un CONFLIT SIGNALÉ (champ
     *  compte_crm : resolution impossible + a_signaler_AE), dont la question
     *  découle par la règle « conflit → question » — pas un mécanisme ad hoc. */
    question_sur_branchement?: boolean;
  };
}

export const FIXTURES_DOSSIERS: FixtureDossier[] = [
  {
    numero: 9,
    nom: 'Décideur ayant fait un deal dans une AUTRE entreprise → relationnel remonté, aucun conflit',
    lead: { domaine: 'acme.fr', email: 'marie.durand@acme.fr' },
    observationsExternes: {
      titre: [
        { valeur: 'VP Sales', source: 'sillage', date_donnee: '2026-06-28T00:00:00Z', confiance_source: 0.85 },
      ],
    },
    attendu: {
      branche: 'MISE_A_JOUR',
      relationnel_contient: 'Globex',
      deals_contient: 'Acme',
      relationnel_ne_contient_pas: 'Acme',
      aucune_question_sur: ['historique_relationnel', 'historique_deals'],
      question_sur_branchement: false,
    },
  },
  {
    numero: 10,
    nom: 'Compte qui matche DEUX fois → NOUVEAU_LEAD + conflit signalé',
    lead: { domaine: 'double.io' },
    observationsExternes: {
      nom_legal: [
        { valeur: 'Double', source: 'sillage', date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.85 },
      ],
    },
    attendu: {
      branche: 'NOUVEAU_LEAD',
      question_sur_branchement: true,
    },
  },
  {
    numero: 11,
    nom: 'Lead ABSENT du CRM → branche neuve, dossier NOUVEAU_LEAD',
    lead: { domaine: 'neuve.ai', email: 'ceo@neuve.ai' },
    observationsExternes: {
      nom_legal: [
        { valeur: 'Neuve AI', source: 'sillage', date_donnee: '2026-07-05T00:00:00Z', confiance_source: 0.85 },
      ],
      effectif: [
        { valeur: 25, source: 'fullenrich', date_donnee: '2026-07-02T00:00:00Z', confiance_source: 0.8 },
      ],
    },
    attendu: {
      branche: 'NOUVEAU_LEAD',
      question_sur_branchement: false,
    },
  },
];
