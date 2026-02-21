-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║                    🛡️ ROW LEVEL SECURITY (RLS) v2 🛡️                       ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║  Version compatible avec service_role backend.                            ║
-- ║  Utilise app.current_tenant pour l'isolation.                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- FONCTION HELPER: Get current tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_tenant', true),
    ''
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TABLES CRITIQUES AVEC RLS
-- ============================================================================

-- SERVICES
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_services ON services;
CREATE POLICY tenant_policy_services ON services
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- CLIENTS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_clients ON clients;
CREATE POLICY tenant_policy_clients ON clients
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- RESERVATIONS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_reservations ON reservations;
CREATE POLICY tenant_policy_reservations ON reservations
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- FACTURES
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_factures ON factures;
CREATE POLICY tenant_policy_factures ON factures
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- CONVERSATIONS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_conversations ON conversations;
CREATE POLICY tenant_policy_conversations ON conversations
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- ADMIN_USERS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_admin_users ON admin_users;
CREATE POLICY tenant_policy_admin_users ON admin_users
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- BRANDING
ALTER TABLE branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_branding ON branding;
CREATE POLICY tenant_policy_branding ON branding
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- REVIEWS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_reviews ON reviews;
CREATE POLICY tenant_policy_reviews ON reviews
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- HORAIRES
ALTER TABLE horaires_hebdo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_horaires_hebdo ON horaires_hebdo;
CREATE POLICY tenant_policy_horaires_hebdo ON horaires_hebdo
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- SOCIAL POSTS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_social_posts ON social_posts;
CREATE POLICY tenant_policy_social_posts ON social_posts
  FOR ALL USING (
    tenant_id = get_current_tenant()
    OR get_current_tenant() = ''
    OR get_current_tenant() = 'service_role'
  );

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;
