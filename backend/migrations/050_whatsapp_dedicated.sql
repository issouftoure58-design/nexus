-- ════════════════════════════════════════════════════════════════════
-- Migration 050: WhatsApp Dedicated Numbers per Tenant
-- ════════════════════════════════════════════════════════════════════
-- Permet aux tenants Pro/Business d'avoir un numéro WhatsApp dédié
-- au lieu de partager le sandbox Twilio.
-- ════════════════════════════════════════════════════════════════════

-- 1. Ajouter messaging_service_sid sur tenant_phone_numbers
ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS messaging_service_sid VARCHAR(50);

-- 2. Ajouter whatsapp_status sur tenant_phone_numbers
-- Valeurs: 'none' | 'registering' | 'registered' | 'failed'
ALTER TABLE tenant_phone_numbers
  ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(30) DEFAULT 'none';

-- 3. Ajouter messaging_service_sid sur tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS messaging_service_sid VARCHAR(50);

-- Index pour lookup rapide par whatsapp_status
CREATE INDEX IF NOT EXISTS idx_tenant_phone_numbers_whatsapp_status
  ON tenant_phone_numbers (whatsapp_status)
  WHERE whatsapp_status = 'registered';
