-- Migration 025: Paramètres sociaux (taux cotisations, SMIC, plafonds)
-- Date: 2026-02-23
-- Description: Table pour stocker et mettre à jour les paramètres sociaux

-- =====================================================
-- TABLE: Paramètres sociaux par année
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_parametres_sociaux (
  id SERIAL PRIMARY KEY,
  annee INTEGER NOT NULL,
  date_application DATE NOT NULL DEFAULT '2026-01-01',

  -- SMIC
  smic_horaire_brut DECIMAL(6,2) NOT NULL DEFAULT 12.02,
  smic_mensuel_brut DECIMAL(8,2) NOT NULL DEFAULT 1823.03,
  smic_annuel_brut DECIMAL(10,2) NOT NULL DEFAULT 21876.36,

  -- Plafonds Sécurité Sociale
  plafond_ss_mensuel DECIMAL(8,2) NOT NULL DEFAULT 4005.00,
  plafond_ss_annuel DECIMAL(10,2) NOT NULL DEFAULT 48060.00,

  -- Minimum garanti
  minimum_garanti DECIMAL(5,2) NOT NULL DEFAULT 4.25,

  -- =====================================================
  -- COTISATIONS SALARIALES (en %)
  -- =====================================================

  -- Sécurité sociale
  cot_sal_maladie DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- 0% depuis 2018
  cot_sal_vieillesse_plafonnee DECIMAL(5,2) NOT NULL DEFAULT 6.90,
  cot_sal_vieillesse_deplafonnee DECIMAL(5,2) NOT NULL DEFAULT 0.40,

  -- Chômage
  cot_sal_chomage DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- 0% depuis 2019

  -- Retraite complémentaire AGIRC-ARRCO
  cot_sal_retraite_t1 DECIMAL(5,2) NOT NULL DEFAULT 3.15,
  cot_sal_retraite_t2 DECIMAL(5,2) NOT NULL DEFAULT 8.64,
  cot_sal_ceg_t1 DECIMAL(5,2) NOT NULL DEFAULT 0.86,
  cot_sal_ceg_t2 DECIMAL(5,2) NOT NULL DEFAULT 1.08,

  -- CSG/CRDS
  cot_sal_csg_deductible DECIMAL(5,2) NOT NULL DEFAULT 6.80,
  cot_sal_csg_non_deductible DECIMAL(5,2) NOT NULL DEFAULT 2.40,
  cot_sal_crds DECIMAL(5,2) NOT NULL DEFAULT 0.50,

  -- Base CSG/CRDS (98.25% du brut + cotisations patronales)
  base_csg_crds_pct DECIMAL(5,2) NOT NULL DEFAULT 98.25,

  -- =====================================================
  -- COTISATIONS PATRONALES (en %)
  -- =====================================================

  -- Sécurité sociale
  cot_pat_maladie DECIMAL(5,2) NOT NULL DEFAULT 7.00, -- taux réduit si < 2.5 SMIC (sinon 13%)
  cot_pat_maladie_haut_revenu DECIMAL(5,2) NOT NULL DEFAULT 13.00, -- si > 2.5 SMIC
  cot_pat_vieillesse_plafonnee DECIMAL(5,2) NOT NULL DEFAULT 8.55,
  cot_pat_vieillesse_deplafonnee DECIMAL(5,2) NOT NULL DEFAULT 2.11, -- augmenté en 2026 (était 2.02)
  cot_pat_allocations_familiales DECIMAL(5,2) NOT NULL DEFAULT 5.25, -- taux normal (3.45% si réduction)
  cot_pat_allocations_familiales_reduit DECIMAL(5,2) NOT NULL DEFAULT 3.45, -- si < 3.5 SMIC

  -- AT/MP (taux moyen, varie selon secteur)
  cot_pat_accident_travail DECIMAL(5,2) NOT NULL DEFAULT 2.08, -- taux moyen 2026

  -- Chômage
  cot_pat_chomage DECIMAL(5,2) NOT NULL DEFAULT 4.05,
  cot_pat_ags DECIMAL(5,2) NOT NULL DEFAULT 0.20, -- était 0.15, vérifié 0.20 en 2026

  -- FNAL
  cot_pat_fnal_moins_50 DECIMAL(5,2) NOT NULL DEFAULT 0.10, -- < 50 salariés
  cot_pat_fnal_50_plus DECIMAL(5,2) NOT NULL DEFAULT 0.50, -- >= 50 salariés

  -- Contribution Solidarité Autonomie
  cot_pat_csa DECIMAL(5,2) NOT NULL DEFAULT 0.30,

  -- Retraite complémentaire AGIRC-ARRCO
  cot_pat_retraite_t1 DECIMAL(5,2) NOT NULL DEFAULT 4.72,
  cot_pat_retraite_t2 DECIMAL(5,2) NOT NULL DEFAULT 12.95,
  cot_pat_ceg_t1 DECIMAL(5,2) NOT NULL DEFAULT 1.29,
  cot_pat_ceg_t2 DECIMAL(5,2) NOT NULL DEFAULT 1.62,

  -- Formation et apprentissage
  cot_pat_formation_moins_11 DECIMAL(5,2) NOT NULL DEFAULT 0.55, -- < 11 salariés
  cot_pat_formation_11_plus DECIMAL(5,2) NOT NULL DEFAULT 1.00, -- >= 11 salariés
  cot_pat_taxe_apprentissage DECIMAL(5,2) NOT NULL DEFAULT 0.68,

  -- Contribution dialogue social
  cot_pat_dialogue_social DECIMAL(5,4) NOT NULL DEFAULT 0.016,

  -- =====================================================
  -- HEURES SUPPLÉMENTAIRES
  -- =====================================================

  majoration_hs_25 DECIMAL(5,2) NOT NULL DEFAULT 25.00, -- 8 premières heures/semaine
  majoration_hs_50 DECIMAL(5,2) NOT NULL DEFAULT 50.00, -- au-delà
  contingent_annuel_hs INTEGER NOT NULL DEFAULT 220,

  -- =====================================================
  -- IMPÔT SUR LE REVENU (PAS)
  -- =====================================================

  -- Taux neutre par défaut (barème selon revenu)
  taux_pas_defaut DECIMAL(5,2) NOT NULL DEFAULT 0.00,

  -- =====================================================
  -- MÉTADONNÉES
  -- =====================================================

  actif BOOLEAN DEFAULT true,
  source VARCHAR(255) DEFAULT 'URSSAF/Légifrance',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(annee, date_application)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_rh_params_sociaux_annee ON rh_parametres_sociaux(annee);
CREATE INDEX IF NOT EXISTS idx_rh_params_sociaux_actif ON rh_parametres_sociaux(actif);

-- =====================================================
-- Insérer les paramètres 2026
-- =====================================================

INSERT INTO rh_parametres_sociaux (
  annee, date_application, actif, source, notes
) VALUES (
  2026, '2026-01-01', true,
  'URSSAF - urssaf.fr, Légifrance, Service-public.fr',
  'Taux applicables au 1er janvier 2026. Vieillesse déplafonnée patronale augmentée à 2.11%. SMIC revalorisé à 12.02€/h.'
) ON CONFLICT (annee, date_application) DO UPDATE SET
  updated_at = NOW();

-- =====================================================
-- Commentaires
-- =====================================================

COMMENT ON TABLE rh_parametres_sociaux IS 'Paramètres sociaux par année (SMIC, plafonds SS, taux cotisations)';
COMMENT ON COLUMN rh_parametres_sociaux.cot_pat_maladie IS 'Taux patronal maladie réduit (< 2.5 SMIC)';
COMMENT ON COLUMN rh_parametres_sociaux.cot_pat_vieillesse_deplafonnee IS 'Taux augmenté à 2.11% en 2026 (était 2.02% en 2025)';
COMMENT ON COLUMN rh_parametres_sociaux.cot_pat_allocations_familiales IS 'Taux normal 5.25%, réduit à 3.45% si < 3.5 SMIC';
