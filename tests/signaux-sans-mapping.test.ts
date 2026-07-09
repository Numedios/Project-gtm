/**
 * B2bis — Les signaux d'une entreprise remontent MÊME SANS company mapping :
 * les scores ICP et de complétude en dépendent. Sans mapping, on n'a pas de
 * company_id ; signauxPourDomaine résout à l'envers (company_id des signaux
 * récents → get_company → domaine).
 */
import { describe, expect, it } from 'vitest';
import { SillageMockClient } from '@/lib/sillage/mock-client';
import { signauxPourDomaine } from '@/lib/sillage/signaux';

const sillage = new SillageMockClient();

describe('signauxPourDomaine', () => {
  it('avec company_id connu (mapping trouvé) : filtrage direct, comportement historique', async () => {
    const mapping = await sillage.findCompanyMappingByDomain('acme-corp.example');
    expect(mapping).not.toBeNull();

    const signaux = await signauxPourDomaine(sillage, 'acme-corp.example', mapping!.company.id);
    expect(signaux.length).toBeGreaterThan(0);
    expect(signaux.every((s) => s.company_id === mapping!.company.id)).toBe(true);
  });

  it('SANS mapping : les signaux remontent quand même, via la résolution company_id → domaine', async () => {
    // neuve.ai n'a pas de company mapping dans le mock (ni de compte CRM —
    // fixture n°11). Ses signaux doivent pourtant remonter.
    const mapping = await sillage.findCompanyMappingByDomain('neuve.ai');
    expect(mapping).toBeNull();

    const signaux = await signauxPourDomaine(sillage, 'neuve.ai', null);
    expect(signaux.length).toBe(1);
    expect(signaux[0]!.signal_type).toBe('fundraising');
  });

  it('ne rattache JAMAIS les signaux d’une autre entreprise au domaine demandé', async () => {
    const signaux = await signauxPourDomaine(sillage, 'neuve.ai', null);
    expect(signaux.every((s) => s.company_id === 990)).toBe(true);
  });

  it('domaine inconnu de Sillage : liste vide, pas d’erreur', async () => {
    const signaux = await signauxPourDomaine(sillage, 'inconnue.example', null);
    expect(signaux).toEqual([]);
  });

  it('la casse et les espaces du domaine n’empêchent pas la résolution', async () => {
    const signaux = await signauxPourDomaine(sillage, '  NEUVE.AI ', null);
    expect(signaux.length).toBe(1);
  });
});
