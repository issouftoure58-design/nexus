-- ============================================================================
-- MIGRATION 038: Fonctionnalités Hôtel
-- Tables: tarifs_saisonniers, chambres_occupation
-- ============================================================================

-- Tarifs saisonniers pour les chambres
CREATE TABLE IF NOT EXISTS tarifs_saisonniers (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service/Chambre concernée
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,

  -- Période
  nom VARCHAR(100) NOT NULL,  -- "Haute saison", "Basse saison", "Vacances scolaires"
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,

  -- Tarifs en centimes
  prix_nuit INTEGER NOT NULL,            -- Prix par nuit
  prix_weekend INTEGER,                   -- Supplément week-end (optionnel)
  prix_semaine INTEGER,                   -- Prix semaine complète (optionnel, -10% typique)

  -- Options
  petit_dejeuner_inclus BOOLEAN DEFAULT false,
  prix_petit_dejeuner INTEGER DEFAULT 0,  -- Si non inclus

  -- Règles
  duree_min_nuits INTEGER DEFAULT 1,     -- Durée minimum de séjour

  -- Métadonnées
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tarifs_tenant ON tarifs_saisonniers(tenant_id);
CREATE INDEX idx_tarifs_service ON tarifs_saisonniers(service_id);
CREATE INDEX idx_tarifs_dates ON tarifs_saisonniers(date_debut, date_fin);

-- Occupation des chambres (tracking journalier)
CREATE TABLE IF NOT EXISTS chambres_occupation (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,

  -- Chambre concernée (service de type chambre)
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,

  -- Date occupée
  date_occupation DATE NOT NULL,

  -- Statut
  statut VARCHAR(20) DEFAULT 'reservee',  -- reservee, occupee, maintenance, bloquee

  -- Réservation liée
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,

  -- Infos client (pour affichage rapide)
  client_nom VARCHAR(255),
  nb_personnes INTEGER DEFAULT 1,

  -- Notes
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_occupation_unique ON chambres_occupation(tenant_id, service_id, date_occupation);
CREATE INDEX idx_occupation_tenant ON chambres_occupation(tenant_id);
CREATE INDEX idx_occupation_date ON chambres_occupation(date_occupation);
CREATE INDEX idx_occupation_service ON chambres_occupation(service_id);

-- Vue pour le calendrier des chambres
CREATE OR REPLACE VIEW vue_calendrier_chambres AS
SELECT
  s.id as service_id,
  s.tenant_id,
  s.nom as chambre_nom,
  s.type_chambre,
  s.capacite,
  s.prix as prix_base,
  co.date_occupation,
  co.statut,
  co.client_nom,
  co.nb_personnes,
  co.reservation_id,
  r.client_id,
  COALESCE(ts.prix_nuit, s.prix) as prix_nuit_effectif,
  ts.nom as saison_nom
FROM services s
LEFT JOIN chambres_occupation co ON s.id = co.service_id
LEFT JOIN reservations r ON co.reservation_id = r.id
LEFT JOIN tarifs_saisonniers ts ON s.id = ts.service_id
  AND co.date_occupation BETWEEN ts.date_debut AND ts.date_fin
  AND ts.actif = true
WHERE s.type_chambre IS NOT NULL;

-- Fonction pour calculer le prix d'un séjour
CREATE OR REPLACE FUNCTION calcul_prix_sejour(
  p_tenant_id VARCHAR(255),
  p_service_id INTEGER,
  p_date_debut DATE,
  p_date_fin DATE
) RETURNS TABLE (
  nb_nuits INTEGER,
  prix_total INTEGER,
  detail_tarifs JSONB
) AS $$
DECLARE
  v_date DATE;
  v_prix INTEGER;
  v_total INTEGER := 0;
  v_nuits INTEGER := 0;
  v_details JSONB := '[]'::JSONB;
  v_prix_base INTEGER;
  v_saison_nom VARCHAR(100);
BEGIN
  -- Récupérer le prix de base
  SELECT prix INTO v_prix_base
  FROM services
  WHERE id = p_service_id AND tenant_id = p_tenant_id;

  -- Calculer pour chaque nuit
  v_date := p_date_debut;
  WHILE v_date < p_date_fin LOOP
    -- Chercher un tarif saisonnier
    SELECT ts.prix_nuit, ts.nom INTO v_prix, v_saison_nom
    FROM tarifs_saisonniers ts
    WHERE ts.service_id = p_service_id
      AND ts.tenant_id = p_tenant_id
      AND v_date BETWEEN ts.date_debut AND ts.date_fin
      AND ts.actif = true
    ORDER BY ts.created_at DESC
    LIMIT 1;

    -- Utiliser prix de base si pas de tarif saisonnier
    IF v_prix IS NULL THEN
      v_prix := v_prix_base;
      v_saison_nom := 'Standard';
    END IF;

    v_total := v_total + v_prix;
    v_nuits := v_nuits + 1;

    -- Ajouter au détail
    v_details := v_details || jsonb_build_object(
      'date', v_date,
      'prix', v_prix,
      'saison', v_saison_nom
    );

    v_date := v_date + INTERVAL '1 day';
  END LOOP;

  nb_nuits := v_nuits;
  prix_total := v_total;
  detail_tarifs := v_details;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mise à jour de updated_at
CREATE OR REPLACE FUNCTION update_tarifs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tarifs_updated_at ON tarifs_saisonniers;
CREATE TRIGGER tarifs_updated_at
  BEFORE UPDATE ON tarifs_saisonniers
  FOR EACH ROW
  EXECUTE FUNCTION update_tarifs_updated_at();
