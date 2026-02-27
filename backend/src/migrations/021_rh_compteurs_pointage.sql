-- Migration 021: Tables compteurs congés, pointage et heures supplémentaires
-- Date: 2026-02-23
-- Description: Gestion automatisée des congés, RTT, pointage et heures supplémentaires

-- =====================================================
-- PARTIE 1: Enrichissement table rh_absences
-- =====================================================

ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS demi_journee BOOLEAN DEFAULT false;
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS periode_journee VARCHAR(10); -- 'matin', 'apres_midi' si demi-journée
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS jours_ouvres DECIMAL(4,1); -- calculé automatiquement
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS approuve_par INTEGER REFERENCES rh_membres(id);
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS date_approbation TIMESTAMP;
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS commentaire_refus TEXT;
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS justificatif_url TEXT;

-- Supprimer l'ancienne contrainte si elle existe et en créer une nouvelle avec plus de types
DO $$
BEGIN
  ALTER TABLE rh_absences DROP CONSTRAINT IF EXISTS rh_absences_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Pas de contrainte stricte car on veut de la flexibilité

-- Index pour recherches
CREATE INDEX IF NOT EXISTS idx_rh_absences_dates ON rh_absences(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_rh_absences_statut ON rh_absences(statut);

-- =====================================================
-- PARTIE 2: Table compteurs congés
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_compteurs_conges (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,
  annee INTEGER NOT NULL,

  -- Congés payés (2.5 jours/mois = 30 jours ouvrables ou 25 jours ouvrés par an)
  cp_acquis DECIMAL(4,1) DEFAULT 0,
  cp_pris DECIMAL(4,1) DEFAULT 0,
  cp_report_n1 DECIMAL(4,1) DEFAULT 0, -- report année précédente

  -- RTT (si temps de travail > 35h)
  rtt_acquis DECIMAL(4,1) DEFAULT 0,
  rtt_pris DECIMAL(4,1) DEFAULT 0,

  -- Repos compensateur (heures supp au-delà contingent 220h)
  rc_acquis DECIMAL(4,1) DEFAULT 0,
  rc_pris DECIMAL(4,1) DEFAULT 0,

  -- Autres congés
  conges_anciennete DECIMAL(4,1) DEFAULT 0,
  conges_fractionnement DECIMAL(4,1) DEFAULT 0,

  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT rh_compteurs_unique UNIQUE(tenant_id, membre_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_rh_compteurs_tenant ON rh_compteurs_conges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_compteurs_membre ON rh_compteurs_conges(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_compteurs_annee ON rh_compteurs_conges(annee);

-- =====================================================
-- PARTIE 3: Table pointage quotidien
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_pointage (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,
  date_travail DATE NOT NULL,

  -- Heures de travail
  heure_debut TIME,
  heure_fin TIME,
  pause_minutes INTEGER DEFAULT 60,

  -- Heures calculées
  heures_travaillees DECIMAL(4,2), -- calculé: (fin - debut) - pause
  heures_theoriques DECIMAL(4,2), -- depuis contrat (ex: 7h/jour)
  heures_supp DECIMAL(4,2) DEFAULT 0, -- si travaillées > théoriques

  -- Source du pointage
  source VARCHAR(20) DEFAULT 'manuel', -- 'manuel', 'planning', 'pointeuse'
  reservation_id INTEGER, -- si alimenté depuis planning/réservation

  -- Validation par manager
  validated BOOLEAN DEFAULT false,
  validated_by INTEGER REFERENCES rh_membres(id),
  validated_at TIMESTAMP,

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT rh_pointage_unique UNIQUE(tenant_id, membre_id, date_travail)
);

CREATE INDEX IF NOT EXISTS idx_rh_pointage_tenant ON rh_pointage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_pointage_membre ON rh_pointage(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_pointage_date ON rh_pointage(date_travail);
CREATE INDEX IF NOT EXISTS idx_rh_pointage_membre_date ON rh_pointage(membre_id, date_travail);

-- =====================================================
-- PARTIE 4: Table heures supplémentaires mensuelles
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_heures_supp_mensuel (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,
  periode VARCHAR(7) NOT NULL, -- 'YYYY-MM'

  -- Heures par tranche de majoration
  heures_25 DECIMAL(5,2) DEFAULT 0, -- 8 premières heures supp/semaine (+25%)
  heures_50 DECIMAL(5,2) DEFAULT 0, -- au-delà (+50%)

  -- Taux horaire au moment du calcul (en centimes)
  taux_horaire INTEGER,

  -- Montants calculés (en centimes)
  montant_25 INTEGER DEFAULT 0,
  montant_50 INTEGER DEFAULT 0,

  -- Contingent annuel (220h max par défaut)
  cumul_annuel DECIMAL(5,2) DEFAULT 0,
  contingent_max DECIMAL(5,2) DEFAULT 220,
  alerte_contingent BOOLEAN DEFAULT false, -- true si cumul > 90% contingent

  -- Repos compensateur généré (si dépassement contingent)
  rc_genere DECIMAL(4,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT rh_heures_supp_unique UNIQUE(tenant_id, membre_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_rh_heures_supp_tenant ON rh_heures_supp_mensuel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_heures_supp_membre ON rh_heures_supp_mensuel(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_heures_supp_periode ON rh_heures_supp_mensuel(periode);

-- =====================================================
-- PARTIE 5: Fonction calcul jours ouvrés entre deux dates
-- =====================================================

CREATE OR REPLACE FUNCTION calculer_jours_ouvres(date_debut DATE, date_fin DATE, demi_journee BOOLEAN DEFAULT false, periode_journee VARCHAR DEFAULT NULL)
RETURNS DECIMAL(4,1) AS $$
DECLARE
  jours DECIMAL(4,1) := 0;
  current_date DATE := date_debut;
BEGIN
  -- Parcourir chaque jour
  WHILE current_date <= date_fin LOOP
    -- Exclure samedi (6) et dimanche (0)
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
      jours := jours + 1;
    END IF;
    current_date := current_date + 1;
  END LOOP;

  -- Ajuster pour demi-journée
  IF demi_journee AND jours > 0 THEN
    jours := jours - 0.5;
  END IF;

  RETURN jours;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTIE 6: Trigger pour calculer jours ouvrés sur absences
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_calculer_jours_ouvres_absence()
RETURNS TRIGGER AS $$
BEGIN
  NEW.jours_ouvres := calculer_jours_ouvres(NEW.date_debut, NEW.date_fin, NEW.demi_journee, NEW.periode_journee);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rh_absences_jours_ouvres ON rh_absences;
CREATE TRIGGER trg_rh_absences_jours_ouvres
  BEFORE INSERT OR UPDATE ON rh_absences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculer_jours_ouvres_absence();

-- =====================================================
-- PARTIE 7: Trigger pour déduire compteur à l'approbation
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_deduire_compteur_absence()
RETURNS TRIGGER AS $$
DECLARE
  compteur_id INTEGER;
  annee_absence INTEGER;
BEGIN
  -- Seulement si le statut passe à 'approuve'
  IF NEW.statut = 'approuve' AND (OLD.statut IS NULL OR OLD.statut != 'approuve') THEN
    annee_absence := EXTRACT(YEAR FROM NEW.date_debut);

    -- Récupérer ou créer le compteur
    SELECT id INTO compteur_id
    FROM rh_compteurs_conges
    WHERE membre_id = NEW.membre_id AND annee = annee_absence AND tenant_id = NEW.tenant_id;

    IF compteur_id IS NULL THEN
      INSERT INTO rh_compteurs_conges (tenant_id, membre_id, annee, cp_acquis)
      VALUES (NEW.tenant_id, NEW.membre_id, annee_absence, 25)
      RETURNING id INTO compteur_id;
    END IF;

    -- Déduire selon le type
    IF NEW.type = 'conge' THEN
      UPDATE rh_compteurs_conges SET cp_pris = cp_pris + NEW.jours_ouvres, updated_at = NOW()
      WHERE id = compteur_id;
    ELSIF NEW.type = 'rtt' THEN
      UPDATE rh_compteurs_conges SET rtt_pris = rtt_pris + NEW.jours_ouvres, updated_at = NOW()
      WHERE id = compteur_id;
    ELSIF NEW.type = 'repos_compensateur' THEN
      UPDATE rh_compteurs_conges SET rc_pris = rc_pris + NEW.jours_ouvres, updated_at = NOW()
      WHERE id = compteur_id;
    END IF;

    -- Enregistrer qui a approuvé et quand
    NEW.date_approbation := NOW();
  END IF;

  -- Si on annule une absence approuvée, restaurer le compteur
  IF OLD.statut = 'approuve' AND NEW.statut IN ('refuse', 'annule') THEN
    annee_absence := EXTRACT(YEAR FROM OLD.date_debut);

    IF OLD.type = 'conge' THEN
      UPDATE rh_compteurs_conges SET cp_pris = cp_pris - OLD.jours_ouvres, updated_at = NOW()
      WHERE membre_id = OLD.membre_id AND annee = annee_absence AND tenant_id = OLD.tenant_id;
    ELSIF OLD.type = 'rtt' THEN
      UPDATE rh_compteurs_conges SET rtt_pris = rtt_pris - OLD.jours_ouvres, updated_at = NOW()
      WHERE membre_id = OLD.membre_id AND annee = annee_absence AND tenant_id = OLD.tenant_id;
    ELSIF OLD.type = 'repos_compensateur' THEN
      UPDATE rh_compteurs_conges SET rc_pris = rc_pris - OLD.jours_ouvres, updated_at = NOW()
      WHERE membre_id = OLD.membre_id AND annee = annee_absence AND tenant_id = OLD.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rh_absences_compteur ON rh_absences;
CREATE TRIGGER trg_rh_absences_compteur
  BEFORE UPDATE ON rh_absences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_deduire_compteur_absence();

-- =====================================================
-- PARTIE 8: Commentaires
-- =====================================================

COMMENT ON TABLE rh_compteurs_conges IS 'Compteurs annuels de congés par salarié (CP, RTT, RC)';
COMMENT ON TABLE rh_pointage IS 'Pointage quotidien des heures travaillées';
COMMENT ON TABLE rh_heures_supp_mensuel IS 'Agrégation mensuelle des heures supplémentaires avec majoration';
COMMENT ON FUNCTION calculer_jours_ouvres IS 'Calcule le nombre de jours ouvrés entre deux dates (exclut sam/dim)';
