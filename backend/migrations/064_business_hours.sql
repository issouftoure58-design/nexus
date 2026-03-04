-- Migration 064: Table business_hours pour horaires dynamiques par tenant
-- Permet aux tenants de modifier leurs horaires via l'admin UI

CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id);

-- Seed Fat's Hair Afro (horaires actuels hardcodes dans businessRules.js)
INSERT INTO business_hours (tenant_id, day_of_week, open_time, close_time, is_closed) VALUES
  ('fatshairafro', 0, NULL, NULL, true),          -- Dimanche ferme
  ('fatshairafro', 1, '09:00', '18:00', false),   -- Lundi
  ('fatshairafro', 2, '09:00', '18:00', false),   -- Mardi
  ('fatshairafro', 3, '09:00', '18:00', false),   -- Mercredi
  ('fatshairafro', 4, '09:00', '13:00', false),   -- Jeudi (demi-journee)
  ('fatshairafro', 5, '13:00', '18:00', false),   -- Vendredi (apres-midi)
  ('fatshairafro', 6, '09:00', '18:00', false)    -- Samedi
ON CONFLICT (tenant_id, day_of_week) DO NOTHING;
