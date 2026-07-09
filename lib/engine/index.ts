import type { MoteurQualification } from '@/lib/pipeline/contrat-moteur';

// STUB — territoire de l'axe A (poste 1), pas de l'axe B.
//
// Ce fichier ne contient AUCUNE règle d'arbitrage, de signalement ou de
// scoring : c'est tout l'objet de docs/axe-A-moteur.md (A1 à A6), écrit et
// testé indépendamment via `vitest run`, sans réseau ni LLM. L'axe B ne le
// modifie jamais.
//
// Il existe uniquement pour que le reste du dépôt (B1 contre la fixture,
// build Next.js, `tsc`) reste fonctionnel avant que l'axe A ne livre la
// vraie implémentation — qui doit satisfaire exactement `MoteurQualification`
// (lib/pipeline/contrat-moteur.ts) pour se brancher sans rien changer côté
// pipeline (app/api/qualify/route.ts).
const NON_IMPLEMENTE = "lib/engine/ n'est pas encore implémenté — voir docs/axe-A-moteur.md";

export const moteur: MoteurQualification = {
  async chercherCompteCrm() {
    throw new Error(NON_IMPLEMENTE);
  },
  async chercherContactCrm() {
    throw new Error(NON_IMPLEMENTE);
  },
  arbitrerChamp() {
    throw new Error(NON_IMPLEMENTE);
  },
  scorer() {
    throw new Error(NON_IMPLEMENTE);
  },
};
