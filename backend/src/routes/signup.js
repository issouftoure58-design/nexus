/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES SIGNUP - Tunnel inscription nouveaux clients NEXUS       ║
 * ║                                                                   ║
 * ║   Auto-onboarding: création automatique des services, horaires,  ║
 * ║   et configuration agent selon le secteur choisi.                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { BUSINESS_TEMPLATES, TEMPLATE_TO_PROFILE, PROFESSION_TO_PROFILE } from '../data/businessTemplates.js';
import { getFeaturesForPlan } from '../config/planFeatures.js';
import { sendWelcomeEmail } from '../services/tenantEmailService.js';
import { applyReferralCode } from '../services/referralService.js';
import { signupLimiter, checkLimiter } from '../middleware/rateLimiter.js';
import {
  validateSiret,
  createPhoneVerification,
  verifyPhoneCode,
  consumePhoneToken,
} from '../services/signupVerificationService.js';
import { validatePasswordStrength } from '../sentinel/security/passwordPolicy.js';

const router = express.Router();

// Init Stripe si configure
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * GET /api/signup/plans
 * Liste des plans disponibles
 */
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select(`
        id, nom, description, prix_mensuel, ordre,
        clients_max, stockage_mb, posts_ia_mois, images_dalle_mois,
        utilisateurs_inclus, reservations_mois, commandes_mois,
        comptabilite, crm_avance, marketing_automation, commercial,
        stock_inventaire, analytics_avances, seo_visibilite, rh_multiemployes,
        api_integrations, white_label, sentinel_niveau, assistant_mode,
        support_email_heures, support_chat, support_telephone, account_manager
      `)
      .eq('actif', true)
      .order('ordre');

    if (error) throw error;

    // Transformer pour le frontend (modèle 2026 : Free / Basic / Business)
    const formattedPlans = plans.map(plan => ({
      ...plan,
      prix_annuel: Math.round(plan.prix_mensuel * 10), // -17% annuel
      populaire: plan.id === 'basic',
      features: [
        `${plan.clients_max} clients max`,
        `${plan.stockage_mb} MB stockage`,
        `${plan.posts_ia_mois} posts IA/mois`,
        plan.crm_avance && 'CRM avancé',
        plan.marketing_automation && 'Marketing automation',
        plan.analytics_avances && 'Analytics avancés',
      ].filter(Boolean)
    }));

    res.json({ success: true, plans: formattedPlans });
  } catch (err) {
    console.error('[SIGNUP] Erreur plans:', err);
    res.status(500).json({ error: 'Erreur chargement plans' });
  }
});

/**
 * GET /api/signup/secteurs
 * Liste des secteurs d'activite
 */
router.get('/secteurs', async (req, res) => {
  try {
    const { data: secteurs, error } = await supabase
      .from('secteurs')
      .select('id, nom, description, modules_metier, icon, ordre')
      .eq('actif', true)
      .order('ordre');

    if (error) throw error;

    res.json({ success: true, secteurs });
  } catch (err) {
    console.error('[SIGNUP] Erreur secteurs:', err);
    res.status(500).json({ error: 'Erreur chargement secteurs' });
  }
});

/**
 * GET /api/signup/structures-juridiques (alias: /business-types pour rétrocompatibilité)
 * Liste des structures juridiques disponibles (independent / company)
 * NOTE: Ne pas confondre avec les 6 types métier NEXUS (salon, restaurant, etc.)
 *       qui sont dans business_profile / GET /api/admin/profile
 */
router.get('/structures-juridiques', (req, res) => {
  const structures = [
    {
      id: 'independent',
      name: 'Indépendant / Auto-entrepreneur',
      description: 'Freelance, service à domicile, micro-entreprise',
      examples: ['Coiffeur à domicile', 'Coach sportif', 'Consultant', 'Artisan'],
      default_tax_status: 'franchise_tva',
      tax_info: 'Non assujetti à la TVA (franchise en base)',
    },
    {
      id: 'company',
      name: 'Entreprise / Société',
      description: 'Salon, restaurant, hôtel, commerce avec local',
      examples: ['Salon de coiffure', 'Restaurant', 'Hôtel', 'Boutique'],
      default_tax_status: 'assujetti_tva',
      tax_info: 'Assujetti à la TVA (20%)',
    },
  ];

  const taxStatuses = [
    {
      id: 'franchise_tva',
      name: 'Franchise en base de TVA',
      description: 'Non assujetti à la TVA - Prix affichés = prix nets',
      mention: 'TVA non applicable, art. 293 B du CGI',
    },
    {
      id: 'assujetti_tva',
      name: 'Assujetti à la TVA',
      description: 'Collecte et reverse la TVA - Prix affichés TTC',
      default_rate: 20.00,
    },
  ];

  res.json({ success: true, structures, taxStatuses });
});

// Alias rétrocompatibilité
router.get('/business-types', (req, res) => {
  // Redirige vers structures-juridiques
  const structures = [
    {
      id: 'independent',
      name: 'Indépendant / Auto-entrepreneur',
      description: 'Freelance, service à domicile, micro-entreprise',
      examples: ['Coiffeur à domicile', 'Coach sportif', 'Consultant', 'Artisan'],
      default_tax_status: 'franchise_tva',
      tax_info: 'Non assujetti à la TVA (franchise en base)',
    },
    {
      id: 'company',
      name: 'Entreprise / Société',
      description: 'Salon, restaurant, hôtel, commerce avec local',
      examples: ['Salon de coiffure', 'Restaurant', 'Hôtel', 'Boutique'],
      default_tax_status: 'assujetti_tva',
      tax_info: 'Assujetti à la TVA (20%)',
    },
  ];
  res.json({ success: true, businessTypes: structures, taxStatuses: [] });
});

// ════════════════════════════════════════════════════════════════════
// ANTI-ABUSE FREE TIER : verification SIRET + SMS
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/signup/validate-siret
 * Valide le format Luhn d'un SIRET, et optionnellement son existence INSEE.
 * Body : { siret: "12345678901234" }
 */
router.post('/validate-siret', checkLimiter, async (req, res) => {
  const { siret } = req.body;

  if (!siret) {
    return res.status(400).json({ error: 'SIRET requis' });
  }

  const result = await validateSiret(siret);

  if (!result.valid) {
    return res.status(400).json({ valid: false, error: result.error });
  }

  // Verifie aussi l'unicite (deja inscrit ?)
  const normalized = String(siret).replace(/\s/g, '');
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('siret', normalized)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({
      valid: false,
      error: 'Ce SIRET est deja associe a un compte NEXUS',
      code: 'SIRET_EXISTS',
    });
  }

  res.json({ valid: true, company: result.company || null });
});

/**
 * POST /api/signup/sms/send
 * Envoie un code SMS 6 chiffres au numero indique.
 * Rate limit : 5 envois/heure par IP, cooldown 60s par numero.
 * Body : { phone: "0612345678" }
 */
router.post('/sms/send', signupLimiter, async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Numero de telephone requis' });
  }

  // Verifie unicite avant d'envoyer un SMS
  const normalizedPhone = String(phone).replace(/[\s\-.()]/g, '');
  const { data: existingPhone } = await supabase
    .from('admin_users')
    .select('id')
    .eq('telephone', normalizedPhone)
    .limit(1)
    .maybeSingle();

  if (existingPhone) {
    return res.status(400).json({
      error: 'Ce numero est deja associe a un compte NEXUS',
      code: 'PHONE_EXISTS',
    });
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || null;
  const result = await createPhoneVerification(phone, ip);

  if (!result.success) {
    return res.status(result.code === 'RATE_LIMITED' ? 429 : 400).json({
      error: result.error,
      code: result.code,
    });
  }

  res.json({
    success: true,
    message: 'Code envoye par SMS',
    simulated: result.simulated || false,
  });
});

/**
 * POST /api/signup/sms/verify
 * Verifie le code SMS et retourne un verified_token a usage unique.
 * Body : { phone, code }
 */
router.post('/sms/verify', checkLimiter, async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Telephone et code requis' });
  }

  const result = await verifyPhoneCode(phone, code);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, verified_token: result.token });
});

/**
 * POST /api/signup
 * Creer nouveau tenant + admin + abonnement
 * 🔒 Rate limited: 3 inscriptions/heure par IP (anti-abus trial)
 * 🔒 Verification SMS obligatoire (verified_token requis)
 * 🔒 SIRET obligatoire pour structure_juridique='company'
 */
router.post('/', signupLimiter, async (req, res) => {
  const {
    // Entreprise
    company_name,
    secteur_id,

    // Structure juridique
    structure_juridique,  // 'independent' ou 'company'
    tax_status,     // 'franchise_tva' ou 'assujetti_tva'
    siret,          // Obligatoire pour 'company', optionnel pour 'independent'

    // Admin
    email,
    password,
    prenom,
    nom,
    telephone,

    // Verification SMS (anti-abuse Free tier)
    sms_verified_token,

    // Plan choisi par le client (utilisé UNIQUEMENT pour la checkout Stripe)
    plan_id: requested_plan_id,
    periode, // 'monthly' ou 'yearly'

    // Parrainage (optionnel)
    referral_code
  } = req.body;

  // 🔒 SECURITY: Tenant TOUJOURS créé en 'free'. Le plan payant ne s'active
  // qu'après paiement via webhook Stripe. Le requested_plan_id sert uniquement
  // à créer la checkout session avec le bon prix.
  const plan_id = 'free';
  const desired_plan = requested_plan_id || 'free';

  try {
    // ═══════════════════════════════════════════════════
    // 1. VALIDATION
    // ═══════════════════════════════════════════════════

    if (!company_name || !secteur_id || !email || !password || !plan_id) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        required: ['company_name', 'secteur_id', 'email', 'password', 'plan_id']
      });
    }

    // 🔒 SECURITY: Valider la complexité du mot de passe
    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({
        error: 'Mot de passe trop faible',
        code: 'WEAK_PASSWORD',
        details: pwdCheck.errors,
      });
    }

    // 🔒 Anti-abuse: telephone obligatoire + verifie par SMS
    if (!telephone) {
      return res.status(400).json({
        error: 'Numero de telephone requis',
        code: 'PHONE_REQUIRED',
      });
    }

    if (!sms_verified_token) {
      return res.status(400).json({
        error: 'Verification SMS requise. Demandez un code via /api/signup/sms/send.',
        code: 'SMS_VERIFICATION_REQUIRED',
      });
    }

    // Verifie le token SMS (et l'invalide)
    const tokenCheck = await consumePhoneToken(telephone, sms_verified_token);
    if (!tokenCheck.valid) {
      return res.status(400).json({
        error: tokenCheck.error,
        code: 'SMS_TOKEN_INVALID',
      });
    }

    // 🔒 SIRET obligatoire pour les societes (anti-abuse Free tier)
    if (structure_juridique === 'company' && !siret) {
      return res.status(400).json({
        error: 'SIRET obligatoire pour une societe',
        code: 'SIRET_REQUIRED',
      });
    }

    // 🔒 Validation Luhn + format si SIRET fourni
    if (siret) {
      const siretCheck = await validateSiret(siret);
      if (!siretCheck.valid) {
        return res.status(400).json({
          error: siretCheck.error,
          code: 'SIRET_INVALID',
        });
      }
    }

    // Verifier email unique
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingAdmin) {
      return res.status(400).json({
        error: 'Email deja utilise',
        code: 'EMAIL_EXISTS'
      });
    }

    // 🔒 Anti-fraude: vérifier téléphone unique (empêche multi-comptes trial)
    {
      const normalizedPhone = telephone.replace(/[\s\-.()]/g, '');
      const { data: existingPhone } = await supabase
        .from('admin_users')
        .select('id')
        .eq('telephone', normalizedPhone)
        .limit(1)
        .maybeSingle();

      if (existingPhone) {
        return res.status(400).json({
          error: 'Ce numéro de téléphone est déjà associé à un compte',
          code: 'PHONE_EXISTS'
        });
      }
    }

    // 🔒 Anti-fraude: vérifier SIRET unique (empêche multi-comptes trial)
    if (siret) {
      const normalizedSiret = siret.replace(/\s/g, '');
      const { data: existingSiret } = await supabase
        .from('tenants')
        .select('id')
        .eq('siret', normalizedSiret)
        .limit(1)
        .maybeSingle();

      if (existingSiret) {
        return res.status(400).json({
          error: 'Ce SIRET est déjà associé à un compte',
          code: 'SIRET_EXISTS'
        });
      }
    }

    // Recuperer plan
    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('actif', true)
      .single();

    if (!plan) {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    // Recuperer secteur
    const { data: secteur } = await supabase
      .from('secteurs')
      .select('*')
      .eq('id', secteur_id)
      .eq('actif', true)
      .single();

    if (!secteur) {
      return res.status(400).json({ error: 'Secteur invalide' });
    }

    // ═══════════════════════════════════════════════════
    // 2. CREER TENANT ID UNIQUE
    // ═══════════════════════════════════════════════════

    const slugify = (text) => {
      return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    let tenant_id = slugify(company_name);

    // Verifier unicite
    let suffix = 1;
    let isUnique = false;

    while (!isUnique) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenant_id)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        tenant_id = `${slugify(company_name)}-${suffix}`;
        suffix++;
      }
    }

    // ═══════════════════════════════════════════════════
    // 3. CREER TENANT
    // ═══════════════════════════════════════════════════

    // Tous les plans sont actifs immediatement
    // Free = gratuit a vie (avec quotas), Basic/Business = paiement immediat
    const isFree = plan_id === 'free';

    // Construire modules actifs depuis planFeatures.js (source unique de vérité)
    const modules_actifs = getFeaturesForPlan(plan_id);

    // Déterminer le statut TVA selon la structure juridique
    const effectiveStructure = structure_juridique || 'company';
    const effectiveTaxStatus = tax_status || (effectiveStructure === 'independent' ? 'franchise_tva' : 'assujetti_tva');

    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        id: tenant_id,
        name: company_name,
        tier: plan_id, // Required field
        status: 'active',
        domain: `${tenant_id}.nexus-ai-saas.com`,
        plan: plan_id,
        secteur_id,
        modules_actifs,
        modules_metier_actifs: secteur.modules_metier || [],
        periode_facturation: periode || 'monthly',
        statut: 'actif',
        // Structure juridique et fiscalité
        structure_juridique: effectiveStructure,
        tax_status: effectiveTaxStatus,
        tva_rate: effectiveTaxStatus === 'assujetti_tva' ? 20.00 : 0,
        siret: siret || null,
        // Contact info (source unique de vérité)
        email: email?.toLowerCase() || null,
        telephone: telephone || null,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Appliquer code parrainage si fourni (non bloquant)
    if (referral_code) {
      try {
        await applyReferralCode(tenant_id, referral_code);
      } catch (e) {
        // Non bloquant — le signup continue meme si le code est invalide
      }
    }

    // ═══════════════════════════════════════════════════
    // 4. CREER ADMIN USER
    // ═══════════════════════════════════════════════════

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = [prenom, nom].filter(Boolean).join(' ') || 'Admin';

    const { data: newAdmin, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        tenant_id,
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        nom: fullName,
        role: 'owner',
        actif: true
      })
      .select('id, email, nom, role')
      .single();

    if (adminError) throw adminError;

    // ═══════════════════════════════════════════════════
    // 5. CREER CUSTOMER STRIPE (si configure)
    // ═══════════════════════════════════════════════════

    let checkoutUrl = null;

    // Charger le plan choisi par le client pour la checkout Stripe
    let desiredPlan = null;
    if (desired_plan !== 'free') {
      const { data: dp } = await supabase.from('plans').select('*').eq('id', desired_plan).eq('actif', true).maybeSingle();
      desiredPlan = dp;
    }

    if (stripe && desiredPlan) {
      try {
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name: `${prenom || ''} ${nom || ''}`.trim() || company_name,
          metadata: {
            tenant_id,
            company_name
          }
        });

        // Mettre a jour tenant avec customer_id
        await supabase
          .from('tenants')
          .update({ stripe_customer_id: customer.id })
          .eq('id', tenant_id);

        // Creer checkout session avec le plan choisi
        const productCode = `nexus_${desired_plan}_${periode === 'yearly' ? 'yearly' : 'monthly'}`;
        const { data: stripeProduct } = await supabase
          .from('stripe_products')
          .select('stripe_price_id')
          .eq('product_code', productCode)
          .eq('active', true)
          .maybeSingle();

        if (stripeProduct?.stripe_price_id) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
          const checkoutParams = {
            customer: customer.id,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
              price: stripeProduct.stripe_price_id,
              quantity: 1
            }],
            subscription_data: {
              metadata: {
                tenant_id,
                plan_id: desired_plan,
                periode
              }
            },
            success_url: `${frontendUrl}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/signup?plan=${desired_plan}`,
            metadata: {
              tenant_id,
              admin_email: email
            }
          };

          const session = await stripe.checkout.sessions.create(checkoutParams);
          checkoutUrl = session.url;
        }
      } catch (stripeErr) {
        console.error('[SIGNUP] Stripe error:', stripeErr.message);
        // Continue sans Stripe
      }
    }

    // ═══════════════════════════════════════════════════
    // 6. CREER USAGE TRACKING INITIAL
    // ═══════════════════════════════════════════════════

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    // Construire limites depuis les colonnes du plan
    const limites_plan = {
      clients_max: plan.clients_max,
      stockage_mb: plan.stockage_mb,
      posts_ia_mois: plan.posts_ia_mois,
      images_dalle_mois: plan.images_dalle_mois,
      reservations_mois: plan.reservations_mois,
      commandes_mois: plan.commandes_mois
    };

    await supabase.from('usage_tracking').insert({
      tenant_id,
      mois: firstDayOfMonth.toISOString().split('T')[0],
      limites_plan
    });

    // ═══════════════════════════════════════════════════
    // 7. AUTO-ONBOARDING - Configuration automatique
    // ═══════════════════════════════════════════════════

    // Mapper secteur vers template
    const sectorTemplateMap = {
      'coiffure': 'salon_coiffure',
      'beaute': 'institut_beaute',
      'restauration': 'restaurant',
      'medical': 'medical',
      'automobile': 'garage',
      'commerce': 'commerce',
      'artisanat': 'artisan',
      'hotellerie': 'hotel',
      'autre': 'autre',
    };

    const templateKey = sectorTemplateMap[secteur_id] || 'autre';
    const template = BUSINESS_TEMPLATES[templateKey] || BUSINESS_TEMPLATES.autre;

    // Déterminer le template_id pour la DB (mapping vers business_templates table)
    const dbTemplateMap = {
      'salon_coiffure': 'salon',
      'coiffure_domicile': 'generic',
      'institut_beaute': 'salon',
      'restaurant': 'restaurant',
      'medical': 'generic',
      'garage': 'generic',
      'commerce': 'generic',
      'artisan': 'generic',
      'hotel': 'generic',
      'autre': 'generic',
    };
    const dbTemplateId = dbTemplateMap[templateKey] || 'generic';

    // Déterminer business_profile depuis le template
    const businessProfile = TEMPLATE_TO_PROFILE[templateKey] || 'service';

    // Mettre à jour tenant avec template_id + business_profile
    await supabase
      .from('tenants')
      .update({
        template_id: dbTemplateId,
        business_profile: businessProfile,
        assistant_name: 'l\'assistant',
        assistant_gender: 'F',
        onboarding_completed: false, // Sera marqué true après config complète
      })
      .eq('id', tenant_id);

    // Tracker les étapes d'onboarding
    const onboardingSteps = {
      services: { status: 'pending', count: 0 },
      hours: { status: 'pending', count: 0 },
      agent_config: { status: 'pending' },
      ia_config: { status: 'pending', count: 0 },
    };

    // 7a. CRÉER LES SERVICES PAR DÉFAUT
    // IMPORTANT :
    //  - la colonne canonique pour la catégorie est `categorie` (FR). On écrit
    //    aussi `category` (EN) pour rétro-compat avec d'anciennes lectures IA.
    //  - les prix dans les templates sont en EUROS, la colonne `services.prix`
    //    stocke des CENTIMES (convention alignée avec adminServices/adminAuth/tenants).
    if (template.defaultServices && template.defaultServices.length > 0) {
      const servicesToInsert = template.defaultServices.map((svc, index) => ({
        tenant_id,
        nom: svc.name,
        description: svc.description || '',
        duree: svc.duration,
        prix: Math.round((svc.price || 0) * 100), // euros → centimes
        categorie: svc.category || 'other',
        category: svc.category || 'other',
        actif: true,
        ordre: index + 1,
        // Colonnes specifiques metier (hotel/restaurant). Si absentes du template,
        // le undefined est ignore par Supabase → valeur par defaut DB.
        ...(svc.type_chambre ? { type_chambre: svc.type_chambre } : {}),
        ...(svc.capacite_max ? { capacite_max: svc.capacite_max } : {}),
        ...(svc.capacite ? { capacite: svc.capacite } : {}),
        ...(svc.zone ? { zone: svc.zone } : {}),
        ...(svc.facturation ? { facturation: svc.facturation } : {}),
      }));

      const { error: servicesError } = await supabase
        .from('services')
        .insert(servicesToInsert);

      if (servicesError) {
        console.warn('[SIGNUP] Erreur création services:', servicesError.message);
        onboardingSteps.services = { status: 'error', error: servicesError.message };
      } else {
        console.log(`[SIGNUP] ${servicesToInsert.length} services créés pour ${tenant_id}`);
        onboardingSteps.services = { status: 'ok', count: servicesToInsert.length };
      }
    }

    // 7b. CRÉER LES HORAIRES (business_hours)
    const dayMapping = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    if (template.defaultHours) {
      const hoursToInsert = [];

      for (const [dayName, hours] of Object.entries(template.defaultHours)) {
        const dayOfWeek = dayMapping[dayName];
        if (dayOfWeek !== undefined) {
          hoursToInsert.push({
            tenant_id,
            day_of_week: dayOfWeek,
            open_time: hours?.open || '09:00',
            close_time: hours?.close || '18:00',
            is_closed: hours === null,
          });
        }
      }

      if (hoursToInsert.length > 0) {
        const { error: hoursError } = await supabase
          .from('business_hours')
          .insert(hoursToInsert);

        if (hoursError) {
          console.warn('[SIGNUP] Erreur création horaires:', hoursError.message);
          onboardingSteps.hours = { status: 'error', error: hoursError.message };
        } else {
          console.log(`[SIGNUP] ${hoursToInsert.length} horaires créés pour ${tenant_id}`);
          onboardingSteps.hours = { status: 'ok', count: hoursToInsert.length };
        }
      }
    }

    // 7c. CRÉER TENANT_AGENT_CONFIG
    const { error: agentConfigError } = await supabase
      .from('tenant_agent_config')
      .insert({
        tenant_id,
        role_id: 'reservation', // Default: agent de réservation
        capabilities: [
          'check_availability',
          'create_booking',
          'get_services',
          'get_prices',
          'answer_faq',
          'take_message',
        ],
        autonomy: {
          can_book_appointments: true,
          can_cancel_appointments: false, // Requiert approbation humaine
          can_modify_appointments: false,
          can_take_payments: true,
          can_send_sms: true,
          can_transfer_calls: true,
          can_take_messages: true,
        },
        channels: {
          phone: { enabled: true },
          chat: { enabled: true },
          whatsapp: { enabled: true },
        },
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
      });

    if (agentConfigError) {
      console.warn('[SIGNUP] Erreur création agent config:', agentConfigError.message);
      onboardingSteps.agent_config = { status: 'error', error: agentConfigError.message };
    } else {
      console.log(`[SIGNUP] Agent config créé pour ${tenant_id}`);
      onboardingSteps.agent_config = { status: 'ok' };
    }

    // 7d. CRÉER TENANT_IA_CONFIG (configuration IA des canaux)
    if (template.iaConfig) {
      const iaConfigToInsert = [];

      for (const [channelKey, channelConfig] of Object.entries(template.iaConfig)) {
        const channel = channelKey.replace('channel_', ''); // channel_telephone → telephone
        iaConfigToInsert.push({
          tenant_id,
          channel,
          config: {
            greeting: channelConfig.greeting?.replace('{business_name}', company_name) || `Bienvenue chez ${company_name}`,
            personality: channelConfig.personality?.replace('{business_name}', company_name) || '',
            tone: channelConfig.tone || 'friendly_professional',
            can_book: channelConfig.canBook ?? true,
            can_quote: channelConfig.canQuote ?? true,
            can_transfer: channelConfig.canTransfer ?? false,
            quick_replies: channelConfig.quickReplies || [],
            transfer_keywords: channelConfig.transferKeywords || [],
            active: true,
          },
        });
      }

      if (iaConfigToInsert.length > 0) {
        const { error: iaError } = await supabase
          .from('tenant_ia_config')
          .insert(iaConfigToInsert);

        if (iaError) {
          console.warn('[SIGNUP] Erreur création IA config:', iaError.message);
          onboardingSteps.ia_config = { status: 'error', error: iaError.message };
        } else {
          console.log(`[SIGNUP] ${iaConfigToInsert.length} configs IA créées pour ${tenant_id}`);
          onboardingSteps.ia_config = { status: 'ok', count: iaConfigToInsert.length };
        }
      }
    }

    // Calculer si l'auto-onboarding a réussi (pour logs)
    const allStepsOk = Object.values(onboardingSteps).every(s => s.status === 'ok');
    const failedSteps = Object.entries(onboardingSteps)
      .filter(([, s]) => s.status === 'error')
      .map(([key]) => key);

    // Sauvegarder l'etat d'onboarding sur le tenant (diagnostic uniquement)
    // NOTE: onboarding_completed reste FALSE (deja mis a jour plus haut)
    // → user doit passer par /configuration a la 1ere connexion pour valider/personnaliser.
    // La table tenants n'a pas de colonne `onboarding_steps` → on stocke dans config.onboarding_steps (JSONB).
    try {
      const { data: existingCfg } = await supabase
        .from('tenants')
        .select('config')
        .eq('id', tenant_id)
        .single();
      const mergedConfig = {
        ...(existingCfg?.config || {}),
        onboarding_steps: onboardingSteps,
      };
      await supabase
        .from('tenants')
        .update({ onboarding_completed: false, config: mergedConfig })
        .eq('id', tenant_id);
    } catch (e) {
      console.warn('[SIGNUP] Merge config.onboarding_steps failed:', e.message);
    }

    if (failedSteps.length > 0) {
      console.warn(`[SIGNUP] ⚠️ Onboarding partiel pour ${tenant_id} — étapes en erreur: ${failedSteps.join(', ')}`);
    } else {
      console.log(`[SIGNUP] ✅ Auto-onboarding terminé pour ${tenant_id}`);
    }

    // ═══════════════════════════════════════════════════
    // 8. RETOURNER RESULTAT
    // ═══════════════════════════════════════════════════

    console.log(`[SIGNUP] Nouveau tenant cree: ${tenant_id} (${company_name}) - Plan: ${plan_id}`);

    // Envoyer l'email de bienvenue (async, ne bloque pas la réponse)
    sendWelcomeEmail(tenant_id).catch(err => {
      console.error('[SIGNUP] Erreur envoi email bienvenue:', err);
    });

    res.json({
      success: true,
      tenant_id,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        nom: newAdmin.nom
      },
      plan: {
        id: plan.id,
        nom: plan.nom
      },
      checkout_url: checkoutUrl,
      dashboard_url: `https://app.nexus-ai-saas.com/admin`,
      onboarding: {
        completed: allStepsOk,
        steps: onboardingSteps,
        failed_steps: failedSteps,
      }
    });

  } catch (err) {
    console.error('[SIGNUP] Erreur:', err);
    res.status(500).json({
      error: 'Erreur lors de la creation du compte',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * POST /api/signup/check-email
 * Verifier si un email est disponible
 * 🔒 Rate limited: 10/min par IP (anti-énumération)
 */
router.post('/check-email', checkLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requis' });
  }

  try {
    const { data: existing } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    res.json({
      available: !existing,
      email: email.toLowerCase()
    });
  } catch (err) {
    res.json({ available: true, email: email.toLowerCase() });
  }
});

/**
 * POST /api/signup/check-company
 * Verifier si un nom d'entreprise est disponible (genere tenant_id)
 * 🔒 Rate limited: 10/min par IP (anti-énumération)
 */
router.post('/check-company', checkLimiter, async (req, res) => {
  const { company_name } = req.body;

  if (!company_name) {
    return res.status(400).json({ error: 'Nom entreprise requis' });
  }

  const slugify = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const tenant_id = slugify(company_name);

  try {
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single();

    res.json({
      available: !existing,
      tenant_id,
      suggested_domain: `${tenant_id}.nexus-ai-saas.com`
    });
  } catch (err) {
    res.json({
      available: true,
      tenant_id,
      suggested_domain: `${tenant_id}.nexus-ai-saas.com`
    });
  }
});

export default router;
