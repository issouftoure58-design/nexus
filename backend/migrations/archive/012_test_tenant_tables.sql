-- Migration: Create missing tables for tenant test
-- Date: 2026-02-12
-- Description: Adds expenses, team_members, business_hours tables

-- =====================================================
-- TABLE: expenses (Depenses comptables)
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL, -- en centimes
  category TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  supplier_name TEXT,
  invoice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- =====================================================
-- TABLE: team_members (Equipe RH)
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  poste TEXT,
  hire_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  hourly_rate INTEGER, -- en centimes
  monthly_salary INTEGER, -- en centimes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- =====================================================
-- TABLE: business_hours (Horaires ouverture)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Dimanche
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id);

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL ON expenses TO authenticated;
GRANT ALL ON team_members TO authenticated;
GRANT ALL ON business_hours TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE expenses_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE team_members_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE business_hours_id_seq TO authenticated;

-- Log migration
SELECT 'Migration 012_test_tenant_tables completed' AS result;
