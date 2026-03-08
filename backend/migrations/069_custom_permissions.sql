-- Migration 069: Permissions granulaires par utilisateur
-- Ajoute custom_permissions JSONB pour override la matrice RBAC par defaut

-- Colonne custom_permissions sur admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- Colonne custom_permissions sur invitations
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- Index pour les requetes frequentes (liste membres actifs d'un tenant)
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_actif ON admin_users(tenant_id, actif);
