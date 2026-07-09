/**
 * L'email est l'entrée obligatoire de la qualification — le domaine en est
 * dérivé (Sillage n'a pas de recherche par email, la clé entreprise reste le
 * domaine). La validité de l'email est garantie en amont par zod à la
 * frontière API : ici on teste l'extraction, pas la validation.
 */
import { describe, expect, it } from 'vitest';
import { domaineDepuisEmail } from '@/lib/pipeline/qualifier';

describe('domaineDepuisEmail', () => {
  it('extrait le domaine après le @', () => {
    expect(domaineDepuisEmail('marie.durand@acme.fr')).toBe('acme.fr');
  });

  it('normalise casse et espaces', () => {
    expect(domaineDepuisEmail('Marie.Durand@Acme.FR ')).toBe('acme.fr');
  });

  it('prend la partie après le DERNIER @ (local-part avec @ entre guillemets)', () => {
    expect(domaineDepuisEmail('"drole@local"@vrai-domaine.io')).toBe('vrai-domaine.io');
  });
});
