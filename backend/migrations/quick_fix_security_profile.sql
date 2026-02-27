-- QUICK FIX: Setup security profile for test-security tenant
-- Exécutez ce script dans la console SQL de Supabase

-- 1. Créer la table business_profiles si elle n'existe pas
CREATE TABLE IF NOT EXISTS business_profiles (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Briefcase',
  pricing_mode VARCHAR(20) DEFAULT 'fixed',
  pricing_modes_allowed VARCHAR(100) DEFAULT 'fixed',
  duration_mode VARCHAR(20) DEFAULT 'fixed',
  allow_multi_day BOOLEAN DEFAULT FALSE,
  allow_overnight BOOLEAN DEFAULT FALSE,
  terminology JSONB DEFAULT '{}',
  field_config JSONB DEFAULT '{}',
  business_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ajouter colonnes aux tenants si elles n'existent pas
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_profile VARCHAR(50) DEFAULT 'beauty';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS profile_config JSONB DEFAULT '{}';

-- 3. Insérer les profils de base (ignorer si existent)
INSERT INTO business_profiles (id, label, description, icon, pricing_mode, pricing_modes_allowed, duration_mode, allow_multi_day, allow_overnight, terminology, field_config, business_rules)
VALUES
  (
    'beauty',
    'Beauté & Bien-être',
    'Salons de coiffure, instituts de beauté',
    'Scissors',
    'fixed',
    'fixed',
    'fixed',
    FALSE,
    FALSE,
    '{"reservation": {"singular": "Rendez-vous", "plural": "Rendez-vous"}, "service": {"singular": "Prestation", "plural": "Prestations"}, "client": {"singular": "Client", "plural": "Clients"}, "employee": {"singular": "Employé", "plural": "Employés"}, "duration": "Durée", "quantity": "Quantité"}'::jsonb,
    '{"service": {"required": ["nom", "prix", "duree_minutes"], "optional": [], "forbidden": ["taux_horaire"]}, "reservation": {"required": ["date_rdv", "heure_rdv"], "optional": [], "forbidden": ["date_fin"]}}'::jsonb,
    '{}'::jsonb
  ),
  (
    'security',
    'Sécurité privée',
    'Sociétés de sécurité, gardiennage, protection',
    'Shield',
    'hourly',
    'hourly,daily,package',
    'flexible',
    TRUE,
    TRUE,
    '{"reservation": {"singular": "Mission", "plural": "Missions"}, "service": {"singular": "Prestation", "plural": "Prestations"}, "client": {"singular": "Client", "plural": "Clients"}, "employee": {"singular": "Agent", "plural": "Agents"}, "duration": "Durée", "quantity": "Effectif"}'::jsonb,
    '{"service": {"required": ["nom", "taux_horaire"], "optional": ["description"], "forbidden": []}, "reservation": {"required": ["date_rdv", "heure_rdv", "heure_fin"], "optional": ["date_fin", "nb_agents"], "forbidden": []}}'::jsonb,
    '{"requireHourlyRate": true, "allowMultiDay": true, "allowMultipleAgents": true}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  pricing_mode = EXCLUDED.pricing_mode,
  terminology = EXCLUDED.terminology,
  field_config = EXCLUDED.field_config;

-- 4. Mettre à jour le tenant test-security avec le profil security
UPDATE tenants
SET business_profile = 'security', updated_at = NOW()
WHERE tenant_id = 'test-security';

-- Vérification
SELECT tenant_id, email, business_profile FROM tenants WHERE tenant_id = 'test-security';
SELECT id, label, pricing_mode FROM business_profiles;
