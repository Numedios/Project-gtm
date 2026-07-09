import { beforeAll, describe, expect, it } from 'vitest';

// Le scénario de démo PayFit (lib/demo/payfit.ts) est CALIBRÉ : ce test
// verrouille ce que la démo promet — si quelqu'un retouche les données ou
// les formules et casse le 95, ça casse ici, pas sur scène.

beforeAll(() => {
  process.env.SILLAGE_USE_MOCK = 'true';
  process.env.FULLENRICH_USE_MOCK = 'true';
  delete process.env.ANTHROPIC_API_KEY; // B5/B6 échouent proprement : hors sujet ici
});

describe('démo PayFit', () => {
  it('produit le dossier calibré : ICP 95, MISE_A_JOUR, conflits tranchés par récence', async () => {
    const { qualifierLead } = await import('@/lib/pipeline/qualifier');
    const resultat = await qualifierLead({
      email: 'camille.roussel@payfit.com',
      aeId: 'ae-test',
    });
    const { dossier } = resultat;

    // Le compte existe au CRM → mise à jour, pas nouveau lead.
    expect(dossier.branche).toBe('MISE_A_JOUR');

    // La pertinence promise : 95/100 exactement.
    expect(dossier.score_icp.score).toBe(95);

    // Les deux conflits volatils sont tranchés par récence (Sillage 2026
    // bat CRM 2025) et remontent comme signaux, pas comme questions.
    expect(dossier.champs.titre?.valeur_retenue).toBe('VP Finance');
    expect(dossier.champs.effectif?.valeur_retenue).toBe(625);
    expect(dossier.signaux.length).toBeGreaterThanOrEqual(1);

    // L'interlocutrice est élue par SON email — jamais un profil arbitraire.
    expect(dossier.champs.prenom?.valeur_retenue).toBe('Camille');
    expect(dossier.champs.nom?.valeur_retenue).toBe('Roussel');

    // Historique : le deal Finexpa (autre entreprise) est du relationnel,
    // le deal PayFit en cours reste dans les deals du compte.
    expect(dossier.historique.relationnel.length).toBeGreaterThanOrEqual(1);
    expect(dossier.historique.deals.length).toBeGreaterThanOrEqual(1);

    // Les signaux d'achat Sillage sont dans le dossier.
    expect(dossier.champs.signaux_achat?.valeur_retenue).toBeTruthy();
  });
});
