-- Migration 081: Stripe Webhook Idempotence
-- Prevents duplicate processing of Stripe webhook events

CREATE TABLE IF NOT EXISTS stripe_processed_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(255),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_tenant_id
    ON stripe_processed_events (tenant_id);
