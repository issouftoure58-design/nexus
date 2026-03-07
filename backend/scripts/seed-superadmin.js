/**
 * Seed Superadmin Account
 *
 * Creates or updates a super_admin account in admin_users from env vars.
 * Idempotent — safe to run multiple times.
 *
 * Required env vars:
 *   NEXUS_SUPERADMIN_EMAIL
 *   NEXUS_SUPERADMIN_PASSWORD
 *
 * Usage:
 *   node scripts/seed-superadmin.js
 *   (or called automatically at boot if env vars are set)
 */

import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export async function seedSuperAdmin() {
  const email = process.env.NEXUS_SUPERADMIN_EMAIL;
  const password = process.env.NEXUS_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[seed-superadmin] NEXUS_SUPERADMIN_EMAIL or NEXUS_SUPERADMIN_PASSWORD not set, skipping.');
    return;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('[seed-superadmin] SUPABASE_URL or SUPABASE_KEY not set.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    // Check if admin exists
    const { data: existing, error: selectError } = await supabase
      .from('admin_users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (selectError) {
      console.error('[seed-superadmin] Error checking existing admin:', selectError.message);
      return;
    }

    if (existing) {
      // Update password + ensure role
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({
          password_hash: passwordHash,
          role: 'super_admin',
          actif: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[seed-superadmin] Error updating admin:', updateError.message);
        return;
      }
      console.log(`[seed-superadmin] Updated super_admin: ${email}`);
    } else {
      // Insert new super_admin (no tenant_id)
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          email,
          password_hash: passwordHash,
          nom: 'NEXUS Operator',
          role: 'super_admin',
          actif: true,
          tenant_id: null,
        });

      if (insertError) {
        console.error('[seed-superadmin] Error creating admin:', insertError.message);
        return;
      }
      console.log(`[seed-superadmin] Created super_admin: ${email}`);
    }
  } catch (err) {
    console.error('[seed-superadmin] Unexpected error:', err.message);
  }
}

// Direct execution
const isDirectRun = process.argv[1]?.includes('seed-superadmin');
if (isDirectRun) {
  seedSuperAdmin().then(() => process.exit(0)).catch(() => process.exit(1));
}
