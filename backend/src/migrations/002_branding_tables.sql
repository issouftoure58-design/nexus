-- ============================================
-- MIGRATION 002 : WHITE-LABEL / BRANDING
-- Tables pour personnalisation tenant
-- ============================================

-- Extension UUID si pas deja presente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1 : Branding par tenant
-- ============================================
CREATE TABLE IF NOT EXISTS branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) UNIQUE NOT NULL,

  -- Logo
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,

  -- Couleurs (format hex)
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#10B981',
  accent_color VARCHAR(7) DEFAULT '#F59E0B',
  background_color VARCHAR(7) DEFAULT '#FFFFFF',
  text_color VARCHAR(7) DEFAULT '#111827',

  -- Typographie
  font_family VARCHAR(255) DEFAULT 'Inter',
  font_url TEXT,

  -- Textes personnalises
  company_name VARCHAR(255),
  tagline TEXT,
  welcome_message TEXT,
  footer_text TEXT,

  -- Domaine custom
  custom_domain VARCHAR(255),
  custom_domain_verified BOOLEAN DEFAULT false,
  custom_domain_ssl BOOLEAN DEFAULT false,
  domain_verification_token VARCHAR(255),

  -- Email branding
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  email_reply_to VARCHAR(255),
  email_header_color VARCHAR(7),
  email_footer_text TEXT,
  email_logo_url TEXT,

  -- SMS branding
  sms_sender_name VARCHAR(11),

  -- Reseaux sociaux
  social_facebook TEXT,
  social_instagram TEXT,
  social_twitter TEXT,
  social_linkedin TEXT,
  social_youtube TEXT,
  social_tiktok TEXT,

  -- Metadonnees
  theme_mode VARCHAR(20) DEFAULT 'light',
  language VARCHAR(5) DEFAULT 'fr',
  timezone VARCHAR(50) DEFAULT 'Europe/Paris',
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Personnalisation avancee
  custom_css TEXT,
  custom_js TEXT,
  meta_title TEXT,
  meta_description TEXT,

  -- Analytics
  google_analytics_id VARCHAR(50),
  facebook_pixel_id VARCHAR(50),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branding_tenant ON branding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branding_domain ON branding(custom_domain);

-- ============================================
-- TABLE 2 : Pages personnalisees
-- ============================================
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  page_type VARCHAR(50) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  content_format VARCHAR(20) DEFAULT 'html',
  meta_title TEXT,
  meta_description TEXT,
  featured_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  publish_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  show_in_menu BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_pages_tenant ON custom_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_pages_published ON custom_pages(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS idx_custom_pages_type ON custom_pages(tenant_id, page_type);

-- ============================================
-- TABLE 3 : Themes predefinis
-- ============================================
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserer themes par defaut
INSERT INTO themes (name, description, is_premium, settings) VALUES
  ('Default', 'Theme par defaut NEXUS', false, '{"primary_color": "#3B82F6", "secondary_color": "#10B981", "font_family": "Inter"}'),
  ('Elegant', 'Theme elegant et raffine', false, '{"primary_color": "#1F2937", "secondary_color": "#D4AF37", "font_family": "Playfair Display"}'),
  ('Fresh', 'Theme frais et moderne', false, '{"primary_color": "#059669", "secondary_color": "#34D399", "font_family": "Poppins"}'),
  ('Bold', 'Theme audacieux et colore', true, '{"primary_color": "#DC2626", "secondary_color": "#FBBF24", "font_family": "Montserrat"}'),
  ('Minimal', 'Theme minimaliste', true, '{"primary_color": "#000000", "secondary_color": "#6B7280", "font_family": "DM Sans"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE branding IS 'Configuration white-label par tenant';
COMMENT ON TABLE custom_pages IS 'Pages personnalisees (CGV, mentions legales, etc.)';
COMMENT ON TABLE themes IS 'Themes predefinis disponibles';
