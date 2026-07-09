export function formaterValeur(valeur: unknown): string {
  if (valeur == null) return '—';
  if (Array.isArray(valeur)) return valeur.join(', ');
  if (typeof valeur === 'number') return String(valeur);
  return String(valeur);
}

export function formaterDate(iso: string | null): string {
  if (!iso) return 'date inconnue';
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formaterPourcentage(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function libelleChamp(champ: string): string {
  const LIBELLES: Record<string, string> = {
    nom: 'Nom',
    pays_siege: 'Pays du siège',
    secteur: 'Secteur',
    effectif: 'Effectif',
    techno: 'Technologies',
    competiteurs: 'Compétiteurs',
    site_web: 'Site web',
    description: 'Description',
    titre: 'Titre',
    seniorite: 'Séniorité',
    email: 'Email',
    telephone: 'Téléphone',
    linkedin_url: 'LinkedIn',
  };
  return LIBELLES[champ] ?? champ;
}

export function libelleSource(source: string): string {
  const LIBELLES: Record<string, string> = { sillage: 'Sillage', fullenrich: 'FullEnrich', crm: 'CRM' };
  return LIBELLES[source] ?? source;
}
