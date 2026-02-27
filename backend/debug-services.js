require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: services } = await supabase
    .from('services')
    .select('id, nom, taux_horaire, pricing_mode')
    .eq('tenant_id', 'tenant_test_securite');
  
  console.log('Services tenant_test_securite:');
  if (services) {
    services.forEach(s => console.log('  - ' + s.id + ': ' + s.nom + ' (mode=' + s.pricing_mode + ', taux=' + s.taux_horaire + ')'));
  }
})();
