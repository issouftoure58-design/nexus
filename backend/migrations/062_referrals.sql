-- Migration 062: Programme parrainage / referral
-- Sprint 4.3 — Parrainage et affiliation

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_tenant_id VARCHAR(255) NOT NULL, -- Le parrain
  referred_tenant_id VARCHAR(255), -- Le filleul (rempli quand inscription)
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, rewarded, expired
  reward_type VARCHAR(20) DEFAULT 'credit', -- credit, discount, month_free
  reward_amount INTEGER DEFAULT 0, -- en centimes ou % selon reward_type
  reward_applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_tenant_id);

-- Colonne referral sur tenants pour tracker la source
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
