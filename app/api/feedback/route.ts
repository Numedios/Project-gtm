import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { interpreterFeedback } from '@/lib/memoire-ae/feedback';
import { getStoreProfilAE } from '@/lib/memoire-ae/store';
import type { ProfilAE } from '@/lib/schema/canonical';

// L'entrée de la mémoire AE (brief §9) : le texte libre de l'AE est interprété
// par le classifieur déterministe borné (lib/memoire-ae/feedback.ts) — il
// SÉLECTIONNE des valeurs d'énumération, jamais il ne recopie le texte. Le
// texte du feedback n'est ni persisté ni renvoyé : seul le profil (schéma
// fermé, strictObject) survit à la requête.

const CorpsRequete = z.object({
  ae_id: z.string().min(1),
  feedback: z.string().min(1).max(500),
});

function slotsModifies(avant: ProfilAE, apres: ProfilAE): string[] {
  return (Object.keys(apres) as (keyof ProfilAE)[]).filter((slot) => avant[slot] !== apres[slot]);
}

export async function POST(req: NextRequest) {
  const corpsJson = await req.json().catch(() => null);
  const parseResult = CorpsRequete.safeParse(corpsJson);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const store = getStoreProfilAE();
  const avant = await store.lire(parseResult.data.ae_id);
  const apres = interpreterFeedback(parseResult.data.feedback, avant);
  await store.ecrire(parseResult.data.ae_id, apres);

  return NextResponse.json({ profil: apres, slots_modifies: slotsModifies(avant, apres) });
}

export async function GET(req: NextRequest) {
  const aeId = req.nextUrl.searchParams.get('ae_id');
  if (!aeId) {
    return NextResponse.json({ error: 'ae_id manquant' }, { status: 400 });
  }
  return NextResponse.json({ profil: await getStoreProfilAE().lire(aeId) });
}
