-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 038: Business Types Extended
-- Ajout des profils: service_domicile, salon, restaurant, hotel
-- Configuration étendue des tenants
-- ═══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. AJOUTER LES NOUVEAUX PROFILS MÉTIERS
-- ════════════════════════════════════════════════════════════════════

INSERT INTO business_profiles (id, label, description, icon, pricing_mode, pricing_modes_allowed, duration_mode, allow_multi_day, allow_overnight, terminology, field_config, business_rules)
VALUES
  -- SERVICE_DOMICILE: Coiffure à domicile, plombier, coach, etc.
  (
    'service_domicile',
    'Service à domicile',
    'Prestations réalisées au domicile du client (coiffure, plomberie, coaching, etc.)',
    'Home',
    'fixed',
    'fixed,hourly',
    'fixed',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "RDV", "plural": "RDV"},
      "service": {"singular": "Prestation", "plural": "Prestations"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Intervenant", "plural": "Intervenants"},
      "location": "Lieu",
      "duration": "Durée",
      "quantity": "Quantité",
      "travel_fees": "Frais de déplacement"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "prix", "duree_minutes"],
        "optional": ["description", "categorie_id"],
        "forbidden": ["taux_journalier"]
      },
      "reservation": {
        "required": ["date", "heure", "service_id", "client_id", "adresse_client"],
        "optional": ["lieu", "frais_deplacement", "notes"],
        "forbidden": ["date_fin", "nb_agents"]
      }
    }'::jsonb,
    '{
      "allowDomicile": true,
      "requireClientAddress": true,
      "travelFeesEnabled": true,
      "travelFeesFreeRadiusKm": 5,
      "travelFeesPricePerKm": 50,
      "maxServicesPerReservation": 10,
      "allowMultipleEmployees": false,
      "defaultLocation": "domicile"
    }'::jsonb
  ),

  -- SALON: Salon de coiffure, barbier, institut de beauté fixe
  (
    'salon',
    'Salon / Institut',
    'Établissement fixe avec plusieurs employés (coiffure, barbier, spa, onglerie)',
    'Scissors',
    'fixed',
    'fixed',
    'fixed',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "RDV", "plural": "RDV"},
      "service": {"singular": "Prestation", "plural": "Prestations"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Coiffeur", "plural": "Coiffeurs"},
      "location": "Salon",
      "duration": "Durée",
      "quantity": "Quantité"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "prix", "duree_minutes"],
        "optional": ["description", "categorie_id"],
        "forbidden": ["taux_horaire", "taux_journalier"]
      },
      "reservation": {
        "required": ["date", "heure", "service_id", "client_id"],
        "optional": ["membre_id", "notes"],
        "forbidden": ["adresse_client", "frais_deplacement", "date_fin"]
      }
    }'::jsonb,
    '{
      "allowDomicile": false,
      "requireClientAddress": false,
      "travelFeesEnabled": false,
      "maxServicesPerReservation": 10,
      "allowMultipleEmployees": true,
      "requireEmployeeAssignment": true,
      "hasStations": true,
      "defaultLocation": "salon"
    }'::jsonb
  ),

  -- RESTAURANT: Restaurant, bar, café
  (
    'restaurant',
    'Restaurant / Bar',
    'Établissements de restauration avec gestion de tables et couverts',
    'UtensilsCrossed',
    'fixed',
    'fixed',
    'fixed',
    FALSE,
    FALSE,
    '{
      "reservation": {"singular": "Réservation", "plural": "Réservations"},
      "service": {"singular": "Table", "plural": "Tables"},
      "client": {"singular": "Client", "plural": "Clients"},
      "employee": {"singular": "Serveur", "plural": "Serveurs"},
      "location": "Restaurant",
      "duration": "Créneau",
      "quantity": "Couverts",
      "covers": "Personnes"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "capacite_max"],
        "optional": ["description", "zone"],
        "forbidden": ["prix", "duree_minutes", "taux_horaire"]
      },
      "reservation": {
        "required": ["date", "heure", "nb_couverts", "client_id"],
        "optional": ["table_id", "service_type", "notes", "allergies"],
        "forbidden": ["adresse_client", "frais_deplacement", "membre_id"]
      }
    }'::jsonb,
    '{
      "allowDomicile": false,
      "requireClientAddress": false,
      "travelFeesEnabled": false,
      "hasTableManagement": true,
      "hasCovers": true,
      "serviceTypes": ["midi", "soir"],
      "defaultSlotDuration": 90,
      "maxCoversPerSlot": 200,
      "requirePhoneNumber": true,
      "defaultLocation": "restaurant"
    }'::jsonb
  ),

  -- HOTEL: Hôtel, gîte, chambre d''hôtes
  (
    'hotel',
    'Hôtel / Hébergement',
    'Établissements d''hébergement avec gestion de chambres et séjours',
    'Hotel',
    'daily',
    'daily,package',
    'range',
    TRUE,
    TRUE,
    '{
      "reservation": {"singular": "Réservation", "plural": "Réservations"},
      "service": {"singular": "Chambre", "plural": "Chambres"},
      "client": {"singular": "Hôte", "plural": "Hôtes"},
      "employee": {"singular": "Réceptionniste", "plural": "Réceptionnistes"},
      "location": "Établissement",
      "duration": "Séjour",
      "quantity": "Personnes",
      "checkin": "Arrivée",
      "checkout": "Départ",
      "nights": "Nuitées"
    }'::jsonb,
    '{
      "service": {
        "required": ["nom", "prix", "capacite_max"],
        "optional": ["description", "equipements", "etage"],
        "forbidden": ["duree_minutes", "taux_horaire"]
      },
      "reservation": {
        "required": ["date_arrivee", "date_depart", "chambre_id", "client_id", "nb_personnes"],
        "optional": ["heure_arrivee", "extras", "notes"],
        "forbidden": ["adresse_client", "frais_deplacement", "heure"]
      }
    }'::jsonb,
    '{
      "allowDomicile": false,
      "requireClientAddress": false,
      "travelFeesEnabled": false,
      "hasRoomInventory": true,
      "hasCheckinCheckout": true,
      "checkinTime": "15:00",
      "checkoutTime": "11:00",
      "minNights": 1,
      "hasExtras": true,
      "defaultLocation": "hotel"
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
-- 2. ÉTENDRE LA CONFIGURATION DES TENANTS
-- ════════════════════════════════════════════════════════════════════

-- Configuration de localisation
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS location_config JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.location_config IS 'Configuration localisation: mode (mobile/fixed), adresse, zone, frais déplacement';

-- Configuration contact
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_config JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.contact_config IS 'Coordonnées: téléphone, WhatsApp, email';

-- Configuration URLs
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS urls_config JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.urls_config IS 'URLs: frontend, paiement, avis';

-- Configuration assistant IA
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS assistant_config JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.assistant_config IS 'Config assistant IA: nom, voix, personnalité';

-- Terminologie personnalisée (override du profil)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terminology_override JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.terminology_override IS 'Override terminologie du profil métier';

-- Features activées/désactivées
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features_config JSONB DEFAULT '{}';
COMMENT ON COLUMN tenants.features_config IS 'Features activées/désactivées pour ce tenant';

-- ════════════════════════════════════════════════════════════════════
-- 3. COLONNES SPÉCIFIQUES RESTAURANT
-- ════════════════════════════════════════════════════════════════════

-- Nombre de couverts sur réservation
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nb_couverts INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.nb_couverts IS 'Nombre de couverts (restaurant)';

-- Type de service (midi/soir)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT NULL;
COMMENT ON COLUMN reservations.service_type IS 'Type de service: midi, soir, etc.';

-- Table assignée
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_id INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.table_id IS 'ID de la table assignée (restaurant)';

-- Allergies/régimes
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS allergies TEXT DEFAULT NULL;
COMMENT ON COLUMN reservations.allergies IS 'Allergies et régimes alimentaires';

-- ════════════════════════════════════════════════════════════════════
-- 4. COLONNES SPÉCIFIQUES HOTEL
-- ════════════════════════════════════════════════════════════════════

-- Date d'arrivée (check-in)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS date_arrivee DATE DEFAULT NULL;
COMMENT ON COLUMN reservations.date_arrivee IS 'Date d''arrivée (hotel)';

-- Date de départ (check-out)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS date_depart DATE DEFAULT NULL;
COMMENT ON COLUMN reservations.date_depart IS 'Date de départ (hotel)';

-- Heure d'arrivée prévue
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS heure_arrivee VARCHAR(5) DEFAULT NULL;
COMMENT ON COLUMN reservations.heure_arrivee IS 'Heure d''arrivée prévue (HH:MM)';

-- Chambre assignée
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS chambre_id INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.chambre_id IS 'ID de la chambre assignée (hotel)';

-- Nombre de personnes
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nb_personnes INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.nb_personnes IS 'Nombre de personnes (hotel)';

-- Extras (petit-déjeuner, parking, etc.)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]';
COMMENT ON COLUMN reservations.extras IS 'Extras sélectionnés (hotel)';

-- Nombre de nuitées (calculé)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nb_nuitees INTEGER DEFAULT NULL;
COMMENT ON COLUMN reservations.nb_nuitees IS 'Nombre de nuitées (calculé)';

-- ════════════════════════════════════════════════════════════════════
-- 5. TABLE DES TABLES (RESTAURANT)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tables_restaurant (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  nom VARCHAR(100),
  capacite_min INTEGER DEFAULT 1,
  capacite_max INTEGER NOT NULL,
  zone VARCHAR(50), -- 'terrasse', 'interieur', 'salon_prive'
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  forme VARCHAR(20) DEFAULT 'rectangle', -- 'rectangle', 'ronde', 'carree'
  est_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables_restaurant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_active ON tables_restaurant(tenant_id, est_active);

-- ════════════════════════════════════════════════════════════════════
-- 6. TABLE DES CHAMBRES (HOTEL)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chambres_hotel (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  nom VARCHAR(100),
  type VARCHAR(50) NOT NULL, -- 'simple', 'double', 'twin', 'suite', 'familiale'
  capacite_max INTEGER NOT NULL DEFAULT 2,
  prix_nuit INTEGER NOT NULL, -- en centimes
  etage INTEGER,
  vue VARCHAR(50), -- 'mer', 'jardin', 'ville', 'montagne'
  superficie_m2 INTEGER,
  equipements JSONB DEFAULT '[]', -- ['wifi', 'tv', 'minibar', 'coffre', 'balcon']
  photos JSONB DEFAULT '[]',
  est_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_chambres_tenant ON chambres_hotel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chambres_active ON chambres_hotel(tenant_id, est_active);
CREATE INDEX IF NOT EXISTS idx_chambres_type ON chambres_hotel(tenant_id, type);

-- ════════════════════════════════════════════════════════════════════
-- 7. TABLE DES EXTRAS (HOTEL)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS extras_hotel (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL, -- en centimes
  prix_type VARCHAR(20) DEFAULT 'per_night', -- 'per_night', 'per_stay', 'per_person'
  est_actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_extras_tenant ON extras_hotel(tenant_id);

-- Insérer des extras par défaut
INSERT INTO extras_hotel (tenant_id, code, nom, prix, prix_type) VALUES
  ('__template__', 'petit_dejeuner', 'Petit-déjeuner', 1500, 'per_person'),
  ('__template__', 'parking', 'Parking', 1000, 'per_night'),
  ('__template__', 'wifi_premium', 'WiFi Premium', 500, 'per_stay'),
  ('__template__', 'lit_bebe', 'Lit bébé', 0, 'per_stay'),
  ('__template__', 'late_checkout', 'Départ tardif (14h)', 2500, 'per_stay')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 8. METTRE À JOUR FAT'S HAIR AFRO
-- ════════════════════════════════════════════════════════════════════

UPDATE tenants SET
  business_profile = 'service_domicile',
  location_config = '{
    "mode": "mobile",
    "base_address": "8 rue des Monts Rouges, 95130 Franconville",
    "zone": "Île-de-France",
    "travel_fees": {
      "enabled": true,
      "free_radius_km": 5,
      "price_per_km": 50
    }
  }'::jsonb,
  contact_config = '{
    "phone": "09 39 24 02 69",
    "whatsapp": "07 82 23 50 20",
    "email": "contact@fatshairafro.fr"
  }'::jsonb,
  urls_config = '{
    "frontend": "https://fatshairafro.fr",
    "booking": "/reserver",
    "payment": "/paiement",
    "reviews": "/avis"
  }'::jsonb,
  assistant_config = '{
    "name": "Halimah",
    "voice_id": "FFXYdAYPzn8Tw8KiHZqg",
    "personality": "friendly",
    "language": "fr"
  }'::jsonb,
  terminology_override = '{}'::jsonb,
  features_config = '{
    "travel_fees": true,
    "client_address": true,
    "online_booking": true,
    "deposits": true,
    "multi_staff": false
  }'::jsonb
WHERE id = 'fatshairafro';

-- ════════════════════════════════════════════════════════════════════
-- 9. INDEX DE PERFORMANCE
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(tenant_id, table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_chambre ON reservations(tenant_id, chambre_id) WHERE chambre_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_dates_hotel ON reservations(tenant_id, date_arrivee, date_depart) WHERE date_arrivee IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════
-- COMMENTAIRES
-- ════════════════════════════════════════════════════════════════════

COMMENT ON TABLE tables_restaurant IS 'Tables de restaurant avec configuration et capacité';
COMMENT ON TABLE chambres_hotel IS 'Chambres d''hôtel avec tarifs et équipements';
COMMENT ON TABLE extras_hotel IS 'Services et extras disponibles pour les hôtels';
