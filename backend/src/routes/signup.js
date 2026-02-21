/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES SIGNUP - Tunnel inscription nouveaux clients NEXUS       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';

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

    // Transformer pour le frontend
    const formattedPlans = plans.map(plan => ({
      ...plan,
      prix_annuel: Math.round(plan.prix_mensuel * 10), // -17% annuel
      populaire: plan.id === 'pro',
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
 * POST /api/signup
 * Creer nouveau tenant + admin + abonnement
 */
router.post('/', async (req, res) => {
  const {
    // Entreprise
    company_name,
    secteur_id,

    // Admin
    email,
    password,
    prenom,
    nom,
    telephone,

    // Plan
    plan_id,
    periode // 'monthly' ou 'yearly'
  } = req.body;

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

    const essai_fin = new Date();
    essai_fin.setDate(essai_fin.getDate() + 14); // 14 jours

    // Construire modules actifs depuis les flags du plan
    const modules_actifs = [];
    if (plan.comptabilite) modules_actifs.push('comptabilite');
    if (plan.crm_avance) modules_actifs.push('crm');
    if (plan.marketing_automation) modules_actifs.push('marketing');
    if (plan.commercial) modules_actifs.push('commercial');
    if (plan.stock_inventaire) modules_actifs.push('stock');
    if (plan.analytics_avances) modules_actifs.push('analytics');
    if (plan.seo_visibilite) modules_actifs.push('seo');
    if (plan.rh_multiemployes) modules_actifs.push('rh');
    if (plan.api_integrations) modules_actifs.push('api');

    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        id: tenant_id,
        name: company_name,
        tier: plan_id, // Required field
        status: 'trial',
        domain: `${tenant_id}.nexus.app`,
        plan_id,
        plan: plan_id,
        secteur_id,
        modules_actifs,
        modules_metier_actifs: secteur.modules_metier || [],
        periode_facturation: periode || 'monthly',
        essai_fin: essai_fin.toISOString(),
        statut: 'essai'
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

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

    if (stripe && plan.stripe_price_id_monthly) {
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

        // Creer checkout session
        const priceId = periode === 'yearly'
          ? plan.stripe_price_id_yearly
          : plan.stripe_price_id_monthly;

        if (priceId) {
          const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
              price: priceId,
              quantity: 1
            }],
            subscription_data: {
              trial_period_days: 14,
              metadata: {
                tenant_id,
                plan_id,
                periode
              }
            },
            success_url: `${process.env.FRONTEND_URL || 'https://nexus.app'}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://nexus.app'}/signup?plan=${plan_id}`,
            metadata: {
              tenant_id,
              admin_email: email
            }
          });

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
    // 7. RETOURNER RESULTAT
    // ═══════════════════════════════════════════════════

    console.log(`[SIGNUP] Nouveau tenant cree: ${tenant_id} (${company_name}) - Plan: ${plan_id}`);

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
      essai_fin: essai_fin.toISOString(),
      checkout_url: checkoutUrl,
      dashboard_url: `https://${tenant_id}.nexus.app/admin`
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
 */
router.post('/check-email', async (req, res) => {
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
 */
router.post('/check-company', async (req, res) => {
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
      suggested_domain: `${tenant_id}.nexus.app`
    });
  } catch (err) {
    res.json({
      available: true,
      tenant_id,
      suggested_domain: `${tenant_id}.nexus.app`
    });
  }
});

export default router;
