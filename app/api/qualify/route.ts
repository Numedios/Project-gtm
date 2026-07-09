import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { qualifierLead } from '@/lib/pipeline/qualifier';

const CorpsRequete = z.object({
  // L'email du lead est LA donnée obligatoire — le domaine en est dérivé par
  // le pipeline (Sillage et FullEnrich sont interrogés à partir de lui).
  email: z.string().email(),
  ae_id: z.string().min(1),
  // Second passage de la boucle FullEnrich (B3) : re-consolider avec les
  // coordonnées du waterfall et/ou le profil du reverse email lookup
  // lancés au premier passage.
  fullenrich_enrichment_id: z.string().min(1).optional(),
  fullenrich_reverse_id: z.string().min(1).optional(),
});

// Le pipeline lui-même : quelques dizaines de lignes de câblage, voir
// lib/pipeline/qualifier.ts. Cette route est volontairement fine — elle ne
// fait que valider l'entrée et sérialiser la sortie.
export async function POST(req: NextRequest) {
  const corpsJson = await req.json().catch(() => null);
  const parseResult = CorpsRequete.safeParse(corpsJson);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  try {
    const resultat = await qualifierLead({
      email: parseResult.data.email,
      aeId: parseResult.data.ae_id,
      fullenrichEnrichmentId: parseResult.data.fullenrich_enrichment_id,
      fullenrichReverseId: parseResult.data.fullenrich_reverse_id,
    });
    return NextResponse.json(resultat);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue du pipeline' },
      { status: 500 },
    );
  }
}
