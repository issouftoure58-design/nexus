-- 095: Fix client_consents.client_id type mismatch
-- La colonne client_id etait UUID mais clients.id est INTEGER
-- Cela provoque "invalid input syntax for type uuid" dans N25_rgpd

ALTER TABLE client_consents
  ALTER COLUMN client_id TYPE INTEGER USING client_id::text::integer;
