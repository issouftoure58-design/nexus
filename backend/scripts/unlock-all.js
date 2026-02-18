#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Débloquer tous les comptes admin
const { data, error } = await supabase
  .from('admin_users')
  .update({
    failed_login_attempts: 0,
    locked_until: null
  })
  .not('id', 'is', null)
  .select('email, tenant_id, nom');

if (error) {
  console.log('Erreur:', error.message);
} else {
  console.log('Comptes débloqués:');
  data.forEach(u => console.log('  -', u.email, '| tenant:', u.tenant_id, '| nom:', u.nom));
}
