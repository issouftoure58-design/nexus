-- Migration 076: Multi-business service columns + business_hours multi-period + waitlist RLS
-- Ajoute les colonnes restaurant/hotel aux services
-- Ajoute period_label/sort_order aux business_hours
-- Corrige la RLS waitlist

-- ═══════════════════════════════════════════════════════════
-- 1. Services: colonnes restaurant
-- ═══════════════════════════════════════════════════════════
ALTER TABLE services ADD COLUMN IF NOT EXISTS capacite INTEGER DEFAULT 4;
ALTER TABLE services ADD COLUMN IF NOT EXISTS zone VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_dispo VARCHAR(20) DEFAULT 'midi_soir';

-- ═══════════════════════════════════════════════════════════
-- 2. Services: colonnes hotel
-- ═══════════════════════════════════════════════════════════
ALTER TABLE services ADD COLUMN IF NOT EXISTS capacite_max INTEGER DEFAULT 2;
ALTER TABLE services ADD COLUMN IF NOT EXISTS etage INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS vue VARCHAR(100);
ALTER TABLE services ADD COLUMN IF NOT EXISTS type_chambre VARCHAR(100);
ALTER TABLE services ADD COLUMN IF NOT EXISTS equipements TEXT[];

-- ═══════════════════════════════════════════════════════════
-- 3. Business hours: multi-period support
-- ═══════════════════════════════════════════════════════════
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS period_label VARCHAR(50) DEFAULT 'journee';
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════════════════════
-- 4. Waitlist: table + RLS policy
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'converted', 'expired', 'cancelled')),
  priority INTEGER DEFAULT 0,
  notes TEXT,
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON waitlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status ON waitlist(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date ON waitlist(tenant_id, preferred_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON waitlist(tenant_id, client_id);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- RLS policy: service role bypass (backend uses service_role key)
DROP POLICY IF EXISTS waitlist_service_all ON waitlist;
CREATE POLICY waitlist_service_all ON waitlist
  FOR ALL USING (true) WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
