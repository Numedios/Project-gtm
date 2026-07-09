import { NextRequest, NextResponse } from 'next/server';
import { getFullEnrichClient, normaliserResultatBulk } from '@/lib/fullenrich';

// Une requête = un GET FullEnrich, rien de plus. C'est le client (navigateur)
// qui rythme le sondage à FULLENRICH_POLL_INTERVAL — jamais un sleep serveur,
// pour rester compatible avec la durée max d'une fonction Vercel.
export async function GET(req: NextRequest) {
  const enrichmentId = req.nextUrl.searchParams.get('enrichment_id');
  if (!enrichmentId) {
    return NextResponse.json({ error: 'enrichment_id manquant' }, { status: 400 });
  }

  try {
    const resultat = await getFullEnrichClient().getBulkStatus(enrichmentId);
    return NextResponse.json({
      status: resultat.status,
      coordonnees_par_decideur: resultat.status === 'FINISHED' ? normaliserResultatBulk(resultat) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur FullEnrich inconnue' },
      { status: 404 },
    );
  }
}
