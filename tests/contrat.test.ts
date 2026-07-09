/**
 * A6 — Le contrat partagé : le dossier d'exemple JSON (consommé par le poste 2)
 * doit valider contre le schéma canonique. Si ce test casse, la frontière
 * entre les deux postes a bougé sans être refigée.
 */
import { describe, expect, it } from 'vitest';
import { DossierConsolide } from '@/lib/schema/canonical';
import exemple from '@/exemple/dossier-consolide.exemple.json';

describe('Contrat partagé', () => {
  it('le dossier d’exemple valide contre le schéma canonique', () => {
    const resultat = DossierConsolide.safeParse(exemple);
    if (!resultat.success) {
      throw new Error(resultat.error.message);
    }
    expect(resultat.success).toBe(true);
  });

  it('le dossier d’exemple respecte l’invariant impossible ⇒ signalé', () => {
    const dossier = DossierConsolide.parse(exemple);
    for (const champ of Object.values(dossier.champs)) {
      // Uniquement « impossible » : « absente » peut légitimement être
      // silencieuse (champ optionnel, ou mono-source CRM).
      if (champ.resolution === 'impossible') {
        expect(champ.a_signaler_AE).toBe(true);
      }
    }
  });
});
