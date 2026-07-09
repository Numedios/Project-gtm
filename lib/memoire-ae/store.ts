import { ProfilAE } from '@/lib/schema/canonical';

// Mémoire long-terme par AE (brief §9) : un profil de préférence en cinq slots
// fermés — le schéma exact vit dans lib/schema/canonical.ts (strictObject :
// tout champ inconnu lève). Lecture : uniquement B6. Écriture : depuis le
// feedback de l'AE, via lib/memoire-ae/feedback.ts — jamais de texte libre.
//
// Implémentation en mémoire pour le hackathon : suffisant pour la démo,
// remplaçable par un KV store sans toucher à l'interface ci-dessous.
export interface StoreProfilAE {
  lire(aeId: string): Promise<ProfilAE>;
  ecrire(aeId: string, profil: ProfilAE): Promise<void>;
}

const PROFIL_PAR_DEFAUT: ProfilAE = {
  registre: 'neutre',
  longueur: 'moyenne',
  tournure: 'interrogative',
  tutoiement: 'vous',
  densite_jargon: 'metier',
};

class StoreProfilAEMemoire implements StoreProfilAE {
  private profils = new Map<string, ProfilAE>();

  async lire(aeId: string): Promise<ProfilAE> {
    return this.profils.get(aeId) ?? PROFIL_PAR_DEFAUT;
  }

  async ecrire(aeId: string, profil: ProfilAE): Promise<void> {
    // strictObject : le parse lève si un champ hors des cinq slots s'est
    // glissé dans l'appelant — invariant garanti par le type, pas par revue.
    this.profils.set(aeId, ProfilAE.parse(profil));
  }
}

// Singleton sur globalThis, pas en variable de module : le store est STATEFUL
// et Next.js compile chaque route dans son propre bundle en dev — un
// module-level `instance` donnerait un store par route, et le profil écrit
// par /api/feedback serait invisible de /api/qualify (même piège que le mock
// FullEnrich, voir lib/fullenrich/index.ts).
const CLE_GLOBALE = Symbol.for('qualif-ae.store-profil-ae');

export function getStoreProfilAE(): StoreProfilAE {
  const registre = globalThis as { [CLE_GLOBALE]?: StoreProfilAE };
  if (!registre[CLE_GLOBALE]) registre[CLE_GLOBALE] = new StoreProfilAEMemoire();
  return registre[CLE_GLOBALE];
}

export { PROFIL_PAR_DEFAUT };
