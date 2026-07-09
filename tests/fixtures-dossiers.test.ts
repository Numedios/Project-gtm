/**
 * A6 — Fixtures n°9, 10, 11 : le niveau dossier, contre CRM_MOCK.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURES_DOSSIERS, DATE_REFERENCE } from '@/fixtures/dossiers';
import { CRM_MOCK } from '@/lib/crm/mock';
import { consoliderDossier } from '@/lib/moteur/consolidation';
import { DossierConsolide } from '@/lib/schema/canonical';

describe('Fixtures dossier (tableau A5, n°9–11)', () => {
  it.each(FIXTURES_DOSSIERS.map((f) => [f.numero, f.nom, f] as const))(
    'n°%s — %s',
    (_numero, _nom, fixture) => {
      const dossier = consoliderDossier({
        crm: CRM_MOCK,
        lead: fixture.lead,
        observationsExternes: fixture.observationsExternes,
        dateReference: DATE_REFERENCE,
        statutSources: { sillage: 'ok', fullenrich: 'ok', crm: 'ok' },
      });

      // La sortie du moteur est toujours conforme au contrat partagé.
      expect(() => DossierConsolide.parse(dossier)).not.toThrow();

      const { attendu } = fixture;
      expect(dossier.branche).toBe(attendu.branche);

      if (attendu.relationnel_contient) {
        expect(
          JSON.stringify(dossier.historique.relationnel),
        ).toContain(attendu.relationnel_contient);
      }
      if (attendu.deals_contient) {
        expect(JSON.stringify(dossier.historique.deals)).toContain(
          attendu.deals_contient,
        );
      }
      if (attendu.relationnel_ne_contient_pas) {
        // Le filtre « autre entreprise » est discriminant : un deal dans
        // l'entreprise du lead ne fuit jamais dans le relationnel.
        expect(JSON.stringify(dossier.historique.relationnel)).not.toContain(
          attendu.relationnel_ne_contient_pas,
        );
      }

      for (const champ of attendu.aucune_question_sur ?? []) {
        expect(dossier.questions.find((q) => q.champ === champ)).toBeUndefined();
        // Mono-source : jamais de conflit.
        expect(dossier.champs[champ]?.resolution).not.toBe('impossible');
      }

      const questionBranchement = dossier.questions.find(
        (q) => q.champ === 'compte_crm',
      );
      const champBranchement = dossier.champs['compte_crm'];
      if (attendu.question_sur_branchement) {
        // L'ambiguïté est un CONFLIT SIGNALÉ (audit/02 §2.3), pas une simple
        // question flottante : elle doit exister comme champ consolidé
        // impossible + signalé, et la question en découler.
        expect(questionBranchement?.type).toBe('ouverte');
        expect(champBranchement).toBeDefined();
        expect(champBranchement?.resolution).toBe('impossible');
        expect(champBranchement?.a_signaler_AE).toBe(true);
      } else {
        expect(questionBranchement).toBeUndefined();
        expect(champBranchement).toBeUndefined();
      }
    },
  );
});
