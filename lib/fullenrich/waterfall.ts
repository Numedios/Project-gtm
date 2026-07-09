import type { Observation } from '@/lib/schema/canonical';
import type { ObservationsParChamp } from '@/lib/sillage/normalize';
import type { FullEnrichBulkStatusResponse, FullEnrichContactInput } from './types';

// Le waterfall n'est PAS une branche if/else "Sillage a la coordonnée ou pas" :
// `get_lead` ne renvoie jamais email/téléphone (vérifié), et `get_company_mapping`
// peut en fournir via ses profils mais sans garantie de couverture ni de
// fraîcheur. On interroge donc systématiquement FullEnrich pour l'interlocuteur
// identifié — vérification quand une autre source portait déjà une valeur,
// cascade de repli sinon. La distinction se joue dans lib/moteur/arbitrage :
// deux observations concordantes = corroboration ; divergentes = conflit.
// Le connecteur n'a pas à trancher.

export interface CandidatContact {
  contactId: string;
  firstname: string | null;
  lastname: string | null;
  domain: string | null;
  companyName: string | null;
  linkedinUrl: string | null;
}

export function construireContactsAEnrichir(candidats: CandidatContact[]): FullEnrichContactInput[] {
  return candidats
    .filter((c) => c.firstname && c.lastname && (c.domain || c.linkedinUrl))
    .map((c) => ({
      contact_id: c.contactId,
      firstname: c.firstname,
      lastname: c.lastname,
      domain: c.domain,
      company_name: c.companyName,
      linkedin_url: c.linkedinUrl,
    }));
}

const CONFIANCE_EMAIL_VALIDE = 0.9;
const CONFIANCE_EMAIL_INCERTAIN = 0.6;
const CONFIANCE_TELEPHONE_VALIDE = 0.85;
const CONFIANCE_TELEPHONE_INCERTAIN = 0.55;

// Résultat par contact, sous forme d'observations `email` / `telephone` du
// schéma A1 — prêtes à entrer dans consoliderDossier comme n'importe quelle
// autre source.
export function normaliserResultatBulk(resultat: FullEnrichBulkStatusResponse): Record<string, ObservationsParChamp> {
  const parContact: Record<string, ObservationsParChamp> = {};

  for (const r of resultat.datas) {
    if (r.status !== 'FINISHED' || !r.contact) continue;

    const champs: ObservationsParChamp = {};
    const email = r.contact.emails?.[0];
    if (email) {
      const observation: Observation = {
        valeur: email.email,
        source: 'fullenrich',
        // FullEnrich ne renvoie aucune métadonnée de fraîcheur sur un contact
        // (vérifié sur le contrat REST v2 : `qualification`, pas de date).
        // date_donnee reste null par honnêteté — l'arbitrage traitera toute
        // divergence en `resolution: impossible` → question ouverte, voir
        // audit/05 §5.2.
        date_donnee: null,
        confiance_source: email.qualification === 'valid' ? CONFIANCE_EMAIL_VALIDE : CONFIANCE_EMAIL_INCERTAIN,
      };
      champs.email = [observation];
    }

    const phone = r.contact.phones?.[0];
    if (phone) {
      champs.telephone = [
        {
          valeur: phone.number,
          source: 'fullenrich',
          date_donnee: null,
          confiance_source:
            phone.qualification === 'valid' ? CONFIANCE_TELEPHONE_VALIDE : CONFIANCE_TELEPHONE_INCERTAIN,
        },
      ];
    }

    if (Object.keys(champs).length > 0) parContact[r.contact_id] = champs;
  }

  return parContact;
}
