#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Test invoice status values
const statuses = ['paid', 'pending', 'cancelled', 'draft', 'sent', 'overdue', 'payee', 'impayee', 'en_attente', 'annulee'];

console.log('Testing invoice status values...\n');

for (const status of statuses) {
  const { data, error } = await supabase.from('invoices').insert({
    tenant_id: 'nexus-test',
    invoice_number: `TEST-${status}-${Date.now()}`,
    client_name: 'Test Client',
    client_email: 'test@test.com',
    status: status,
    issue_date: '2026-02-12',
    due_date: '2026-03-12',
    subtotal: 1000,
    vat_amount: 200,
    total: 1200
  }).select();

  if (error) {
    console.log(`❌ "${status}" -> ${error.message.includes('check') ? 'INVALID' : error.message}`);
  } else {
    console.log(`✅ "${status}" -> OK`);
    // Clean up
    await supabase.from('invoices').delete().eq('id', data[0].id);
  }
}
