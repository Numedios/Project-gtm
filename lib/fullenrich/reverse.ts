import type { Observation } from '@/lib/schema/canonical';
import type { NomChamp } from '@/lib/config/champs';
import type { ObservationsParChamp } from '@/lib/sillage/normalize';
import type { FullEnrichReverseResponse } from './types';

// Reverse email lookup → observations du schéma A1. C'est ce qui permet de
// qualifier un lead dont on ne connaît QUE l'email : le domaine de
// l'employeur actuel entre dans le dossier comme observation `domaine`
// (source fullenrich) — sans lui, un lead sans mapping Sillage n'avait
// aucun domaine retenu. Les autres champs sont du pur contact (périmètre
// FullEnrich du brief §2) ; on n'injecte AUCUNE autre donnée entreprise.

const CONFIANCE_REVERSE = 0.75;

function ajouter(
  cible: ObservationsParChamp,
  champ: NomChamp,
  valeur: unknown,
  dateDonnee: string | null,
): void {
  if (valeur === null || valeur === undefined || valeur === '') return;
  (cible[champ] ??= []).push({
    valeur,
    source: 'fullenrich',
    date_donnee: dateDonnee,
    confiance_source: CONFIANCE_REVERSE,
  } satisfies Observation);
}

export function normaliserResultatReverse(
  resultat: FullEnrichReverseResponse,
  email: string,
): ObservationsParChamp {
  const emailNormalise = email.trim().toLowerCase();
  const enregistrement = resultat.data.find((r) => r.input.email.trim().toLowerCase() === emailNormalise);
  const profil = enregistrement?.profile ?? null;
  if (!profil) return {};

  const posteActuel = profil.employment?.current ?? null;
  // Seule métadonnée de fraîcheur du contrat reverse : la prise de poste.
  const date = posteActuel?.start_at ?? null;
  const observations: ObservationsParChamp = {};

  ajouter(observations, 'domaine', posteActuel?.company?.domain, date);
  ajouter(observations, 'prenom', profil.first_name, date);
  ajouter(observations, 'nom', profil.last_name, date);
  ajouter(observations, 'titre', posteActuel?.title, date);
  // FullEnrich est la SEULE source qui fournit une séniorité structurée
  // (Sillage ne l'expose pas, assumé dans sillage/normalize.ts) — sans elle,
  // le critère séniorité du score ICP (poids 3/10) reste toujours à zéro.
  ajouter(observations, 'seniorite', posteActuel?.seniority, date);
  ajouter(observations, 'linkedin_contact', profil.social_profiles?.professional_network?.url ?? null, date);
  ajouter(
    observations,
    'localisation_contact',
    [profil.location?.city, profil.location?.country].filter(Boolean).join(', ') || null,
    date,
  );
  ajouter(observations, 'date_prise_poste', posteActuel?.start_at, date);

  return observations;
}
