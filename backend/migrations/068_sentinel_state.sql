-- Migration 068: Persistent SENTINEL state
-- Survives server restarts (IP blacklist, degraded mode, etc.)

CREATE TABLE IF NOT EXISTS sentinel_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default state
INSERT INTO sentinel_state (key, value) VALUES
  ('degraded_mode', '{"active": false, "reason": null, "since": null}'),
  ('ip_blacklist', '{"ips": []}')
ON CONFLICT (key) DO NOTHING;
