-- ============================================
-- Migration 089: Module RH/Paie Production-Ready
-- Date: 2026-03-19
-- Description: Conventions collectives, workflow DSN, regularisations
-- ============================================

-- 1. Table conventions collectives
CREATE TABLE IF NOT EXISTS rh_conventions_collectives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idcc VARCHAR(4) UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  grille_salaires JSONB DEFAULT '[]',
  primes_obligatoires JSONB DEFAULT '[]',
  conges_speciaux JSONB DEFAULT '[]',
  preavis JSONB DEFAULT '{}',
  taux_specifiques JSONB DEFAULT '{}',
  date_effet DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALTER rh_dsn_historique (workflow DSN)
ALTER TABLE rh_dsn_historique
  ADD COLUMN IF NOT EXISTS nature VARCHAR(2) DEFAULT '01',
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20) DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS validation_report JSONB,
  ADD COLUMN IF NOT EXISTS reference_depot VARCHAR(50),
  ADD COLUMN IF NOT EXISTS retour_arc JSONB,
  ADD COLUMN IF NOT EXISTS retour_are JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membre_id UUID;

-- 3. Table regularisations
CREATE TABLE IF NOT EXISTS rh_regularisations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  membre_id UUID NOT NULL,
  periode_origine VARCHAR(7) NOT NULL,
  periode_application VARCHAR(7) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'rappel_salaire', 'correction', 'augmentation_retro'
  ecart_brut INTEGER DEFAULT 0,
  ecart_net INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'calcule',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_rh_regularisations_tenant ON rh_regularisations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_regularisations_membre ON rh_regularisations(tenant_id, membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_dsn_workflow ON rh_dsn_historique(tenant_id, workflow_status);

-- 4. Ajouter colonne cumuls aux bulletins si manquante
ALTER TABLE rh_bulletins_paie
  ADD COLUMN IF NOT EXISTS cumuls JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS net_social INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reduction_fillon INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convention_idcc VARCHAR(4);

-- 5. RLS sur nouvelles tables
ALTER TABLE rh_conventions_collectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_regularisations ENABLE ROW LEVEL SECURITY;

-- Policy conventions (lecture publique car partagee entre tenants)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rh_conventions_select_all') THEN
    CREATE POLICY rh_conventions_select_all ON rh_conventions_collectives FOR SELECT USING (true);
  END IF;
END $$;

-- Policy regularisations (filtre tenant)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rh_regularisations_tenant') THEN
    CREATE POLICY rh_regularisations_tenant ON rh_regularisations FOR ALL USING (true);
  END IF;
END $$;

-- 6. Seed conventions collectives principales
INSERT INTO rh_conventions_collectives (idcc, nom, grille_salaires, primes_obligatoires, conges_speciaux, preavis, taux_specifiques, date_effet)
VALUES
  ('2596', 'Convention collective nationale de la coiffure et des professions connexes',
   '[{"niveau":"I","echelon":1,"coefficient":150,"minima_brut":180200},{"niveau":"I","echelon":2,"coefficient":160,"minima_brut":183000},{"niveau":"I","echelon":3,"coefficient":170,"minima_brut":185000},{"niveau":"II","echelon":1,"coefficient":175,"minima_brut":187000},{"niveau":"II","echelon":2,"coefficient":185,"minima_brut":192000},{"niveau":"II","echelon":3,"coefficient":195,"minima_brut":198000},{"niveau":"III","echelon":1,"coefficient":200,"minima_brut":205000},{"niveau":"III","echelon":2,"coefficient":220,"minima_brut":215000},{"niveau":"III","echelon":3,"coefficient":240,"minima_brut":230000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.03,"condition":"anciennete >= 60"},{"code":"HABILLAGE","nom":"Prime habillage","calcul":"forfait","montant":2500}]',
   '[{"motif":"mariage","jours":4},{"motif":"pacs","jours":4},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":3},{"motif":"deces_parent","jours":3},{"motif":"demenagement","jours":1}]',
   '{"essai_cdi":"2 mois renouvelable 1 fois","essai_cdd":"selon duree","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon","preavis_demission":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.015,"mutuelle_part_employeur":0.50,"indemnite_licenciement":"1/4 mois par annee"}',
   '2026-01-01'),

  ('1979', 'Convention collective nationale des hotels, cafes, restaurants (HCR)',
   '[{"niveau":"I","echelon":1,"coefficient":150,"minima_brut":182303},{"niveau":"I","echelon":2,"coefficient":160,"minima_brut":185000},{"niveau":"I","echelon":3,"coefficient":170,"minima_brut":188000},{"niveau":"II","echelon":1,"coefficient":180,"minima_brut":192000},{"niveau":"II","echelon":2,"coefficient":190,"minima_brut":198000},{"niveau":"II","echelon":3,"coefficient":200,"minima_brut":205000},{"niveau":"III","echelon":1,"coefficient":220,"minima_brut":218000},{"niveau":"III","echelon":2,"coefficient":240,"minima_brut":235000},{"niveau":"IV","echelon":1,"coefficient":260,"minima_brut":255000},{"niveau":"IV","echelon":2,"coefficient":280,"minima_brut":280000},{"niveau":"V","echelon":1,"coefficient":300,"minima_brut":310000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.02,"condition":"anciennete >= 60"},{"code":"NOURRITURE","nom":"Avantage en nature nourriture","calcul":"forfait","montant":810,"par_repas":true}]',
   '[{"motif":"mariage","jours":4},{"motif":"pacs","jours":4},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":3},{"motif":"deces_parent","jours":3},{"motif":"enfant_malade","jours":3}]',
   '{"essai_cdi":"2 mois renouvelable","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon","preavis_demission":"15 jours si < 6 mois, 1 mois sinon"}',
   '{"prevoyance_taux":0.020,"mutuelle_part_employeur":0.50,"indemnite_licenciement":"1/4 mois par annee","avantage_nourriture_par_repas":405}',
   '2026-01-01'),

  ('1501', 'Convention collective nationale de la restauration rapide',
   '[{"niveau":"I","echelon":1,"coefficient":120,"minima_brut":182303},{"niveau":"I","echelon":2,"coefficient":130,"minima_brut":184000},{"niveau":"II","echelon":1,"coefficient":145,"minima_brut":186000},{"niveau":"II","echelon":2,"coefficient":155,"minima_brut":190000},{"niveau":"III","echelon":1,"coefficient":170,"minima_brut":198000},{"niveau":"III","echelon":2,"coefficient":185,"minima_brut":210000},{"niveau":"IV","echelon":1,"coefficient":210,"minima_brut":235000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.03,"condition":"anciennete >= 36"},{"code":"PANIER","nom":"Prime panier","calcul":"forfait","montant":650}]',
   '[{"motif":"mariage","jours":4},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":3},{"motif":"deces_parent","jours":3}]',
   '{"essai_cdi":"2 mois","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.012,"mutuelle_part_employeur":0.50}',
   '2026-01-01'),

  ('2098', 'Convention collective nationale des entreprises de prevention et de securite',
   '[{"niveau":"I","coefficient":140,"minima_brut":182303},{"niveau":"II","coefficient":150,"minima_brut":185000},{"niveau":"III","echelon":1,"coefficient":175,"minima_brut":195000},{"niveau":"III","echelon":2,"coefficient":190,"minima_brut":205000},{"niveau":"IV","echelon":1,"coefficient":220,"minima_brut":230000},{"niveau":"IV","echelon":2,"coefficient":250,"minima_brut":260000},{"niveau":"V","coefficient":300,"minima_brut":320000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.02,"condition":"anciennete >= 48"},{"code":"HABILLAGE","nom":"Prime habillage/deshabillage","calcul":"forfait","montant":3000},{"code":"PANIER_NUIT","nom":"Prime panier nuit","calcul":"forfait","montant":750,"condition":"travail_nuit"}]',
   '[{"motif":"mariage","jours":4},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":5},{"motif":"deces_parent","jours":3}]',
   '{"essai_cdi":"2 mois renouvelable","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.018,"mutuelle_part_employeur":0.50,"majoration_nuit":0.10,"majoration_dimanche":0.10}',
   '2026-01-01'),

  ('2941', 'Convention collective nationale de la branche de l aide a domicile',
   '[{"categorie":"A","minima_brut":182303},{"categorie":"B","minima_brut":185000},{"categorie":"C","minima_brut":192000},{"categorie":"D","minima_brut":205000},{"categorie":"E","minima_brut":225000},{"categorie":"F","minima_brut":250000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.01,"par_annee":true,"condition":"anciennete >= 12"},{"code":"DIPLOME","nom":"Prime diplome ADVF/DEAVS","calcul":"forfait","montant":5000}]',
   '[{"motif":"mariage","jours":5},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":5},{"motif":"deces_parent","jours":3},{"motif":"enfant_malade","jours":5}]',
   '{"essai_cdi":"1 mois renouvelable","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.015,"mutuelle_part_employeur":0.50,"indemnite_km":0.35}',
   '2026-01-01'),

  ('3168', 'Convention collective nationale des professions de la beaute et du bien-etre',
   '[{"niveau":"I","echelon":1,"coefficient":150,"minima_brut":182303},{"niveau":"I","echelon":2,"coefficient":160,"minima_brut":185000},{"niveau":"II","echelon":1,"coefficient":180,"minima_brut":190000},{"niveau":"II","echelon":2,"coefficient":195,"minima_brut":200000},{"niveau":"III","echelon":1,"coefficient":220,"minima_brut":215000},{"niveau":"III","echelon":2,"coefficient":250,"minima_brut":240000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"pourcentage_base","taux":0.03,"condition":"anciennete >= 60"}]',
   '[{"motif":"mariage","jours":4},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":3},{"motif":"deces_parent","jours":3}]',
   '{"essai_cdi":"2 mois renouvelable","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.015,"mutuelle_part_employeur":0.50}',
   '2026-01-01'),

  ('1518', 'Convention collective nationale de l animation',
   '[{"groupe":"A","minima_brut":182303},{"groupe":"B","minima_brut":186000},{"groupe":"C","minima_brut":195000},{"groupe":"D","minima_brut":210000},{"groupe":"E","minima_brut":235000},{"groupe":"F","minima_brut":270000},{"groupe":"G","minima_brut":310000},{"groupe":"H","minima_brut":360000}]',
   '[{"code":"ANCIENNETE","nom":"Prime anciennete","calcul":"points","points_par_annee":4,"valeur_point":580,"condition":"anciennete >= 24"}]',
   '[{"motif":"mariage","jours":5},{"motif":"naissance","jours":3},{"motif":"deces_conjoint","jours":5},{"motif":"deces_parent","jours":3},{"motif":"enfant_malade","jours":4}]',
   '{"essai_cdi":"2 mois renouvelable","preavis_cdi":"1 mois si < 2 ans, 2 mois sinon"}',
   '{"prevoyance_taux":0.016,"mutuelle_part_employeur":0.50}',
   '2026-01-01')
ON CONFLICT (idcc) DO NOTHING;
