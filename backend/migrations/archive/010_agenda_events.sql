-- Migration: Agenda Events
-- Table pour les RDV business de l'entrepreneur

CREATE TABLE IF NOT EXISTS agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  admin_id UUID NOT NULL,

  -- Infos événement
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME DEFAULT '09:00',
  end_time TIME,

  -- Type et statut
  type TEXT DEFAULT 'meeting' CHECK (type IN ('meeting', 'call', 'task', 'reminder')),
  completed BOOLEAN DEFAULT FALSE,

  -- Détails
  location TEXT,
  attendees TEXT,
  color TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_agenda_events_tenant ON agenda_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_admin ON agenda_events(admin_id);
CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(date);
CREATE INDEX IF NOT EXISTS idx_agenda_events_tenant_date ON agenda_events(tenant_id, date);

-- Enable RLS
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;

-- Policy pour isolation tenant
CREATE POLICY agenda_events_tenant_isolation ON agenda_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));

COMMENT ON TABLE agenda_events IS 'Événements agenda personnel de l''entrepreneur';
