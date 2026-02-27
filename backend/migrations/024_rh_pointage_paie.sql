-- Migration 024: Tables pointage et paie
-- Date: 2026-02-23

-- ============================================
-- TABLE POINTAGE JOURNALIER
-- ============================================
CREATE TABLE IF NOT EXISTS rh_pointage (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  date_travail DATE NOT NULL,

  -- Heures
  heure_debut TIME,
  heure_fin TIME,
  pause_minutes INTEGER DEFAULT 60,
  heures_travaillees DECIMAL(5,2), -- calculé: (fin - debut) - pause
  heures_theoriques DECIMAL(5,2), -- depuis contrat (ex: 7h/jour)
  heures_supp DECIMAL(5,2) DEFAULT 0, -- si travaillées > théoriques

  -- Source du pointage
  source VARCHAR(20) DEFAULT 'manuel', -- 'manuel', 'planning', 'pointeuse'
  reservation_id INTEGER, -- si alimenté depuis planning/réservation

  -- Validation
  validated BOOLEAN DEFAULT false,
  validated_by INTEGER,
  validated_at TIMESTAMP,

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, membre_id, date_travail)
);

CREATE INDEX IF NOT EXISTS idx_rh_pointage_membre ON rh_pointage(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_pointage_date ON rh_pointage(date_travail);
CREATE INDEX IF NOT EXISTS idx_rh_pointage_tenant_date ON rh_pointage(tenant_id, date_travail);

-- ============================================
-- TABLE HEURES SUPPLEMENTAIRES MENSUELLES
-- ============================================
CREATE TABLE IF NOT EXISTS rh_heures_supp_mensuel (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  periode VARCHAR(7) NOT NULL, -- 'YYYY-MM'

  -- Heures par tranche de majoration
  heures_25 DECIMAL(5,2) DEFAULT 0, -- 8 premières heures supp/semaine (+25%)
  heures_50 DECIMAL(5,2) DEFAULT 0, -- au-delà (+50%)
  heures_total DECIMAL(5,2) DEFAULT 0, -- calculé

  -- Montants calculés (en centimes)
  taux_horaire INTEGER, -- copié depuis contrat au moment du calcul
  montant_25 INTEGER DEFAULT 0,
  montant_50 INTEGER DEFAULT 0,
  montant_total INTEGER DEFAULT 0, -- calculé

  -- Contingent annuel (220h max par défaut)
  cumul_annuel DECIMAL(5,2) DEFAULT 0,
  contingent_max DECIMAL(5,2) DEFAULT 220,
  alerte_contingent BOOLEAN DEFAULT false, -- true si cumul > 90% contingent

  -- Repos compensateur généré (si dépassement contingent)
  rc_genere DECIMAL(4,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, membre_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_rh_heures_supp_membre ON rh_heures_supp_mensuel(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_heures_supp_periode ON rh_heures_supp_mensuel(periode);

-- ============================================
-- TABLE BULLETINS DE PAIE
-- ============================================
CREATE TABLE IF NOT EXISTS rh_bulletins_paie (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  periode VARCHAR(7) NOT NULL, -- 'YYYY-MM'

  -- Identité employé (snapshot)
  employe_nom VARCHAR(255),
  employe_prenom VARCHAR(255),
  employe_nir VARCHAR(15),
  employe_adresse TEXT,
  employe_poste VARCHAR(100),
  employe_classification VARCHAR(50),

  -- Contrat
  type_contrat VARCHAR(20),
  date_embauche DATE,
  anciennete_mois INTEGER,

  -- Rémunération brute
  salaire_base INTEGER, -- en centimes
  heures_normales DECIMAL(5,2),
  heures_supp_25 DECIMAL(5,2) DEFAULT 0,
  montant_hs_25 INTEGER DEFAULT 0,
  heures_supp_50 DECIMAL(5,2) DEFAULT 0,
  montant_hs_50 INTEGER DEFAULT 0,
  primes JSONB DEFAULT '[]', -- [{nom, montant}]
  avantages_nature JSONB DEFAULT '[]',
  brut_total INTEGER,

  -- Cotisations (simplifié - détail dans JSONB)
  cotisations_salariales JSONB DEFAULT '[]', -- [{nom, base, taux, montant}]
  total_cotisations_salariales INTEGER DEFAULT 0,
  cotisations_patronales JSONB DEFAULT '[]',
  total_cotisations_patronales INTEGER DEFAULT 0,

  -- Net
  net_avant_ir INTEGER,
  montant_ir INTEGER DEFAULT 0, -- prélèvement à la source
  taux_ir DECIMAL(5,2) DEFAULT 0,
  net_a_payer INTEGER,
  net_imposable INTEGER,

  -- Cumuls annuels
  cumul_brut INTEGER DEFAULT 0,
  cumul_net_imposable INTEGER DEFAULT 0,
  cumul_ir INTEGER DEFAULT 0,

  -- Congés
  cp_acquis DECIMAL(4,1) DEFAULT 0,
  cp_pris DECIMAL(4,1) DEFAULT 0,
  cp_solde DECIMAL(4,1) DEFAULT 0,

  -- Métadonnées
  statut VARCHAR(20) DEFAULT 'brouillon', -- 'brouillon', 'valide', 'envoye'
  fichier_url TEXT, -- PDF stocké
  genere_par INTEGER,
  valide_par INTEGER,
  valide_at TIMESTAMP,
  envoye_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, membre_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_rh_bulletins_membre ON rh_bulletins_paie(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_bulletins_periode ON rh_bulletins_paie(periode);

-- ============================================
-- TABLE PARAMETRES PAIE (par tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS rh_parametres_paie (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,

  -- Taux de cotisations (en %)
  -- Sécurité sociale
  taux_ss_maladie_sal DECIMAL(5,3) DEFAULT 0,
  taux_ss_maladie_pat DECIMAL(5,3) DEFAULT 7.00,
  taux_ss_vieillesse_sal DECIMAL(5,3) DEFAULT 6.90,
  taux_ss_vieillesse_pat DECIMAL(5,3) DEFAULT 8.55,
  taux_ss_af_pat DECIMAL(5,3) DEFAULT 5.25,

  -- Chômage
  taux_chomage_sal DECIMAL(5,3) DEFAULT 0,
  taux_chomage_pat DECIMAL(5,3) DEFAULT 4.05,

  -- Retraite complémentaire
  taux_retraite_t1_sal DECIMAL(5,3) DEFAULT 3.15,
  taux_retraite_t1_pat DECIMAL(5,3) DEFAULT 4.72,
  taux_retraite_t2_sal DECIMAL(5,3) DEFAULT 8.64,
  taux_retraite_t2_pat DECIMAL(5,3) DEFAULT 12.95,

  -- CSG/CRDS
  taux_csg_deductible DECIMAL(5,3) DEFAULT 6.80,
  taux_csg_non_deductible DECIMAL(5,3) DEFAULT 2.40,
  taux_crds DECIMAL(5,3) DEFAULT 0.50,

  -- Plafonds
  plafond_ss_mensuel INTEGER DEFAULT 382500, -- 3825€ en centimes
  plafond_ss_annuel INTEGER DEFAULT 4590000, -- 45900€

  -- Heures supplémentaires
  majoration_hs_25 DECIMAL(5,2) DEFAULT 25.00,
  majoration_hs_50 DECIMAL(5,2) DEFAULT 50.00,
  contingent_annuel DECIMAL(5,2) DEFAULT 220.00,

  -- Prélèvement à la source (par défaut, taux neutre)
  taux_ir_defaut DECIMAL(5,2) DEFAULT 0,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FONCTION CALCUL HEURES TRAVAILLEES
-- ============================================
CREATE OR REPLACE FUNCTION calculer_heures_travaillees()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculer heures travaillées si heure_debut et heure_fin sont définies
  IF NEW.heure_debut IS NOT NULL AND NEW.heure_fin IS NOT NULL THEN
    NEW.heures_travaillees = EXTRACT(EPOCH FROM (NEW.heure_fin - NEW.heure_debut)) / 3600.0
                            - COALESCE(NEW.pause_minutes, 0) / 60.0;

    -- Calculer heures supp si heures_theoriques définies
    IF NEW.heures_theoriques IS NOT NULL AND NEW.heures_travaillees > NEW.heures_theoriques THEN
      NEW.heures_supp = NEW.heures_travaillees - NEW.heures_theoriques;
    ELSE
      NEW.heures_supp = 0;
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculer_heures ON rh_pointage;
CREATE TRIGGER trigger_calculer_heures
  BEFORE INSERT OR UPDATE ON rh_pointage
  FOR EACH ROW
  EXECUTE FUNCTION calculer_heures_travaillees();

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE rh_pointage IS 'Pointage journalier des employés';
COMMENT ON TABLE rh_heures_supp_mensuel IS 'Récapitulatif mensuel des heures supplémentaires';
COMMENT ON TABLE rh_bulletins_paie IS 'Bulletins de paie générés';
COMMENT ON TABLE rh_parametres_paie IS 'Paramètres de paie par tenant (taux cotisations, plafonds)';
