import type { SillageClient } from './client';
import type { SillageSignalDetection } from './types';

// Les signaux d'une entreprise doivent remonter MÊME SANS company mapping :
// les scores ICP et de complétude en dépendent. Or `list_signals` ne porte
// qu'un `company_id` (aucun domaine, aucun filtre serveur — vérifié contre
// l'API réelle le 2026-07-09), et sans mapping on n'a pas ce company_id.
// On résout donc À L'ENVERS : company_id des signaux récents → get_company
// → domaine. Le nombre d'entreprises distinctes dans une page de signaux est
// petit (une poignée), donc le coût reste borné.
//
// `enrich_company(domain)` n'est PAS une alternative : il est asynchrone
// (status "accepted" + request_id, stage account_mapping_in_progress) — il
// lance un mapping pour plus tard, il ne résout rien pour la qualification
// en cours.
export async function signauxPourDomaine(
  sillage: SillageClient,
  domaine: string,
  companyIdConnu: number | null,
): Promise<SillageSignalDetection[]> {
  // Chemin nominal : le mapping a fourni le company_id, filtrage direct.
  if (companyIdConnu !== null) {
    return sillage.listRecentSignals({ companyId: companyIdConnu });
  }

  // Chemin sans mapping : résolution inverse company_id → domaine.
  const tous = await sillage.listRecentSignals({});
  const domaineNormalise = domaine.trim().toLowerCase();
  const idsUniques = [...new Set(tous.map((s) => s.company_id).filter((id): id is number => id !== null))];

  const idsDuDomaine = new Set<number>();
  await Promise.all(
    idsUniques.map(async (id) => {
      // get_company qui échoue = signal non attribuable, pas une erreur fatale.
      const company = await sillage.getCompany(id).catch(() => null);
      if (company?.domain?.trim().toLowerCase() === domaineNormalise) idsDuDomaine.add(id);
    }),
  );

  return tous.filter((s) => s.company_id !== null && idsDuDomaine.has(s.company_id));
}
