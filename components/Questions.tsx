'use client';

import { useState } from 'react';
import type { Question } from '@/lib/schema/canonical';
import { libelleChamp } from '@/lib/ui/format';

// Les conflits devenus questions — la meilleure idée du brief : là où les
// sources se contredisent, on n'invente pas, on demande à l'AE. L'ordre est
// figé par le moteur : on affiche la liste telle quelle, on ne la trie pas.
// Au-delà de VISIBLES_PAR_DEFAUT, le reste se déplie à la demande — le
// repli tronque l'affichage, jamais la liste (l'ordre du moteur est intact).

const VISIBLES_PAR_DEFAUT = 3;

export function Questions({ questions }: { questions: Question[] }) {
  const [tout, setTout] = useState(false);

  if (questions.length === 0) {
    return <p className="empty-state">Aucune question — tout a pu être résolu en silence.</p>;
  }

  const visibles = tout ? questions : questions.slice(0, VISIBLES_PAR_DEFAUT);
  const masquees = questions.length - VISIBLES_PAR_DEFAUT;

  return (
    <div className="table-scroll"><table className="tableau">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Question</th>
            <th>Type</th>
            <th>Champ</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((q, i) => (
            <tr key={i}>
              <td className="cell-label">{i + 1}</td>
              <td className="cell-valeur">{q.texte}</td>
              <td>
                <span className={`badge ${q.type === 'ouverte' ? 'badge-warn' : 'badge-neutral'}`}>
                  {q.type === 'ouverte' ? 'ouverte' : 'confirmation'}
                </span>
              </td>
              <td className="cell-label">{libelleChamp(q.champ)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {masquees > 0 && (
        <button type="button" className="lien-depli" onClick={() => setTout((t) => !t)}>
          {tout ? '⌃ Réduire' : `⌵ Afficher les ${masquees} autres questions`}
        </button>
      )}
    </div>
  );
}
