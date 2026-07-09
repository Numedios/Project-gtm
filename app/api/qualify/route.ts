import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { qualifierLead } from '@/lib/pipeline/qualifier';

const CorpsRequete = z.object({
  domaine: z.string().min(1),
  email_contact: z.string().email().optional(),
  ae_id: z.string().min(1),
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
    const { dossier, fullenrichEnrichmentId } = await qualifierLead({
      domaine: parseResult.data.domaine,
      emailContact: parseResult.data.email_contact,
      aeId: parseResult.data.ae_id,
    });
    return NextResponse.json({ dossier, fullenrich_enrichment_id: fullenrichEnrichmentId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue du pipeline' },
      { status: 500 },
    );
  }
}
