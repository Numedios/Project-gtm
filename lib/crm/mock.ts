/**
 * A5 — Le CRM mocké, en LECTURE SEULE GARANTIE PAR LE TYPE.
 *
 * L'interface `CrmLectureSeule` n'expose que des méthodes de lecture : le
 * contrat « le CRM n'est jamais modifié » est garanti par le compilateur, pas
 * par un prompt ni une revue de code. Les données sont gelées (`Object.freeze`
 * profond) pour que la garantie tienne aussi à l'exécution.
 *
 * Le jeu de données est DÉLIBÉRÉ : il contient exactement les scénarios que le
 * système prétend gérer (fixtures n°9, 10, 11 — les n°1 à 8 sont des jeux
 * d'observations, voir fixtures/conflits.ts).
 */
import type { NomChamp } from '@/lib/config/champs';

// ---------------------------------------------------------------------------
// Types de lecture
// ---------------------------------------------------------------------------

/** Une valeur CRM estampillée de sa date de saisie (null si inconnue). */
export interface ValeurCrm {
  valeur: unknown;
  date_donnee: string | null;
}

export interface CompteCrm {
  id: string;
  domaine: string;
  champs: Partial<Record<NomChamp, ValeurCrm>>;
}

export interface ContactCrm {
  id: string;
  email: string;
  compte_id: string | null;
  champs: Partial<Record<NomChamp, ValeurCrm>>;
}

export interface DealCrm {
  id: string;
  contact_email: string;
  entreprise: string;
  domaine_entreprise: string;
  statut: 'gagne' | 'perdu' | 'en_cours';
  date: string;
}

/**
 * LE contrat. Aucune méthode d'écriture — c'est un invariant testé (A6) :
 * tout nom de méthode doit commencer par `find`, `get` ou `list`.
 */
export interface CrmLectureSeule {
  /** Renvoie TOUS les comptes qui matchent — l'ambiguïté (≥ 2) est un cas
   *  produit (fixture n°10), pas une erreur. */
  findAccountsByDomain(domaine: string): readonly CompteCrm[];
  findContactByEmail(email: string): ContactCrm | null;
  /** Deals du contact, toutes entreprises confondues. Ceux conclus dans une
   *  AUTRE entreprise forment l'historique relationnel (fixture n°9). */
  listDealsByContactEmail(email: string): readonly DealCrm[];
  listDealsByAccountId(compteId: string): readonly DealCrm[];
}

// ---------------------------------------------------------------------------
// Implémentation mock
// ---------------------------------------------------------------------------

function geler<T>(objet: T): T {
  if (objet !== null && typeof objet === 'object') {
    for (const valeur of Object.values(objet)) geler(valeur);
    Object.freeze(objet);
  }
  return objet;
}

interface DonneesCrm {
  comptes: CompteCrm[];
  contacts: ContactCrm[];
  deals: DealCrm[];
}

export class MockCrm implements CrmLectureSeule {
  private readonly donnees: DonneesCrm;

  constructor(donnees: DonneesCrm) {
    this.donnees = geler(donnees);
  }

  findAccountsByDomain(domaine: string): readonly CompteCrm[] {
    const d = domaine.trim().toLowerCase();
    return this.donnees.comptes.filter((c) => c.domaine === d);
  }

  findContactByEmail(email: string): ContactCrm | null {
    const e = email.trim().toLowerCase();
    return this.donnees.contacts.find((c) => c.email === e) ?? null;
  }

  listDealsByContactEmail(email: string): readonly DealCrm[] {
    const e = email.trim().toLowerCase();
    return this.donnees.deals.filter((d) => d.contact_email === e);
  }

  listDealsByAccountId(compteId: string): readonly DealCrm[] {
    const compte = this.donnees.comptes.find((c) => c.id === compteId);
    if (!compte) return [];
    return this.donnees.deals.filter(
      (d) => d.domaine_entreprise === compte.domaine,
    );
  }
}

// ---------------------------------------------------------------------------
// Le jeu de données délibéré
// ---------------------------------------------------------------------------

export const CRM_MOCK: CrmLectureSeule = new MockCrm({
  comptes: [
    {
      // Compte nominal — un seul match (branche MISE_A_JOUR).
      id: 'acc_acme',
      domaine: 'acme.fr',
      champs: {
        nom_legal: { valeur: 'Acme SAS', date_donnee: '2025-03-12T00:00:00Z' },
        pays_siege: { valeur: 'France', date_donnee: '2026-06-20T00:00:00Z' },
        secteur: { valeur: 'saas', date_donnee: '2025-03-12T00:00:00Z' },
        effectif: { valeur: 100, date_donnee: '2026-05-01T00:00:00Z' },
        notes_crm: {
          valeur: 'Rencontré au salon B2B Rocks. Rappeler en septembre.',
          date_donnee: null,
        },
      },
    },
    {
      // Fixture n°10 — deux comptes pour le même domaine : ambiguïté.
      id: 'acc_double_emea',
      domaine: 'double.io',
      champs: {
        nom_legal: { valeur: 'Double EMEA Ltd', date_donnee: '2024-09-01T00:00:00Z' },
        pays_siege: { valeur: 'Irlande', date_donnee: '2024-09-01T00:00:00Z' },
      },
    },
    {
      id: 'acc_double_fr',
      domaine: 'double.io',
      champs: {
        nom_legal: { valeur: 'Double France SARL', date_donnee: '2025-01-15T00:00:00Z' },
        pays_siege: { valeur: 'France', date_donnee: '2025-01-15T00:00:00Z' },
      },
    },
    // Fixture n°11 — « neuve.ai » n'existe volontairement PAS ici.
  ],
  contacts: [
    {
      // Fixture n°1 — titre CRM périmé (elle a été promue depuis).
      // Fixture n°9 — a fait un deal chez Globex, une AUTRE entreprise.
      id: 'cnt_marie',
      email: 'marie.durand@acme.fr',
      compte_id: 'acc_acme',
      champs: {
        prenom: { valeur: 'Marie', date_donnee: '2024-11-02T00:00:00Z' },
        nom: { valeur: 'Durand', date_donnee: '2024-11-02T00:00:00Z' },
        titre: { valeur: 'Head of Sales', date_donnee: '2024-11-02T00:00:00Z' },
        email: { valeur: 'marie.durand@acme.fr', date_donnee: '2024-11-02T00:00:00Z' },
      },
    },
  ],
  deals: [
    {
      // Fixture n°9 — deal gagné avec Marie quand elle était chez Globex.
      id: 'deal_globex',
      contact_email: 'marie.durand@acme.fr',
      entreprise: 'Globex GmbH',
      domaine_entreprise: 'globex.de',
      statut: 'gagne',
      date: '2024-05-17T00:00:00Z',
    },
    {
      // Fixture n°9, contre-exemple — deal de Marie DANS l'entreprise du lead.
      // Il doit finir dans historique.deals et JAMAIS dans le relationnel :
      // c'est lui qui rend le filtre « autre entreprise » discriminant
      // (sans lui, une implémentation qui verse tous les deals du contact
      // dans le relationnel passerait les tests).
      id: 'deal_acme_en_cours',
      contact_email: 'marie.durand@acme.fr',
      entreprise: 'Acme SAS',
      domaine_entreprise: 'acme.fr',
      statut: 'en_cours',
      date: '2026-03-10T00:00:00Z',
    },
  ],
});

/** Confiance de source attribuée par le collecteur CRM à ses estampilles. */
export const CONFIANCE_CRM = 0.9;
