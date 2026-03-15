-- Migration 083: RLS on Missing Tables
-- Adds Row Level Security to tables that were missing tenant isolation
-- Pattern: get_current_tenant() with service_role bypass

-- ============================================================================
-- 1. billing_events
-- ============================================================================
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_billing_events ON billing_events;
CREATE POLICY tenant_policy_billing_events ON billing_events
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 2. admin_sessions
-- ============================================================================
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_admin_sessions ON admin_sessions;
CREATE POLICY tenant_policy_admin_sessions ON admin_sessions
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 3. documents
-- ============================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_documents ON documents;
CREATE POLICY tenant_policy_documents ON documents
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 4. sso_providers
-- ============================================================================
ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_sso_providers ON sso_providers;
CREATE POLICY tenant_policy_sso_providers ON sso_providers
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 7. error_logs
-- ============================================================================
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_error_logs ON error_logs;
CREATE POLICY tenant_policy_error_logs ON error_logs
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 8. ia_conversations — fix USING(true) -> proper tenant filter
-- ============================================================================
ALTER TABLE ia_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_ia_conversations ON ia_conversations;
DROP POLICY IF EXISTS ia_conversations_policy ON ia_conversations;
CREATE POLICY tenant_policy_ia_conversations ON ia_conversations
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
    );

-- ============================================================================
-- 9. ia_messages — fix USING(true) -> proper tenant filter via conversation
-- ============================================================================
ALTER TABLE ia_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_ia_messages ON ia_messages;
DROP POLICY IF EXISTS ia_messages_policy ON ia_messages;
CREATE POLICY tenant_policy_ia_messages ON ia_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM ia_conversations c
            WHERE c.id = ia_messages.conversation_id
            AND (
                c.tenant_id = get_current_tenant()
                OR get_current_tenant() = ''
                OR get_current_tenant() = 'service_role'
            )
        )
    );

-- ============================================================================
-- 10. stripe_processed_events (new table from migration 081)
-- ============================================================================
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_policy_stripe_processed_events ON stripe_processed_events;
CREATE POLICY tenant_policy_stripe_processed_events ON stripe_processed_events
    FOR ALL USING (
        tenant_id = get_current_tenant()
        OR get_current_tenant() = ''
        OR get_current_tenant() = 'service_role'
        OR tenant_id IS NULL
    );

-- ============================================================================
-- Verification
-- ============================================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;
