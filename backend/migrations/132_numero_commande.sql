-- Migration 132: Ajouter numero_commande (bon de commande / PO) sur reservations, devis, forfaits, factures
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS numero_commande VARCHAR(100);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS numero_commande VARCHAR(100);
ALTER TABLE forfaits ADD COLUMN IF NOT EXISTS numero_commande VARCHAR(100);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS numero_commande VARCHAR(100);
