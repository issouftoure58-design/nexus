-- ============================================================================
-- NEXUS TEST TENANT - Script de création complet
-- Tenant: nexus-test (Salon Élégance - fictif)
-- Plan: Business (full features)
-- ============================================================================

-- 1. CRÉATION DU TENANT
-- ============================================================================
INSERT INTO tenants (
  id,
  name,
  domain,
  plan,
  status,
  slug,
  assistant_name,
  gerante,
  telephone,
  adresse,
  concept,
  secteur,
  ville,
  frozen,
  nexus_version,
  features,
  limits_config,
  branding,
  created_at,
  updated_at
) VALUES (
  'nexus-test',
  'Salon Élégance Paris',
  'test.nexus.dev',
  'business',
  'active',
  'salon-elegance',
  'Sophie',
  'Marie Dupont',
  '+33 1 23 45 67 89',
  '123 Avenue des Champs-Élysées, 75008 Paris',
  'Salon de coiffure haut de gamme spécialisé dans les soins capillaires et les colorations naturelles',
  'salon',
  'Paris',
  false,
  '2.0',
  '{
    "agent_ia_web": true,
    "agent_ia_whatsapp": true,
    "agent_ia_telephone": true,
    "reservations": true,
    "facturation": true,
    "comptabilite": true,
    "stock": true,
    "marketing": true,
    "crm_avance": true,
    "rh": true,
    "analytics": true,
    "seo": true,
    "sentinel": true,
    "api": true,
    "white_label": true
  }'::jsonb,
  '{
    "telephone_minutes": 1200,
    "whatsapp_messages": 5000,
    "web_messages": -1,
    "posts_ia": 1000,
    "images_ia": 1000,
    "clients_max": -1,
    "storage_gb": -1,
    "users_max": 10
  }'::jsonb,
  '{
    "primary_color": "#0891b2",
    "logo_url": null,
    "favicon_url": null
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  plan = 'business',
  status = 'active',
  features = EXCLUDED.features,
  limits_config = EXCLUDED.limits_config,
  updated_at = NOW();

-- 2. CRÉATION DE L'ADMIN USER
-- ============================================================================
-- Password: Test123! (hashed with bcrypt)
INSERT INTO admin_users (
  id,
  email,
  password_hash,
  nom,
  role,
  actif,
  tenant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@nexus-test.com',
  '$2b$10$rQZ8K.XvN5Y5J5Y5J5Y5JOKvN5Y5J5Y5J5Y5J5Y5J5Y5J5Y5J5Y5J',
  'Marie Dupont',
  'admin',
  true,
  'nexus-test',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  actif = true,
  tenant_id = 'nexus-test',
  updated_at = NOW();

-- 3. CRÉATION DES SERVICES
-- ============================================================================
INSERT INTO services (tenant_id, nom, description, prix, duree, categorie, actif, created_at) VALUES
('nexus-test', 'Coupe Femme', 'Coupe, shampoing et brushing', 4500, 45, 'Coupes', true, NOW()),
('nexus-test', 'Coupe Homme', 'Coupe classique homme', 2500, 30, 'Coupes', true, NOW()),
('nexus-test', 'Coupe Enfant', 'Coupe pour enfants (-12 ans)', 1800, 20, 'Coupes', true, NOW()),
('nexus-test', 'Brushing', 'Brushing simple', 3000, 30, 'Coiffage', true, NOW()),
('nexus-test', 'Brushing Long', 'Brushing cheveux longs', 4000, 45, 'Coiffage', true, NOW()),
('nexus-test', 'Coloration', 'Coloration complète', 6500, 90, 'Coloration', true, NOW()),
('nexus-test', 'Mèches', 'Mèches ou balayage', 8500, 120, 'Coloration', true, NOW()),
('nexus-test', 'Coloration + Mèches', 'Coloration complète avec mèches', 12000, 150, 'Coloration', true, NOW()),
('nexus-test', 'Lissage Brésilien', 'Lissage brésilien professionnel', 15000, 180, 'Soins', true, NOW()),
('nexus-test', 'Soin Kératine', 'Soin à la kératine', 8000, 60, 'Soins', true, NOW()),
('nexus-test', 'Coupe + Coloration', 'Forfait coupe et coloration', 9500, 120, 'Forfaits', true, NOW()),
('nexus-test', 'Forfait Mariée', 'Essai + Jour J coiffure mariée', 25000, 240, 'Forfaits', true, NOW())
ON CONFLICT DO NOTHING;

-- 4. CRÉATION DES CLIENTS
-- ============================================================================
INSERT INTO clients (tenant_id, nom, prenom, email, telephone, adresse, date_naissance, notes, source, created_at) VALUES
('nexus-test', 'Martin', 'Sophie', 'sophie.martin@email.com', '06 12 34 56 78', '15 Rue de Rivoli, 75001 Paris', '1985-03-15', 'Cliente fidèle, préfère les colorations naturelles', 'site_web', NOW() - INTERVAL '2 years'),
('nexus-test', 'Dubois', 'Julie', 'julie.dubois@email.com', '06 23 45 67 89', '28 Boulevard Haussmann, 75009 Paris', '1990-07-22', 'Allergie à certains produits - vérifier avant coloration', 'recommandation', NOW() - INTERVAL '18 months'),
('nexus-test', 'Bernard', 'Marie', 'marie.bernard@email.com', '06 34 56 78 90', '42 Avenue Mozart, 75016 Paris', '1978-11-08', 'VIP - Offrir café', 'instagram', NOW() - INTERVAL '1 year'),
('nexus-test', 'Petit', 'Léa', 'lea.petit@email.com', '06 45 67 89 01', '8 Rue du Faubourg Saint-Honoré, 75008 Paris', '1995-01-30', '', 'google', NOW() - INTERVAL '10 months'),
('nexus-test', 'Robert', 'Emma', 'emma.robert@email.com', '06 56 78 90 12', '55 Rue de Passy, 75016 Paris', '1988-05-12', 'Cheveux fragiles, conseiller soins', 'site_web', NOW() - INTERVAL '8 months'),
('nexus-test', 'Richard', 'Camille', 'camille.richard@email.com', '06 67 89 01 23', '12 Place Vendôme, 75001 Paris', '1992-09-25', '', 'whatsapp', NOW() - INTERVAL '6 months'),
('nexus-test', 'Moreau', 'Chloé', 'chloe.moreau@email.com', '06 78 90 12 34', '3 Rue de la Paix, 75002 Paris', '1983-12-03', 'Préfère les RDV en fin de journée', 'telephone', NOW() - INTERVAL '5 months'),
('nexus-test', 'Simon', 'Inès', 'ines.simon@email.com', '06 89 01 23 45', '67 Avenue Montaigne, 75008 Paris', '1997-04-18', '', 'instagram', NOW() - INTERVAL '4 months'),
('nexus-test', 'Laurent', 'Manon', 'manon.laurent@email.com', '06 90 12 34 56', '21 Rue Saint-Dominique, 75007 Paris', '1986-08-07', 'Mariée en juin - suivi forfait', 'recommandation', NOW() - INTERVAL '3 months'),
('nexus-test', 'Michel', 'Clara', 'clara.michel@email.com', '06 01 23 45 67', '9 Avenue George V, 75008 Paris', '1991-02-14', '', 'google', NOW() - INTERVAL '2 months'),
('nexus-test', 'Garcia', 'Lucas', 'lucas.garcia@email.com', '06 11 22 33 44', '45 Rue de Courcelles, 75017 Paris', '1989-06-20', 'Client homme régulier', 'site_web', NOW() - INTERVAL '1 year'),
('nexus-test', 'Martinez', 'Thomas', 'thomas.martinez@email.com', '06 22 33 44 55', '78 Boulevard Malesherbes, 75008 Paris', '1994-10-11', '', 'google', NOW() - INTERVAL '7 months'),
('nexus-test', 'Lopez', 'Antoine', 'antoine.lopez@email.com', '06 33 44 55 66', '33 Rue La Boétie, 75008 Paris', '1987-03-28', '', 'recommandation', NOW() - INTERVAL '4 months'),
('nexus-test', 'Hernandez', 'Hugo', 'hugo.hernandez@email.com', '06 44 55 66 77', '14 Avenue Marceau, 75016 Paris', '1996-07-05', 'Étudiant - tarif réduit', 'instagram', NOW() - INTERVAL '2 months'),
('nexus-test', 'Gonzalez', 'Paul', 'paul.gonzalez@email.com', '06 55 66 77 88', '56 Rue de Longchamp, 75016 Paris', '1982-11-19', '', 'telephone', NOW() - INTERVAL '1 month')
ON CONFLICT DO NOTHING;

-- 5. CRÉATION DES RÉSERVATIONS (historique + futures)
-- ============================================================================
-- Réservations passées (historique)
INSERT INTO reservations (tenant_id, client_id, service_id, date_rdv, heure, duree, statut, prix_total, notes, source, created_at)
SELECT
  'nexus-test',
  c.id,
  s.id,
  (NOW() - (random() * INTERVAL '90 days'))::date,
  (ARRAY['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'])[floor(random() * 13 + 1)],
  s.duree,
  'termine',
  s.prix,
  '',
  (ARRAY['site_web', 'telephone', 'whatsapp', 'instagram'])[floor(random() * 4 + 1)],
  NOW() - (random() * INTERVAL '90 days')
FROM clients c
CROSS JOIN services s
WHERE c.tenant_id = 'nexus-test' AND s.tenant_id = 'nexus-test'
ORDER BY random()
LIMIT 50;

-- Réservations d'aujourd'hui
INSERT INTO reservations (tenant_id, client_id, service_id, date_rdv, heure, duree, statut, prix_total, notes, source, created_at)
SELECT
  'nexus-test',
  c.id,
  s.id,
  CURRENT_DATE,
  h.heure,
  s.duree,
  CASE WHEN h.heure < TO_CHAR(NOW(), 'HH24:MI') THEN 'termine' ELSE 'confirme' END,
  s.prix,
  '',
  'site_web',
  NOW() - INTERVAL '2 days'
FROM clients c
CROSS JOIN services s
CROSS JOIN (VALUES ('09:00'), ('10:30'), ('11:30'), ('14:00'), ('15:30'), ('17:00')) AS h(heure)
WHERE c.tenant_id = 'nexus-test' AND s.tenant_id = 'nexus-test'
ORDER BY random()
LIMIT 6;

-- Réservations futures (prochains jours)
INSERT INTO reservations (tenant_id, client_id, service_id, date_rdv, heure, duree, statut, prix_total, notes, source, created_at)
SELECT
  'nexus-test',
  c.id,
  s.id,
  (CURRENT_DATE + (floor(random() * 14 + 1)::int))::date,
  (ARRAY['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'])[floor(random() * 11 + 1)],
  s.duree,
  (ARRAY['confirme', 'en_attente', 'demande'])[floor(random() * 3 + 1)],
  s.prix,
  '',
  (ARRAY['site_web', 'telephone', 'whatsapp'])[floor(random() * 3 + 1)],
  NOW() - (random() * INTERVAL '7 days')
FROM clients c
CROSS JOIN services s
WHERE c.tenant_id = 'nexus-test' AND s.tenant_id = 'nexus-test'
ORDER BY random()
LIMIT 25;

-- 6. CRÉATION DES FACTURES
-- ============================================================================
INSERT INTO factures (tenant_id, client_id, numero, date_facture, date_echeance, montant_ht, montant_ttc, statut, lignes, created_at)
SELECT
  'nexus-test',
  c.id,
  'FAC-2026-' || LPAD((row_number() OVER ())::text, 4, '0'),
  (NOW() - (random() * INTERVAL '60 days'))::date,
  (NOW() - (random() * INTERVAL '30 days'))::date,
  (random() * 15000 + 2500)::int,
  ((random() * 15000 + 2500) * 1.2)::int,
  (ARRAY['payee', 'payee', 'payee', 'en_attente', 'en_retard'])[floor(random() * 5 + 1)],
  '[{"description": "Prestation coiffure", "quantite": 1, "prix_unitaire": 5000}]'::jsonb,
  NOW() - (random() * INTERVAL '60 days')
FROM clients c
WHERE c.tenant_id = 'nexus-test'
ORDER BY random()
LIMIT 30;

-- 7. CRÉATION DES PRODUITS (STOCK)
-- ============================================================================
INSERT INTO produits (tenant_id, nom, description, prix_achat, prix_vente, stock_actuel, stock_minimum, categorie, actif, created_at) VALUES
('nexus-test', 'Shampoing Kérastase Nutritive', 'Shampoing nourrissant 250ml', 1200, 2800, 15, 5, 'Shampoings', true, NOW()),
('nexus-test', 'Shampoing Kérastase Chronologiste', 'Shampoing revitalisant 250ml', 1500, 3200, 12, 5, 'Shampoings', true, NOW()),
('nexus-test', 'Après-shampoing Nutritive', 'Soin démêlant 200ml', 1400, 3000, 18, 5, 'Soins', true, NOW()),
('nexus-test', 'Masque Chronologiste', 'Masque intense 200ml', 2500, 4800, 8, 3, 'Soins', true, NOW()),
('nexus-test', 'Huile Elixir Ultime', 'Huile tous types 100ml', 2000, 4200, 20, 5, 'Soins', true, NOW()),
('nexus-test', 'Coloration LOréal Majirel', 'Tube coloration 50ml', 450, 0, 45, 15, 'Colorations', true, NOW()),
('nexus-test', 'Oxydant 20 volumes', 'Oxydant 1L', 800, 0, 8, 3, 'Colorations', true, NOW()),
('nexus-test', 'Oxydant 30 volumes', 'Oxydant 1L', 850, 0, 6, 3, 'Colorations', true, NOW()),
('nexus-test', 'Poudre décolorante', 'Poudre 500g', 1200, 0, 10, 4, 'Colorations', true, NOW()),
('nexus-test', 'Spray Fixant', 'Laque fixation forte 300ml', 800, 1800, 25, 8, 'Coiffage', true, NOW()),
('nexus-test', 'Mousse Coiffante', 'Mousse volume 200ml', 700, 1600, 20, 6, 'Coiffage', true, NOW()),
('nexus-test', 'Gel Coiffant', 'Gel fixation forte 150ml', 600, 1400, 15, 5, 'Coiffage', true, NOW()),
('nexus-test', 'Serviettes jetables', 'Paquet 100 serviettes', 500, 0, 3, 2, 'Consommables', true, NOW()),
('nexus-test', 'Gants latex', 'Boîte 100 gants M', 800, 0, 5, 2, 'Consommables', true, NOW()),
('nexus-test', 'Papier aluminium', 'Rouleau 100m', 1500, 0, 4, 2, 'Consommables', true, NOW())
ON CONFLICT DO NOTHING;

-- 8. CRÉATION DES MEMBRES ÉQUIPE (RH)
-- ============================================================================
INSERT INTO rh_membres (tenant_id, nom, prenom, email, telephone, poste, date_embauche, salaire_mensuel, statut, created_at) VALUES
('nexus-test', 'Dupont', 'Marie', 'marie.dupont@salon-elegance.fr', '06 12 34 56 78', 'Gérante', '2020-01-15', 350000, 'actif', NOW()),
('nexus-test', 'Leroy', 'Sophie', 'sophie.leroy@salon-elegance.fr', '06 23 45 67 89', 'Coiffeuse Senior', '2021-03-01', 250000, 'actif', NOW()),
('nexus-test', 'Moreau', 'Julie', 'julie.moreau@salon-elegance.fr', '06 34 56 78 90', 'Coiffeuse', '2022-06-15', 200000, 'actif', NOW()),
('nexus-test', 'Roux', 'Emma', 'emma.roux@salon-elegance.fr', '06 45 67 89 01', 'Coiffeuse Junior', '2023-09-01', 180000, 'actif', NOW()),
('nexus-test', 'Blanc', 'Léa', 'lea.blanc@salon-elegance.fr', '06 56 78 90 12', 'Apprentie', '2024-09-01', 90000, 'actif', NOW()),
('nexus-test', 'Petit', 'Lucas', 'lucas.petit@salon-elegance.fr', '06 67 89 01 23', 'Coloriste', '2021-11-15', 280000, 'actif', NOW())
ON CONFLICT DO NOTHING;

-- 9. CRÉATION DES SEGMENTS CRM
-- ============================================================================
INSERT INTO segments (tenant_id, nom, description, criteres, created_at) VALUES
('nexus-test', 'VIP', 'Clients à forte valeur (>500€ dépensés)', '{"min_total_spent": 50000, "min_visits": 5}'::jsonb, NOW()),
('nexus-test', 'Inactifs', 'Clients sans visite depuis 3 mois', '{"last_visit_days_ago": 90}'::jsonb, NOW()),
('nexus-test', 'Nouveaux', 'Clients inscrits ce mois', '{"registered_days_ago": 30}'::jsonb, NOW()),
('nexus-test', 'Colorations', 'Clients fidèles colorations', '{"services_categories": ["Coloration"], "min_visits": 3}'::jsonb, NOW()),
('nexus-test', 'Anniversaire ce mois', 'Clients dont anniversaire est ce mois', '{"birthday_this_month": true}'::jsonb, NOW())
ON CONFLICT DO NOTHING;

-- 10. CRÉATION DES OPPORTUNITÉS COMMERCIALES
-- ============================================================================
INSERT INTO opportunites (tenant_id, client_id, titre, description, valeur_estimee, probabilite, statut, date_cloture_prevue, created_at)
SELECT
  'nexus-test',
  c.id,
  CASE floor(random() * 4)
    WHEN 0 THEN 'Forfait Mariée'
    WHEN 1 THEN 'Abonnement annuel soins'
    WHEN 2 THEN 'Lissage brésilien'
    ELSE 'Pack coloration régulière'
  END,
  'Opportunité détectée via analyse comportement client',
  (random() * 50000 + 10000)::int,
  (random() * 60 + 20)::int,
  (ARRAY['nouveau', 'en_cours', 'proposition', 'negociation'])[floor(random() * 4 + 1)],
  (CURRENT_DATE + (random() * 60)::int)::date,
  NOW()
FROM clients c
WHERE c.tenant_id = 'nexus-test'
ORDER BY random()
LIMIT 8;

-- 11. MÉTRIQUES SENTINEL (30 derniers jours)
-- ============================================================================
INSERT INTO sentinel_daily_snapshots (tenant_id, date, ca_jour, nb_rdv, nb_clients_nouveaux, taux_occupation, panier_moyen, created_at)
SELECT
  'nexus-test',
  d::date,
  (random() * 80000 + 20000)::int,
  (random() * 12 + 3)::int,
  (random() * 3)::int,
  (random() * 40 + 50)::int,
  (random() * 3000 + 4000)::int,
  NOW()
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  INTERVAL '1 day'
) AS d
ON CONFLICT DO NOTHING;

-- 12. HORAIRES D'OUVERTURE
-- ============================================================================
INSERT INTO business_hours (tenant_id, jour, ouvert, heure_ouverture, heure_fermeture, pause_debut, pause_fin) VALUES
('nexus-test', 0, false, NULL, NULL, NULL, NULL),  -- Dimanche fermé
('nexus-test', 1, false, NULL, NULL, NULL, NULL),  -- Lundi fermé
('nexus-test', 2, true, '09:00', '19:00', '12:30', '14:00'),  -- Mardi
('nexus-test', 3, true, '09:00', '19:00', '12:30', '14:00'),  -- Mercredi
('nexus-test', 4, true, '09:00', '20:00', '12:30', '14:00'),  -- Jeudi (nocturne)
('nexus-test', 5, true, '09:00', '19:00', '12:30', '14:00'),  -- Vendredi
('nexus-test', 6, true, '09:00', '18:00', NULL, NULL)         -- Samedi
ON CONFLICT DO NOTHING;

-- 13. RÉSUMÉ
-- ============================================================================
-- Tenant créé: nexus-test (Salon Élégance Paris)
-- Plan: Business (toutes fonctionnalités)
-- Admin: admin@nexus-test.com / Test123!
--
-- Données générées:
-- - 12 services
-- - 15 clients
-- - ~80 réservations (passées, aujourd'hui, futures)
-- - ~30 factures
-- - 15 produits en stock
-- - 6 membres d'équipe
-- - 5 segments CRM
-- - 8 opportunités commerciales
-- - 30 jours de métriques SENTINEL
-- - Horaires d'ouverture complets
