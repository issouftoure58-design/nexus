import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('admins')
  .select('id, email, tenant_id, role')
  .limit(10);

if (error) {
  console.error('Erreur:', error);
} else {
  console.log('Admins trouvés:');
  console.log(JSON.stringify(data, null, 2));
}
