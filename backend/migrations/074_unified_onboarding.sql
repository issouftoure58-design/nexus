-- Migration 074: Unified Onboarding — multi-period hours + business_profile backfill + onboarding_step
-- Supports restaurant (midi/soir), medical (matin/apres-midi), garage (matin/apres-midi)

-- 1. Multi-period business hours: drop old unique constraint, add period support
ALTER TABLE business_hours DROP CONSTRAINT IF EXISTS business_hours_tenant_id_day_of_week_key;
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS period_label VARCHAR(50) DEFAULT 'journee';
ALTER TABLE business_hours ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- New unique constraint: one row per (tenant, day, period)
ALTER TABLE business_hours ADD CONSTRAINT business_hours_tenant_day_period_unique
  UNIQUE(tenant_id, day_of_week, period_label);

-- 2. Backfill business_profile from template_id for tenants that have no profile set
UPDATE tenants SET business_profile = CASE
  WHEN template_id IN ('salon_coiffure','institut_beaute','medical','garage','commerce','autre') THEN 'salon'
  WHEN template_id = 'restaurant' THEN 'restaurant'
  WHEN template_id = 'hotel' THEN 'hotel'
  WHEN template_id = 'artisan' THEN 'service_domicile'
  ELSE COALESCE(business_profile, 'salon')
END WHERE business_profile IS NULL OR business_profile = 'beauty';

-- 3. Track onboarding wizard progress (0 = not started, 1-4 = step, 5 = completed)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
