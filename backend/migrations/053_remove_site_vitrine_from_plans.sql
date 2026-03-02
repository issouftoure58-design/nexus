-- Migration 053: Retirer site_vitrine des features de plans
-- Le site vitrine n'est plus inclus dans les offres NEXUS

-- Retirer site_vitrine du JSONB features de chaque plan
UPDATE plan_quotas
SET features = features - 'site_vitrine'
WHERE features ? 'site_vitrine';
