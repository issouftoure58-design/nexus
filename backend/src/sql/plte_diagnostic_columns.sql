-- PLTE v2 — Diagnostic Engine Migration
-- Ajoute les colonnes de diagnostic aux tables PLTE

-- Colonnes diagnostic sur les tests individuels
ALTER TABLE sentinel_logic_tests
  ADD COLUMN IF NOT EXISTS diagnosis_category TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS operator_action TEXT;

-- Colonnes diagnostic sur les runs (agregats)
ALTER TABLE sentinel_logic_runs
  ADD COLUMN IF NOT EXISTS diagnostics_fixed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostics_diagnosed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostics_unknown INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostic_report JSONB DEFAULT '[]';
