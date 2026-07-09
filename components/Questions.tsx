import type { Question } from '@/lib/schema/canonical';

// Les conflits devenus questions — la meilleure idée du brief : là où les
// sources se contredisent, on n'invente pas, on demande à l'AE.
export function Questions({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return <p className="empty-state">Aucune question — tout a pu être résolu en silence.</p>;
  }

  return (
    <div>
      {questions
        .slice()
        .sort((a, b) => a.ordre - b.ordre)
        .map((q) => (
          <div key={q.id} className="question-card">
            <div className="texte">{q.texte}</div>
            <div className="question-meta">
              <span className={`badge ${q.type === 'ouverte' ? 'badge-warn' : 'badge-neutral'}`}>
                {q.type === 'ouverte' ? 'question ouverte' : 'confirmation'}
              </span>
              {q.champ && <span className="badge badge-neutral">{q.champ}</span>}
            </div>
          </div>
        ))}
    </div>
  );
}
