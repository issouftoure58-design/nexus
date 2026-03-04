-- Migration 063: SSO providers (SAML/OIDC) pour enterprise
-- Sprint 4.1 — SSO

CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  provider_type VARCHAR(10) NOT NULL CHECK (provider_type IN ('saml', 'oidc')),
  name VARCHAR(100) NOT NULL, -- ex: "Google Workspace", "Azure AD", "Okta"
  enabled BOOLEAN DEFAULT false,

  -- SAML config
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_certificate TEXT, -- x509 certificate (PEM)
  saml_metadata_url TEXT,

  -- OIDC config
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT, -- chiffre
  oidc_discovery_url TEXT,
  oidc_scopes TEXT DEFAULT 'openid email profile',

  -- Common
  domain_restriction VARCHAR(255), -- ex: "@company.com" — seuls ces emails autorisés
  auto_provision BOOLEAN DEFAULT true, -- creer auto les comptes admin
  default_role VARCHAR(20) DEFAULT 'viewer',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_tenant ON sso_providers(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_tenant_type ON sso_providers(tenant_id, provider_type);
