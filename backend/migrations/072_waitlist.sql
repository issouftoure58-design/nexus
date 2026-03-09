-- Migration 072: Liste d'attente (Waitlist)
-- Permet aux clients d'être mis en attente quand un créneau est plein

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

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant ON waitlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status ON waitlist(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date ON waitlist(tenant_id, preferred_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON waitlist(tenant_id, client_id);

-- RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
