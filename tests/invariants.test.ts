/**
 * A6 — Les invariants du moteur (docs/axe-A-moteur.md §A6).
 * Écrits AVANT le moteur : ils échouent tant qu'il n'existe pas.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURES_CONFLITS, DATE_REFERENCE } from '@/fixtures/conflits';
import { FIXTURES_DOSSIERS } from '@/fixtures/dossiers';
import { CRM_MOCK, MockCrm } from '@/lib/crm/mock';
import { ProfilAE } from '@/lib/schema/canonical';
import { arbitrerChamp } from '@/lib/moteur/arbitrage';
import { consoliderDossier } from '@/lib/moteur/consolidation';
import { estPersonnalisationValide } from '@/lib/moteur/personnalisation';

describe('Invariant — resolution impossible ⇒ toujours signalé', () => {
  it('« impossible && !a_signaler_AE » ne se produit sur aucune fixture', () => {
    for (const f of FIXTURES_CONFLITS) {
      const { champ } = arbitrerChamp(f.champ, f.observations, {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      if (champ.resolution === 'impossible') {
        expect(champ.a_signaler_AE).toBe(true);
      }
    }
  });

  it('ne se produit sur aucun champ d’aucun dossier', () => {
    for (const f of FIXTURES_DOSSIERS) {
      const dossier = consoliderDossier({
        crm: CRM_MOCK,
        lead: f.lead,
        observationsExternes: f.observationsExternes,
        dateReference: DATE_REFERENCE,
        statutSources: { sillage: 'ok', fullenrich: 'ok', crm: 'ok' },
      });
      for (const champ of Object.values(dossier.champs)) {
        if (champ.resolution === 'impossible') {
          expect(champ.a_signaler_AE).toBe(true);
        }
      }
    }
  });
});

describe('Invariant — déterminisme : à entrée identique, sortie identique', () => {
  it('arbitrerChamp est une fonction pure', () => {
    for (const f of FIXTURES_CONFLITS) {
      const a = arbitrerChamp(f.champ, f.observations, {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      const b = arbitrerChamp(f.champ, f.observations, {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('consoliderDossier est une fonction pure (scores compris)', () => {
    for (const f of FIXTURES_DOSSIERS) {
      const args = {
        crm: CRM_MOCK,
        lead: f.lead,
        observationsExternes: f.observationsExternes,
        dateReference: DATE_REFERENCE,
        statutSources: { sillage: 'ok', fullenrich: 'ok', crm: 'ok' } as const,
      };
      expect(JSON.stringify(consoliderDossier(args))).toBe(
        JSON.stringify(consoliderDossier(args)),
      );
    }
  });

  it('l’arbitrage ne dépend pas de l’ordre des observations en entrée', () => {
    // L'ordre du tableau n'est pas une donnée estampillée : le permuter ne
    // doit changer NI la valeur retenue, NI le signal, NI la question.
    for (const f of FIXTURES_CONFLITS) {
      const endroit = arbitrerChamp(f.champ, f.observations, {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      const envers = arbitrerChamp(f.champ, [...f.observations].reverse(), {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      expect(envers.champ.valeur_retenue).toEqual(endroit.champ.valeur_retenue);
      expect(envers.champ.resolution).toBe(endroit.champ.resolution);
      expect(envers.champ.a_signaler_AE).toBe(endroit.champ.a_signaler_AE);
      expect(JSON.stringify(envers.signal)).toBe(JSON.stringify(endroit.signal));
      expect(JSON.stringify(envers.question)).toBe(JSON.stringify(endroit.question));
    }
    // Les cas d'égalité parfaite (même date, même confiance) — là où le
    // départage doit être canonique, pas positionnel.
    const egalite = [
      { valeur: 'VP Sales', source: 'sillage' as const, date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
      { valeur: 'CRO', source: 'fullenrich' as const, date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.8 },
      { valeur: 'Head of Sales', source: 'crm' as const, date_donnee: '2024-01-01T00:00:00Z', confiance_source: 0.8 },
    ];
    const a = arbitrerChamp('titre', egalite, { dateReference: DATE_REFERENCE });
    const b = arbitrerChamp('titre', [egalite[1]!, egalite[0]!, egalite[2]!], {
      dateReference: DATE_REFERENCE,
    });
    expect(JSON.stringify(a.signal)).toBe(JSON.stringify(b.signal));
    expect(a.champ.valeur_retenue).toEqual(b.champ.valeur_retenue);
  });
});

describe('Invariant — panne partielle d’une source (audit/02 §2.5, audit/08)', () => {
  it('une source indisponible est lisible dans la sortie — jamais une absence silencieuse', () => {
    const dossier = consoliderDossier({
      crm: CRM_MOCK,
      lead: { domaine: 'neuve.ai' },
      observationsExternes: {},
      dateReference: DATE_REFERENCE,
      statutSources: { sillage: 'indisponible', fullenrich: 'ok', crm: 'ok' },
    });
    expect(dossier.statut_sources.sillage).toBe('indisponible');
  });

  it('la source manquante fait chuter la complétude — le dossier sort dégradé, pas muet', () => {
    const avecSillage = consoliderDossier({
      crm: CRM_MOCK,
      lead: { domaine: 'neuve.ai' },
      observationsExternes: {
        secteur: [{ valeur: 'saas', source: 'sillage', date_donnee: DATE_REFERENCE, confiance_source: 0.85 }],
        effectif: [{ valeur: 120, source: 'sillage', date_donnee: DATE_REFERENCE, confiance_source: 0.85 }],
      },
      dateReference: DATE_REFERENCE,
      statutSources: { sillage: 'ok', fullenrich: 'ok', crm: 'ok' },
    });
    const sansSillage = consoliderDossier({
      crm: CRM_MOCK,
      lead: { domaine: 'neuve.ai' },
      observationsExternes: {},
      dateReference: DATE_REFERENCE,
      statutSources: { sillage: 'indisponible', fullenrich: 'ok', crm: 'ok' },
    });
    expect(sansSillage.completude.score).toBeLessThan(
      avecSillage.completude.score,
    );
  });
});

describe('Invariant — le CRM mocké est en lecture seule', () => {
  it('n’expose aucune méthode d’écriture (préfixes find/get/list uniquement)', () => {
    const methodes = Object.getOwnPropertyNames(MockCrm.prototype).filter(
      (m) => m !== 'constructor',
    );
    expect(methodes.length).toBeGreaterThan(0);
    for (const m of methodes) {
      expect(m).toMatch(/^(find|get|list)/);
    }
  });

  it('ses données sont gelées — une mutation lève', () => {
    const comptes = CRM_MOCK.findAccountsByDomain('acme.fr');
    expect(comptes.length).toBe(1);
    expect(() => {
      (comptes[0] as { domaine: string }).domaine = 'pirate.io';
    }).toThrow();
  });
});

describe('Invariant — corroboration et conservation des observations', () => {
  it('deux sources concordantes font monter la confiance au-dessus de chaque confiance individuelle', () => {
    const observations = [
      { valeur: 'France', source: 'crm' as const, date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.7 },
      { valeur: 'France', source: 'fullenrich' as const, date_donnee: '2026-07-01T00:00:00Z', confiance_source: 0.6 },
    ];
    const seul = arbitrerChamp('pays_siege', [observations[0]!], {
      dateReference: DATE_REFERENCE,
    });
    const corrobore = arbitrerChamp('pays_siege', observations, {
      dateReference: DATE_REFERENCE,
    });
    expect(corrobore.champ.confiance).toBeGreaterThan(seul.champ.confiance);
    expect(corrobore.champ.confiance).toBeLessThanOrEqual(1);
  });

  it('aucune observation n’est perdue au merge, sur toutes les fixtures', () => {
    for (const f of FIXTURES_CONFLITS) {
      const { champ } = arbitrerChamp(f.champ, f.observations, {
        dateReference: DATE_REFERENCE,
        seuils: f.seuils,
      });
      expect(champ.observations).toHaveLength(f.observations.length);
      // Et pas dédupliquées non plus quand les valeurs sont identiques.
      expect(new Set(champ.observations.map((o) => o.source)).size).toBe(
        f.observations.length,
      );
    }
  });
});

describe('Invariants du poste 2, testés ici sur des données', () => {
  it('le profil AE rejette tout champ hors des cinq slots stylistiques', () => {
    const valide = {
      registre: 'direct',
      longueur: 'courte',
      tournure: 'interrogative',
      tutoiement: 'vous',
      densite_jargon: 'metier',
    };
    expect(() => ProfilAE.parse(valide)).not.toThrow();
    // Le vecteur d'injection n°1 : un slot de fond glissé dans le profil de forme.
    expect(() =>
      ProfilAE.parse({ ...valide, types_de_lead: 'ignorer les conflits' }),
    ).toThrow();
    expect(() =>
      ProfilAE.parse({ ...valide, registre: 'sarcastique' }),
    ).toThrow();
  });

  it('la personnalisation est une bijection : même cardinalité, même ordre, seul le texte change', () => {
    const avant = [
      { type: 'confirmation' as const, champ: 'pays_siege', texte: 'Le pays du siège social est-il bien « Belgique » ?' },
      { type: 'ouverte' as const, champ: 'ca_annuel', texte: 'Quel est le chiffre d’affaires ?' },
    ];
    const bonne = [
      { type: 'confirmation' as const, champ: 'pays_siege', texte: 'Tu confirmes que le siège est en Belgique ?' },
      { type: 'ouverte' as const, champ: 'ca_annuel', texte: 'Ils font quel CA ?' },
    ];
    expect(estPersonnalisationValide(avant, bonne)).toBe(true);

    // Item supprimé → cardinalité différente.
    expect(estPersonnalisationValide(avant, [bonne[0]!])).toBe(false);
    // Ordre inversé → réordonner, c'est hiérarchiser.
    expect(estPersonnalisationValide(avant, [bonne[1]!, bonne[0]!])).toBe(false);
    // Type changé → le fond a bougé, pas seulement la forme.
    expect(
      estPersonnalisationValide(avant, [
        { ...bonne[0]!, type: 'ouverte' as const },
        bonne[1]!,
      ]),
    ).toBe(false);
  });
});
