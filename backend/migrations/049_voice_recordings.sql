-- Migration 042: Voice Recordings Storage
-- Stores Twilio voice recordings with transcriptions

CREATE TABLE IF NOT EXISTS voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recording_sid TEXT NOT NULL,
  call_sid TEXT,
  caller_phone TEXT,
  duration_seconds INTEGER DEFAULT 0,
  transcription TEXT,
  twilio_url TEXT,
  storage_path TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'deleted')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, recording_sid)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_recordings_tenant ON voice_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_created ON voice_recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_caller ON voice_recordings(caller_phone);
CREATE INDEX IF NOT EXISTS idx_voice_recordings_call ON voice_recordings(call_sid);

-- Enable RLS
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
CREATE POLICY "voice_recordings_tenant_isolation" ON voice_recordings
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Update trigger
CREATE OR REPLACE FUNCTION update_voice_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_recordings_updated_at
  BEFORE UPDATE ON voice_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_recordings_updated_at();

-- Create storage bucket for recordings (run manually in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('voice-recordings', 'voice-recordings', false);

COMMENT ON TABLE voice_recordings IS 'Stores Twilio voice recordings with optional transcriptions';
