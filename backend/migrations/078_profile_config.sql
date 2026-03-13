-- Migration 078: Add profile_config JSONB column to tenants
-- Stores per-tenant configuration (commerce_prep_time, restaurant_info, hotel_info, etc.)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS profile_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenants.profile_config IS 'Configuration metier personnalisee par tenant (temps preparation, infos restaurant/hotel, etc.)';
