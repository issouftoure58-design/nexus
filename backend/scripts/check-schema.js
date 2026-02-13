#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function checkSchema() {
  console.log('Checking table schemas...\n');

  const tables = ['services', 'clients', 'reservations', 'products', 'team_members', 'invoices', 'expenses'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`✅ ${table}: ${Object.keys(data[0]).join(', ')}`);
      } else {
        // Try insert to get column info from error
        const { error: insertError } = await supabase.from(table).insert({}).select();
        if (insertError && insertError.message.includes('column')) {
          console.log(`📋 ${table}: (empty) - ${insertError.message}`);
        } else {
          console.log(`📋 ${table}: (empty, schema unknown)`);
        }
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }
}

checkSchema().catch(console.error);
