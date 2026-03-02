-- Migration 051: Alignement prix table plans sur grille tarifaire definitive
-- Date: 2026-03-02
-- Description: Corrige la table plans pour correspondre a la grille validee (migration 041)
-- Prix definitifs: Starter 99€, Pro 249€, Business 499€

-- ════════════════════════════════════════════════════════════════════
-- CORRECTION PRIX MENSUELS
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET prix_mensuel = 9900 WHERE id = 'starter';
UPDATE plans SET prix_mensuel = 24900 WHERE id = 'pro';
UPDATE plans SET prix_mensuel = 49900 WHERE id = 'business';

-- ════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════

-- Verifier que les prix sont corrects
-- SELECT id, nom, prix_mensuel FROM plans ORDER BY ordre;
-- Attendu:
--   starter  | NEXUS Starter  | 9900   (99€)
--   pro      | NEXUS Pro      | 24900  (249€)
--   business | NEXUS Business | 49900  (499€)
