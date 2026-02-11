-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION 001: Création table modules_disponibles
-- Exécuter dans Supabase Dashboard > SQL Editor
-- Date: 2026-02-10
-- Mission: Jour 6 - Système Modules Activables
-- ════════════════════════════════════════════════════════════════════════════

-- 1. CRÉER LA TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS modules_disponibles (
  id VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50) NOT NULL,
  prix_mensuel INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  requis BOOLEAN DEFAULT false,
  dependances JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  ordre INTEGER DEFAULT 0,
  icone VARCHAR(50) DEFAULT 'Package',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CRÉER LES INDEX
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_modules_categorie ON modules_disponibles(categorie);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON modules_disponibles(actif);
CREATE INDEX IF NOT EXISTS idx_modules_ordre ON modules_disponibles(ordre);

-- 3. INSÉRER LES DONNÉES
-- ────────────────────────────────────────────────────────────────────────────

-- Vider les données existantes
TRUNCATE TABLE modules_disponibles;

-- SOCLE (obligatoire - 49€/mois)
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, requis, ordre, icone, features, dependances) VALUES
('socle', 'Socle NEXUS', 'Dashboard admin, gestion clients, notifications SMS de base', 'base', 4900, true, 0, 'Building2',
 '["Dashboard admin", "Gestion clients", "Notifications SMS", "Support email"]'::jsonb, '[]'::jsonb);

-- CANAUX CLIENTS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, ordre, icone, features, dependances) VALUES
('agent_ia_web', 'Agent IA Web', 'Chatbot IA 24/7 sur votre site web, répond aux questions clients', 'canaux_clients', 2500, 10, 'Bot',
 '["Chat IA 24/7", "FAQ automatique", "Collecte leads", "Personnalisation ton"]'::jsonb, '["socle"]'::jsonb),
('whatsapp', 'WhatsApp Business', 'Répondez automatiquement sur WhatsApp avec votre assistant IA', 'canaux_clients', 3500, 11, 'MessageCircle',
 '["WhatsApp Business API", "Réponses IA", "Templates messages", "Notifications"]'::jsonb, '["socle", "agent_ia_web"]'::jsonb),
('telephone', 'Téléphone IA', 'Réception des appels avec voix IA naturelle, prise de RDV vocale', 'canaux_clients', 4500, 12, 'Phone',
 '["Voix IA naturelle", "Prise RDV vocale", "Transfert appels", "Messagerie vocale"]'::jsonb, '["socle", "agent_ia_web"]'::jsonb);

-- OUTILS BUSINESS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, ordre, icone, features, dependances) VALUES
('reservations', 'Agenda & Réservations', 'Gestion complète des RDV, disponibilités, confirmations automatiques', 'outils_business', 2000, 20, 'Calendar',
 '["Agenda en ligne", "Réservation web", "Confirmations SMS", "Rappels J-1", "Gestion annulations"]'::jsonb, '["socle"]'::jsonb),
('site_vitrine', 'Site Web Pro', 'Site professionnel personnalisé avec votre marque et vos couleurs', 'outils_business', 1500, 21, 'Globe',
 '["Site responsive", "Personnalisation marque", "SEO basique", "Formulaire contact"]'::jsonb, '["socle"]'::jsonb),
('paiements', 'Paiements en ligne', 'Encaissez en ligne avec Stripe, gestion acomptes et remboursements', 'outils_business', 2900, 22, 'CreditCard',
 '["Stripe intégré", "Acomptes", "Remboursements", "Historique paiements"]'::jsonb, '["socle"]'::jsonb),
('ecommerce', 'E-commerce', 'Boutique en ligne complète, gestion stock et commandes', 'outils_business', 3900, 23, 'ShoppingBag',
 '["Catalogue produits", "Panier", "Gestion stock", "Suivi commandes"]'::jsonb, '["socle", "paiements"]'::jsonb);

-- MODULES MÉTIER
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, ordre, icone, features, dependances) VALUES
('module_metier_salon', 'Module Salon', 'Fonctionnalités spécifiques coiffure/beauté : fiches clients, produits', 'modules_metier', 1500, 30, 'Scissors',
 '["Fiches techniques clients", "Historique prestations", "Gestion produits salon"]'::jsonb, '["socle", "reservations"]'::jsonb),
('module_metier_resto', 'Module Restaurant', 'Fonctionnalités spécifiques restauration : tables, menus, réservations', 'modules_metier', 1500, 31, 'UtensilsCrossed',
 '["Plan de salle", "Gestion tables", "Menus digitaux", "Commandes en ligne"]'::jsonb, '["socle", "reservations"]'::jsonb),
('module_metier_medical', 'Module Médical', 'Fonctionnalités spécifiques santé : dossiers patients, ordonnances', 'modules_metier', 2500, 32, 'Stethoscope',
 '["Dossiers patients", "Historique médical", "Ordonnances", "Conformité RGPD santé"]'::jsonb, '["socle", "reservations"]'::jsonb);

-- MODULES AVANCÉS
INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, ordre, icone, features, dependances) VALUES
('rh_avance', 'RH & Planning', 'Gestion multi-employés, planning équipe, congés et absences', 'modules_avances', 3500, 40, 'Users',
 '["Multi-employés", "Planning équipe", "Gestion congés", "Pointage", "Rapports RH"]'::jsonb, '["socle"]'::jsonb),
('comptabilite', 'Comptabilité', 'Suivi dépenses, compte de résultat, exports comptables', 'modules_avances', 2500, 41, 'Calculator',
 '["Suivi dépenses", "Catégorisation", "P&L mensuel", "Export CSV/PDF"]'::jsonb, '["socle"]'::jsonb),
('marketing', 'Marketing Auto', 'Génération posts IA, campagnes promos, emails automatiques', 'modules_avances', 2900, 42, 'Megaphone',
 '["Posts IA réseaux sociaux", "Campagnes email", "Promos automatiques", "Analytics"]'::jsonb, '["socle"]'::jsonb),
('seo', 'SEO & Visibilité', 'Articles IA, optimisation mots-clés, Google My Business', 'modules_avances', 4000, 43, 'Search',
 '["Articles IA", "Analyse mots-clés", "Google My Business", "Rapports SEO"]'::jsonb, '["socle", "site_vitrine"]'::jsonb),
('sentinel_pro', 'SENTINEL Pro', 'Monitoring avancé plateforme, alertes temps réel, rapports performance', 'modules_avances', 2000, 44, 'Shield',
 '["Monitoring 24/7", "Alertes temps réel", "Rapports performance", "Logs détaillés"]'::jsonb, '["socle"]'::jsonb);

-- 4. VÉRIFICATION
-- ────────────────────────────────────────────────────────────────────────────

SELECT
  categorie,
  COUNT(*) as nb_modules,
  SUM(prix_mensuel) / 100.0 as prix_total_euros
FROM modules_disponibles
WHERE actif = true
GROUP BY categorie
ORDER BY
  CASE categorie
    WHEN 'base' THEN 0
    WHEN 'canaux_clients' THEN 1
    WHEN 'outils_business' THEN 2
    WHEN 'modules_metier' THEN 3
    WHEN 'modules_avances' THEN 4
  END;

-- Afficher tous les modules
SELECT id, nom, categorie, prix_mensuel / 100.0 as prix_euros, requis
FROM modules_disponibles
ORDER BY ordre;
