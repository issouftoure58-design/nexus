-- Migration 115: Activer RLS sur signup_phone_verifications
-- Corrige l'alerte Supabase "Table publicly accessible"

ALTER TABLE signup_phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_phone_verifications FORCE ROW LEVEL SECURITY;

-- Seul service_role (backend) peut acceder a cette table
CREATE POLICY IF NOT EXISTS service_role_full_access ON signup_phone_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon et authenticated = deny all (RLS sans policy = bloque tout)
