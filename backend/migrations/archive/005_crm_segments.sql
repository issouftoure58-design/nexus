/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   MIGRATION 005 : CRM Segments - Segmentation clients intelligente            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   Disponible : Plans PRO et BUSINESS uniquement                               ║
 * ║   Features   : Segments dynamiques, filtres avancés, auto-tags                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

-- ============================================
-- TABLE SEGMENTS
-- ============================================
-- Définition des segments clients (ex: VIP, Inactifs, Nouveaux)

CREATE TABLE IF NOT EXISTS segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identité du segment
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  couleur VARCHAR(7) DEFAULT '#6366f1', -- Couleur hex pour l'UI
  icone VARCHAR(50) DEFAULT 'users', -- Nom de l'icône Lucide

  -- Type de segment
  type VARCHAR(20) NOT NULL DEFAULT 'manuel',
  -- manuel: clients ajoutés manuellement
  -- dynamique: basé sur des critères automatiques
  -- mixte: critères auto + ajouts manuels

  -- Critères pour segments dynamiques (JSON)
  criteres JSONB DEFAULT '{}',
  -- Exemple de critères:
  -- {
  --   "min_rdv": 10,
  --   "min_ca_euros": 500,
  --   "derniere_visite_max_jours": 90,
  --   "services_inclus": ["locks", "tresses"],
  --   "tags_requis": ["premium"]
  -- }

  -- Statistiques
  nb_clients INTEGER DEFAULT 0,
  ca_total_centimes BIGINT DEFAULT 0,

  -- Métadonnées
  actif BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0, -- Pour trier l'affichage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id),

  -- Contrainte d'unicité nom par tenant
  CONSTRAINT unique_segment_nom_tenant UNIQUE(tenant_id, nom)
);

-- ============================================
-- TABLE SEGMENT_CLIENTS
-- ============================================
-- Association clients <-> segments (many-to-many)

CREATE TABLE IF NOT EXISTS segment_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Comment le client a été ajouté
  source VARCHAR(20) DEFAULT 'manuel',
  -- manuel: ajouté manuellement par l'admin
  -- auto: ajouté automatiquement par les critères
  -- ia: suggéré par l'IA et validé

  -- Métadonnées
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES admins(id),
  notes TEXT,

  -- Contrainte d'unicité
  CONSTRAINT unique_client_segment UNIQUE(segment_id, client_id)
);

-- ============================================
-- INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segments_actif ON segments(tenant_id, actif);
CREATE INDEX IF NOT EXISTS idx_segments_type ON segments(tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_segment_clients_segment ON segment_clients(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_clients_client ON segment_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_segment_clients_tenant ON segment_clients(tenant_id);

-- ============================================
-- FONCTION TRIGGER POUR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_segments_updated_at ON segments;
CREATE TRIGGER trigger_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW
  EXECUTE FUNCTION update_segments_updated_at();

-- ============================================
-- FONCTION POUR RECALCULER LES STATS D'UN SEGMENT
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_segment_stats(p_segment_id UUID)
RETURNS void AS $$
DECLARE
  v_nb_clients INTEGER;
  v_ca_total BIGINT;
BEGIN
  -- Compter les clients
  SELECT COUNT(*) INTO v_nb_clients
  FROM segment_clients
  WHERE segment_id = p_segment_id;

  -- Calculer le CA total des clients du segment
  SELECT COALESCE(SUM(r.prix_total), 0) INTO v_ca_total
  FROM segment_clients sc
  JOIN reservations r ON r.client_id = sc.client_id
  WHERE sc.segment_id = p_segment_id
    AND r.statut IN ('confirme', 'termine');

  -- Mettre à jour le segment
  UPDATE segments
  SET nb_clients = v_nb_clients,
      ca_total_centimes = v_ca_total
  WHERE id = p_segment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEGMENTS PAR DÉFAUT (créés pour chaque tenant Pro/Business)
-- ============================================

-- Note: Ces segments seront créés via l'API lors de l'upgrade vers Pro
-- Exemple de segments par défaut:
-- 1. VIP: min_rdv >= 10 AND min_ca_euros >= 500
-- 2. Fidèles: min_rdv >= 5
-- 3. Inactifs 3 mois: derniere_visite_max_jours = 90
-- 4. Inactifs 6 mois: derniere_visite_max_jours = 180
-- 5. Nouveaux: created_days_ago <= 30

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON TABLE segments IS 'Segments de clients pour CRM avancé (Pro/Business)';
COMMENT ON TABLE segment_clients IS 'Association many-to-many clients et segments';
COMMENT ON COLUMN segments.criteres IS 'Critères JSON pour segments dynamiques';
COMMENT ON COLUMN segments.type IS 'manuel = ajout manuel, dynamique = auto selon critères, mixte = les deux';
