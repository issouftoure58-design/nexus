-- Migration 075: Email case-insensitive uniqueness
-- Prevents duplicate accounts from email casing differences (e.g. John@Test.com vs john@test.com)

-- 1. Normalize all existing emails to lowercase
UPDATE admin_users SET email = LOWER(email) WHERE email != LOWER(email);
UPDATE invitations SET email = LOWER(email) WHERE email != LOWER(email);

-- 2. Unique index on lowercase email per tenant (prevents case-variant duplicates)
-- COALESCE handles super_admin rows where tenant_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_tenant_lower_unique
  ON admin_users (LOWER(email), COALESCE(tenant_id, '__nexus_null__'));

-- 3. Unique index on lowercase email for invitations (per tenant, non-accepted only)
-- NOW() is not immutable, so we only filter on accepted_at (application handles expiry)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_email_tenant_pending_lower_unique
  ON invitations (LOWER(email), tenant_id)
  WHERE accepted_at IS NULL;
