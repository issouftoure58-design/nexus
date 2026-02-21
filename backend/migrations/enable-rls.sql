-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║                    🛡️ ROW LEVEL SECURITY (RLS) 🛡️                         ║
-- ╠═══════════════════════════════════════════════════════════════════════════╣
-- ║  Active l'isolation tenant au niveau base de données.                     ║
-- ║  DERNIÈRE LIGNE DE DÉFENSE - même si le code a un bug,                   ║
-- ║  Supabase bloquera les accès cross-tenant.                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Tables avec tenant_id qui nécessitent RLS
-- (Tables système comme 'tenants', 'plans' sont exclues)

-- ============================================================================
-- SERVICES & PRODUITS
-- ============================================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_services ON services;
CREATE POLICY tenant_isolation_services ON services
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_produits ON produits;
CREATE POLICY tenant_isolation_produits ON produits
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- CLIENTS & RÉSERVATIONS
-- ============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_clients ON clients;
CREATE POLICY tenant_isolation_clients ON clients
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_reservations ON reservations;
CREATE POLICY tenant_isolation_reservations ON reservations
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE rendez_vous ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_rendez_vous ON rendez_vous;
CREATE POLICY tenant_isolation_rendez_vous ON rendez_vous
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE rendezvous ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_rendezvous ON rendezvous;
CREATE POLICY tenant_isolation_rendezvous ON rendezvous
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_conversations ON conversations;
CREATE POLICY tenant_isolation_conversations ON conversations
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE halimah_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_halimah_conversations ON halimah_conversations;
CREATE POLICY tenant_isolation_halimah_conversations ON halimah_conversations
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE halimah_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_halimah_memory ON halimah_memory;
CREATE POLICY tenant_isolation_halimah_memory ON halimah_memory
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- ADMIN & USERS
-- ============================================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_admin_users ON admin_users;
CREATE POLICY tenant_isolation_admin_users ON admin_users
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_admin_tasks ON admin_tasks;
CREATE POLICY tenant_isolation_admin_tasks ON admin_tasks
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- FACTURATION & PAIEMENTS
-- ============================================================================

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_factures ON factures;
CREATE POLICY tenant_isolation_factures ON factures
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_invoices ON invoices;
CREATE POLICY tenant_isolation_invoices ON invoices
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- MARKETING & SOCIAL
-- ============================================================================

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_social_posts ON social_posts;
CREATE POLICY tenant_isolation_social_posts ON social_posts
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_social_accounts ON social_accounts;
CREATE POLICY tenant_isolation_social_accounts ON social_accounts
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_campaigns ON campaigns;
CREATE POLICY tenant_isolation_campaigns ON campaigns
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE campagnes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_campagnes ON campagnes;
CREATE POLICY tenant_isolation_campagnes ON campagnes
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- STOCK & INVENTAIRE
-- ============================================================================

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_stock_movements ON stock_movements;
CREATE POLICY tenant_isolation_stock_movements ON stock_movements
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE inventaires ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_inventaires ON inventaires;
CREATE POLICY tenant_isolation_inventaires ON inventaires
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- AVIS & REVIEWS
-- ============================================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_reviews ON reviews;
CREATE POLICY tenant_isolation_reviews ON reviews
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_avis ON avis;
CREATE POLICY tenant_isolation_avis ON avis
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- BRANDING & CONFIG
-- ============================================================================

ALTER TABLE branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_branding ON branding;
CREATE POLICY tenant_isolation_branding ON branding
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_configs ON tenant_configs;
CREATE POLICY tenant_isolation_tenant_configs ON tenant_configs
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- HORAIRES & DISPONIBILITÉS
-- ============================================================================

ALTER TABLE horaires_hebdo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_horaires_hebdo ON horaires_hebdo;
CREATE POLICY tenant_isolation_horaires_hebdo ON horaires_hebdo
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE disponibilites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_disponibilites ON disponibilites;
CREATE POLICY tenant_isolation_disponibilites ON disponibilites
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE blocs_indispo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_blocs_indispo ON blocs_indispo;
CREATE POLICY tenant_isolation_blocs_indispo ON blocs_indispo
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- WORKFLOWS & AUTOMATIONS
-- ============================================================================

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_workflows ON workflows;
CREATE POLICY tenant_isolation_workflows ON workflows
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_workflow_executions ON workflow_executions;
CREATE POLICY tenant_isolation_workflow_executions ON workflow_executions
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_automations ON automations;
CREATE POLICY tenant_isolation_automations ON automations
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

-- ============================================================================
-- POLICY SPÉCIALE: SERVICE ROLE BYPASS
-- Le service_role peut accéder à toutes les données (pour les jobs backend)
-- ============================================================================

-- Pour chaque table, ajouter une policy pour service_role
-- Exemple pattern (à appliquer si nécessaire):
-- CREATE POLICY service_role_bypass ON services
--   FOR ALL TO service_role USING (true);

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

-- Lister les tables avec RLS activé
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
