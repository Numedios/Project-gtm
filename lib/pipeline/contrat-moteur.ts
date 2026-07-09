import type {
  ChampConsolide,
  Conflit,
  DealCRM,
  HistoriqueRelationnel,
  Observation,
  Score,
  Volatilite,
} from '@/lib/schema/canonical';

// Le contrat que B7 (le pipeline) attend de lib/engine/ (axe A). Possédé par
// l'axe B au sens où c'est lui qui consomme ces fonctions ; le contenu —
// l'arbitrage, le signalement, le scoring — reste entièrement axe A. Voir
// SYNTHESE.md : "trois points de contact seulement".

export interface EntreeArbitrageChamp {
  champ: string;
  entite: string; // "entreprise", ou id du décideur
  observations: Observation[];
  volatilite: Volatilite;
}

export interface SortieArbitrageChamp {
  champConsolide: ChampConsolide;
  conflit: Conflit | null; // null tant que rien à signaler
}

export interface EntreeScoring {
  entreprise: Record<string, ChampConsolide>;
  nombreDecideursIdentifies: number;
  signauxRecents: number;
  historiqueDeals: DealCRM[];
}

export interface QuestionDeFond {
  texte: string;
  type: 'ouverte' | 'confirmation';
}

export interface SortieScoring {
  scoreIcp: Score;
  scoreCompletude: Score;
  questionsDeFond: QuestionDeFond[];
}

export interface CrmCompte {
  matches: number; // 0 = absent, 1 = trouvé, >1 = ambigu → NOUVEAU_LEAD + conflit signalé
  historiqueDeals: DealCRM[];
}

export interface CrmContact {
  decideurId: string;
  historiqueRelationnel: HistoriqueRelationnel;
}

export interface MoteurQualification {
  chercherCompteCrm(domaine: string): Promise<CrmCompte>;
  chercherContactCrm(email: string): Promise<CrmContact | null>;
  arbitrerChamp(entree: EntreeArbitrageChamp): SortieArbitrageChamp;
  scorer(entree: EntreeScoring): SortieScoring;
}
