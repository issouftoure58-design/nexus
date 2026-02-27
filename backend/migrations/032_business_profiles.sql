-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 032: Business Profiles System
-- Isolation des logiques métiers par profil
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. TABLE DES PROFILS MÉTIERS DISPONIBLES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_profiles (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Briefcase',

  -- Configuration tarification
  pricing_mode VARCHAR(20) DEFAULT 'fixed', -- 'fixed', 'hourly', 'daily', 'package'
  pricing_modes_allowed VARCHAR(100) DEFAULT 'fixed', -- CSV des modes autorisés

  -- Configuration durée
  duration_mode VARCHAR(20) DEFAULT 'fixed', -- 'fixed', 'flexible', 'range'
  allow_multi_day BOOLEAN DEFAULT FALSE,
  allow_overnight BOOLEAN DEFAULT FALSE,

  -- Terminologie (JSON)
  terminology JSONB DEFAULT '{}',

  -- Champs requis/optionnels (JSON)
  field_config JSONB DEFAULT '{}',

  -- Règles métier (JSON)
  business_rules JSONB DEFAULT '{}',

  -- Statut
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════
-- 2. AJOUTER LE PROFIL MÉTIER AUX TENANTS
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_profile VARCHAR(50) DEFAULT 'beauty';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS profile_config JSONB DEFAULT '{}';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tenants_business_profile ON tenants(business_profile);

-- ════════════════════════════════════════════════════════════════════
-- 3. INSÉRER LES PROFILS MÉTIERS DE BASE
-- ════════════════════════════════════════════════════════════════════

INSERT INTO business_profiles (id, label, description, icon, pricing_mode, pricing_modes_allowed, duration_mode, allow_multi_day, allow_overnight, terminology, field_config, business_rules)
VALUES
  -- BEAUTY: Coiffure, esthétique, spa, bien-être
  (
    'beauty',
    'Beauté & Bien-être',
    'Salons de coiffure, instituts de beauté, spas, centres de bien-être',
    'Scissors',
    'fixed',
    'fixed',
    'fixed',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "Rendez-vous", "plural": "Rendez-vous"},
      "service": {"singular": "Prestation", "plural": "Prestations"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Employé", "plural": "Employés"},
      "duration": "Durée",
      "quantity": "Quantité"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "prix", "duree_minutes"],
        "optional": ["description", "categorie_id"],
        "forbidden": ["taux_horaire"]
      },
      "reservation": {
        "required": ["date_rdv", "heure_rdv", "service_id"],
        "optional": ["lieu", "adresse_client", "notes"],
        "forbidden": ["date_fin", "heure_fin"]
      }
    }'::jsonb,
    '{
      "allowDomicile": true,
      "requireDurationFixed": true,
      "maxServicesPerReservation": 10,
      "allowMultipleEmployees": true
    }'::jsonb
  ),

  -- SECURITY: Sécurité privée, gardiennage
  (
    'security',
    'Sécurité privée',
    'Sociétés de sécurité, gardiennage, protection événementielle',
    'Shield',
    'hourly',
    'hourly,daily,package',
    'flexible',
    TRUE,
    TRUE,
    '{
      "reservation": {"singular": "Mission", "plural": "Missions"},
      "service": {"singular": "Type de prestation", "plural": "Types de prestations"},
      "client": {"singular": "Donneur d''ordre", "plural": "Donneurs d''ordre"},
      "employee": {"singular": "Agent", "plural": "Agents"},
      "duration": "Vacation",
      "quantity": "Effectif"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "taux_horaire"],
        "optional": ["description", "qualifications_requises", "taux_journalier"],
        "forbidden": ["duree_minutes"]
      },
      "reservation": {
        "required": ["date_debut", "heure_debut", "heure_fin", "nb_agents"],
        "optional": ["date_fin", "site_address", "contact_site", "briefing"],
        "forbidden": []
      }
    }'::jsonb,
    '{
      "allowMultiDay": true,
      "allowOvernight": true,
      "minHoursPerMission": 4,
      "maxAgentsPerMission": 50,
      "requireSiteAddress": true,
      "requireContactOnSite": false
    }'::jsonb
  ),

  -- CONSULTING: Conseil, avocats, experts
  (
    'consulting',
    'Conseil & Expertise',
    'Cabinets de conseil, avocats, experts-comptables, consultants',
    'Briefcase',
    'hourly',
    'hourly,package,fixed',
    'flexible',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "Intervention", "plural": "Interventions"},
      "service": {"singular": "Type de mission", "plural": "Types de missions"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Consultant", "plural": "Consultants"},
      "duration": "Temps passé",
      "quantity": "Intervenants"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "taux_horaire"],
        "optional": ["description", "forfait_prix"],
        "forbidden": []
      },
      "reservation": {
        "required": ["date_rdv", "heure_rdv", "duree_estimee"],
        "optional": ["lieu", "visio_link", "dossier_ref"],
        "forbidden": []
      }
    }'::jsonb,
    '{
      "allowRemote": true,
      "allowVisio": true,
      "trackActualTime": true,
      "requireTimesheet": true
    }'::jsonb
  ),

  -- CLEANING: Nettoyage, entretien
  (
    'cleaning',
    'Nettoyage & Entretien',
    'Entreprises de nettoyage, services d''entretien, conciergerie',
    'Sparkles',
    'hourly',
    'hourly,daily,package,fixed',
    'flexible',
    TRUE,
    TRUE,
    '{
      "reservation": {"singular": "Intervention", "plural": "Interventions"},
      "service": {"singular": "Prestation", "plural": "Prestations"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Agent", "plural": "Agents"},
      "duration": "Durée",
      "quantity": "Personnel"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom"],
        "optional": ["taux_horaire", "prix_fixe", "duree_estimee"],
        "forbidden": []
      },
      "reservation": {
        "required": ["date_rdv", "adresse"],
        "optional": ["heure_rdv", "heure_fin", "recurrence"],
        "forbidden": []
      }
    }'::jsonb,
    '{
      "allowRecurrence": true,
      "allowMultiDay": true,
      "requireAddress": true,
      "allowKeyHandover": true
    }'::jsonb
  ),

  -- HEALTHCARE: Médical, paramédical
  (
    'healthcare',
    'Santé & Paramédical',
    'Infirmiers, kinés, ostéopathes, psychologues, professions médicales',
    'Heart',
    'fixed',
    'fixed,package',
    'fixed',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "Consultation", "plural": "Consultations"},
      "service": {"singular": "Acte", "plural": "Actes"},
      "client": {"singular": "Patient", "plural": "Patients"},
      "employee": {"singular": "Praticien", "plural": "Praticiens"},
      "duration": "Durée",
      "quantity": "Séances"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "prix", "duree_minutes"],
        "optional": ["code_acte", "remboursement_secu"],
        "forbidden": []
      },
      "reservation": {
        "required": ["date_rdv", "heure_rdv", "patient_id"],
        "optional": ["motif", "ordonnance_ref"],
        "forbidden": []
      }
    }'::jsonb,
    '{
      "requirePatientFile": true,
      "allowDomicile": true,
      "trackMedicalHistory": true,
      "secuIntegration": false
    }'::jsonb
  ),

  -- EVENTS: Événementiel, traiteur
  (
    'events',
    'Événementiel',
    'Organisation d''événements, traiteurs, photographes, DJ',
    'PartyPopper',
    'package',
    'package,hourly,daily',
    'flexible',
    TRUE,
    TRUE,
    '{
      "reservation": {"singular": "Événement", "plural": "Événements"},
      "service": {"singular": "Prestation", "plural": "Prestations"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Intervenant", "plural": "Intervenants"},
      "duration": "Durée événement",
      "quantity": "Convives/Participants"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom"],
        "optional": ["prix_forfait", "prix_par_personne", "duree_estimee"],
        "forbidden": []
      },
      "reservation": {
        "required": ["date_debut", "lieu", "type_evenement"],
        "optional": ["date_fin", "nb_participants", "options"],
        "forbidden": []
      }
    }'::jsonb,
    '{
      "allowMultiDay": true,
      "requireDevis": true,
      "allowOptions": true,
      "trackParticipants": true
    }'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  pricing_mode = EXCLUDED.pricing_mode,
  pricing_modes_allowed = EXCLUDED.pricing_modes_allowed,
  duration_mode = EXCLUDED.duration_mode,
  allow_multi_day = EXCLUDED.allow_multi_day,
  allow_overnight = EXCLUDED.allow_overnight,
  terminology = EXCLUDED.terminology,
  field_config = EXCLUDED.field_config,
  business_rules = EXCLUDED.business_rules,
  updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════
-- 4. ADAPTER LA TABLE SERVICES POUR LES DIFFÉRENTS MODES
-- ════════════════════════════════════════════════════════════════════

-- Taux horaire (pour security, consulting, cleaning)
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_horaire INTEGER DEFAULT NULL;
COMMENT ON COLUMN services.taux_horaire IS 'Taux horaire en centimes (pour profils hourly)';

-- Taux journalier (pour security, events)
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_journalier INTEGER DEFAULT NULL;
COMMENT ON COLUMN services.taux_journalier IS 'Taux journalier en centimes';

-- Prix forfait (pour events, consulting)
ALTER TABLE services ADD COLUMN IF NOT EXISTS prix_forfait INTEGER DEFAULT NULL;
COMMENT ON COLUMN services.prix_forfait IS 'Prix forfaitaire en centimes';

-- Mode de tarification du service (override du profil si besoin)
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) DEFAULT NULL;
COMMENT ON COLUMN services.pricing_mode IS 'Mode tarification: fixed, hourly, daily, package';

-- ════════════════════════════════════════════════════════════════════
-- 5. ADAPTER LA TABLE RESERVATIONS POUR LES DIFFÉRENTS MODES
-- ════════════════════════════════════════════════════════════════════

-- Date de fin (pour missions multi-jours)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS date_fin DATE DEFAULT NULL;
COMMENT ON COLUMN reservations.date_fin IS 'Date de fin pour missions multi-jours';

-- Heure de fin (pour calcul durée flexible)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS heure_fin VARCHAR(5) DEFAULT NULL;
COMMENT ON COLUMN reservations.heure_fin IS 'Heure de fin (HH:MM)';

-- Nombre d'agents/intervenants
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nb_agents INTEGER DEFAULT 1;
COMMENT ON COLUMN reservations.nb_agents IS 'Nombre d''agents/intervenants';

-- Adresse du site (pour security, cleaning)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS site_address TEXT DEFAULT NULL;
COMMENT ON COLUMN reservations.site_address IS 'Adresse du site d''intervention';

-- Contact sur site
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS contact_site VARCHAR(255) DEFAULT NULL;
COMMENT ON COLUMN reservations.contact_site IS 'Contact sur site (nom + téléphone)';

-- Briefing / instructions
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS briefing TEXT DEFAULT NULL;
COMMENT ON COLUMN reservations.briefing IS 'Instructions / briefing pour la mission';

-- Mode de tarification appliqué
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) DEFAULT 'fixed';
COMMENT ON COLUMN reservations.pricing_mode IS 'Mode tarification appliqué à cette réservation';

-- Taux appliqué (pour audit)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS taux_applique INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.taux_applique IS 'Taux horaire/journalier appliqué en centimes';

-- ════════════════════════════════════════════════════════════════════
-- 6. TABLE D'AUDIT DES PROFILS
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_profile_audit (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'profile_loaded', 'validation_failed', 'profile_changed'
  profile_id VARCHAR(50),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_audit_tenant ON business_profile_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_audit_created ON business_profile_audit(created_at);

-- ════════════════════════════════════════════════════════════════════
-- 7. FONCTION DE VALIDATION PROFIL
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_business_profile(
  p_tenant_id VARCHAR(255),
  p_data JSONB,
  p_context VARCHAR(50) -- 'service', 'reservation'
) RETURNS JSONB AS $$
DECLARE
  v_profile_id VARCHAR(50);
  v_field_config JSONB;
  v_required_fields TEXT[];
  v_forbidden_fields TEXT[];
  v_errors TEXT[] := '{}';
  v_field TEXT;
BEGIN
  -- Récupérer le profil du tenant
  SELECT business_profile INTO v_profile_id FROM tenants WHERE id = p_tenant_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Tenant not found');
  END IF;

  -- Récupérer la config des champs
  SELECT field_config INTO v_field_config FROM business_profiles WHERE id = v_profile_id;

  IF v_field_config IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Profile not found');
  END IF;

  -- Vérifier les champs requis
  SELECT array_agg(value::text) INTO v_required_fields
  FROM jsonb_array_elements_text(v_field_config -> p_context -> 'required');

  IF v_required_fields IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_required_fields LOOP
      IF NOT p_data ? v_field OR p_data ->> v_field IS NULL THEN
        v_errors := array_append(v_errors, 'Champ requis manquant: ' || v_field);
      END IF;
    END LOOP;
  END IF;

  -- Vérifier les champs interdits
  SELECT array_agg(value::text) INTO v_forbidden_fields
  FROM jsonb_array_elements_text(v_field_config -> p_context -> 'forbidden');

  IF v_forbidden_fields IS NOT NULL THEN
    FOREACH v_field IN ARRAY v_forbidden_fields LOOP
      IF p_data ? v_field AND p_data ->> v_field IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Champ non autorisé pour ce profil: ' || v_field);
      END IF;
    END LOOP;
  END IF;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', to_jsonb(v_errors),
      'profile', v_profile_id
    );
  END IF;

  RETURN jsonb_build_object('valid', true, 'profile', v_profile_id);
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════
-- 8. METTRE À JOUR LES TENANTS EXISTANTS
-- ════════════════════════════════════════════════════════════════════

-- Tous les tenants existants sont en mode 'beauty' par défaut
UPDATE tenants SET business_profile = 'beauty' WHERE business_profile IS NULL;

-- ════════════════════════════════════════════════════════════════════
-- COMMENTAIRES
-- ════════════════════════════════════════════════════════════════════

COMMENT ON TABLE business_profiles IS 'Définitions des profils métiers avec leurs règles et configurations';
COMMENT ON COLUMN tenants.business_profile IS 'Profil métier du tenant (beauty, security, consulting, etc.)';
