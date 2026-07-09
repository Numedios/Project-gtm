import { CHAMPS, type NomChamp } from '@/lib/config/champs';

export function formaterValeur(valeur: unknown): string {
  if (valeur == null) return '—';
  if (Array.isArray(valeur)) return valeur.join(', ');
  return String(valeur);
}

export function formaterDate(iso: string | null): string {
  if (!iso) return 'date inconnue';
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formaterPourcentage(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// Sémantique visuelle d'un score (ratio 0..1) : rouge / orange / vert.
// L'UI colore, elle ne recalcule jamais — le chiffre vient du moteur.
export function couleurScore(ratio: number): string {
  if (ratio >= 0.7) return 'var(--ok)';
  if (ratio >= 0.4) return 'var(--warn)';
  return 'var(--danger)';
}

// Le libellé humain vit dans la spec A1 (lib/config/champs.ts) — une seule
// source de vérité, la même que celle des templates de questions du moteur.
export function libelleChamp(champ: string): string {
  const spec = CHAMPS[champ as NomChamp];
  if (!spec) return champ;
  // "le nom légal" → "Nom légal"
  const sansArticle = spec.label.replace(/^(le |la |les |l’|l')/i, '');
  return sansArticle.charAt(0).toUpperCase() + sansArticle.slice(1);
}

export function libelleSource(source: string): string {
  const LIBELLES: Record<string, string> = { sillage: 'Sillage', fullenrich: 'FullEnrich', crm: 'CRM' };
  return LIBELLES[source] ?? source;
}
