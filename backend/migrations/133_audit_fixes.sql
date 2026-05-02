-- Migration 133: Audit fixes — Race conditions + Business isolation
-- R5: Unique constraint on forfait_affectations to prevent bulk retry duplicates
-- R2: RPC debit_credits for atomic credit consumption

-- ═══════════════════════════════════════════════════════════════
-- R5: Unique index on forfait_affectations
-- Prevents duplicate affectations when retrying bulk insert
-- ═══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_forfait_affectations_unique
ON forfait_affectations(periode_id, poste_id, membre_id, date);

-- ═══════════════════════════════════════════════════════════════
-- R2: Atomic debit_credits RPC
-- Prevents double-spend race condition on concurrent consume()
-- Returns the new balance, or -1 if insufficient credits
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION debit_credits(
  p_tenant_id UUID,
  p_amount INT,
  p_total_consumed INT DEFAULT 0,
  p_monthly_used INT DEFAULT 0
)
RETURNS TABLE(new_balance INT, success BOOLEAN) AS $$
DECLARE
  v_balance INT;
BEGIN
  -- Atomic: UPDATE only if balance >= amount
  UPDATE ai_credits
  SET
    balance = balance - p_amount,
    total_consumed = total_consumed + p_amount,
    monthly_used = monthly_used + p_amount,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND balance >= p_amount
  RETURNING ai_credits.balance INTO v_balance;

  IF FOUND THEN
    RETURN QUERY SELECT v_balance, TRUE;
  ELSE
    -- Return current balance for error reporting
    SELECT ai_credits.balance INTO v_balance
    FROM ai_credits
    WHERE ai_credits.tenant_id = p_tenant_id;

    RETURN QUERY SELECT COALESCE(v_balance, 0), FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- R2 (overage): Atomic debit with overage split
-- Debits balance to 0 and records overage EUR cost
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION debit_credits_overage(
  p_tenant_id UUID,
  p_amount INT,
  p_overage_eur NUMERIC(10,2)
)
RETURNS TABLE(new_balance INT, new_overage_used NUMERIC(10,2), success BOOLEAN) AS $$
DECLARE
  v_overage_used NUMERIC(10,2);
  v_limit NUMERIC(10,2);
BEGIN
  -- Check overage limit first
  SELECT overage_used_eur, overage_limit_eur
  INTO v_overage_used, v_limit
  FROM ai_credits
  WHERE tenant_id = p_tenant_id AND overage_enabled = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0::NUMERIC(10,2), FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_overage_used, 0) + p_overage_eur > COALESCE(v_limit, 0) THEN
    RETURN QUERY SELECT 0, COALESCE(v_overage_used, 0::NUMERIC(10,2)), FALSE;
    RETURN;
  END IF;

  -- Atomic update: zero balance + add overage
  UPDATE ai_credits
  SET
    balance = 0,
    total_consumed = total_consumed + p_amount,
    monthly_used = monthly_used + p_amount,
    overage_used_eur = COALESCE(overage_used_eur, 0) + p_overage_eur,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING ai_credits.overage_used_eur INTO v_overage_used;

  RETURN QUERY SELECT 0, v_overage_used, TRUE;
END;
$$ LANGUAGE plpgsql;
