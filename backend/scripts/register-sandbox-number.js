#!/usr/bin/env node
/**
 * Script: Register Twilio WhatsApp Sandbox Number
 *
 * Registers the Twilio sandbox number (+14155238886) for fatshairafro tenant
 * to enable WhatsApp routing.
 *
 * Usage: node scripts/register-sandbox-number.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Twilio WhatsApp Sandbox number
const SANDBOX_NUMBER = '+14155238886';
const TENANT_ID = 'fatshairafro';

async function main() {
  console.log('='.repeat(50));
  console.log('Register Twilio WhatsApp Sandbox Number');
  console.log('='.repeat(50));

  // 1. Check current state
  console.log('\n1. Checking current tenant_phone_numbers...');
  const { data: existing, error: checkError } = await supabase
    .from('tenant_phone_numbers')
    .select('*')
    .eq('phone_number', SANDBOX_NUMBER);

  if (checkError) {
    console.error('Error checking:', checkError.message);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log('✅ Number already registered:');
    console.log(JSON.stringify(existing, null, 2));

    // Check if it's for the right tenant
    if (existing[0].tenant_id === TENANT_ID && existing[0].status === 'active') {
      console.log('\n✅ Number is correctly configured for', TENANT_ID);
      return;
    } else {
      console.log(`\n⚠️ Number is registered for ${existing[0].tenant_id} with status ${existing[0].status}`);
      console.log('Updating...');
    }
  }

  // 2. Register or update the number
  console.log('\n2. Registering sandbox number...');
  const { data: inserted, error: insertError } = await supabase
    .from('tenant_phone_numbers')
    .upsert({
      tenant_id: TENANT_ID,
      phone_number: SANDBOX_NUMBER,
      type: 'whatsapp',
      status: 'active',
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'phone_number'
    })
    .select();

  if (insertError) {
    console.error('Error registering:', insertError.message);

    // If upsert fails, try delete + insert
    console.log('Trying delete + insert...');
    await supabase
      .from('tenant_phone_numbers')
      .delete()
      .eq('phone_number', SANDBOX_NUMBER);

    const { error: retry } = await supabase
      .from('tenant_phone_numbers')
      .insert({
        tenant_id: TENANT_ID,
        phone_number: SANDBOX_NUMBER,
        type: 'whatsapp',
        status: 'active',
        created_at: new Date().toISOString(),
      });

    if (retry) {
      console.error('Retry failed:', retry.message);
      process.exit(1);
    }
  }

  console.log('✅ Number registered successfully!');

  // 3. Update tenant whatsapp_number column
  console.log('\n3. Updating tenant whatsapp_number...');
  const { error: updateError } = await supabase
    .from('tenants')
    .update({ whatsapp_number: SANDBOX_NUMBER })
    .eq('slug', TENANT_ID);

  if (updateError) {
    console.warn('Warning: Could not update tenant.whatsapp_number:', updateError.message);
  } else {
    console.log('✅ Tenant whatsapp_number updated');
  }

  // 4. Verify
  console.log('\n4. Verifying...');
  const { data: verify } = await supabase
    .from('tenant_phone_numbers')
    .select('*')
    .eq('phone_number', SANDBOX_NUMBER)
    .single();

  console.log('Final state:');
  console.log(JSON.stringify(verify, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ DONE! Restart the backend to refresh the cache.');
  console.log('Or wait 60 seconds for automatic refresh.');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
