import '../config/env.js';
import { supabase } from '../config/supabase.js';

console.log('=== VERIFICATION TENANT_ID ===\n');

// RDV sans tenant_id
const { data: rdvSansTenant } = await supabase
  .from('reservations')
  .select('id, date, service_nom, tenant_id, created_via')
  .is('tenant_id', null);

console.log('RDV sans tenant_id:', rdvSansTenant?.length || 0);
if (rdvSansTenant?.length > 0) {
  rdvSansTenant.slice(0,10).forEach(r =>
    console.log('  - ID', r.id, ':', r.date, r.service_nom, '(' + (r.created_via || 'unknown') + ')')
  );
}

// Clients sans tenant_id
const { data: clientsSansTenant } = await supabase
  .from('clients')
  .select('id, prenom, telephone, tenant_id')
  .is('tenant_id', null);

console.log('\nClients sans tenant_id:', clientsSansTenant?.length || 0);
if (clientsSansTenant?.length > 0) {
  clientsSansTenant.slice(0,5).forEach(c =>
    console.log('  - ID', c.id, ':', c.prenom, c.telephone)
  );
}

// RDV crees par halimah-ai
const { data: rdvHalimah } = await supabase
  .from('reservations')
  .select('id, date, service_nom, tenant_id, created_via')
  .eq('created_via', 'halimah-ai');

console.log('\nRDV crees par halimah-ai:', rdvHalimah?.length || 0);
if (rdvHalimah?.length > 0) {
  rdvHalimah.forEach(r =>
    console.log('  - ID', r.id, ':', r.date, r.service_nom, 'tenant=' + r.tenant_id)
  );
}

console.log('\n=== FIN VERIFICATION ===');
