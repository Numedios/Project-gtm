import type { FullEnrichClient } from './client';
import type {
  FullEnrichBulkLaunchResponse,
  FullEnrichBulkStatusResponse,
  FullEnrichContactInput,
  FullEnrichReverseProfile,
  FullEnrichReverseResponse,
} from './types';

// Recoupe volontairement le décideur du dossier d'exemple (Marie Durand) pour
// que la démo B1↔B3 raconte la même histoire de bout en bout.
export class FullEnrichMockClient implements FullEnrichClient {
  private lots = new Map<string, FullEnrichContactInput[]>();
  private lotsReverse = new Map<string, string[]>();

  async launchBulkEnrichment(contacts: FullEnrichContactInput[]): Promise<FullEnrichBulkLaunchResponse> {
    const enrichmentId = `mock_${Math.random().toString(36).slice(2, 10)}`;
    this.lots.set(enrichmentId, contacts);
    return { enrichment_id: enrichmentId };
  }

  async getBulkStatus(enrichmentId: string): Promise<FullEnrichBulkStatusResponse> {
    const contacts = this.lots.get(enrichmentId);
    if (!contacts) throw new Error(`enrichment_id mock inconnu : ${enrichmentId}`);

    return {
      enrichment_id: enrichmentId,
      status: 'FINISHED',
      datas: contacts.map((c) => ({
        contact_id: c.contact_id,
        status: 'FINISHED',
        contact: {
          emails:
            c.firstname && c.lastname && c.domain
              ? [
                  {
                    email: `${c.firstname.toLowerCase()}.${c.lastname.toLowerCase()}@${c.domain}`,
                    qualification: 'valid',
                  },
                ]
              : null,
          phones: [{ number: '+33 6 12 34 56 78', qualification: 'valid' }],
        },
      })),
    };
  }

  async launchReverseEmail(emails: string[]): Promise<FullEnrichBulkLaunchResponse> {
    const enrichmentId = `mock_reverse_${Math.random().toString(36).slice(2, 10)}`;
    this.lotsReverse.set(enrichmentId, emails);
    return { enrichment_id: enrichmentId };
  }

  async getReverseResult(enrichmentId: string): Promise<FullEnrichReverseResponse> {
    const emails = this.lotsReverse.get(enrichmentId);
    if (!emails) throw new Error(`enrichment_id reverse mock inconnu : ${enrichmentId}`);

    return {
      id: enrichmentId,
      status: 'FINISHED',
      data: emails.map((email) => ({ input: { email }, profile: profilDepuisEmail(email) })),
    };
  }
}

// Un profil plausible dérivé de l'email : `prenom.nom@domaine` → identité +
// employeur actuel (domaine après le @). L'email de démo rend le profil
// complet de Marie ; les autres restent volontairement partiels — le contrat
// dit que profile peut être lacunaire, le moteur doit le tolérer.
function profilDepuisEmail(email: string): FullEnrichReverseProfile | null {
  const [localPart = '', domaine = ''] = email.trim().toLowerCase().split('@');
  if (!domaine) return null;

  // L'email pro ET l'email perso de Marie mènent au même profil : c'est le
  // scénario « lead qui écrit depuis gmail » — le reverse découvre l'employeur,
  // et son domaine re-pilote toute la collecte au second passage.
  if (['marie.durand@acme-corp.example', 'marie.durand@gmail.com'].includes(email.toLowerCase())) {
    return {
      first_name: 'Marie',
      last_name: 'Durand',
      location: { country: 'France', city: 'Paris' },
      social_profiles: { professional_network: { url: 'https://linkedin.com/in/marie-durand-example' } },
      employment: {
        current: {
          title: 'VP Sales',
          seniority: 'vp',
          is_current: true,
          start_at: '2026-06-30T00:00:00.000Z',
          end_at: null,
          company: { name: 'Acme Corp', domain: 'acme-corp.example' },
        },
        all: [],
      },
    };
  }

  const [prenom, nom] = localPart.split('.');
  const capitaliser = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
  return {
    first_name: capitaliser(prenom),
    last_name: capitaliser(nom),
    location: null,
    social_profiles: null,
    employment: {
      current: {
        title: null,
        seniority: null,
        is_current: true,
        start_at: null,
        end_at: null,
        company: { name: null, domain: domaine },
      },
      all: [],
    },
  };
}
