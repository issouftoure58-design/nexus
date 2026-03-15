-- Migration 082: Client Consents (RGPD)
-- Table de consentement marketing par canal (SMS, WhatsApp, email)
-- Preuve legale requise par le RGPD Article 7

CREATE TABLE IF NOT EXISTS client_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'marketing')),
    consented BOOLEAN NOT NULL DEFAULT false,
    consented_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, client_id, channel)
);

CREATE INDEX idx_client_consents_tenant ON client_consents (tenant_id);
CREATE INDEX idx_client_consents_client ON client_consents (client_id);

-- RLS
ALTER TABLE client_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_client_consents ON client_consents;
CREATE POLICY tenant_policy_client_consents ON client_consents
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );
