-- Migration 121: Création table rh_parametres_sociaux avec tenant_id + CET
-- Permet la mise à jour automatique des taux par tenant

CREATE TABLE IF NOT EXISTS rh_parametres_sociaux (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  annee INTEGER NOT NULL,
  date_application DATE NOT NULL DEFAULT '2026-01-01',

  -- SMIC
  smic_horaire_brut DECIMAL(6,2) NOT NULL DEFAULT 12.02,
  smic_mensuel_brut DECIMAL(8,2) NOT NULL DEFAULT 1823.03,
  smic_annuel_brut DECIMAL(10,2) NOT NULL DEFAULT 21876.36,

  -- Plafonds Securite Sociale
  plafond_ss_mensuel DECIMAL(8,2) NOT NULL DEFAULT 4005.00,
  plafond_ss_annuel DECIMAL(10,2) NOT NULL DEFAULT 48060.00,

  -- Minimum garanti
  minimum_garanti DECIMAL(5,2) NOT NULL DEFAULT 4.25,

  -- COTISATIONS SALARIALES (en %)
  cot_sal_maladie DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  cot_sal_vieillesse_plafonnee DECIMAL(5,2) NOT NULL DEFAULT 6.90,
  cot_sal_vieillesse_deplafonnee DECIMAL(5,2) NOT NULL DEFAULT 0.40,
  cot_sal_chomage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  cot_sal_retraite_t1 DECIMAL(5,2) NOT NULL DEFAULT 3.15,
  cot_sal_retraite_t2 DECIMAL(5,2) NOT NULL DEFAULT 8.64,
  cot_sal_ceg_t1 DECIMAL(5,2) NOT NULL DEFAULT 0.86,
  cot_sal_ceg_t2 DECIMAL(5,2) NOT NULL DEFAULT 1.08,
  cot_sal_cet DECIMAL(5,2) NOT NULL DEFAULT 0.14,
  cot_sal_csg_deductible DECIMAL(5,2) NOT NULL DEFAULT 6.80,
  cot_sal_csg_non_deductible DECIMAL(5,2) NOT NULL DEFAULT 2.40,
  cot_sal_crds DECIMAL(5,2) NOT NULL DEFAULT 0.50,
  base_csg_crds_pct DECIMAL(5,2) NOT NULL DEFAULT 98.25,

  -- COTISATIONS PATRONALES (en %)
  cot_pat_maladie DECIMAL(5,2) NOT NULL DEFAULT 7.00,
  cot_pat_maladie_haut_revenu DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  cot_pat_vieillesse_plafonnee DECIMAL(5,2) NOT NULL DEFAULT 8.55,
  cot_pat_vieillesse_deplafonnee DECIMAL(5,2) NOT NULL DEFAULT 2.11,
  cot_pat_allocations_familiales DECIMAL(5,2) NOT NULL DEFAULT 5.25,
  cot_pat_allocations_familiales_reduit DECIMAL(5,2) NOT NULL DEFAULT 3.45,
  cot_pat_accident_travail DECIMAL(5,2) NOT NULL DEFAULT 2.08,
  cot_pat_chomage DECIMAL(5,2) NOT NULL DEFAULT 4.05,
  cot_pat_ags DECIMAL(5,2) NOT NULL DEFAULT 0.20,
  cot_pat_fnal_moins_50 DECIMAL(5,2) NOT NULL DEFAULT 0.10,
  cot_pat_fnal_50_plus DECIMAL(5,2) NOT NULL DEFAULT 0.50,
  cot_pat_csa DECIMAL(5,2) NOT NULL DEFAULT 0.30,
  cot_pat_retraite_t1 DECIMAL(5,2) NOT NULL DEFAULT 4.72,
  cot_pat_retraite_t2 DECIMAL(5,2) NOT NULL DEFAULT 12.95,
  cot_pat_ceg_t1 DECIMAL(5,2) NOT NULL DEFAULT 1.29,
  cot_pat_ceg_t2 DECIMAL(5,2) NOT NULL DEFAULT 1.62,
  cot_pat_cet DECIMAL(5,2) NOT NULL DEFAULT 0.21,
  cot_pat_formation_moins_11 DECIMAL(5,2) NOT NULL DEFAULT 0.55,
  cot_pat_formation_11_plus DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  cot_pat_taxe_apprentissage DECIMAL(5,2) NOT NULL DEFAULT 0.68,
  cot_pat_dialogue_social DECIMAL(5,4) NOT NULL DEFAULT 0.016,

  -- HEURES SUPPLEMENTAIRES
  majoration_hs_25 DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  majoration_hs_50 DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  contingent_annuel_hs INTEGER NOT NULL DEFAULT 220,

  -- PAS
  taux_pas_defaut DECIMAL(5,2) NOT NULL DEFAULT 0.00,

  -- METADATA
  actif BOOLEAN DEFAULT true,
  source VARCHAR(255) DEFAULT 'URSSAF/Legifrance',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, annee, date_application)
);

CREATE INDEX IF NOT EXISTS idx_rh_params_sociaux_tenant ON rh_parametres_sociaux(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_params_sociaux_annee ON rh_parametres_sociaux(annee);

ALTER TABLE rh_parametres_sociaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_parametres_sociaux_tenant_isolation ON rh_parametres_sociaux
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
