/**
 * A2 — L'arbitrage : une règle unique.
 *
 *   Union des données non conflictuelles. En cas de conflit, la récence prime.
 *
 * Table de décision (docs/axe-A-moteur.md §A2), implémentée ligne par ligne :
 *
 *   | Situation                          | Valeur retenue              | Émission                |
 *   |------------------------------------|-----------------------------|--------------------------|
 *   | Un seul prétendant                 | la valeur                   | rien                     |
 *   | Plusieurs, valeurs identiques      | la valeur                   | confiance rehaussée      |
 *   | Écart numérique sous tolérance     | la plus récente             | rien                     |
 *   | Divergence, champ volatile         | la plus récente             | signal « changement »    |
 *   | Divergence, champ stable           | la plus récente             | conflit → question       |
 *   | Une date manquante                 | —                           | conflit → question ouverte|
 *   | Dates identiques                   | confiance_source la + haute | conflit si égales        |
 *
 * Trois garde-fous :
 *   1. La récence exige des dates — pas de date, pas d'arbitrage automatique.
 *   2. Dates identiques ⇒ départage par confiance_source, sinon non déterministe.
 *   3. L'union n'écrase pas — toutes les observations sont conservées.
 *
 * Prérequis en amont : les différences de taxonomie (« SaaS » vs « Logiciel »)
 * sont absorbées par l'équivalence sémantique (poste 2, B4) AVANT d'arriver ici.
 */
import type {
  Observation,
  ChampConsolide,
  Signal,
  Question,
} from '@/lib/schema/canonical';
import {
  CHAMPS,
  CONFIG_DEFAUT,
  type ConfigMoteur,
  type NomChamp,
  type SeuilsClasse,
} from '@/lib/config/champs';
import {
  ageJours,
  confianceDecayee,
  confianceObservations,
} from './scoring';
import { aSignaler, questionConfirmation, questionOuverte } from './signalement';

export interface ResultatArbitrage {
  champ: ChampConsolide;
  signal: Signal | null;
  question: Question | null;
}

export interface OptionsArbitrage {
  /** Le moteur ne lit JAMAIS l'horloge : la date de référence est injectée. */
  dateReference: string;
  /** Le seuil est un bouton, pas une constante (fixtures n°2 vs n°3). */
  seuils?: Partial<SeuilsClasse> | undefined;
  config?: Partial<ConfigMoteur> | undefined;
}

const normaliser = (v: unknown): string =>
  typeof v === 'string' ? v.trim().toLowerCase() : JSON.stringify(v);

const MS_PAR_JOUR = 86_400_000;

export function arbitrerChamp(
  nom: NomChamp | string,
  observations: Observation[],
  options: OptionsArbitrage,
): ResultatArbitrage {
  const spec = CHAMPS[nom as NomChamp];
  if (!spec) throw new Error(`Champ inconnu du schéma : « ${nom} »`);

  const config: ConfigMoteur = { ...CONFIG_DEFAUT, ...options.config };
  const seuils: SeuilsClasse = { ...config.seuils, ...options.seuils };
  const { dateReference } = options;

  const base = {
    champ: nom,
    observations, // jamais aplaties, jamais dédupliquées
    volatilite: spec.volatilite,
  };

  const pretendants = observations.filter(
    (o) => o.valeur !== null && o.valeur !== undefined,
  );

  // -------------------------------------------------------------------------
  // Absence de valeur ≠ conflit (audit/02 §2.4) : rien à arbitrer. La
  // complétude chute, et une question ouverte est posée si le champ compte
  // et qu'une source externe aurait pu le fournir (interroger l'AE sur
  // notre propre CRM n'aurait pas de sens).
  // -------------------------------------------------------------------------
  if (pretendants.length === 0) {
    const questionable =
      spec.importance !== 'optionnel' &&
      spec.sources.some((s) => s !== 'crm');
    return {
      champ: {
        ...base,
        valeur_retenue: null,
        confiance: 0,
        resolution: 'absente',
        a_signaler_AE: questionable,
      },
      signal: null,
      question: questionable ? questionOuverte(nom, spec.label) : null,
    };
  }

  // Groupes de valeurs concordantes (l'équivalence sémantique a déjà eu lieu).
  const groupes = new Map<string, Observation[]>();
  for (const o of pretendants) {
    const cle = normaliser(o.valeur);
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(o);
    else groupes.set(cle, [o]);
  }

  // -------------------------------------------------------------------------
  // Lignes 1 et 2 — un seul prétendant, ou plusieurs valeurs identiques :
  // corroboration, la confiance monte (union probabiliste), rien n'est émis…
  // sauf si la valeur retenue est elle-même périmée (champ stable).
  // -------------------------------------------------------------------------
  if (groupes.size === 1) {
    const groupe = pretendants;
    const retenue = plusRecente(groupe);
    const age = ageJours(retenue.date_donnee, dateReference);
    const signale =
      spec.volatilite === 'stable' &&
      aSignaler({ resolution: 'auto', ageValeurRetenue: age, ecartJours: null, seuils });
    return {
      champ: {
        ...base,
        valeur_retenue: retenue.valeur,
        confiance: confianceObservations(groupe, dateReference, config),
        resolution: 'auto',
        a_signaler_AE: signale,
      },
      signal: null,
      question: signale
        ? questionConfirmation(nom, spec.label, retenue.valeur)
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Vraie divergence. Garde-fou n°1 : la récence exige des dates — il prime
  // sur la tolérance numérique, car « la plus récente » y est tout aussi
  // inexécutable (fixture n°5.5).
  // Ligne 6 — une date manquante ⇒ pas d'arbitrage automatique.
  // -------------------------------------------------------------------------
  if (pretendants.some((o) => o.date_donnee === null)) {
    return {
      champ: {
        ...base,
        valeur_retenue: null,
        confiance: 0,
        resolution: 'impossible',
        a_signaler_AE: true, // l'invariant A6 : impossible ⇒ toujours signalé
      },
      signal: null,
      question: questionOuverte(nom, spec.label),
    };
  }

  // -------------------------------------------------------------------------
  // Ligne 3 — écart numérique sous tolérance : la plus récente, rien.
  // -------------------------------------------------------------------------
  if (spec.type === 'numerique' && pretendants.every((o) => typeof o.valeur === 'number')) {
    const nombres = pretendants.map((o) => o.valeur as number);
    const min = Math.min(...nombres);
    const max = Math.max(...nombres);
    const reference = Math.max(Math.abs(min), Math.abs(max));
    const ecartRelatif = reference === 0 ? 0 : (max - min) / reference;
    if (ecartRelatif <= config.TOLERANCE_NUMERIQUE) {
      const retenue = plusRecente(pretendants);
      const age = ageJours(retenue.date_donnee, dateReference);
      const signale =
        spec.volatilite === 'stable' &&
        aSignaler({ resolution: 'auto', ageValeurRetenue: age, ecartJours: null, seuils });
      return {
        champ: {
          ...base,
          valeur_retenue: retenue.valeur,
          confiance: confianceDecayee(retenue, dateReference, config),
          resolution: 'auto',
          a_signaler_AE: signale,
        },
        signal: null,
        question: signale
          ? questionConfirmation(nom, spec.label, retenue.valeur)
          : null,
      };
    }
  }

  // La récence prime (le garde-fou n°1 garantit ici que toutes les dates existent).
  const datesMs = pretendants.map((o) => Date.parse(o.date_donnee!));
  const maxDate = Math.max(...datesMs);
  const lesPlusRecentes = pretendants.filter(
    (o) => Date.parse(o.date_donnee!) === maxDate,
  );

  let gagnante: Observation;
  if (lesPlusRecentes.length === 1) {
    gagnante = lesPlusRecentes[0]!;
  } else {
    // Ligne 7 / garde-fou n°2 — dates identiques ⇒ départage par confiance_source.
    const maxConfiance = Math.max(
      ...lesPlusRecentes.map((o) => o.confiance_source),
    );
    const meilleures = lesPlusRecentes.filter(
      (o) => o.confiance_source === maxConfiance,
    );
    const valeursDistinctes = new Set(meilleures.map((o) => normaliser(o.valeur)));
    if (valeursDistinctes.size > 1) {
      // Confiances égales, valeurs divergentes : conflit, question ouverte.
      return {
        champ: {
          ...base,
          valeur_retenue: null,
          confiance: 0,
          resolution: 'impossible',
          a_signaler_AE: true,
        },
        signal: null,
        question: questionOuverte(nom, spec.label),
      };
    }
    gagnante = meilleures[0]!;
  }

  // Union sur le groupe concordant avec la gagnante (corroboration éventuelle).
  const cleGagnante = normaliser(gagnante.valeur);
  const concordantes = pretendants.filter((o) => normaliser(o.valeur) === cleGagnante);
  const perdantes = pretendants.filter((o) => normaliser(o.valeur) !== cleGagnante);

  // Écart (jours) entre la valeur retenue et la divergente la plus récente.
  const datePerdante = Math.max(...perdantes.map((o) => Date.parse(o.date_donnee!)));
  const ecartJours = (Date.parse(gagnante.date_donnee!) - datePerdante) / MS_PAR_JOUR;
  const age = ageJours(gagnante.date_donnee, dateReference);

  // -------------------------------------------------------------------------
  // Ligne 4 — divergence sur champ VOLATILE : un changement, pas une erreur.
  // Signal, aucune question ; les seuils ne s'appliquent pas.
  // -------------------------------------------------------------------------
  if (spec.volatilite === 'volatile') {
    const ancienne = perdantes.reduce((a, b) =>
      Date.parse(a.date_donnee!) >= Date.parse(b.date_donnee!) ? a : b,
    );
    return {
      champ: {
        ...base,
        valeur_retenue: gagnante.valeur,
        confiance: confianceObservations(concordantes, dateReference, config),
        resolution: 'auto',
        a_signaler_AE: false,
      },
      signal: {
        type: 'changement',
        champ: nom,
        ancienne_valeur: ancienne.valeur,
        nouvelle_valeur: gagnante.valeur,
        source_nouvelle: gagnante.source,
        message: `Changement détecté sur ${spec.label} : « ${String(ancienne.valeur)} » → « ${String(gagnante.valeur)} ».`,
      },
      question: null,
    };
  }

  // -------------------------------------------------------------------------
  // Ligne 5 — divergence sur champ STABLE : une source se trompe.
  // La récence prime pour la valeur, les seuils décident du signalement.
  // -------------------------------------------------------------------------
  const signale = aSignaler({
    resolution: 'auto',
    ageValeurRetenue: age,
    ecartJours,
    seuils,
  });
  return {
    champ: {
      ...base,
      valeur_retenue: gagnante.valeur,
      confiance: confianceObservations(concordantes, dateReference, config),
      resolution: 'auto',
      a_signaler_AE: signale,
    },
    signal: null,
    question: signale
      ? questionConfirmation(nom, spec.label, gagnante.valeur)
      : null,
  };
}

/** Tri déterministe : date la plus récente d'abord (les non-datées en dernier),
 *  puis confiance_source, puis source alphabétique. */
function plusRecente(observations: readonly Observation[]): Observation {
  return [...observations].sort((a, b) => {
    const da = a.date_donnee === null ? -Infinity : Date.parse(a.date_donnee);
    const db = b.date_donnee === null ? -Infinity : Date.parse(b.date_donnee);
    if (da !== db) return db - da;
    if (a.confiance_source !== b.confiance_source) {
      return b.confiance_source - a.confiance_source;
    }
    return a.source.localeCompare(b.source);
  })[0]!;
}
