import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { qualifierLead } from '@/lib/pipeline/qualifier';

const CorpsRequete = z.object({
  domaine: z.string().min(1),
  email_contact: z.string().email().optional(),
  ae_id: z.string().min(1),
  // Second passage de la boucle FullEnrich (B3) : re-consolider avec les
  // coordonnées du waterfall lancé au premier passage.
  fullenrich_enrichment_id: z.string().min(1).optional(),
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
      domaine: parseResult.data.domaine,
      emailContact: parseResult.data.email_contact,
      aeId: parseResult.data.ae_id,
      fullenrichEnrichmentId: parseResult.data.fullenrich_enrichment_id,
    });
    return NextResponse.json(resultat);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue du pipeline' },
      { status: 500 },
    );
  }
}
