import '../config/env.js';
import { supabase } from '../config/supabase.js';

const demain = '2026-02-12';

const { data, error } = await supabase
  .from('reservations')
  .select('id, date, heure, service_nom, statut, prix_total, client_id')
  .eq('tenant_id', 'fatshairafro')
  .eq('date', demain)
  .neq('statut', 'annule')
  .order('heure');

if (error) {
  console.log('Erreur:', error.message);
} else if (!data || data.length === 0) {
  console.log('=== Aucun RDV pour demain (12 fevrier 2026) ===');

  const { data: prochains } = await supabase
    .from('reservations')
    .select('id, date, heure, service_nom, statut, prix_total')
    .eq('tenant_id', 'fatshairafro')
    .gte('date', '2026-02-11')
    .neq('statut', 'annule')
    .order('date')
    .order('heure')
    .limit(10);

  console.log('\nProchains RDV (a partir d\'aujourdhui):');
  prochains?.forEach(r => {
    console.log('  ' + r.date + ' ' + r.heure + ' - ' + r.service_nom + ' (' + (r.prix_total/100) + 'EUR) [' + r.statut + ']');
  });
} else {
  console.log('RDV pour demain (12 fevrier 2026):');
  data.forEach(r => {
    console.log('  ' + r.heure + ' - ' + r.service_nom + ' (' + (r.prix_total/100) + 'EUR)');
  });
}
