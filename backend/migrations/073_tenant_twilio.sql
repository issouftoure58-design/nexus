-- Migration 073: Twilio phone number per tenant (multi-tenant SMS)
-- Permet à chaque tenant d'avoir son propre numéro Twilio pour SMS/Voice/WhatsApp

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS twilio_phone_number VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS twilio_messaging_service_sid VARCHAR(40);

-- Seed fatshairafro avec son numéro existant
UPDATE tenants
SET twilio_phone_number = '+33939240269',
    twilio_messaging_service_sid = 'MG9900ef43c53af37368ff17cb8ac1ab07'
WHERE id = 'fatshairafro';

COMMENT ON COLUMN tenants.twilio_phone_number IS 'Numéro Twilio du tenant (E.164, ex: +33612345678)';
COMMENT ON COLUMN tenants.twilio_messaging_service_sid IS 'Messaging Service SID Twilio (optionnel, prioritaire sur phone_number)';
