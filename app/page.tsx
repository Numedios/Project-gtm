import { QualifierLead } from '@/components/QualifierLead';

// B1 : le formulaire déclenche le pipeline réel (POST /api/qualify) et rend
// le dossier consolidé qui en sort. L'exemple statique du contrat reste
// vérifié par tests/contrat.test.ts côté moteur.
export default function Page() {
  return <QualifierLead />;
}
