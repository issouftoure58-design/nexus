/**
 * API Modules - Système modulaire dynamique NEXUS
 *
 * Principe: Chaque tenant active les modules dont il a besoin.
 * Pas de plans fixes, tarification à la carte.
 *
 * GET    /api/modules/available     - Liste tous les modules disponibles
 * GET    /api/modules/active        - Modules actifs du tenant
 * GET    /api/modules/pricing       - Calcul du coût mensuel
 * POST   /api/modules/:id/activate  - Activer un module
 * POST   /api/modules/:id/deactivate - Désactiver un module
 * POST   /api/modules/bulk          - Activation/désactivation en masse
 * GET    /api/modules/recommendations - Suggestions basées sur le métier
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { invalidateModuleCache } from '../middleware/moduleProtection.js';
import provisioningService from '../services/twilioProvisioningService.js';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════
// CONTRÔLE D'ACCÈS PAR PLAN - SÉCURITÉ CRITIQUE
// ════════════════════════════════════════════════════════════════════

/**
 * Mapping module -> plans autorisés
 * IMPORTANT: Synchronisé avec checkPlan.js et moduleProtection.js
 *
 * Grille tarifaire 2026:
 * - Starter (99€/mois): Fonctionnalités de base
 * - Pro (249€/mois): + WhatsApp, Téléphone, Marketing, Pipeline
 * - Business (499€/mois): + RH, SEO, API, SENTINEL
 */
const MODULE_PLAN_ACCESS = {
  // STARTER - Inclus dans tous les plans
  'socle': ['starter', 'pro', 'business'],
  'agent_ia_web': ['starter', 'pro', 'business'],
  'ia_reservation': ['starter', 'pro', 'business'],
  'site_vitrine': ['starter', 'pro', 'business'],
  'facturation': ['starter', 'pro', 'business'],

  // PRO - Nécessite plan Pro ou Business
  'whatsapp': ['pro', 'business'],
  'telephone': ['pro', 'business'],
  'standard_ia': ['pro', 'business'],
  'comptabilite': ['pro', 'business'],
  'crm_avance': ['pro', 'business'],
  'marketing': ['pro', 'business'],
  'pipeline': ['pro', 'business'],
  'stock': ['pro', 'business'],
  'analytics': ['pro', 'business'],
  'devis': ['pro', 'business'],

  // BUSINESS - Exclusivement Business
  'rh': ['business'],
  'seo': ['business'],
  'api': ['business'],
  'sentinel': ['business'],
  'whitelabel': ['business'],

  // MODULES MÉTIER - Addon payant, tous plans
  'restaurant': ['starter', 'pro', 'business'],
  'hotel': ['starter', 'pro', 'business'],
  'domicile': ['starter', 'pro', 'business'],
};

/**
 * Vérifie si un plan peut accéder à un module
 */
function canPlanAccessModule(planId, moduleId) {
  const allowedPlans = MODULE_PLAN_ACCESS[moduleId];
  if (!allowedPlans) {
    // Module non mappé = accessible à tous (backwards compatibility)
    console.warn(`[MODULES] ⚠️ Module ${moduleId} non mappé dans MODULE_PLAN_ACCESS`);
    return true;
  }
  return allowedPlans.includes(planId?.toLowerCase());
}

/**
 * Retourne le plan minimum requis pour un module
 */
function getMinimumPlanForModule(moduleId) {
  const allowedPlans = MODULE_PLAN_ACCESS[moduleId];
  if (!allowedPlans) return 'starter';
  if (allowedPlans.includes('starter')) return 'starter';
  if (allowedPlans.includes('pro')) return 'pro';
  return 'business';
}

/**
 * Crée une configuration IA par défaut pour un tenant
 * Appelé automatiquement lors de l'activation d'un module IA
 */
async function createDefaultIAConfig(tenantId, channel) {
  console.log(`[MODULES] 🤖 Création config IA ${channel} pour ${tenantId}`);

  const defaultConfigs = {
    telephone: {
      greeting_message: "Bonjour ! Je suis l'assistante virtuelle. Comment puis-je vous aider ?",
      voice_style: 'alloy', // OpenAI voice
      tone: 'professionnel',
      language: 'fr-FR',
      transfer_phone: '',
      max_duration_seconds: 300,
      business_hours: {
        enabled: false,
        message_outside_hours: "Nous sommes actuellement fermés. Veuillez rappeler pendant nos heures d'ouverture."
      },
      personality: 'Assistante professionnelle et chaleureuse',
      services_description: '',
      booking_enabled: true,
      active: true
    },
    whatsapp: {
      greeting_message: "Bonjour ! 👋 Comment puis-je vous aider ?",
      tone: 'professionnel',
      language: 'fr-FR',
      response_delay_ms: 1000,
      business_hours: {
        enabled: false,
        message_outside_hours: "Nous vous répondrons dès notre réouverture."
      },
      personality: 'Assistante chaleureuse et efficace',
      services_description: '',
      booking_enabled: true,
      send_images: true,
      send_location: true,
      quick_replies_enabled: true,
      quick_replies: ['Prendre RDV', 'Nos services', 'Horaires', 'Contact'],
      active: true
    },
    web: {
      greeting_message: "Bonjour ! Je suis l'assistant virtuel. Comment puis-je vous aider ?",
      tone: 'professionnel',
      language: 'fr-FR',
      personality: 'Assistant professionnel et amical',
      services_description: '',
      booking_enabled: true,
      show_typing_indicator: true,
      auto_open_delay_ms: 0, // 0 = ne pas ouvrir auto
      position: 'bottom-right',
      theme: 'light',
      active: true
    }
  };

  const config = defaultConfigs[channel];
  if (!config) {
    console.warn(`[MODULES] ⚠️ Pas de config par défaut pour canal ${channel}`);
    return;
  }

  // Vérifier si config existe déjà
  const { data: existing } = await supabase
    .from('tenant_ia_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .single();

  if (existing) {
    console.log(`[MODULES] Config IA ${channel} existe déjà pour ${tenantId}`);
    return;
  }

  // Créer la config
  const { error } = await supabase
    .from('tenant_ia_config')
    .insert({
      tenant_id: tenantId,
      channel: channel,
      config: config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(`[MODULES] Erreur création config IA:`, error.message);
    throw error;
  }

  console.log(`[MODULES] ✅ Config IA ${channel} créée pour ${tenantId}`);
}

// ════════════════════════════════════════════════════════════════════
// MODULES DISPONIBLES (hardcodé en attendant migration DB)
// ════════════════════════════════════════════════════════════════════

const MODULES_DISPONIBLES = [
  // SOCLE
  {
    id: 'socle',
    nom: 'Socle NEXUS',
    description: 'Dashboard admin, gestion clients, notifications SMS de base',
    categorie: 'base',
    prix_mensuel: 4900,
    requis: true,
    actif: true,
    ordre: 0,
    icone: 'Building2',
    dependances: [],
    features: ['Dashboard admin', 'Gestion clients', 'Notifications SMS', 'Support email']
  },
  // CANAUX CLIENTS
  {
    id: 'agent_ia_web',
    nom: 'Agent IA Web',
    description: 'Chatbot IA 24/7 sur votre site web',
    categorie: 'canaux_clients',
    prix_mensuel: 2500,
    actif: true,
    ordre: 10,
    icone: 'Bot',
    dependances: ['socle'],
    features: ['Chat IA 24/7', 'FAQ automatique', 'Collecte leads', 'Personnalisation ton']
  },
  {
    id: 'whatsapp',
    nom: 'WhatsApp Business',
    description: 'Répondez automatiquement sur WhatsApp avec votre assistant IA',
    categorie: 'canaux_clients',
    prix_mensuel: 3500,
    actif: true,
    ordre: 11,
    icone: 'MessageCircle',
    dependances: ['socle', 'agent_ia_web'],
    features: ['WhatsApp Business API', 'Réponses IA', 'Templates messages', 'Notifications']
  },
  {
    id: 'telephone',
    nom: 'Téléphone IA',
    description: 'Réception des appels avec voix IA naturelle',
    categorie: 'canaux_clients',
    prix_mensuel: 4500,
    actif: true,
    ordre: 12,
    icone: 'Phone',
    dependances: ['socle', 'agent_ia_web'],
    features: ['Voix IA naturelle', 'Prise RDV vocale', 'Transfert appels', 'Messagerie vocale']
  },
  {
    id: 'standard_ia',
    nom: 'Standard d\'accueil IA',
    description: 'Standard téléphonique intelligent : accueil, renseignements, transfert d\'appels',
    categorie: 'canaux_clients',
    prix_mensuel: 5500,
    actif: true,
    ordre: 13,
    icone: 'Headphones',
    dependances: ['socle', 'telephone'],
    features: ['Accueil personnalisé', 'Renseignements auto', 'Prise de messages', 'Transfert intelligent', 'Multi-lignes']
  },
  {
    id: 'ia_reservation',
    nom: 'IA Réservation Omnicanal',
    description: 'Prise de RDV automatique par téléphone, WhatsApp et web',
    categorie: 'canaux_clients',
    prix_mensuel: 3500,
    actif: true,
    ordre: 14,
    icone: 'CalendarCheck',
    dependances: ['socle', 'reservations', 'agent_ia_web'],
    features: ['RDV par téléphone', 'RDV par WhatsApp', 'RDV par chat web', 'Confirmation auto', 'Rappels IA']
  },
  // OUTILS BUSINESS
  {
    id: 'reservations',
    nom: 'Agenda & Réservations',
    description: 'Gestion complète des RDV, disponibilités, confirmations automatiques',
    categorie: 'outils_business',
    prix_mensuel: 2000,
    actif: true,
    ordre: 20,
    icone: 'Calendar',
    dependances: ['socle'],
    features: ['Agenda en ligne', 'Réservation web', 'Confirmations SMS', 'Rappels J-1']
  },
  {
    id: 'site_vitrine',
    nom: 'Site Web Pro',
    description: 'Site professionnel personnalisé avec votre marque',
    categorie: 'outils_business',
    prix_mensuel: 1500,
    actif: true,
    ordre: 21,
    icone: 'Globe',
    dependances: ['socle'],
    features: ['Site responsive', 'Personnalisation marque', 'SEO basique', 'Formulaire contact']
  },
  {
    id: 'paiements',
    nom: 'Paiements en ligne',
    description: 'Encaissez en ligne avec Stripe, gestion acomptes',
    categorie: 'outils_business',
    prix_mensuel: 2900,
    actif: true,
    ordre: 22,
    icone: 'CreditCard',
    dependances: ['socle'],
    features: ['Stripe intégré', 'Acomptes', 'Remboursements', 'Historique paiements']
  },
  {
    id: 'ecommerce',
    nom: 'E-commerce',
    description: 'Boutique en ligne complète, gestion stock et commandes',
    categorie: 'outils_business',
    prix_mensuel: 3900,
    actif: true,
    ordre: 23,
    icone: 'ShoppingBag',
    dependances: ['socle', 'paiements'],
    features: ['Catalogue produits', 'Panier', 'Gestion stock', 'Suivi commandes']
  },
  // MODULES MÉTIER
  {
    id: 'module_metier_salon',
    nom: 'Module Salon',
    description: 'Fonctionnalités spécifiques coiffure/beauté',
    categorie: 'modules_metier',
    prix_mensuel: 1500,
    actif: true,
    ordre: 30,
    icone: 'Scissors',
    dependances: ['socle', 'reservations'],
    features: ['Fiches techniques clients', 'Historique prestations', 'Gestion produits salon']
  },
  {
    id: 'module_metier_resto',
    nom: 'Module Restaurant',
    description: 'Fonctionnalités spécifiques restauration',
    categorie: 'modules_metier',
    prix_mensuel: 1500,
    actif: true,
    ordre: 31,
    icone: 'UtensilsCrossed',
    dependances: ['socle', 'reservations'],
    features: ['Plan de salle', 'Gestion tables', 'Menus digitaux', 'Commandes en ligne']
  },
  {
    id: 'module_metier_medical',
    nom: 'Module Médical',
    description: 'Fonctionnalités spécifiques santé',
    categorie: 'modules_metier',
    prix_mensuel: 2500,
    actif: true,
    ordre: 32,
    icone: 'Stethoscope',
    dependances: ['socle', 'reservations'],
    features: ['Dossiers patients', 'Historique médical', 'Ordonnances', 'Conformité RGPD santé']
  },
  // MODULES AVANCÉS
  {
    id: 'rh_avance',
    nom: 'RH & Planning',
    description: 'Gestion multi-employés, planning équipe, congés',
    categorie: 'modules_avances',
    prix_mensuel: 3500,
    actif: true,
    ordre: 40,
    icone: 'Users',
    dependances: ['socle'],
    features: ['Multi-employés', 'Planning équipe', 'Gestion congés', 'Pointage', 'Rapports RH']
  },
  {
    id: 'paie',
    nom: 'Paie & Salaires',
    description: 'Gestion des fiches de paie, calcul salaires, déclarations',
    categorie: 'modules_avances',
    prix_mensuel: 4500,
    actif: true,
    ordre: 41,
    icone: 'Banknote',
    dependances: ['socle', 'rh_avance'],
    features: ['Fiches de paie', 'Calcul salaires', 'Charges sociales', 'Export comptable', 'Déclarations']
  },
  {
    id: 'social_media',
    nom: 'Réseaux Sociaux',
    description: 'Génération de posts IA, planification, publication multi-plateformes',
    categorie: 'modules_avances',
    prix_mensuel: 2500,
    actif: true,
    ordre: 42,
    icone: 'Share2',
    dependances: ['socle'],
    features: ['Génération posts IA', 'Planification', 'Multi-plateformes', 'Analytics', 'Calendrier éditorial']
  },
  {
    id: 'assistant_ia',
    nom: 'Assistant Personnel IA',
    description: 'Assistant IA personnel pour gérer vos tâches, rappels, et organisation',
    categorie: 'modules_avances',
    prix_mensuel: 3000,
    actif: true,
    ordre: 43,
    icone: 'Sparkles',
    dependances: ['socle', 'agent_ia_web'],
    features: ['Gestion tâches', 'Rappels intelligents', 'Analyse données', 'Suggestions IA', 'Rapports auto']
  },
  {
    id: 'comptabilite',
    nom: 'Comptabilité',
    description: 'Suivi dépenses, compte de résultat, exports',
    categorie: 'modules_avances',
    prix_mensuel: 2500,
    actif: true,
    ordre: 41,
    icone: 'Calculator',
    dependances: ['socle'],
    features: ['Suivi dépenses', 'Catégorisation', 'P&L mensuel', 'Export CSV/PDF']
  },
  {
    id: 'marketing',
    nom: 'Marketing Auto',
    description: 'Génération posts IA, campagnes promos, emails',
    categorie: 'modules_avances',
    prix_mensuel: 2900,
    actif: true,
    ordre: 42,
    icone: 'Megaphone',
    dependances: ['socle'],
    features: ['Posts IA réseaux sociaux', 'Campagnes email', 'Promos automatiques', 'Analytics']
  },
  {
    id: 'seo',
    nom: 'SEO & Visibilité',
    description: 'Articles IA, optimisation mots-clés, Google My Business',
    categorie: 'modules_avances',
    prix_mensuel: 4000,
    actif: true,
    ordre: 43,
    icone: 'Search',
    dependances: ['socle', 'site_vitrine'],
    features: ['Articles IA', 'Analyse mots-clés', 'Google My Business', 'Rapports SEO']
  },
  {
    id: 'sentinel_pro',
    nom: 'SENTINEL Pro',
    description: 'Monitoring avancé, alertes temps réel, rapports',
    categorie: 'modules_avances',
    prix_mensuel: 2000,
    actif: true,
    ordre: 44,
    icone: 'Shield',
    dependances: ['socle'],
    features: ['Monitoring 24/7', 'Alertes temps réel', 'Rapports performance', 'Logs détaillés']
  }
];

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Vérifie les dépendances d'un module
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function checkDependencies(moduleId, modulesDispo, modulesActifs) {
  const module = modulesDispo.find(m => m.id === moduleId);
  if (!module) return { valid: false, missing: ['Module non trouvé'] };

  const deps = module.dependances || [];
  const missing = deps.filter(depId => !modulesActifs[depId]);

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Vérifie si d'autres modules dépendent de celui-ci
 * @returns {string[]} Liste des modules dépendants actifs
 */
function findDependentModules(moduleId, modulesDispo, modulesActifs) {
  return modulesDispo
    .filter(m => {
      const deps = m.dependances || [];
      return deps.includes(moduleId) && modulesActifs[m.id];
    })
    .map(m => m.id);
}

/**
 * Calcule le prix mensuel total
 */
function calculatePricing(modulesDispo, modulesActifs) {
  let total = 0;
  const details = [];

  modulesDispo.forEach(mod => {
    if (modulesActifs[mod.id]) {
      total += mod.prix_mensuel || 0;
      details.push({
        id: mod.id,
        nom: mod.nom,
        prix: mod.prix_mensuel
      });
    }
  });

  return {
    details,
    total_centimes: total,
    total_euros: (total / 100).toFixed(2)
  };
}

// ════════════════════════════════════════════════════════════════════
// LISTE DES MODULES DISPONIBLES
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/modules/available
 * Liste tous les modules avec leur statut pour ce tenant
 */
router.get('/available', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Utiliser les modules hardcodés
    const modules = MODULES_DISPONIBLES;

    // Récupérer modules actifs du tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const modulesActifs = tenant?.modules_actifs || { socle: true };

    // Enrichir chaque module avec son statut
    const modulesWithStatus = modules.map(mod => ({
      ...mod,
      est_actif: modulesActifs[mod.id] === true,
      peut_activer: checkDependencies(mod.id, modules, modulesActifs).valid || modulesActifs[mod.id],
      dependances_manquantes: checkDependencies(mod.id, modules, modulesActifs).missing,
      modules_dependants: findDependentModules(mod.id, modules, modulesActifs)
    }));

    // Grouper par catégorie
    const parCategorie = {};
    modulesWithStatus.forEach(mod => {
      if (!parCategorie[mod.categorie]) {
        parCategorie[mod.categorie] = [];
      }
      parCategorie[mod.categorie].push(mod);
    });

    res.json({
      success: true,
      modules: modulesWithStatus,
      par_categorie: parCategorie,
      categories: ['base', 'canaux_clients', 'outils_business', 'modules_metier', 'modules_avances']
    });
  } catch (error) {
    console.error('[MODULES] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// MODULES ACTIFS DU TENANT
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/modules/active
 * Retourne les modules actifs du tenant avec détails
 */
router.get('/active', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs, name')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const modulesActifs = tenant?.modules_actifs || { socle: true };
    const activeIds = Object.keys(modulesActifs).filter(k => modulesActifs[k]);

    // Filtrer les modules hardcodés
    const modulesDetails = MODULES_DISPONIBLES
      .filter(m => activeIds.includes(m.id))
      .sort((a, b) => a.ordre - b.ordre);

    // Calcul pricing
    const pricing = calculatePricing(modulesDetails, modulesActifs);

    res.json({
      success: true,
      tenant: tenant.name,
      modules_actifs: modulesActifs,
      modules: modulesDetails,
      count: modulesDetails.length,
      pricing
    });
  } catch (error) {
    console.error('[MODULES] Erreur actifs:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// PRICING
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/modules/pricing
 * Calcul détaillé du coût mensuel
 */
router.get('/pricing', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const modulesActifs = tenant?.modules_actifs || { socle: true };
    const activeIds = Object.keys(modulesActifs).filter(k => modulesActifs[k]);

    // Filtrer les modules hardcodés
    const modules = MODULES_DISPONIBLES.filter(m => activeIds.includes(m.id));

    const pricing = calculatePricing(modules, modulesActifs);

    res.json({
      success: true,
      ...pricing,
      devise: 'EUR'
    });
  } catch (error) {
    console.error('[MODULES] Erreur pricing:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// ACTIVATION MODULE
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/modules/:moduleId/activate
 * Activer un module pour le tenant
 */
router.post('/:moduleId/activate', authenticateAdmin, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = req.admin.tenant_id;

    console.log(`[MODULES] Activation ${moduleId} pour ${tenantId}`);

    // Vérifier que le module existe (hardcodé)
    const module = MODULES_DISPONIBLES.find(m => m.id === moduleId && m.actif);

    if (!module) {
      return res.status(404).json({
        error: 'Module non trouvé',
        code: 'MODULE_NOT_FOUND'
      });
    }

    // Récupérer tenant avec plan_id
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs, plan_id, plan')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const modulesActifs = tenant?.modules_actifs || { socle: true };
    const tenantPlan = tenant?.plan_id || tenant?.plan || 'starter';

    // ════════════════════════════════════════════════════════════════
    // VÉRIFICATION PLAN - SÉCURITÉ CRITIQUE
    // ════════════════════════════════════════════════════════════════
    if (!canPlanAccessModule(tenantPlan, moduleId)) {
      const requiredPlan = getMinimumPlanForModule(moduleId);
      const planPrices = { starter: 99, pro: 249, business: 499 };

      console.log(`[MODULES] ⛔ Accès refusé: ${moduleId} nécessite ${requiredPlan}, tenant a ${tenantPlan}`);

      return res.status(403).json({
        error: `Ce module nécessite le plan ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}`,
        code: 'PLAN_UPGRADE_REQUIRED',
        current_plan: tenantPlan,
        required_plan: requiredPlan,
        upgrade_price: planPrices[requiredPlan],
        upgrade_url: '/subscription'
      });
    }

    // Déjà actif ?
    if (modulesActifs[moduleId]) {
      return res.json({
        success: true,
        message: `${module.nom} est déjà actif`,
        already_active: true
      });
    }

    // Vérifier dépendances
    const depCheck = checkDependencies(moduleId, MODULES_DISPONIBLES, modulesActifs);
    if (!depCheck.valid) {
      return res.status(400).json({
        error: `Modules requis manquants: ${depCheck.missing.join(', ')}`,
        code: 'MISSING_DEPENDENCIES',
        missing: depCheck.missing
      });
    }

    // Activer le module
    const newModulesActifs = { ...modulesActifs, [moduleId]: true };

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        modules_actifs: newModulesActifs,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (updateError) throw updateError;

    // Invalider le cache
    invalidateModuleCache(tenantId);

    // ═══════════════════════════════════════════════════════════════
    // PROVISIONING AUTOMATIQUE pour modules télécom
    // ═══════════════════════════════════════════════════════════════
    let provisioningResult = null;

    if (moduleId === 'telephone' || moduleId === 'standard_ia') {
      // Auto-provisionner un numéro de téléphone
      try {
        console.log(`[MODULES] 📞 Auto-provisioning téléphone pour ${tenantId}...`);
        provisioningResult = await provisioningService.autoProvisionNumber(tenantId, 'FR');
        console.log(`[MODULES] ✅ Numéro attribué: ${provisioningResult.phoneNumber}`);
      } catch (provError) {
        console.error(`[MODULES] ⚠️ Erreur provisioning téléphone:`, provError.message);
        // On ne bloque pas l'activation, le numéro peut être attribué manuellement
        provisioningResult = { error: provError.message };
      }
    }

    if (moduleId === 'whatsapp') {
      // Configurer WhatsApp (utilise le sandbox en dev)
      try {
        console.log(`[MODULES] 💬 Configuration WhatsApp pour ${tenantId}...`);
        provisioningResult = await provisioningService.configureWhatsApp(tenantId);
        console.log(`[MODULES] ✅ WhatsApp configuré`);

        // Créer config IA WhatsApp par défaut
        await createDefaultIAConfig(tenantId, 'whatsapp');
      } catch (provError) {
        console.error(`[MODULES] ⚠️ Erreur config WhatsApp:`, provError.message);
        provisioningResult = { error: provError.message };
      }
    }

    // Créer config IA téléphone par défaut
    if (moduleId === 'telephone' || moduleId === 'standard_ia') {
      try {
        await createDefaultIAConfig(tenantId, 'telephone');
      } catch (e) {
        console.error(`[MODULES] ⚠️ Erreur création config IA téléphone:`, e.message);
      }
    }

    // Créer config IA web par défaut
    if (moduleId === 'agent_ia_web') {
      try {
        await createDefaultIAConfig(tenantId, 'web');
      } catch (e) {
        console.error(`[MODULES] ⚠️ Erreur création config IA web:`, e.message);
      }
    }

    // Logger l'action
    try {
      await supabase.from('historique_admin').insert({
        tenant_id: tenantId,
        admin_id: req.admin.id,
        action: 'module_activate',
        entite: 'module',
        details: {
          module_id: moduleId,
          module_nom: module.nom,
          prix: module.prix_mensuel,
          provisioning: provisioningResult
        }
      });
    } catch (e) { /* ignore */ }

    console.log(`[MODULES] ✅ ${moduleId} activé pour ${tenantId}`);

    res.json({
      success: true,
      message: `${module.nom} activé`,
      module: {
        id: module.id,
        nom: module.nom,
        prix_mensuel: module.prix_mensuel,
        features: module.features
      },
      provisioning: provisioningResult
    });
  } catch (error) {
    console.error('[MODULES] Erreur activation:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// DÉSACTIVATION MODULE
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/modules/:moduleId/deactivate
 * Désactiver un module
 */
router.post('/:moduleId/deactivate', authenticateAdmin, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = req.admin.tenant_id;

    console.log(`[MODULES] Désactivation ${moduleId} pour ${tenantId}`);

    // Module socle ne peut pas être désactivé
    if (moduleId === 'socle') {
      return res.status(400).json({
        error: 'Le module socle ne peut pas être désactivé',
        code: 'CANNOT_DEACTIVATE_CORE'
      });
    }

    // Récupérer module (hardcodé)
    const module = MODULES_DISPONIBLES.find(m => m.id === moduleId);

    if (!module) {
      return res.status(404).json({ error: 'Module non trouvé' });
    }

    // Vérifier si requis
    if (module.requis) {
      return res.status(400).json({
        error: 'Ce module est obligatoire et ne peut pas être désactivé',
        code: 'MODULE_REQUIRED'
      });
    }

    // Récupérer tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const modulesActifs = tenant?.modules_actifs || {};

    // Pas actif ?
    if (!modulesActifs[moduleId]) {
      return res.json({
        success: true,
        message: `${module.nom} n'était pas actif`,
        already_inactive: true
      });
    }

    // Vérifier si d'autres modules dépendent de celui-ci
    const dependants = findDependentModules(moduleId, MODULES_DISPONIBLES, modulesActifs);
    if (dependants.length > 0) {
      return res.status(400).json({
        error: `D'autres modules actifs dépendent de ${module.nom}`,
        code: 'HAS_DEPENDENT_MODULES',
        dependants
      });
    }

    // Désactiver
    const newModulesActifs = { ...modulesActifs };
    delete newModulesActifs[moduleId];

    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        modules_actifs: newModulesActifs,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (updateError) throw updateError;

    // Invalider cache
    invalidateModuleCache(tenantId);

    // Logger
    try {
      await supabase.from('historique_admin').insert({
        tenant_id: tenantId,
        admin_id: req.admin.id,
        action: 'module_deactivate',
        entite: 'module',
        details: { module_id: moduleId, module_nom: module.nom }
      });
    } catch (e) { /* ignore */ }

    console.log(`[MODULES] ✅ ${moduleId} désactivé pour ${tenantId}`);

    res.json({
      success: true,
      message: `${module.nom} désactivé`
    });
  } catch (error) {
    console.error('[MODULES] Erreur désactivation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// BULK UPDATE
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/modules/bulk
 * Activer/désactiver plusieurs modules en une fois
 * Body: { activate: ['mod1', 'mod2'], deactivate: ['mod3'] }
 */
router.post('/bulk', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { activate = [], deactivate = [] } = req.body;

    console.log(`[MODULES] Bulk update pour ${tenantId}:`, { activate, deactivate });

    // Récupérer tenant avec plan_id
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('modules_actifs, plan_id, plan')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    let modulesActifs = { ...tenant?.modules_actifs } || { socle: true };
    const tenantPlan = tenant?.plan_id || tenant?.plan || 'starter';

    const errors = [];
    const activated = [];
    const deactivated = [];

    // Traiter les activations
    for (const moduleId of activate) {
      const module = MODULES_DISPONIBLES.find(m => m.id === moduleId);
      if (!module) {
        errors.push({ moduleId, error: 'Module non trouvé' });
        continue;
      }

      // VÉRIFICATION PLAN - SÉCURITÉ CRITIQUE
      if (!canPlanAccessModule(tenantPlan, moduleId)) {
        const requiredPlan = getMinimumPlanForModule(moduleId);
        errors.push({
          moduleId,
          error: `Nécessite le plan ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}`,
          code: 'PLAN_UPGRADE_REQUIRED',
          required_plan: requiredPlan
        });
        continue;
      }

      const depCheck = checkDependencies(moduleId, MODULES_DISPONIBLES, modulesActifs);
      if (!depCheck.valid) {
        errors.push({ moduleId, error: `Dépendances manquantes: ${depCheck.missing.join(', ')}` });
        continue;
      }

      modulesActifs[moduleId] = true;
      activated.push(moduleId);
    }

    // Traiter les désactivations
    for (const moduleId of deactivate) {
      if (moduleId === 'socle') {
        errors.push({ moduleId, error: 'Module socle obligatoire' });
        continue;
      }

      const module = MODULES_DISPONIBLES.find(m => m.id === moduleId);
      if (module?.requis) {
        errors.push({ moduleId, error: 'Module obligatoire' });
        continue;
      }

      const dependants = findDependentModules(moduleId, MODULES_DISPONIBLES, modulesActifs);
      if (dependants.length > 0) {
        errors.push({ moduleId, error: `Dépendants actifs: ${dependants.join(', ')}` });
        continue;
      }

      delete modulesActifs[moduleId];
      deactivated.push(moduleId);
    }

    // Mettre à jour si changements
    if (activated.length > 0 || deactivated.length > 0) {
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          modules_actifs: modulesActifs,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (updateError) throw updateError;

      // Invalider cache
      invalidateModuleCache(tenantId);
    }

    // Calculer nouveau pricing
    const activeIds = Object.keys(modulesActifs).filter(k => modulesActifs[k]);
    const activeModules = MODULES_DISPONIBLES.filter(m => activeIds.includes(m.id));
    const pricing = calculatePricing(activeModules, modulesActifs);

    res.json({
      success: true,
      activated,
      deactivated,
      errors: errors.length > 0 ? errors : undefined,
      modules_actifs: modulesActifs,
      pricing
    });
  } catch (error) {
    console.error('[MODULES] Erreur bulk:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// RECOMMANDATIONS PAR MÉTIER
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/modules/recommendations?metier=restaurant
 * Suggestions de modules basées sur le type de métier
 */
router.get('/recommendations', authenticateAdmin, async (req, res) => {
  try {
    const { metier } = req.query;

    // Templates par métier
    const TEMPLATES = {
      restaurant: {
        nom: 'Restaurant / Café',
        modules: ['socle', 'agent_ia_web', 'reservations', 'module_metier_resto', 'site_vitrine'],
        description: 'Réservations en ligne, menu digital, assistant IA pour les clients'
      },
      salon: {
        nom: 'Salon de coiffure / Beauté',
        modules: ['socle', 'agent_ia_web', 'whatsapp', 'reservations', 'module_metier_salon', 'site_vitrine'],
        description: 'Prise de RDV, fiches clients, rappels automatiques'
      },
      medical: {
        nom: 'Cabinet médical',
        modules: ['socle', 'agent_ia_web', 'telephone', 'reservations', 'module_metier_medical'],
        description: 'Gestion patients, prise de RDV, dossiers médicaux'
      },
      ecommerce: {
        nom: 'E-commerce',
        modules: ['socle', 'agent_ia_web', 'whatsapp', 'ecommerce', 'paiements', 'marketing', 'seo'],
        description: 'Boutique en ligne, chatbot produits, marketing automatisé'
      },
      service: {
        nom: 'Prestataire de services',
        modules: ['socle', 'agent_ia_web', 'reservations', 'paiements', 'comptabilite'],
        description: 'Gestion RDV, devis, facturation'
      },
      formation: {
        nom: 'Formation / Coaching',
        modules: ['socle', 'agent_ia_web', 'reservations', 'paiements', 'site_vitrine'],
        description: 'Inscription sessions, paiements, site pro'
      }
    };

    // Si métier spécifique demandé
    if (metier && TEMPLATES[metier]) {
      const template = TEMPLATES[metier];

      // Filtrer modules hardcodés
      const modules = MODULES_DISPONIBLES
        .filter(m => template.modules.includes(m.id))
        .sort((a, b) => a.ordre - b.ordre);

      const totalPrix = modules.reduce((sum, m) => sum + (m.prix_mensuel || 0), 0);

      return res.json({
        success: true,
        metier,
        template: {
          ...template,
          modules_details: modules,
          prix_total_centimes: totalPrix,
          prix_total_euros: (totalPrix / 100).toFixed(2)
        }
      });
    }

    // Sinon, lister tous les templates
    res.json({
      success: true,
      templates: Object.entries(TEMPLATES).map(([id, t]) => ({
        id,
        nom: t.nom,
        description: t.description,
        modules_count: t.modules.length
      }))
    });
  } catch (error) {
    console.error('[MODULES] Erreur recommendations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// APPLIQUER UN TEMPLATE
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/modules/apply-template
 * Applique un template métier (active les modules recommandés)
 * Body: { metier: 'restaurant' }
 */
router.post('/apply-template', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { metier } = req.body;

    const TEMPLATES = {
      restaurant: ['socle', 'agent_ia_web', 'reservations', 'module_metier_resto', 'site_vitrine'],
      salon: ['socle', 'agent_ia_web', 'whatsapp', 'reservations', 'module_metier_salon', 'site_vitrine'],
      medical: ['socle', 'agent_ia_web', 'telephone', 'reservations', 'module_metier_medical'],
      ecommerce: ['socle', 'agent_ia_web', 'whatsapp', 'ecommerce', 'paiements', 'marketing', 'seo'],
      service: ['socle', 'agent_ia_web', 'reservations', 'paiements', 'comptabilite'],
      formation: ['socle', 'agent_ia_web', 'reservations', 'paiements', 'site_vitrine']
    };

    if (!metier || !TEMPLATES[metier]) {
      return res.status(400).json({
        error: 'Métier invalide',
        metiers_disponibles: Object.keys(TEMPLATES)
      });
    }

    const modulesList = TEMPLATES[metier];

    // Construire modules_actifs
    const modulesActifs = {};
    modulesList.forEach(m => modulesActifs[m] = true);

    // Mettre à jour tenant
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        modules_actifs: modulesActifs,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);

    if (updateError) throw updateError;

    // Invalider cache
    invalidateModuleCache(tenantId);

    // Filtrer modules hardcodés pour le pricing
    const modules = MODULES_DISPONIBLES.filter(m => modulesList.includes(m.id));

    const pricing = calculatePricing(modules, modulesActifs);

    console.log(`[MODULES] ✅ Template ${metier} appliqué pour ${tenantId}`);

    res.json({
      success: true,
      message: `Configuration ${metier} appliquée`,
      modules_actifs: modulesActifs,
      modules: modules,
      pricing
    });
  } catch (error) {
    console.error('[MODULES] Erreur apply-template:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// EXPORTS pour tests et autres modules
// ════════════════════════════════════════════════════════════════════
export {
  MODULE_PLAN_ACCESS,
  canPlanAccessModule,
  getMinimumPlanForModule,
  MODULES_DISPONIBLES
};

export default router;
