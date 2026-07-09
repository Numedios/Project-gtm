import { ProfilAE } from '@/lib/schema/canonical';

// Mémoire long-terme par AE (brief §9) : un profil de préférence, texte
// résumé en cinq slots fermés. Lecture : uniquement B6. Écriture : depuis le
// feedback de l'AE, via lib/memoire-ae/feedback.ts — jamais de texte libre.
//
// Implémentation en mémoire pour le hackathon : suffisant pour la démo,
// remplaçable par un KV store sans toucher à l'interface ci-dessous.
export interface StoreProfilAE {
  lire(aeId: string): Promise<ProfilAE>;
  ecrire(aeId: string, profil: ProfilAE): Promise<void>;
}

const PROFIL_PAR_DEFAUT: ProfilAE = {
  registre: 'formel',
  longueur: 'moyenne',
  tournure: 'directe',
  tutoiement: 'non',
  densite_jargon: 'moyenne',
};

class StoreProfilAEMemoire implements StoreProfilAE {
  private profils = new Map<string, ProfilAE>();

  async lire(aeId: string): Promise<ProfilAE> {
    return this.profils.get(aeId) ?? PROFIL_PAR_DEFAUT;
  }

  async ecrire(aeId: string, profil: ProfilAE): Promise<void> {
    // `.strict()` fait lever le parse si un champ hors des cinq slots
    // s'est glissé dans l'appelant — invariant garanti par le type, pas par revue.
    this.profils.set(aeId, ProfilAE.parse(profil));
  }
}

let instance: StoreProfilAE | null = null;

export function getStoreProfilAE(): StoreProfilAE {
  if (!instance) instance = new StoreProfilAEMemoire();
  return instance;
}

export { PROFIL_PAR_DEFAUT };
