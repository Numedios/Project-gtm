/**
 * A6 — Les onze fixtures sont la spécification exécutable.
 * Ici : n°1 à 8 (+ 8.5), table-driven, une assertion par colonne du tableau A5.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURES_CONFLITS, DATE_REFERENCE } from '@/fixtures/conflits';
import { arbitrerChamp } from '@/lib/moteur/arbitrage';

describe('Fixtures de conflit (tableau A5, n°1–8)', () => {
  it.each(FIXTURES_CONFLITS.map((f) => [f.numero, f.nom, f] as const))(
    'n°%s — %s',
    (_numero, _nom, fixture) => {
      const resultat = arbitrerChamp(fixture.champ, fixture.observations, {
        dateReference: DATE_REFERENCE,
        seuils: fixture.seuils,
      });

      const { attendu } = fixture;

      expect(resultat.champ.valeur_retenue).toEqual(attendu.valeur_retenue);
      expect(resultat.champ.resolution).toBe(attendu.resolution);
      expect(resultat.champ.a_signaler_AE).toBe(attendu.a_signaler_AE);

      switch (attendu.emission) {
        case 'rien':
          expect(resultat.signal).toBeNull();
          expect(resultat.question).toBeNull();
          break;
        case 'signal':
          expect(resultat.signal).not.toBeNull();
          expect(resultat.question).toBeNull();
          break;
        case 'question_confirmation':
          expect(resultat.signal).toBeNull();
          expect(resultat.question?.type).toBe('confirmation');
          break;
        case 'question_ouverte':
          expect(resultat.signal).toBeNull();
          expect(resultat.question?.type).toBe('ouverte');
          break;
      }

      if (attendu.confiance_strictement_superieure_a !== undefined) {
        expect(resultat.champ.confiance).toBeGreaterThan(
          attendu.confiance_strictement_superieure_a,
        );
      }

      // L'union n'écrase pas : aucune observation perdue au merge.
      expect(resultat.champ.observations).toHaveLength(
        fixture.observations.length,
      );
    },
  );
});
