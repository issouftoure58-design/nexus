-- Migration 016: Ajout TVA et taxe CNAPS aux services
-- TVA configurable par service + taxe CNAPS pour les sociétés de sécurité privée

-- Ajouter taux_tva si n'existe pas (défaut 20%)
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_tva DECIMAL(5,2) DEFAULT 20;

-- Ajouter support taxe CNAPS (pour les entreprises de sécurité privée)
-- La taxe CNAPS était de 0.40% à 0.50% du HT, soumise à TVA
-- Supprimée depuis le 01/01/2020 mais peut être réintroduite
ALTER TABLE services ADD COLUMN IF NOT EXISTS taxe_cnaps BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_cnaps DECIMAL(5,3) DEFAULT 0.50;

-- Ajouter actif si n'existe pas
ALTER TABLE services ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT true;

-- Ajouter catégorie si n'existe pas (pour regrouper les services)
ALTER TABLE services ADD COLUMN IF NOT EXISTS categorie VARCHAR(100);

-- Commentaires pour documentation
COMMENT ON COLUMN services.taux_tva IS 'Taux de TVA en pourcentage (ex: 20 pour 20%)';
COMMENT ON COLUMN services.taxe_cnaps IS 'Si true, applique la taxe CNAPS (sécurité privée)';
COMMENT ON COLUMN services.taux_cnaps IS 'Taux de la taxe CNAPS en pourcentage (ex: 0.50 pour 0.5%)';

-- Index pour la catégorie
CREATE INDEX IF NOT EXISTS idx_services_categorie ON services(tenant_id, categorie);
