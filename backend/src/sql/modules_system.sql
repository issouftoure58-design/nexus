-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Système Modules Activables
-- Date: 2026-02-10
-- Mission: Jour 6 - Dette #2
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- TABLE: modules_disponibles
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS modules_disponibles (
  id VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50) NOT NULL,
  prix_mensuel INTEGER NOT NULL DEFAULT 0, -- En centimes (2900 = 29€)
  actif BOOLEAN DEFAULT true,
  requis BOOLEAN DEFAULT false, -- Si module obligatoire (socle)
  dependances JSONB DEFAULT '[]'::jsonb, -- ['module_id_1', 'module_id_2']
  features JSONB DEFAULT '[]'::jsonb, -- Liste fonctionnalités
  ordre INTEGER DEFAULT 0, -- Pour tri affichage
  icone VARCHAR(50) DEFAULT 'Package', -- Nom icône Lucide
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_modules_categorie ON modules_disponibles(categorie);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON modules_disponibles(actif);

-- ────────────────────────────────────────────────────────────────────
-- DONNÉES: Modules disponibles
-- ────────────────────────────────────────────────────────────────────

-- Vider table si données existantes
DELETE FROM modules_disponibles;

-- SOCLE (obligatoire)
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, requis, ordre, icone, features) VALUES
('socle', 'Socle NEXUS', 'Dashboard admin, gestion clients, notifications SMS de base', 'base', 4900, true, 0, 'Building2',
 '["Dashboard admin", "Gestion clients", "Notifications SMS", "Support email"]'::jsonb);

-- CANAUX CLIENTS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, dependances, ordre, icone, features) VALUES
('agent_ia_web', 'Agent IA Web', 'Chatbot IA 24/7 sur votre site web, répond aux questions clients', 'canaux_clients', 2500, '["socle"]'::jsonb, 10, 'Bot',
 '["Chat IA 24/7", "FAQ automatique", "Collecte leads", "Personnalisation ton"]'::jsonb),
('whatsapp', 'WhatsApp Business', 'Répondez automatiquement sur WhatsApp avec votre assistant IA', 'canaux_clients', 3500, '["socle", "agent_ia_web"]'::jsonb, 11, 'MessageCircle',
 '["WhatsApp Business API", "Réponses IA", "Templates messages", "Notifications"]'::jsonb),
('telephone', 'Téléphone IA', 'Réception des appels avec voix IA naturelle, prise de RDV vocale', 'canaux_clients', 4500, '["socle", "agent_ia_web"]'::jsonb, 12, 'Phone',
 '["Voix IA naturelle", "Prise RDV vocale", "Transfert appels", "Messagerie vocale"]'::jsonb);

-- OUTILS BUSINESS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, dependances, ordre, icone, features) VALUES
('reservations', 'Agenda & Réservations', 'Gestion complète des RDV, disponibilités, confirmations automatiques', 'outils_business', 2000, '["socle"]'::jsonb, 20, 'Calendar',
 '["Agenda en ligne", "Réservation web", "Confirmations SMS", "Rappels J-1", "Gestion annulations"]'::jsonb),
('site_vitrine', 'Site Web Pro', 'Site professionnel personnalisé avec votre marque et vos couleurs', 'outils_business', 1500, '["socle"]'::jsonb, 21, 'Globe',
 '["Site responsive", "Personnalisation marque", "SEO basique", "Formulaire contact"]'::jsonb),
('paiements', 'Paiements en ligne', 'Encaissez en ligne avec Stripe, gestion acomptes et remboursements', 'outils_business', 2900, '["socle"]'::jsonb, 22, 'CreditCard',
 '["Stripe intégré", "Acomptes", "Remboursements", "Historique paiements"]'::jsonb),
('ecommerce', 'E-commerce', 'Boutique en ligne complète, gestion stock et commandes', 'outils_business', 3900, '["socle", "paiements"]'::jsonb, 23, 'ShoppingBag',
 '["Catalogue produits", "Panier", "Gestion stock", "Suivi commandes"]'::jsonb);

-- MODULES MÉTIER
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, dependances, ordre, icone, features) VALUES
('module_metier_salon', 'Module Salon', 'Fonctionnalités spécifiques coiffure/beauté : fiches clients, produits', 'modules_metier', 1500, '["socle", "reservations"]'::jsonb, 30, 'Scissors',
 '["Fiches techniques clients", "Historique prestations", "Gestion produits salon"]'::jsonb),
('module_metier_resto', 'Module Restaurant', 'Fonctionnalités spécifiques restauration : tables, menus, réservations', 'modules_metier', 1500, '["socle", "reservations"]'::jsonb, 31, 'UtensilsCrossed',
 '["Plan de salle", "Gestion tables", "Menus digitaux", "Commandes en ligne"]'::jsonb),
('module_metier_medical', 'Module Médical', 'Fonctionnalités spécifiques santé : dossiers patients, ordonnances', 'modules_metier', 2500, '["socle", "reservations"]'::jsonb, 32, 'Stethoscope',
 '["Dossiers patients", "Historique médical", "Ordonnances", "Conformité RGPD santé"]'::jsonb);

-- MODULES AVANCÉS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, dependances, ordre, icone, features) VALUES
('rh_avance', 'RH & Planning', 'Gestion multi-employés, planning équipe, congés et absences', 'modules_avances', 3500, '["socle"]'::jsonb, 40, 'Users',
 '["Multi-employés", "Planning équipe", "Gestion congés", "Pointage", "Rapports RH"]'::jsonb),
('comptabilite', 'Comptabilité', 'Suivi dépenses, compte de résultat, exports comptables', 'modules_avances', 2500, '["socle"]'::jsonb, 41, 'Calculator',
 '["Suivi dépenses", "Catégorisation", "P&L mensuel", "Export CSV/PDF"]'::jsonb),
('marketing', 'Marketing Auto', 'Génération posts IA, campagnes promos, emails automatiques', 'modules_avances', 2900, '["socle"]'::jsonb, 42, 'Megaphone',
 '["Posts IA réseaux sociaux", "Campagnes email", "Promos automatiques", "Analytics"]'::jsonb),
('seo', 'SEO & Visibilité', 'Articles IA, optimisation mots-clés, Google My Business', 'modules_avances', 4000, '["socle", "site_vitrine"]'::jsonb, 43, 'Search',
 '["Articles IA", "Analyse mots-clés", "Google My Business", "Rapports SEO"]'::jsonb),
('sentinel_pro', 'SENTINEL Pro', 'Monitoring avancé plateforme, alertes temps réel, rapports performance', 'modules_avances', 2000, '["socle"]'::jsonb, 44, 'Shield',
 '["Monitoring 24/7", "Alertes temps réel", "Rapports performance", "Logs détaillés"]'::jsonb);

-- ────────────────────────────────────────────────────────────────────
-- COLONNE: modules_actifs dans tenants
-- ────────────────────────────────────────────────────────────────────

-- Ajouter colonne si elle n'existe pas
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS modules_actifs JSONB DEFAULT '{"socle": true}'::jsonb;

-- Mettre à jour Fat's Hair avec modules actuels
UPDATE tenants
SET modules_actifs = '{
  "socle": true,
  "agent_ia_web": true,
  "whatsapp": true,
  "telephone": true,
  "reservations": true,
  "site_vitrine": true,
  "paiements": true,
  "module_metier_salon": true
}'::jsonb,
updated_at = NOW()
WHERE id = 'fatshairafro';

-- Mettre à jour Deco Event avec modules de base
UPDATE tenants
SET modules_actifs = '{
  "socle": true,
  "agent_ia_web": true,
  "reservations": true,
  "site_vitrine": true
}'::jsonb,
updated_at = NOW()
WHERE id = 'decoevent';

-- ────────────────────────────────────────────────────────────────────
-- VÉRIFICATION
-- ────────────────────────────────────────────────────────────────────

-- Afficher modules par catégorie
SELECT
  categorie,
  COUNT(*) as nb_modules,
  SUM(prix_mensuel) as total_prix_centimes,
  ROUND(SUM(prix_mensuel) / 100.0, 2) as total_prix_euros
FROM modules_disponibles
GROUP BY categorie
ORDER BY categorie;

-- Afficher tenants avec leurs modules
SELECT
  id,
  name,
  modules_actifs,
  jsonb_object_keys(modules_actifs) as module_actif
FROM tenants
WHERE id IN ('fatshairafro', 'decoevent');
