/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * Route publique CGV — Conditions Générales de Vente NEXUS
 * GET /api/cgv — retourne contenu + version courante
 */

import express from 'express';

const router = express.Router();

const CGV_VERSION = '1.2';

const CGV_CONTENT = {
  version: CGV_VERSION,
  updated_at: '2026-04-09',
  articles: [
    {
      numero: 1,
      titre: 'Objet',
      contenu: `Les présentes Conditions Générales de Vente (CGV) régissent l'utilisation de la plateforme NEXUS, éditée par NEXUS AI, SASU au capital de 1€, SIRET 947 570 362 00022, dont le siège social est situé 8 Rue des Monts Rouges, 95130 Franconville. NEXUS est une solution SaaS de gestion d'activité destinée aux professionnels (salons, restaurants, hôtels, services à domicile). En créant un compte, l'utilisateur accepte sans réserve les présentes CGV.`
    },
    {
      numero: 2,
      titre: 'Services proposés',
      contenu: `NEXUS propose une suite d'outils de gestion incluant : gestion de rendez-vous et réservations, CRM et fichier clients, facturation et comptabilité, marketing automatisé (email, SMS, campagnes), agents IA (web, téléphone, WhatsApp), gestion des stocks, RH et planning, SEO et visibilité en ligne, monitoring et analytics (SENTINEL). Les fonctionnalités disponibles dépendent du plan souscrit (Free, Basic, Business). Les fonctions IA sont accessibles via un système de crédits universels (pay-as-you-go).`
    },
    {
      numero: 3,
      titre: 'Tarifs et paiement',
      contenu: `Les tarifs sont exprimés en euros TTC. Free : 0€ (gratuit à vie, sans carte bancaire, quotas mensuels stricts). Basic : 29€/mois ou 290€/an (2 mois offerts en annuel), incluant 1 000 crédits IA chaque mois (valeur 15€). Business : 149€/mois ou 1 490€/an, incluant 10 000 crédits IA chaque mois (valeur 150€). Les fonctions IA consomment des crédits universels (1,5€ = 100 crédits, soit 0,015€/crédit). Pour aller au-delà des crédits inclus, un pack unique additionnel est disponible : Pack 1000 — 15€ pour 1 000 crédits (taux base, sans bonus). Le paiement s'effectue par carte bancaire via Stripe. La facturation est mensuelle ou annuelle selon le choix de l'utilisateur. En cas de non-paiement, le compte est suspendu après 3 échecs consécutifs. L'utilisateur peut démarrer gratuitement avec le plan Free, sans engagement ni carte bancaire.`
    },
    {
      numero: 4,
      titre: 'Durée et résiliation',
      contenu: `L'abonnement est conclu pour une durée indéterminée. L'utilisateur peut résilier à tout moment depuis son espace abonnement. La résiliation prend effet à la fin de la période en cours. Les données sont conservées 30 jours après résiliation, puis supprimées conformément au RGPD. NEXUS se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGV.`
    },
    {
      numero: 5,
      titre: 'Protection des données',
      contenu: `NEXUS s'engage à protéger les données personnelles conformément au RGPD (Règlement UE 2016/679). Les données sont hébergées en Europe (Supabase). Chaque tenant dispose d'un espace isolé (Tenant Shield). L'utilisateur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données via le module RGPD intégré. Les données ne sont jamais revendues à des tiers.`
    },
    {
      numero: 6,
      titre: 'Programme de fidélité',
      contenu: `NEXUS intègre un programme de fidélité configurable par l'administrateur. Règles par défaut : 1 point par euro dépensé, 50 points offerts à l'inscription, validité 2 ans. Les points peuvent être convertis en réductions selon le ratio défini par l'administrateur. NEXUS se réserve le droit de modifier les conditions du programme avec un préavis de 30 jours.`
    },
    {
      numero: 7,
      titre: 'Responsabilité',
      contenu: `NEXUS s'engage à assurer un taux de disponibilité de 99,5% hors maintenance programmée. En cas d'interruption de service, NEXUS ne saurait être tenu responsable des pertes d'exploitation. La responsabilité de NEXUS est limitée au montant de l'abonnement mensuel en cours. L'utilisateur est responsable de la confidentialité de ses identifiants et de l'utilisation faite de la plateforme.`
    },
    {
      numero: 8,
      titre: 'Litiges et droit applicable',
      contenu: `Les présentes CGV sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, les tribunaux de Paris seront seuls compétents. Conformément aux articles L.611-1 et R.612-1 du Code de la consommation, le client professionnel peut recourir au médiateur de la consommation.`
    },
    {
      numero: 9,
      titre: 'Contact',
      contenu: `Pour toute question relative aux présentes CGV : Email : contact@nexus-ai-saas.com. Site : https://nexus-ai-saas.com. Les présentes CGV sont consultables à tout moment sur la plateforme.`
    },
    {
      numero: 10,
      titre: 'Propriété Intellectuelle',
      contenu: `Le logiciel NEXUS, incluant son code source, son architecture technique, ses algorithmes, ses modèles d'intelligence artificielle, ses interfaces graphiques, ses bases de données, sa documentation et l'ensemble de ses composants, est la propriété exclusive de NEXUS AI, protégé par le Code de la propriété intellectuelle (articles L111-1 et suivants) et les conventions internationales relatives au droit d'auteur. L'abonnement confère au client un droit d'usage non-exclusif, non-transférable, révocable et limité à la durée de l'abonnement, dans le cadre strict de son activité professionnelle. Il est strictement interdit de : (a) copier, reproduire ou dupliquer tout ou partie du logiciel ; (b) modifier, adapter ou créer des œuvres dérivées ; (c) décompiler, désassembler ou procéder à de l'ingénierie inverse (reverse engineering) ; (d) sous-licencier, louer, prêter, revendre ou transférer l'accès au logiciel à un tiers ; (e) utiliser le logiciel pour développer un produit concurrent. Les données saisies par le client lui appartiennent et restent sa propriété. Le logiciel lui-même demeure la propriété exclusive de NEXUS AI. Toute violation du présent article entraîne la résiliation immédiate de l'abonnement, sans préavis ni remboursement, et expose le contrevenant à des poursuites judiciaires. La reproduction ou représentation non autorisée constitue une contrefaçon sanctionnée par les articles L335-2 et suivants du Code de la propriété intellectuelle (jusqu'à 3 ans d'emprisonnement et 300 000€ d'amende).`
    }
  ]
};

// GET /api/cgv — Retourne les CGV complètes
router.get('/', (req, res) => {
  res.json(CGV_CONTENT);
});

export default router;
