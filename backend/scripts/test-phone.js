#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const formats = [
  '0612345678',
  '06 12 34 56 78',
  '+33612345678',
  '+33 6 12 34 56 78',
  '07 82 23 50 20'
];

for (const phone of formats) {
  const email = `test${Math.floor(Math.random() * 100000)}@test.com`;
  const { data, error } = await supabase.from('clients').insert({
    tenant_id: 'nexus-test',
    prenom: 'Marie',
    nom: 'Dupont',
    email: email,
    telephone: phone
  }).select();

  if (error) {
    console.log(`❌ "${phone}" -> ${error.message}`);
  } else {
    console.log(`✅ "${phone}" -> OK (id: ${data[0].id})`);
    // Clean up
    await supabase.from('clients').delete().eq('id', data[0].id);
  }
}
