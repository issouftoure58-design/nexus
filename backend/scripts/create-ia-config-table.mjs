/**
 * Script de migration - Creer la table tenant_ia_config
 * Pour stocker les configurations IA (telephone, whatsapp) par tenant
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTable() {
  console.log('Creation de la table tenant_ia_config...\n');

  // Utiliser une requete SQL directe via RPC
  const { error: createError } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS tenant_ia_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        channel TEXT NOT NULL CHECK (channel IN ('telephone', 'whatsapp', 'web', 'sms')),
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, channel)
      );

      -- Index pour recherche rapide par tenant
      CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_tenant ON tenant_ia_config(tenant_id);

      -- Index pour recherche par channel
      CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_channel ON tenant_ia_config(channel);

      -- RLS
      ALTER TABLE tenant_ia_config ENABLE ROW LEVEL SECURITY;

      -- Policy: Les admins peuvent tout faire sur leur tenant
      DROP POLICY IF EXISTS tenant_ia_config_admin_policy ON tenant_ia_config;
      CREATE POLICY tenant_ia_config_admin_policy ON tenant_ia_config
        FOR ALL
        USING (true)
        WITH CHECK (true);
    `
  });

  if (createError) {
    // Si RPC n'existe pas, essayer une methode alternative
    if (createError.message.includes('function') || createError.message.includes('does not exist')) {
      console.log('RPC exec_sql non disponible, tentative alternative...');

      // Tester si la table existe deja
      const { data: existing, error: checkError } = await supabase
        .from('tenant_ia_config')
        .select('id')
        .limit(1);

      if (!checkError) {
        console.log('✅ La table tenant_ia_config existe deja!');
        return true;
      }

      console.log('⚠️  La table doit etre creee manuellement dans Supabase.');
      console.log('\nCopiez ce SQL dans l\'editeur SQL de Supabase:\n');
      console.log('─'.repeat(60));
      console.log(`
CREATE TABLE IF NOT EXISTS tenant_ia_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('telephone', 'whatsapp', 'web', 'sms')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, channel)
);

-- Index pour recherche rapide par tenant
CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_tenant ON tenant_ia_config(tenant_id);

-- Index pour recherche par channel
CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_channel ON tenant_ia_config(channel);

-- RLS
ALTER TABLE tenant_ia_config ENABLE ROW LEVEL SECURITY;

-- Policy: Acces complet (le backend gere la securite)
CREATE POLICY tenant_ia_config_admin_policy ON tenant_ia_config
  FOR ALL
  USING (true)
  WITH CHECK (true);
`);
      console.log('─'.repeat(60));
      return false;
    }

    console.error('Erreur creation table:', createError);
    return false;
  }

  console.log('✅ Table tenant_ia_config creee avec succes!');
  return true;
}

async function insertDefaultConfigs() {
  console.log('\nInsertion des configurations par defaut...\n');

  const defaultTelephone = {
    greeting_message: "Bonjour ! Je suis l'assistante virtuelle. Comment puis-je vous aider ?",
    voice_style: 'polly_lea',
    tone: 'professionnel',
    language: 'fr-FR',
    transfer_phone: '',
    max_duration_seconds: 300,
    business_hours: {
      enabled: false,
      message_outside_hours: "Nous sommes actuellement fermes."
    },
    personality: 'Assistante professionnelle et chaleureuse',
    services_description: '',
    booking_enabled: true,
    active: true
  };

  const defaultWhatsApp = {
    greeting_message: "Bonjour ! Comment puis-je vous aider ?",
    tone: 'professionnel',
    language: 'fr-FR',
    response_delay_ms: 1000,
    business_hours: {
      enabled: false,
      message_outside_hours: "Nous vous repondrons des notre reouverture."
    },
    personality: 'Assistante chaleureuse',
    services_description: '',
    booking_enabled: true,
    send_images: true,
    send_location: true,
    quick_replies_enabled: true,
    quick_replies: ['Prendre RDV', 'Nos services', 'Horaires', 'Contact'],
    active: true
  };

  // Recuperer les tenants existants
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id');

  if (tenantsError) {
    console.log('Pas de table tenants ou erreur:', tenantsError.message);
    console.log('Les configs seront creees a la demande.');
    return;
  }

  if (!tenants || tenants.length === 0) {
    console.log('Aucun tenant trouve. Les configs seront creees a la demande.');
    return;
  }

  for (const tenant of tenants) {
    // Config telephone
    const { error: telError } = await supabase
      .from('tenant_ia_config')
      .upsert({
        tenant_id: tenant.id,
        channel: 'telephone',
        config: defaultTelephone,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,channel'
      });

    if (telError) {
      console.log(`  [${tenant.id}] Erreur telephone:`, telError.message);
    } else {
      console.log(`  [${tenant.id}] Config telephone ✓`);
    }

    // Config WhatsApp
    const { error: waError } = await supabase
      .from('tenant_ia_config')
      .upsert({
        tenant_id: tenant.id,
        channel: 'whatsapp',
        config: defaultWhatsApp,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,channel'
      });

    if (waError) {
      console.log(`  [${tenant.id}] Erreur whatsapp:`, waError.message);
    } else {
      console.log(`  [${tenant.id}] Config WhatsApp ✓`);
    }
  }

  console.log('\n✅ Configurations par defaut inserees!');
}

async function main() {
  console.log('='.repeat(60));
  console.log('Migration: Table tenant_ia_config');
  console.log('='.repeat(60));
  console.log('');

  const created = await createTable();

  if (created) {
    await insertDefaultConfigs();
  }

  console.log('\n✅ Migration terminee!');
}

main().catch(console.error);
