/**
 * A6 — Les trois formules (A4) : fonctions pures, testées sans réseau ni modèle.
 */
import { describe, expect, it } from 'vitest';
import { DATE_REFERENCE } from '@/fixtures/conflits';
import {
  confianceObservations,
  calculerCompletude,
  calculerScoreIcp,
} from '@/lib/moteur/scoring';
import { consoliderDossier } from '@/lib/moteur/consolidation';
import { CRM_MOCK } from '@/lib/crm/mock';
import { CONFIG_DEFAUT } from '@/lib/config/champs';
import { ICP_DEFAUT } from '@/lib/config/icp';
import type { Observation } from '@/lib/schema/canonical';

const obs = (
  confiance_source: number,
  date_donnee: string | null,
): Observation => ({
  valeur: 'x',
  source: 'crm',
  date_donnee,
  confiance_source,
});

describe('Formule 1 — confiance (union probabiliste, décroissance par âge)', () => {
  it('une source fraîche ≈ sa confiance_source', () => {
    const c = confianceObservations([obs(0.8, DATE_REFERENCE)], DATE_REFERENCE, CONFIG_DEFAUT);
    expect(c).toBeCloseTo(0.8, 5);
  });

  it('décroît avec l’âge : une demi-vie divise par deux', () => {
    const unAn = '2025-07-09T00:00:00Z'; // 365 j avant la référence
    const c = confianceObservations([obs(0.8, unAn)], DATE_REFERENCE, CONFIG_DEFAUT);
    expect(c).toBeCloseTo(0.4, 2);
  });

  it('corrobore : 0.8 et 0.6 fraîches → 1 − 0.2×0.4 = 0.92', () => {
    const c = confianceObservations(
      [obs(0.8, DATE_REFERENCE), obs(0.6, DATE_REFERENCE)],
      DATE_REFERENCE,
      CONFIG_DEFAUT,
    );
    expect(c).toBeCloseTo(0.92, 5);
  });

  it('ne dépasse jamais 1, même très corroborée', () => {
    const c = confianceObservations(
      [obs(0.99, DATE_REFERENCE), obs(0.99, DATE_REFERENCE), obs(0.99, DATE_REFERENCE)],
      DATE_REFERENCE,
      CONFIG_DEFAUT,
    );
    expect(c).toBeLessThanOrEqual(1);
    expect(c).toBeGreaterThan(0.99);
  });
});

describe('Formules 2 et 3 — complétude et ICP ne se confondent pas', () => {
  // Un lead parfaitement ICP mais peu documenté : l'ICP doit être haut,
  // la complétude basse. Beaucoup de solutions confondent les deux.
  const dossier = consoliderDossier({
    crm: CRM_MOCK,
    lead: { domaine: 'neuve.ai' },
    observationsExternes: {
      secteur: [{ valeur: 'saas', source: 'sillage', date_donnee: DATE_REFERENCE, confiance_source: 0.85 }],
      effectif: [{ valeur: 120, source: 'sillage', date_donnee: DATE_REFERENCE, confiance_source: 0.85 }],
      pays_siege: [{ valeur: 'France', source: 'fullenrich', date_donnee: DATE_REFERENCE, confiance_source: 0.8 }],
      seniorite: [{ valeur: 'vp', source: 'sillage', date_donnee: DATE_REFERENCE, confiance_source: 0.85 }],
    },
    dateReference: DATE_REFERENCE,
  });

  it('score ICP ≠ score de complétude', () => {
    expect(dossier.score_icp.score).toBe(100);
    expect(dossier.completude.score).toBeLessThan(0.6);
  });

  it('la décomposition ICP recompose exactement le score', () => {
    const { decomposition, score } = dossier.score_icp;
    const totalPoids = decomposition.reduce((s, c) => s + c.poids, 0);
    const recompose =
      (decomposition.reduce((s, c) => s + c.poids * c.score, 0) / totalPoids) * 100;
    expect(score).toBeCloseTo(recompose, 6);
  });

  it('un champ absent de toutes les sources chute la complétude et alimente une question — pas un conflit', () => {
    expect(dossier.completude.champs_manquants).toContain('email');
    const champEmail = dossier.champs['email'];
    expect(champEmail?.resolution).toBe('absente');
    // Absence ≠ conflit : pas de résolution « impossible » fabriquée.
    const questionEmail = dossier.questions.find((q) => q.champ === 'email');
    expect(questionEmail?.type).toBe('ouverte');
  });
});

describe('Formule 3 — dégradation progressive de l’effectif hors fourchette', () => {
  const icpAvec = (effectif: number) =>
    calculerScoreIcp(
      {
        secteur: 'saas',
        effectif,
        pays_siege: 'France',
        seniorite: 'vp',
      },
      ICP_DEFAUT,
    );

  it('dans la fourchette → critère à 1', () => {
    const c = icpAvec(200).decomposition.find((d) => d.critere === 'effectif');
    expect(c?.score).toBe(1);
  });

  it('hors fourchette → dégradé progressivement, pas binaire', () => {
    const c600 = icpAvec(600).decomposition.find((d) => d.critere === 'effectif');
    const c2000 = icpAvec(2000).decomposition.find((d) => d.critere === 'effectif');
    expect(c600!.score).toBeLessThan(1);
    expect(c600!.score).toBeGreaterThan(0);
    expect(c2000!.score).toBeLessThan(c600!.score);
  });
});

describe('Formule 3 — équivalences secteur (jugement B4 injecté en donnée)', () => {
  const valeurs = { secteur: 'SaaS B2B', effectif: 200, pays_siege: 'France', seniorite: 'vp' };

  it('sans map : « saas b2b » hors cible, critère à 0', () => {
    const c = calculerScoreIcp(valeurs, ICP_DEFAUT).decomposition.find((d) => d.critere === 'secteur');
    expect(c?.score).toBe(0);
  });

  it('avec rattachement « saas b2b » → « saas » : critère à 1, décision visible dans le detail', () => {
    const c = calculerScoreIcp(valeurs, ICP_DEFAUT, { 'saas b2b': 'saas' }).decomposition.find(
      (d) => d.critere === 'secteur',
    );
    expect(c?.score).toBe(1);
    expect(c?.detail).toContain('rattaché');
  });

  it('un rattachement vers une valeur HORS cible ne compte pas', () => {
    const c = calculerScoreIcp(valeurs, ICP_DEFAUT, { 'saas b2b': 'immobilier' }).decomposition.find(
      (d) => d.critere === 'secteur',
    );
    expect(c?.score).toBe(0);
  });
});
