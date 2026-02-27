-- Migration 023: Vue planning employé enrichie avec calculs automatiques
-- Date: 2026-02-23
-- Description: Vue planning dynamique avec cumuls heures et alertes
-- FIXED: Utilise les bons noms de colonnes (date, heure, duree_minutes)

-- =====================================================
-- PARTIE 1: Vue planning employé complet
-- =====================================================

CREATE OR REPLACE VIEW v_planning_employe_complet AS
SELECT
  r.id as reservation_id,
  r.tenant_id,
  r.membre_id,
  m.nom || ' ' || m.prenom as employe_nom,
  m.email as employe_email,
  COALESCE(m.heures_hebdo, 35) as heures_contrat,
  r.date::date as date_reservation,
  r.heure as heure_debut,
  -- Calculer heure_fin = heure + duree_minutes
  (r.heure::time + (COALESCE(r.duree_minutes, 60) || ' minutes')::interval)::time as heure_fin,
  -- Durée en heures
  ROUND(COALESCE(r.duree_minutes, 60)::decimal / 60, 2) as duree_heures,
  -- Infos client
  c.id as client_id,
  COALESCE(c.nom || ' ' || c.prenom, 'Client inconnu') as client_nom,
  c.telephone as client_tel,
  -- Infos service
  s.id as service_id,
  COALESCE(s.nom, r.service_nom, 'Service') as service_nom,
  COALESCE(s.prix, r.prix_service, 0) as service_prix,
  r.statut,
  r.notes,
  -- Cumul heures jour
  (SELECT COALESCE(SUM(COALESCE(r2.duree_minutes, 60)::decimal / 60), 0)
   FROM reservations r2
   WHERE r2.membre_id = r.membre_id
   AND r2.tenant_id = r.tenant_id
   AND r2.date::date = r.date::date
   AND r2.statut NOT IN ('cancelled', 'no_show', 'annule')
  ) as heures_jour,
  -- Cumul heures semaine (lundi à dimanche)
  (SELECT COALESCE(SUM(COALESCE(r2.duree_minutes, 60)::decimal / 60), 0)
   FROM reservations r2
   WHERE r2.membre_id = r.membre_id
   AND r2.tenant_id = r.tenant_id
   AND DATE_TRUNC('week', r2.date::date) = DATE_TRUNC('week', r.date::date)
   AND r2.statut NOT IN ('cancelled', 'no_show', 'annule')
  ) as heures_semaine
FROM reservations r
JOIN rh_membres m ON r.membre_id = m.id
LEFT JOIN clients c ON r.client_id = c.id
LEFT JOIN services s ON r.service_id = s.id
WHERE r.membre_id IS NOT NULL
AND r.statut NOT IN ('cancelled', 'annule');

-- =====================================================
-- PARTIE 2: Vue résumé hebdomadaire par employé
-- =====================================================

CREATE OR REPLACE VIEW v_planning_resume_hebdo AS
SELECT
  m.tenant_id,
  m.id as membre_id,
  m.nom || ' ' || m.prenom as employe_nom,
  COALESCE(m.heures_hebdo, 35) as heures_contrat,
  DATE_TRUNC('week', r.date::date)::date as semaine_debut,
  COUNT(DISTINCT r.id) as nb_rdv,
  ROUND(COALESCE(SUM(COALESCE(r.duree_minutes, 60)::decimal / 60), 0)::numeric, 2) as heures_planifiees,
  -- Pourcentage de remplissage
  CASE
    WHEN COALESCE(m.heures_hebdo, 35) > 0 THEN
      ROUND((COALESCE(SUM(COALESCE(r.duree_minutes, 60)::decimal / 60), 0) / COALESCE(m.heures_hebdo, 35) * 100)::numeric, 1)
    ELSE 0
  END as pourcentage_remplissage,
  -- Heures restantes
  ROUND((COALESCE(m.heures_hebdo, 35) - COALESCE(SUM(COALESCE(r.duree_minutes, 60)::decimal / 60), 0))::numeric, 2) as heures_disponibles,
  -- Alerte surcharge
  CASE
    WHEN COALESCE(SUM(COALESCE(r.duree_minutes, 60)::decimal / 60), 0) > COALESCE(m.heures_hebdo, 35) THEN 'depassement'
    WHEN COALESCE(SUM(COALESCE(r.duree_minutes, 60)::decimal / 60), 0) > COALESCE(m.heures_hebdo, 35) * 0.9 THEN 'proche_limite'
    ELSE 'ok'
  END as statut_charge
FROM rh_membres m
LEFT JOIN reservations r ON r.membre_id = m.id
  AND r.statut NOT IN ('cancelled', 'no_show', 'annule')
  AND r.date::date >= CURRENT_DATE - INTERVAL '4 weeks'
  AND r.date::date <= CURRENT_DATE + INTERVAL '8 weeks'
WHERE m.statut = 'actif'
GROUP BY m.tenant_id, m.id, m.nom, m.prenom, m.heures_hebdo, DATE_TRUNC('week', r.date::date);

-- =====================================================
-- PARTIE 3: Vue absences planifiées (pour griser le planning)
-- =====================================================

CREATE OR REPLACE VIEW v_planning_absences AS
SELECT
  a.tenant_id,
  a.membre_id,
  m.nom || ' ' || m.prenom as employe_nom,
  a.type,
  a.date_debut,
  a.date_fin,
  a.demi_journee,
  a.periode_journee,
  a.statut,
  a.motif
FROM rh_absences a
JOIN rh_membres m ON a.membre_id = m.id
WHERE a.statut = 'approuve'
AND a.date_fin >= CURRENT_DATE;

-- =====================================================
-- PARTIE 4: Fonction vérification disponibilité
-- =====================================================

CREATE OR REPLACE FUNCTION verifier_disponibilite_employe(
  p_tenant_id TEXT,
  p_membre_id INTEGER,
  p_date DATE,
  p_heure_debut TIME,
  p_heure_fin TIME
)
RETURNS JSONB AS $$
DECLARE
  v_heures_jour DECIMAL;
  v_heures_semaine DECIMAL;
  v_heures_contrat DECIMAL;
  v_conflits JSONB;
  v_absences JSONB;
  v_alertes JSONB := '[]'::JSONB;
  v_derniere_fin TIME;
  v_premiere_debut TIME;
  v_amplitude DECIMAL;
  v_duree_creneau DECIMAL;
BEGIN
  -- Calculer durée du créneau demandé
  v_duree_creneau := EXTRACT(EPOCH FROM (p_heure_fin - p_heure_debut))/3600;

  -- Récupérer heures contrat
  SELECT COALESCE(heures_hebdo, 35) INTO v_heures_contrat
  FROM rh_membres WHERE id = p_membre_id;

  -- Calculer heures déjà planifiées ce jour
  SELECT COALESCE(SUM(COALESCE(duree_minutes, 60)::decimal / 60), 0)
  INTO v_heures_jour
  FROM reservations
  WHERE membre_id = p_membre_id
  AND tenant_id = p_tenant_id
  AND date::date = p_date
  AND statut NOT IN ('cancelled', 'no_show', 'annule');

  -- Calculer heures déjà planifiées cette semaine
  SELECT COALESCE(SUM(COALESCE(duree_minutes, 60)::decimal / 60), 0)
  INTO v_heures_semaine
  FROM reservations
  WHERE membre_id = p_membre_id
  AND tenant_id = p_tenant_id
  AND DATE_TRUNC('week', date::date) = DATE_TRUNC('week', p_date)
  AND statut NOT IN ('cancelled', 'no_show', 'annule');

  -- Vérifier conflits horaires
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'heure_debut', r.heure,
    'heure_fin', (r.heure::time + (COALESCE(r.duree_minutes, 60) || ' minutes')::interval)::time,
    'client_nom', COALESCE(c.nom || ' ' || c.prenom, 'Client'),
    'service_nom', COALESCE(s.nom, r.service_nom, 'Service')
  )), '[]'::JSONB)
  INTO v_conflits
  FROM reservations r
  LEFT JOIN clients c ON r.client_id = c.id
  LEFT JOIN services s ON r.service_id = s.id
  WHERE r.membre_id = p_membre_id
  AND r.tenant_id = p_tenant_id
  AND r.date::date = p_date
  AND r.statut NOT IN ('cancelled', 'no_show', 'annule')
  AND (
    (r.heure::time < p_heure_fin AND (r.heure::time + (COALESCE(r.duree_minutes, 60) || ' minutes')::interval)::time > p_heure_debut)
  );

  -- Vérifier absences
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', type,
    'date_debut', date_debut,
    'date_fin', date_fin,
    'motif', motif
  )), '[]'::JSONB)
  INTO v_absences
  FROM rh_absences
  WHERE membre_id = p_membre_id
  AND tenant_id = p_tenant_id
  AND statut = 'approuve'
  AND p_date BETWEEN date_debut AND date_fin;

  -- Calculer amplitude journalière
  SELECT MIN(heure::time), MAX((heure::time + (COALESCE(duree_minutes, 60) || ' minutes')::interval)::time)
  INTO v_premiere_debut, v_derniere_fin
  FROM reservations
  WHERE membre_id = p_membre_id
  AND tenant_id = p_tenant_id
  AND date::date = p_date
  AND statut NOT IN ('cancelled', 'no_show', 'annule');

  IF v_premiere_debut IS NOT NULL THEN
    -- Inclure le nouveau créneau dans le calcul
    IF p_heure_debut < v_premiere_debut THEN v_premiere_debut := p_heure_debut; END IF;
    IF p_heure_fin > v_derniere_fin THEN v_derniere_fin := p_heure_fin; END IF;
    v_amplitude := EXTRACT(EPOCH FROM (v_derniere_fin - v_premiere_debut))/3600;
  ELSE
    v_amplitude := v_duree_creneau;
  END IF;

  -- Générer alertes
  -- Alerte dépassement heures hebdo
  IF v_heures_semaine + v_duree_creneau > v_heures_contrat THEN
    v_alertes := v_alertes || jsonb_build_object(
      'type', 'depassement',
      'niveau', 'error',
      'message', 'Dépasse les ' || v_heures_contrat || 'h hebdomadaires du contrat'
    );
  ELSIF v_heures_semaine + v_duree_creneau > v_heures_contrat * 0.9 THEN
    v_alertes := v_alertes || jsonb_build_object(
      'type', 'surcharge',
      'niveau', 'warning',
      'message', 'Atteint 90% des heures hebdomadaires'
    );
  END IF;

  -- Alerte amplitude > 10h
  IF v_amplitude > 10 THEN
    v_alertes := v_alertes || jsonb_build_object(
      'type', 'amplitude',
      'niveau', 'warning',
      'message', 'Amplitude journalière > 10h (' || ROUND(v_amplitude, 1) || 'h)'
    );
  END IF;

  -- Alerte absence
  IF jsonb_array_length(v_absences) > 0 THEN
    v_alertes := v_alertes || jsonb_build_object(
      'type', 'absence',
      'niveau', 'error',
      'message', 'Salarié en absence ce jour'
    );
  END IF;

  RETURN jsonb_build_object(
    'disponible', jsonb_array_length(v_conflits) = 0 AND jsonb_array_length(v_absences) = 0,
    'heures_jour', ROUND(v_heures_jour + v_duree_creneau, 2),
    'heures_semaine', ROUND(v_heures_semaine + v_duree_creneau, 2),
    'heures_contrat_hebdo', v_heures_contrat,
    'pourcentage_semaine', ROUND((v_heures_semaine + v_duree_creneau) / v_heures_contrat * 100, 1),
    'amplitude_jour', ROUND(v_amplitude, 2),
    'alertes', v_alertes,
    'conflits', v_conflits,
    'absences', v_absences
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTIE 5: Trigger alimentation pointage depuis réservation
-- =====================================================

CREATE OR REPLACE FUNCTION alimenter_pointage_depuis_reservation()
RETURNS TRIGGER AS $$
DECLARE
  v_heures_travaillees DECIMAL;
  v_heures_theoriques DECIMAL;
BEGIN
  -- Seulement si la réservation passe en 'termine' et a un membre_id
  IF NEW.statut IN ('completed', 'termine') AND NEW.membre_id IS NOT NULL
     AND (OLD.statut IS NULL OR OLD.statut NOT IN ('completed', 'termine')) THEN

    -- Calculer heures travaillées depuis duree_minutes
    v_heures_travaillees := COALESCE(NEW.duree_minutes, 60)::decimal / 60;

    -- Récupérer heures théoriques journalières (heures_hebdo / 5)
    SELECT COALESCE(heures_hebdo / 5, 7) INTO v_heures_theoriques
    FROM rh_membres WHERE id = NEW.membre_id;

    -- Upsert dans pointage
    INSERT INTO rh_pointage (
      tenant_id, membre_id, date_travail,
      heure_debut, heure_fin, pause_minutes,
      heures_travaillees, heures_theoriques,
      source, reservation_id
    )
    VALUES (
      NEW.tenant_id, NEW.membre_id, NEW.date::date,
      NEW.heure::time,
      (NEW.heure::time + (COALESCE(NEW.duree_minutes, 60) || ' minutes')::interval)::time,
      0,
      v_heures_travaillees, v_heures_theoriques,
      'planning', NEW.id
    )
    ON CONFLICT (tenant_id, membre_id, date_travail)
    DO UPDATE SET
      heures_travaillees = rh_pointage.heures_travaillees + EXCLUDED.heures_travaillees,
      heure_fin = GREATEST(rh_pointage.heure_fin, EXCLUDED.heure_fin),
      heure_debut = LEAST(rh_pointage.heure_debut, EXCLUDED.heure_debut);

    -- Recalculer heures supp pour la journée
    UPDATE rh_pointage
    SET heures_supp = GREATEST(heures_travaillees - heures_theoriques, 0)
    WHERE tenant_id = NEW.tenant_id
    AND membre_id = NEW.membre_id
    AND date_travail = NEW.date::date;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservation_pointage ON reservations;
CREATE TRIGGER trg_reservation_pointage
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION alimenter_pointage_depuis_reservation();

-- =====================================================
-- PARTIE 6: Commentaires
-- =====================================================

COMMENT ON VIEW v_planning_employe_complet IS 'Planning détaillé par employé avec cumuls heures jour/semaine';
COMMENT ON VIEW v_planning_resume_hebdo IS 'Résumé hebdomadaire des heures planifiées par employé';
COMMENT ON VIEW v_planning_absences IS 'Absences approuvées pour affichage dans le planning';
COMMENT ON FUNCTION verifier_disponibilite_employe IS 'Vérifie la disponibilité d''un employé pour un créneau donné';
