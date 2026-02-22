-- Migration 013: Business Templates & Agent Roles System for Multi-Tenant Agents
-- Permet de créer des agents configurables pour différents métiers et rôles.
--
-- Architecture:
-- 1. business_templates - Type de business (salon, restaurant, hotel)
-- 2. agent_roles - Rôle de l'agent (reservation, standard, receptionniste)
-- 3. tenant_agent_config - Config spécifique du tenant (capabilities, autonomy, channels)

-- ============================================
-- 1. TABLE business_templates
-- ============================================
CREATE TABLE IF NOT EXISTS business_templates (
  id TEXT PRIMARY KEY,  -- 'salon', 'restaurant', 'hotel', 'generic'
  name TEXT NOT NULL,
  description TEXT,

  -- Defaults for new tenants using this template
  default_services JSONB DEFAULT '[]',
  default_business_hours JSONB DEFAULT '{}',
  default_booking_rules JSONB DEFAULT '{}',
  default_travel_fees JSONB DEFAULT '{}',

  -- Prompt templates (use {{variable}} placeholders)
  prompt_template TEXT,
  voice_prompt_template TEXT,
  greeting_templates JSONB DEFAULT '{}',
  goodbye_templates JSONB DEFAULT '{}',

  -- Business logic
  ambiguous_terms JSONB DEFAULT '{}',
  category_labels JSONB DEFAULT '{}',

  -- Required fields for booking
  required_fields TEXT[] DEFAULT ARRAY['client_nom', 'client_telephone'],
  optional_fields TEXT[] DEFAULT ARRAY['adresse', 'notes'],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_business_templates_id ON business_templates(id);

-- ============================================
-- 2. EXTEND tenants TABLE
-- ============================================

-- Reference to business template
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'salon';

-- Prompt customization overrides
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS prompt_overrides JSONB DEFAULT '{}';

-- Voice configuration (TTS settings, greetings, etc.)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS voice_config JSONB DEFAULT '{}';

-- Service options (domicile enabled, delivery, etc.)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_options JSONB DEFAULT '{}';

-- Personality configuration
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{}';

-- Business hours (structured)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{}';

-- Travel/delivery fees
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS travel_fees JSONB DEFAULT '{}';

-- Booking rules
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS booking_rules JSONB DEFAULT '{}';

-- Ambiguous terms override
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ambiguous_terms JSONB DEFAULT '{}';

-- ============================================
-- 3. EXTEND services TABLE
-- ============================================

-- Category for grouping (locks, soins, tresses, etc.)
ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT;

-- Service blocks entire day (e.g., locks creation)
ALTER TABLE services ADD COLUMN IF NOT EXISTS blocks_full_day BOOLEAN DEFAULT false;

-- Number of consecutive days required
ALTER TABLE services ADD COLUMN IF NOT EXISTS blocks_days INTEGER DEFAULT 1;

-- Price is minimum ("à partir de X€")
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_is_minimum BOOLEAN DEFAULT false;

-- Variable pricing per unit
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_per_unit BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS unit_name TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS unit_price INTEGER;  -- In cents

-- Special instructions for this service
ALTER TABLE services ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Template this service belongs to (for defaults)
ALTER TABLE services ADD COLUMN IF NOT EXISTS template_id TEXT;

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_template ON services(template_id);

-- ============================================
-- 4. TABLE agent_roles
-- ============================================
CREATE TABLE IF NOT EXISTS agent_roles (
  id TEXT PRIMARY KEY,  -- 'reservation', 'standard', 'receptionniste', 'support'
  name TEXT NOT NULL,
  description TEXT,

  -- Capabilities this role can have (all possible actions)
  available_capabilities JSONB DEFAULT '[]',

  -- Default enabled capabilities for new tenants
  default_capabilities JSONB DEFAULT '[]',

  -- Channel configurations
  channels JSONB DEFAULT '{
    "phone": true,
    "chat": true,
    "whatsapp": true,
    "email": false
  }',

  -- Prompt templates for this role
  system_prompt_template TEXT,
  voice_prompt_template TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_roles_id ON agent_roles(id);

-- ============================================
-- 5. TABLE tenant_agent_config
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,

  -- Role reference
  role_id TEXT NOT NULL DEFAULT 'reservation',

  -- Enabled capabilities (subset of role.available_capabilities)
  capabilities JSONB DEFAULT '[]',

  -- Autonomy settings (what agent can do without human approval)
  autonomy JSONB DEFAULT '{
    "can_book_appointments": true,
    "can_cancel_appointments": false,
    "can_modify_appointments": false,
    "can_take_payments": true,
    "can_send_sms": true,
    "can_transfer_calls": true,
    "can_take_messages": true,
    "max_booking_value": null
  }',

  -- Channel-specific configs
  channels JSONB DEFAULT '{
    "phone": {"enabled": true, "greeting": null},
    "chat": {"enabled": true, "greeting": null},
    "whatsapp": {"enabled": true, "greeting": null}
  }',

  -- Notification preferences
  notifications JSONB DEFAULT '{
    "email": true,
    "sms": false,
    "push": true,
    "slack": false,
    "webhook": null
  }',

  -- Transfer/escalation settings
  escalation JSONB DEFAULT '{
    "transfer_numbers": [],
    "fallback_email": null,
    "busy_action": "take_message",
    "after_hours_action": "voicemail"
  }',

  -- Active status
  active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_agent_config_tenant ON tenant_agent_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_agent_config_role ON tenant_agent_config(role_id);

-- ============================================
-- 6. SEED AGENT ROLES
-- ============================================

-- Role: Agent de réservation (comme Halimah)
INSERT INTO agent_roles (id, name, description, available_capabilities, default_capabilities, channels)
VALUES (
  'reservation',
  'Agent de réservation',
  'Gère les rendez-vous: vérification disponibilité, création, modification, annulation. Peut prendre des paiements.',
  '[
    "check_availability",
    "create_booking",
    "modify_booking",
    "cancel_booking",
    "get_services",
    "get_prices",
    "calculate_travel_fee",
    "take_payment",
    "send_confirmation_sms",
    "answer_faq"
  ]',
  '[
    "check_availability",
    "create_booking",
    "get_services",
    "get_prices",
    "send_confirmation_sms",
    "answer_faq"
  ]',
  '{"phone": true, "chat": true, "whatsapp": true, "email": false}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  available_capabilities = EXCLUDED.available_capabilities,
  default_capabilities = EXCLUDED.default_capabilities,
  channels = EXCLUDED.channels,
  updated_at = NOW();

-- Role: Standard téléphonique
INSERT INTO agent_roles (id, name, description, available_capabilities, default_capabilities, channels)
VALUES (
  'standard',
  'Standard téléphonique',
  'Accueille les appels, prend les messages, transfère vers les personnes concernées, notifie par email/SMS.',
  '[
    "take_message",
    "transfer_call",
    "notify_by_email",
    "notify_by_sms",
    "check_availability_person",
    "get_directory",
    "answer_faq",
    "voicemail"
  ]',
  '[
    "take_message",
    "transfer_call",
    "notify_by_email",
    "answer_faq"
  ]',
  '{"phone": true, "chat": false, "whatsapp": false, "email": true}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  available_capabilities = EXCLUDED.available_capabilities,
  default_capabilities = EXCLUDED.default_capabilities,
  channels = EXCLUDED.channels,
  updated_at = NOW();

-- Role: Réceptionniste
INSERT INTO agent_roles (id, name, description, available_capabilities, default_capabilities, channels)
VALUES (
  'receptionniste',
  'Réceptionniste',
  'Accueille, renseigne, dirige. Peut répondre aux questions fréquentes et orienter vers le bon service.',
  '[
    "greet_visitor",
    "answer_faq",
    "provide_directions",
    "check_in_visitor",
    "notify_arrival",
    "get_directory",
    "transfer_call"
  ]',
  '[
    "greet_visitor",
    "answer_faq",
    "provide_directions",
    "get_directory"
  ]',
  '{"phone": true, "chat": true, "whatsapp": true, "email": false}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  available_capabilities = EXCLUDED.available_capabilities,
  default_capabilities = EXCLUDED.default_capabilities,
  channels = EXCLUDED.channels,
  updated_at = NOW();

-- Role: Support client
INSERT INTO agent_roles (id, name, description, available_capabilities, default_capabilities, channels)
VALUES (
  'support',
  'Support client',
  'Répond aux questions, résout les problèmes simples, escalade les cas complexes.',
  '[
    "answer_faq",
    "check_order_status",
    "initiate_refund",
    "create_ticket",
    "escalate_to_human",
    "send_documentation"
  ]',
  '[
    "answer_faq",
    "check_order_status",
    "create_ticket",
    "escalate_to_human"
  ]',
  '{"phone": true, "chat": true, "whatsapp": true, "email": true}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  available_capabilities = EXCLUDED.available_capabilities,
  default_capabilities = EXCLUDED.default_capabilities,
  channels = EXCLUDED.channels,
  updated_at = NOW();

-- ============================================
-- 7. SEED DEFAULT TEMPLATES
-- ============================================

-- Insert salon template (based on Fat's Hair-Afro)
INSERT INTO business_templates (id, name, description, category_labels, ambiguous_terms, default_booking_rules, default_travel_fees)
VALUES (
  'salon',
  'Salon de coiffure',
  'Template pour salons de coiffure, coiffure afro, soins capillaires',
  '{
    "locks": "Locks",
    "soins": "Soins",
    "tresses": "Tresses & Braids",
    "coloration": "Coloration & Finition",
    "other": "Autres services"
  }',
  '{
    "locks": {
      "message": "Pour les locks, vous souhaitez :\n- Une création de locks\n- Une reprise de racines\n- Un décapage",
      "options": ["création crochet locks", "reprise racines locks", "décapage locks"]
    },
    "tresses": {
      "message": "Quel type de tresses souhaitez-vous ?\n- Braids\n- Vanilles\n- Fulani",
      "options": ["braids", "vanilles", "fulani braids"]
    }
  }',
  '{
    "min_advance_hours": 24,
    "max_advance_days": 60,
    "deposit_percent": 30,
    "free_cancellation_hours": 48,
    "full_day_start_hour": 9
  }',
  '{
    "base_distance_km": 8,
    "base_fee": 10,
    "base_fee_cents": 1000,
    "per_km_beyond": 1.10,
    "per_km_beyond_cents": 110
  }'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_labels = EXCLUDED.category_labels,
  ambiguous_terms = EXCLUDED.ambiguous_terms,
  default_booking_rules = EXCLUDED.default_booking_rules,
  default_travel_fees = EXCLUDED.default_travel_fees,
  updated_at = NOW();

-- Insert restaurant template (for future use)
INSERT INTO business_templates (id, name, description, category_labels, default_booking_rules)
VALUES (
  'restaurant',
  'Restaurant',
  'Template pour restaurants, livraison, commandes',
  '{
    "entrees": "Entrées",
    "plats": "Plats principaux",
    "desserts": "Desserts",
    "boissons": "Boissons"
  }',
  '{
    "min_advance_hours": 1,
    "max_advance_days": 30,
    "deposit_percent": 0,
    "free_cancellation_hours": 2
  }'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_labels = EXCLUDED.category_labels,
  default_booking_rules = EXCLUDED.default_booking_rules,
  updated_at = NOW();

-- Insert hotel template (for future use)
INSERT INTO business_templates (id, name, description, category_labels, default_booking_rules)
VALUES (
  'hotel',
  'Hotel / Hébergement',
  'Template pour hôtels, gîtes, chambres d''hôtes',
  '{
    "chambres": "Chambres",
    "suites": "Suites",
    "services": "Services additionnels"
  }',
  '{
    "min_advance_hours": 24,
    "max_advance_days": 365,
    "deposit_percent": 50,
    "free_cancellation_hours": 48
  }'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_labels = EXCLUDED.category_labels,
  default_booking_rules = EXCLUDED.default_booking_rules,
  updated_at = NOW();

-- Insert generic template
INSERT INTO business_templates (id, name, description, category_labels)
VALUES (
  'generic',
  'Générique',
  'Template générique pour tout type de business',
  '{
    "services": "Services",
    "products": "Produits"
  }'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category_labels = EXCLUDED.category_labels,
  updated_at = NOW();

-- ============================================
-- 8. UPDATE fatshairafro TENANT
-- ============================================

-- Set Fat's Hair-Afro to use salon template (but keep frozen)
UPDATE tenants
SET
  template_id = 'salon',
  personality = '{
    "tutoiement": false,
    "ton": "chaleureux",
    "emojis": "moderation",
    "description": "Chaleureuse, professionnelle, efficace"
  }',
  service_options = '{
    "domicile_enabled": false,
    "domicile_disabled_message": "Actuellement, les prestations se font uniquement chez moi à Franconville. Pas de déplacement à domicile pour le moment."
  }',
  business_hours = '{
    "0": null,
    "1": {"open": "09:00", "close": "18:00"},
    "2": {"open": "09:00", "close": "18:00"},
    "3": {"open": "09:00", "close": "18:00"},
    "4": {"open": "09:00", "close": "13:00"},
    "5": {"open": "13:00", "close": "18:00"},
    "6": {"open": "09:00", "close": "18:00"}
  }',
  travel_fees = '{
    "base_distance_km": 8,
    "base_fee": 10,
    "base_fee_cents": 1000,
    "per_km_beyond": 1.10,
    "per_km_beyond_cents": 110
  }',
  booking_rules = '{
    "min_advance_hours": 24,
    "max_advance_days": 60,
    "deposit_percent": 30,
    "free_cancellation_hours": 48,
    "full_day_start_hour": 9
  }',
  updated_at = NOW()
WHERE id = 'fatshairafro' OR slug = 'fatshairafro';

-- Create agent config for Fat's Hair-Afro (reservation role)
INSERT INTO tenant_agent_config (tenant_id, role_id, capabilities, autonomy, channels, notifications)
VALUES (
  'fatshairafro',
  'reservation',
  '[
    "check_availability",
    "create_booking",
    "cancel_booking",
    "get_services",
    "get_prices",
    "calculate_travel_fee",
    "take_payment",
    "send_confirmation_sms",
    "answer_faq"
  ]',
  '{
    "can_book_appointments": true,
    "can_cancel_appointments": true,
    "can_modify_appointments": false,
    "can_take_payments": true,
    "can_send_sms": true,
    "can_transfer_calls": true,
    "can_take_messages": true,
    "max_booking_value": null
  }',
  '{
    "phone": {"enabled": true, "greeting": "Fat''s Hair-Afro bonjour ! Moi c''est Halimah, comment puis-je vous aider ?"},
    "chat": {"enabled": true, "greeting": "Bonjour ! Je suis Halimah, l''assistante de Fat''s Hair-Afro. Comment puis-je vous aider ?"},
    "whatsapp": {"enabled": true, "greeting": "Bonjour ! Halimah de Fat''s Hair-Afro. En quoi puis-je vous aider ?"}
  }',
  '{
    "email": false,
    "sms": true,
    "push": false,
    "slack": false
  }'
) ON CONFLICT (tenant_id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  capabilities = EXCLUDED.capabilities,
  autonomy = EXCLUDED.autonomy,
  channels = EXCLUDED.channels,
  notifications = EXCLUDED.notifications,
  updated_at = NOW();

-- ============================================
-- 9. RLS POLICIES
-- ============================================

-- Enable RLS on business_templates (read-only for most users)
ALTER TABLE business_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read templates
DROP POLICY IF EXISTS "Anyone can read templates" ON business_templates;
CREATE POLICY "Anyone can read templates" ON business_templates
  FOR SELECT USING (true);

-- Only service role can modify templates
DROP POLICY IF EXISTS "Service role can modify templates" ON business_templates;
CREATE POLICY "Service role can modify templates" ON business_templates
  FOR ALL USING (true) WITH CHECK (true);
