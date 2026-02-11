import '../config/env.js';
import { supabase } from '../config/supabase.js';

// Check admins with tenant_id
const { data } = await supabase
  .from('admin_users')
  .select('id, email, tenant_id, role')
  .limit(5);

console.log('Admins:', JSON.stringify(data, null, 2));

// Check if any has fatshairafro
const withTenant = data?.filter(a => a.tenant_id);
console.log('\nAdmins with tenant_id:', withTenant?.length || 0);
