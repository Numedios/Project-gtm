import type { Decideur } from '@/lib/schema/canonical';
import { ChampConsolideRow } from './ChampConsolideRow';
import { formaterDate, formaterValeur } from '@/lib/ui/format';

export function DecideurCard({ decideur }: { decideur: Decideur }) {
  return (
    <div className="panel">
      <ChampConsolideRow champ="nom" valeur={decideur.nom} />
      <ChampConsolideRow champ="titre" valeur={decideur.titre} />
      <ChampConsolideRow champ="seniorite" valeur={decideur.seniorite} />
      <ChampConsolideRow champ="email" valeur={decideur.email} />
      <ChampConsolideRow champ="telephone" valeur={decideur.telephone} />
      <ChampConsolideRow champ="linkedin_url" valeur={decideur.linkedin_url} />

      {decideur.historique_relationnel.deals.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <span className="champ-label">Historique relationnel (CRM)</span>
          {decideur.historique_relationnel.autre_entreprise && (
            <span className="badge badge-warn" style={{ marginLeft: 6 }}>
              autre entreprise
            </span>
          )}
          {decideur.historique_relationnel.deals.map((deal) => (
            <div key={deal.id} className="observation-list" style={{ marginTop: 6 }}>
              {deal.entreprise} — {formaterValeur(deal.statut)} · {formaterDate(deal.date)}
              {deal.montant != null && ` · ${deal.montant.toLocaleString('fr-FR')} €`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
