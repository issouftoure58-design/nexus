/**
 * Route publique CGV — Conditions Générales de Vente NEXUS
 * GET /api/cgv — retourne contenu + version courante
 */

import express from 'express';

const router = express.Router();

const CGV_VERSION = '1.0';

const CGV_CONTENT = {
  version: CGV_VERSION,
  updated_at: '2026-03-08',
  articles: [
    {
      numero: 1,
      titre: 'Objet',
      contenu: `Les présentes Conditions Générales de Vente (CGV) régissent l'utilisation de la plateforme NEXUS, éditée par NEXUS AI, SASU au capital de 1€, SIRET 947 570 362 00022, dont le siège social est situé 8 Rue des Monts Rouges, 95130 Franconville. NEXUS est une solution SaaS de gestion d'activité destinée aux professionnels (salons, restaurants, hôtels, services à domicile). En créant un compte, l'utilisateur accepte sans réserve les présentes CGV.`
    },
    {
      numero: 2,
      titre: 'Services proposés',
      contenu: `NEXUS propose une suite d'outils de gestion incluant : gestion de rendez-vous et réservations, CRM et fichier clients, facturation et comptabilité, marketing automatisé (email, SMS, campagnes), agents IA (web, téléphone, WhatsApp), gestion des stocks, RH et planning, SEO et visibilité en ligne, monitoring et analytics (SENTINEL). Les fonctionnalités disponibles dépendent du plan souscrit (Starter, Pro, Business).`
    },
    {
      numero: 3,
      titre: 'Tarifs et paiement',
      contenu: `Les tarifs sont exprimés en euros HT. Starter : 99€/mois ou 950€/an. Pro : 249€/mois ou 2 390€/an. Business : 499€/mois ou 4 790€/an. Le paiement s'effectue par carte bancaire via Stripe. La facturation est mensuelle ou annuelle selon le choix de l'utilisateur. En cas de non-paiement, le compte est suspendu après 3 échecs consécutifs. Un essai gratuit de 14 jours est proposé sans engagement.`
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
      contenu: `Pour toute question relative aux présentes CGV : Email : support@nexus-ai-saas.com. Site : https://nexus-ai-saas.com. Les présentes CGV sont consultables à tout moment sur la plateforme.`
    }
  ]
};

// GET /api/cgv — Retourne les CGV complètes
router.get('/', (req, res) => {
  res.json(CGV_CONTENT);
});

export default router;
