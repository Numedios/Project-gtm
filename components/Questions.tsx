import type { Question } from '@/lib/schema/canonical';
import { libelleChamp } from '@/lib/ui/format';

// Les conflits devenus questions — la meilleure idée du brief : là où les
// sources se contredisent, on n'invente pas, on demande à l'AE. L'ordre est
// figé par le moteur : on affiche la liste telle quelle, on ne la trie pas.
export function Questions({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return <p className="empty-state">Aucune question — tout a pu être résolu en silence.</p>;
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} className="question-card">
          <div className="texte">{q.texte}</div>
          <div className="question-meta">
            <span className={`badge ${q.type === 'ouverte' ? 'badge-warn' : 'badge-neutral'}`}>
              {q.type === 'ouverte' ? 'question ouverte' : 'confirmation'}
            </span>
            <span className="badge badge-neutral">{libelleChamp(q.champ)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
