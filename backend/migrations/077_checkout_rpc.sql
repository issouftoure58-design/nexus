-- Migration 077: RPC update_reservation_checkout
-- Permet de mettre a jour prix_total et stocker les items consommes lors du checkout restaurant
-- Utilise une RPC pour bypass le cache PostgREST

CREATE OR REPLACE FUNCTION update_reservation_checkout(
  p_rdv_id INTEGER,
  p_tenant_id TEXT,
  p_prix_total NUMERIC,
  p_items_consommes JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE reservations
  SET prix_total = p_prix_total,
      notes = COALESCE(notes, '') ||
        CASE WHEN notes IS NOT NULL AND notes != '' THEN E'\n---\n' ELSE '' END ||
        'Checkout: ' || p_items_consommes::text,
      updated_at = NOW()
  WHERE id = p_rdv_id AND tenant_id = p_tenant_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
