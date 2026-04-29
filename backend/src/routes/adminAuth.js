import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { verifyLogin, changePassword } from '../sentinel/security/accountService.js';
import { POLICY, validatePasswordStrength } from '../sentinel/security/passwordPolicy.js';
import { loginLimiter, signupLimiter } from '../middleware/rateLimiter.js';
import logger from '../config/logger.js';
import { totpService } from '../services/totpService.js';
import { getBusinessTemplate, TEMPLATE_TO_PROFILE, PROFESSION_TO_PROFILE, PROFESSIONS, generateIaConfig } from '../data/businessTemplates.js';
import { createSession, validateSession, listSessions, revokeSession, revokeAllSessions, hashToken } from '../services/sessionService.js';
import { getFeaturesForPlan } from '../config/planFeatures.js';
import { createCheckoutSession, isStripeConfigured } from '../services/stripeBillingService.js';
import {
  validateSiret,
  createPhoneVerification,
  verifyPhoneCode,
  consumePhoneToken,
} from '../services/signupVerificationService.js';

const router = express.Router();

// 🔒 C2: JWT Secret - DOIT être défini dans .env (AUCUN fallback)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('ERREUR CRITIQUE: JWT_SECRET non défini dans .env — Ajoutez JWT_SECRET à vos variables d\'environnement');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET;

// 🔒 G4: Rate limiting pour login (protection brute force)
const loginAttempts = new Map(); // IP -> { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
  // Skip rate limit for E2E/dev environments
  if (process.env.SKIP_RATE_LIMIT === 'true') {
    return { allowed: true };
  }

  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Reset si lockout expiré
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    const remainingMs = LOCKOUT_DURATION - (now - attempts.lastAttempt);
    const remainingMin = Math.ceil(remainingMs / 60000);
    return { allowed: false, remainingMin };
  }

  attempts.count++;
  attempts.lastAttempt = now;
  return { allowed: true };
}

function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

// POST /api/admin/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  // 🔒 Empêcher le cache (fix Chrome/Service Worker)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // 🔒 G4: Vérifier rate limit (in-memory, garde pour compatibilité)
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      logger.warn(`[AUTH] Rate limit dépassé pour IP: ${clientIp}`);
      return res.status(429).json({
        error: `Trop de tentatives. Réessayez dans ${rateCheck.remainingMin} minutes.`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // 🔒 SENTINEL: verifyLogin avec politique de sécurité
    const loginResult = await verifyLogin(email, password, req);

    if (!loginResult.success) {
      const status = loginResult.expired ? 403 : 401;
      return res.status(status).json({ error: loginResult.error });
    }

    // 🔒 Vérifier le statut du tenant (essai expiré, suspendu, annulé)
    {
      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('statut, essai_fin')
        .eq('id', loginResult.user.tenant_id)
        .single();

      if (tenantRow) {
        // Auto-expiration si essai dépassé
        if (tenantRow.statut === 'essai' && tenantRow.essai_fin && new Date(tenantRow.essai_fin) < new Date()) {
          await supabase
            .from('tenants')
            .update({ statut: 'expire', updated_at: new Date().toISOString() })
            .eq('id', loginResult.user.tenant_id);
          tenantRow.statut = 'expire';
        }

        if (tenantRow.statut === 'expire') {
          return res.status(403).json({
            error: 'Votre essai gratuit est terminé. Choisissez un plan pour continuer.',
            code: 'TRIAL_EXPIRED'
          });
        }
        if (tenantRow.statut === 'annule') {
          return res.status(403).json({
            error: 'Votre compte a été résilié.',
            code: 'ACCOUNT_CANCELLED'
          });
        }
        if (tenantRow.statut === 'suspendu') {
          return res.status(403).json({
            error: 'Abonnement suspendu suite à un échec de paiement. Mettez à jour votre moyen de paiement.',
            code: 'SUBSCRIPTION_SUSPENDED'
          });
        }
      }
    }

    // 🔒 2FA: Vérifier si TOTP activé avant de délivrer le JWT
    const { data: adminUser2fa } = await supabase
      .from('admin_users')
      .select('totp_enabled')
      .eq('id', loginResult.user.id)
      .eq('tenant_id', loginResult.user.tenant_id)
      .single();

    if (adminUser2fa?.totp_enabled) {
      // Générer un token temporaire (5 min, non utilisable comme auth)
      const tempToken = jwt.sign(
        { id: loginResult.user.id, tenant_id: loginResult.user.tenant_id, pending_2fa: true },
        EFFECTIVE_JWT_SECRET,
        { expiresIn: '5m' }
      );
      resetRateLimit(clientIp);
      return res.json({ requires_2fa: true, temp_token: tempToken });
    }

    // Générer JWT (🔒 M4: durée réduite à 24h pour admin)
    const token = jwt.sign(
      {
        id: loginResult.user.id,
        email: loginResult.user.email,
        role: loginResult.user.role,
        tenant_id: loginResult.user.tenant_id,  // Multi-tenant
        tenant_slug: loginResult.user.tenant_id  // Alias pour compatibilite
      },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 🔒 G4: Reset rate limit après login réussi
    resetRateLimit(clientIp);

    // Créer la session en DB (await pour éviter race condition avec validateSession)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      await createSession({
        adminId: loginResult.user.id,
        tenantId: loginResult.user.tenant_id,
        token,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt,
      });
    } catch (err) {
      logger.error('[Session] Erreur création:', { error: err.message });
    }

    // Logger l'action
    try {
      await supabase.from('historique_admin').insert({
        admin_id: loginResult.user.id,
        tenant_id: loginResult.user.tenant_id,
        action: 'login',
        entite: 'admin',
        details: { ip: req.ip }
      });
    } catch (_) { /* non-blocking */ }

    const response = {
      token,
      admin: {
        id: loginResult.user.id,
        email: loginResult.user.email,
        nom: loginResult.user.nom,
        role: loginResult.user.role,
      },
    };

    // Signaler si changement de mot de passe requis
    if (loginResult.mustChangePassword) {
      response.mustChangePassword = true;
      response.message = loginResult.message;
    }
    if (loginResult.passwordExpired) {
      response.passwordExpired = true;
      response.message = loginResult.message;
    }

    res.json(response);

  } catch (error) {
    logger.error('[ADMIN AUTH] Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/auth/logout
router.post('/logout', async (req, res) => {
  // 🔒 Empêcher le cache (fix Chrome/Service Worker)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Révoquer la session serveur si token présent
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
        if (decoded.id && decoded.tenant_id) {
          const tokenHash = hashToken(token);
          // Chercher et révoquer la session par hash du token
          const { data: sessions } = await supabase
            .from('admin_sessions')
            .select('id')
            .eq('admin_id', decoded.id)
            .eq('tenant_id', decoded.tenant_id)
            .eq('token_hash', tokenHash)
            .eq('revoked', false)
            .limit(1);

          if (sessions?.length > 0) {
            await revokeSession(sessions[0].id, decoded.id, decoded.tenant_id);
          }
        }
      } catch (_) { /* Token invalide/expiré — ignorer */ }
      // Invalider le cache auth
      invalidateAuthCache(token);
    }

    res.json({ message: 'Déconnecté avec succès' });
  } catch (error) {
    logger.error('[AUTH] Erreur logout:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/auth/change-password
router.post('/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    }

    const result = await changePassword(req.admin.id, currentPassword, newPassword, req.admin.tenant_id);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        details: result.details,
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('[ADMIN AUTH] Erreur change-password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/auth/password-policy
router.get('/password-policy', (req, res) => {
  res.json({
    policy: {
      minLength: POLICY.minLength,
      requireUppercase: POLICY.requireUppercase,
      requireLowercase: POLICY.requireLowercase,
      requireNumbers: POLICY.requireNumbers,
      requireSymbols: POLICY.requireSymbols,
      maxAge: POLICY.maxAge,
      historyCount: POLICY.historyCount,
      provisionalExpiry: POLICY.provisionalExpiry,
    },
  });
});

// POST /api/admin/auth/unlock-account (débloquer un compte)
router.post('/unlock-account', authenticateAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifier que l'admin a les droits (même tenant)
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, tenant_id, locked_until')
      .eq('email', email)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Seul un admin du même tenant ou super_admin peut débloquer
    if (req.admin.role !== 'super_admin' && req.admin.tenant_id !== targetUser.tenant_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Débloquer le compte
    const { error } = await supabase
      .from('admin_users')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', targetUser.id)
      .eq('tenant_id', targetUser.tenant_id);

    if (error) throw error;

    logger.info(`[AUTH] Compte débloqué: ${email}`);
    res.json({ success: true, message: `Compte ${email} débloqué` });
  } catch (error) {
    logger.error('[ADMIN AUTH] Erreur unlock-account:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// ANTI-ABUSE SIGNUP : SIRET + verification SMS
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/auth/signup/validate-siret
 * Body : { siret }
 */
router.post('/signup/validate-siret', async (req, res) => {
  const { siret } = req.body;
  if (!siret) return res.status(400).json({ error: 'SIRET requis' });

  const result = await validateSiret(siret);
  if (!result.valid) {
    return res.status(400).json({ valid: false, error: result.error });
  }

  // Verifie l'unicite (deja inscrit ?)
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
 * POST /api/admin/auth/signup/sms/send
 * Body : { phone }
 */
router.post('/signup/sms/send', signupLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Numero de telephone requis' });

  // Verifie unicite avant d'envoyer un SMS (sur tenants ET admin_users)
  const normalizedPhone = String(phone).replace(/[\s\-.()]/g, '');

  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('telephone', normalizedPhone)
    .neq('statut', 'annule')
    .limit(1)
    .maybeSingle();

  if (existingTenant) {
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
 * POST /api/admin/auth/signup/sms/verify
 * Body : { phone, code }
 */
router.post('/signup/sms/verify', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Telephone et code requis' });

  const result = await verifyPhoneCode(phone, code);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, verified_token: result.token });
});

// POST /api/admin/auth/signup (créer un compte)
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const {
      entreprise, nom, email: rawEmail, telephone, password, accept_cgv,
      template_type, profession_id, adresse, siret, sms_verified_token,
    } = req.body;

    // 🔒 SECURITY: Always force plan to 'free' — never trust client-supplied plan.
    // Prevents plan spoofing where a malicious client could send plan='business'
    // to get premium features for free. Upgrades happen only via Stripe checkout.
    const plan = 'free';

    // Normaliser l'email en minuscules (évite les doublons par casse)
    const email = rawEmail?.trim().toLowerCase();

    // Validation
    if (!entreprise || !nom || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    // CGV acceptance obligatoire
    if (!accept_cgv) {
      return res.status(400).json({ error: 'Vous devez accepter les Conditions Générales de Vente' });
    }

    // Valider le mot de passe
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Mot de passe trop faible',
        details: passwordValidation.errors
      });
    }

    // 🔒 Anti-abuse Free tier : telephone obligatoire et verifie SMS
    if (!telephone) {
      return res.status(400).json({
        error: 'Numero de telephone requis',
        code: 'PHONE_REQUIRED',
      });
    }

    if (!sms_verified_token) {
      return res.status(400).json({
        error: 'Verification SMS requise. Demandez un code via /api/admin/auth/signup/sms/send.',
        code: 'SMS_VERIFICATION_REQUIRED',
      });
    }

    const tokenCheck = await consumePhoneToken(telephone, sms_verified_token);
    if (!tokenCheck.valid) {
      return res.status(400).json({
        error: tokenCheck.error,
        code: 'SMS_TOKEN_INVALID',
      });
    }

    // 🔒 Validation Luhn du SIRET (optionnel, mais format strict si fourni)
    if (siret) {
      const siretCheck = await validateSiret(siret);
      if (!siretCheck.valid) {
        return res.status(400).json({
          error: siretCheck.error,
          code: 'SIRET_INVALID',
        });
      }

      // Anti-fraude : SIRET unique
      const normalizedSiret = String(siret).replace(/\s/g, '');
      const { data: existingSiret } = await supabase
        .from('tenants')
        .select('id')
        .eq('siret', normalizedSiret)
        .limit(1)
        .maybeSingle();

      if (existingSiret) {
        return res.status(400).json({
          error: 'Ce SIRET est deja associe a un compte NEXUS',
          code: 'SIRET_EXISTS',
        });
      }
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà' });
    }

    // 🔒 Anti-abus: vérifier unicité du téléphone
    if (telephone) {
      const formattedPhone = telephone.replace(/\s+/g, '').trim();
      const { data: existingTenantByPhone } = await supabase
        .from('tenants')
        .select('id')
        .eq('telephone', formattedPhone)
        .neq('statut', 'annule')
        .limit(1)
        .maybeSingle();

      if (existingTenantByPhone) {
        return res.status(400).json({ error: 'Un compte existe déjà avec ce numéro de téléphone' });
      }
    }

    // Créer le slug du tenant
    const slug = entreprise
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    // Vérifier si le slug existe
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    const finalSlug = existingTenant ? `${slug}-${Date.now()}` : slug;

    // Déterminer le template et business_profile
    // Priorité : profession_id → template_type → fallback 'service'
    const effectiveTemplate = template_type || 'autre';
    const businessProfile = (profession_id && PROFESSION_TO_PROFILE[profession_id])
      || TEMPLATE_TO_PROFILE[effectiveTemplate]
      || 'service';

    // Description auto depuis la profession choisie (pour que l'IA connaisse l'activité)
    const professionInfo = profession_id ? PROFESSIONS.find(p => p.id === profession_id) : null;
    const autoDescription = professionInfo ? `${professionInfo.label} — ${professionInfo.description}` : '';

    // ═══ Modèle 2026 (révision finale 9 avril 2026) : tous les nouveaux comptes démarrent en Free (gratuit à vie) ═══
    // Le client doit upgrader vers Basic (29€, 1 000 crédits IA inclus) ou Business (149€, 10 000 crédits IA inclus) pour débloquer l'IA et les modules avancés
    const modulesActifs = getFeaturesForPlan('free');

    // Créer le tenant avec template + business_profile + modules
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        id: finalSlug,
        name: entreprise,
        slug: finalSlug,
        plan: plan,
        status: 'active',
        statut: 'actif',
        essai_fin: null,
        template_id: effectiveTemplate,
        business_profile: businessProfile,
        description: autoDescription || null,
        onboarding_step: 0,
        onboarding_completed: false,
        modules_actifs: modulesActifs,
        email: email || null,
        ...(telephone ? { telephone: telephone.replace(/\s+/g, '').trim() } : {}),
        ...(adresse ? { adresse } : {}),
        ...(profession_id ? { profession_id } : {}),
        ...(siret ? { siret: String(siret).replace(/\s/g, '') } : {}),
        settings: {
          timezone: 'Europe/Paris',
          currency: 'EUR',
          locale: 'fr-FR'
        }
      })
      .select()
      .single();

    if (tenantError) {
      logger.error('[SIGNUP] Erreur création tenant:', tenantError);
      throw new Error(`Erreur création tenant: ${tenantError.message || tenantError.code || 'inconnu'}`);
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'admin user
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .insert({
        email,
        password_hash: hashedPassword,
        nom,
        role: 'admin',
        tenant_id: tenant.id,
        password_changed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError) {
      // Rollback: supprimer le tenant créé
      await supabase.from('tenants').delete().eq('id', tenant.id);
      logger.error('[SIGNUP] Erreur création admin:', userError);
      throw new Error(`Erreur création admin: ${userError.message || userError.code || 'inconnu'}`);
    }

    // ═══ Auto-provisionner depuis le template ═══
    try {
      const template = getBusinessTemplate(effectiveTemplate);

      // 1. Créer les services par défaut
      if (template.defaultServices?.length > 0) {
        const servicesRows = template.defaultServices.map((s, i) => ({
          tenant_id: finalSlug,
          nom: s.name,
          duree: s.duration,
          prix: Math.round(s.price * 100), // centimes
          categorie: s.category || 'general',
          actif: true,
          ordre: i,
        }));
        const { error: svcErr } = await supabase.from('services').insert(servicesRows);
        if (svcErr) logger.warn('[SIGNUP] Services insert error:', svcErr.message);
      }

      // 2. Créer les business_hours (multi-period si restaurant/médical/garage)
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      if (template.defaultHours) {
        const hoursRows = [];
        for (const [dayName, hours] of Object.entries(template.defaultHours)) {
          const dayNum = dayMap[dayName];
          if (dayNum === undefined) continue;

          if (!hours) {
            // Fermé
            hoursRows.push({
              tenant_id: finalSlug,
              day_of_week: dayNum,
              open_time: null,
              close_time: null,
              is_closed: true,
              period_label: 'journee',
              sort_order: 0,
            });
          } else if (Array.isArray(hours)) {
            // Multi-period (restaurant midi/soir, médical matin/après-midi)
            hours.forEach((period, idx) => {
              hoursRows.push({
                tenant_id: finalSlug,
                day_of_week: dayNum,
                open_time: period.open,
                close_time: period.close,
                is_closed: false,
                period_label: period.label || (idx === 0 ? 'midi' : 'soir'),
                sort_order: idx,
              });
            });
          } else {
            // Single period
            hoursRows.push({
              tenant_id: finalSlug,
              day_of_week: dayNum,
              open_time: hours.open,
              close_time: hours.close,
              is_closed: false,
              period_label: 'journee',
              sort_order: 0,
            });
          }
        }
        if (hoursRows.length > 0) {
          await supabase.from('business_hours').insert(hoursRows);
        }
      }

      // 3. Créer la config IA par canal
      const iaConfigs = generateIaConfig(effectiveTemplate, entreprise, nom);
      const iaConfigRows = Object.entries(iaConfigs).map(([channel, config]) => ({
        tenant_id: finalSlug,
        canal: channel.replace('channel_', ''),
        config: config,
      }));
      if (iaConfigRows.length > 0) {
        await supabase.from('tenant_ia_config').upsert(iaConfigRows, { onConflict: 'tenant_id,canal' }).catch(() => {
          // Table peut ne pas exister, non-bloquant
          logger.warn('[SIGNUP] tenant_ia_config insert skipped (table may not exist)');
        });
      }

      logger.info(`[SIGNUP] Template provisionné: ${effectiveTemplate} → ${template.defaultServices?.length || 0} services, horaires, IA config`);
    } catch (provisionError) {
      // Non-bloquant: le compte est créé même si le provisioning partiel échoue
      logger.warn('[SIGNUP] Provisioning partiel:', provisionError.message, provisionError.stack);
    }

    // ═══ Auto-login: générer JWT + créer session ═══
    const tokenPayload = {
      id: adminUser.id,
      email: adminUser.email,
      nom: adminUser.nom,
      role: adminUser.role,
      tenant_id: tenant.id,
      tenant_slug: finalSlug,
    };
    const token = jwt.sign(tokenPayload, EFFECTIVE_JWT_SECRET, { expiresIn: '24h' });

    // Créer session DB
    try {
      await createSession({
        adminId: adminUser.id,
        tenantId: tenant.id,
        token,
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (sessionError) {
      logger.warn('[SIGNUP] Session creation failed (non-blocking):', sessionError.message);
    }

    // ═══ Stripe Checkout pour plans payants ═══
    // Le tenant est créé en free (sécurité). Le plan ne passe en payant
    // qu'après confirmation du paiement via webhook Stripe.
    const desired_plan = req.body.plan || 'free';
    let checkoutUrl = null;

    if (desired_plan !== 'free' && isStripeConfigured()) {
      try {
        const productCode = `nexus_${desired_plan}_monthly`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const result = await createCheckoutSession(
          tenant.id,
          productCode,
          `${frontendUrl}/subscription?checkout=success`,
          `${frontendUrl}/signup?plan=${desired_plan}`
        );
        checkoutUrl = result.url;
        logger.info(`[SIGNUP] Checkout Stripe créée pour ${tenant.id} (plan: ${desired_plan})`);
      } catch (stripeErr) {
        logger.error('[SIGNUP] Stripe checkout error (non-blocking):', stripeErr.message);
        // Continue sans Stripe — le tenant est en free, il pourra upgrader plus tard
      }
    }

    logger.info(`[SIGNUP] Nouveau compte créé + auto-login: ${email} (tenant: ${finalSlug}, plan: ${plan}, template: ${effectiveTemplate})`);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      token,
      tenant_id: tenant.id,
      template_type: effectiveTemplate,
      admin: { id: adminUser.id, email: adminUser.email, nom: adminUser.nom },
      plan: plan,
      tenant: {
        id: tenant.id,
        slug: finalSlug,
        plan: plan
      },
      ...(checkoutUrl ? { checkout_url: checkoutUrl } : {}),
    });

  } catch (error) {
    logger.error('[SIGNUP] Erreur:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la création du compte' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2FA TOTP ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/auth/2fa/setup — Générer secret TOTP + backup codes
router.post('/2fa/setup', authenticateAdmin, async (req, res) => {
  try {
    const secret = totpService.generateSecret();
    const backupCodes = totpService.generateBackupCodes();
    const otpAuthUrl = totpService.generateOtpAuthUrl(req.admin.email, secret);

    // Chiffrer et stocker (sans activer)
    const { error } = await supabase
      .from('admin_users')
      .update({
        totp_secret: totpService.encryptSecret(secret),
        totp_backup_codes: totpService.encryptSecret(JSON.stringify(backupCodes)),
        totp_enabled: false,
      })
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    logger.info(`[2FA] Setup initié pour admin ${req.admin.id}`);
    res.json({ secret, otpAuthUrl, backupCodes });
  } catch (error) {
    logger.error('[2FA] Erreur setup:', error);
    res.status(500).json({ error: 'Erreur lors de la configuration 2FA' });
  }
});

// POST /api/admin/auth/2fa/verify — Vérifier code TOTP et activer 2FA
router.post('/2fa/verify', authenticateAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Code à 6 chiffres requis' });
    }

    // Lire le secret chiffré
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('totp_secret')
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!adminUser?.totp_secret) {
      return res.status(400).json({ error: 'Aucun setup 2FA en cours. Appelez /2fa/setup d\'abord.' });
    }

    const secret = totpService.decryptSecret(adminUser.totp_secret);
    if (!totpService.verifyTOTP(secret, code)) {
      return res.status(400).json({ error: 'Code invalide' });
    }

    // Activer 2FA
    const { error } = await supabase
      .from('admin_users')
      .update({
        totp_enabled: true,
        totp_verified_at: new Date().toISOString(),
      })
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    logger.info(`[2FA] Activé pour admin ${req.admin.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[2FA] Erreur verify:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification 2FA' });
  }
});

// POST /api/admin/auth/2fa/validate — Valider code TOTP au login (utilise temp_token)
router.post('/2fa/validate', loginLimiter, async (req, res) => {
  try {
    const { temp_token, code } = req.body;
    if (!temp_token || !code) {
      return res.status(400).json({ error: 'Token temporaire et code requis' });
    }

    // Décoder le temp_token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, EFFECTIVE_JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token temporaire expiré ou invalide' });
    }

    if (!decoded.pending_2fa) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Lire l'admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, tenant_id, totp_secret, totp_backup_codes, totp_enabled')
      .eq('id', decoded.id)
      .eq('tenant_id', decoded.tenant_id)
      .single();

    if (!adminUser || !adminUser.totp_enabled) {
      return res.status(401).json({ error: '2FA non activé' });
    }

    const secret = totpService.decryptSecret(adminUser.totp_secret);
    let backupCodeUsed = false;

    // Vérifier code TOTP
    if (!totpService.verifyTOTP(secret, code)) {
      // Vérifier si c'est un backup code
      const backupCodes = JSON.parse(totpService.decryptSecret(adminUser.totp_backup_codes));
      const backupIndex = backupCodes.indexOf(code.toUpperCase());

      if (backupIndex === -1) {
        return res.status(401).json({ error: 'Code invalide' });
      }

      // Consommer le backup code
      backupCodes.splice(backupIndex, 1);
      await supabase
        .from('admin_users')
        .update({ totp_backup_codes: totpService.encryptSecret(JSON.stringify(backupCodes)) })
        .eq('id', adminUser.id)
        .eq('tenant_id', adminUser.tenant_id);

      backupCodeUsed = true;
      logger.info(`[2FA] Backup code utilisé par admin ${adminUser.id} (${backupCodes.length} restants)`);
    }

    // Générer le vrai JWT 24h
    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        tenant_id: adminUser.tenant_id,
        tenant_slug: adminUser.tenant_id,
      },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Créer la session en DB
    const expiresAt2FA = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    createSession({
      adminId: adminUser.id,
      tenantId: adminUser.tenant_id,
      token,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: expiresAt2FA,
    }).catch(err => logger.error('[Session] Erreur création 2FA:', { error: err.message }));

    // Logger
    try {
      await supabase.from('historique_admin').insert({
        admin_id: adminUser.id,
        tenant_id: adminUser.tenant_id,
        action: 'login_2fa',
        entite: 'admin',
        details: { ip: req.ip, backup_code_used: backupCodeUsed },
      });
    } catch (_) { /* non-blocking */ }

    logger.info(`[2FA] Login 2FA réussi pour admin ${adminUser.id}`);
    res.json({
      token,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        nom: adminUser.nom,
        role: adminUser.role,
      },
    });
  } catch (error) {
    logger.error('[2FA] Erreur validate:', error);
    res.status(500).json({ error: 'Erreur lors de la validation 2FA' });
  }
});

// POST /api/admin/auth/2fa/disable — Désactiver 2FA (requiert mot de passe)
router.post('/2fa/disable', authenticateAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    // Vérifier le mot de passe
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('password')
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!adminUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const passwordValid = await bcrypt.compare(password, adminUser.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Désactiver 2FA
    const { error } = await supabase
      .from('admin_users')
      .update({
        totp_enabled: false,
        totp_secret: null,
        totp_backup_codes: null,
        totp_verified_at: null,
      })
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    logger.info(`[2FA] Désactivé pour admin ${req.admin.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[2FA] Erreur disable:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation 2FA' });
  }
});

// GET /api/admin/auth/2fa/status — Statut 2FA
router.get('/2fa/status', authenticateAdmin, async (req, res) => {
  try {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('totp_enabled, totp_verified_at, totp_backup_codes')
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    let backupCodesRemaining = 0;
    if (adminUser?.totp_backup_codes) {
      try {
        const codes = JSON.parse(totpService.decryptSecret(adminUser.totp_backup_codes));
        backupCodesRemaining = codes.length;
      } catch (_) { /* si déchiffrement échoue, 0 */ }
    }

    res.json({
      enabled: adminUser?.totp_enabled || false,
      verified_at: adminUser?.totp_verified_at || null,
      backup_codes_remaining: backupCodesRemaining,
    });
  } catch (error) {
    logger.error('[2FA] Erreur status:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut 2FA' });
  }
});

// PATCH /api/admin/auth/phone (mettre à jour le téléphone admin)
router.patch('/phone', authenticateAdmin, async (req, res) => {
  try {
    const { telephone } = req.body;
    if (typeof telephone !== 'string') {
      return res.status(400).json({ error: 'Telephone requis' });
    }

    const cleaned = telephone.replace(/\s+/g, '').trim() || null;

    const { error } = await supabase
      .from('admin_users')
      .update({ telephone: cleaned, updated_at: new Date().toISOString() })
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true, telephone: cleaned });
  } catch (error) {
    console.error('[ADMIN AUTH] Erreur update phone:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/auth/me (vérifier token)
router.get('/me', authenticateAdmin, async (req, res) => {
  // 🔒 Empêcher le cache (fix Chrome/Service Worker)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    let admin;
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, totp_enabled, custom_permissions, telephone')
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error) {
      // Fallback si custom_permissions n'existe pas encore
      const { data: fallback } = await supabase
        .from('admin_users')
        .select('id, email, nom, role, totp_enabled, telephone')
        .eq('id', req.admin.id)
        .eq('tenant_id', req.admin.tenant_id)
        .single();
      admin = fallback;
    } else {
      admin = data;
    }

    res.json({ admin });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Cache mémoire pour authenticateAdmin (évite de frapper Supabase à chaque requête) ──
const _authCache = new Map(); // token → { admin, validatedAt }
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCachedAuth(token) {
  const entry = _authCache.get(token);
  if (!entry) return null;
  if (Date.now() - entry.validatedAt > AUTH_CACHE_TTL) {
    _authCache.delete(token);
    return null;
  }
  return entry.admin;
}

function setCachedAuth(token, admin) {
  _authCache.set(token, { admin, validatedAt: Date.now() });
  // Eviter fuite mémoire : purger si > 100 entrées
  if (_authCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of _authCache) {
      if (now - v.validatedAt > AUTH_CACHE_TTL) _authCache.delete(k);
    }
  }
}

// Invalider le cache d'un token (appelé au logout/revoke)
export function invalidateAuthCache(token) {
  _authCache.delete(token);
}

// Middleware authentification
export async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);

    // 1. Vérifier le cache mémoire (évite 2-3 requêtes Supabase)
    const cached = getCachedAuth(token);
    if (cached) {
      req.admin = cached;
      req.token = token;
      return next();
    }

    // 2. Vérifier que la session est active (non révoquée)
    const sessionValid = await validateSession(token);
    if (!sessionValid) {
      return res.status(401).json({ error: 'Session expirée ou révoquée' });
    }

    // 3. Enrichir avec les données admin (tenant_id, etc.) depuis la BDD
    let adminData;
    let error;

    // Tenter avec custom_permissions, fallback sans si colonne absente (migration 069)
    ({ data: adminData, error } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, tenant_id, custom_permissions')
      .eq('id', decoded.id)
      .single());

    if (error) {
      // Fallback: colonne custom_permissions n'existe peut-etre pas encore
      ({ data: adminData, error } = await supabase
        .from('admin_users')
        .select('id, email, nom, role, tenant_id')
        .eq('id', decoded.id)
        .single());
    }

    if (error || !adminData) {
      return res.status(401).json({ error: 'Admin non trouvé' });
    }

    const adminObj = {
      ...decoded,
      tenant_id: adminData.tenant_id,
      nom: adminData.nom,
      custom_permissions: adminData.custom_permissions || null,
    };

    // 4. Mettre en cache pour les requêtes suivantes
    setCachedAuth(token, adminObj);

    req.admin = adminObj;
    req.token = token;
    next();
  } catch (error) {
    // Distinguer erreurs JWT (vrai 401) des erreurs réseau/DB (500)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    // Erreur réseau/DB (timeout Supabase, etc.) — NE PAS déconnecter l'utilisateur
    console.error('[AUTH] Erreur temporaire auth middleware:', error.message);
    return res.status(503).json({ error: 'Service temporairement indisponible, réessayez' });
  }
}

// Middleware super admin (role = 'super_admin')
export function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au super admin' });
  }
  next();
}

// ─── GET /permissions — Matrice de permissions du user connecté ──────────────
import { getPermissionsForRole, getEffectivePermissions } from '../middleware/rbac.js';

router.get('/permissions', authenticateAdmin, (req, res) => {
  const permissions = getEffectivePermissions(req.admin.role, req.admin.custom_permissions);
  res.json({ role: req.admin.role, permissions });
});

// ─── SESSION MANAGEMENT ─────────────────────────────────────────────────────

// GET /sessions — Liste les sessions actives
router.get('/sessions', authenticateAdmin, async (req, res) => {
  try {
    const sessions = await listSessions(req.admin.id, req.admin.tenant_id);

    // Marquer la session courante
    const currentHash = hashToken(req.token);
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      is_current: false, // On ne peut pas comparer directement ici
    }));

    // Pour identifier la session courante, on cherche par token hash
    const { data: currentSession } = await supabase
      .from('admin_sessions')
      .select('id')
      .eq('token_hash', currentHash)
      .single();

    for (const s of sessionsWithCurrent) {
      if (currentSession && s.id === currentSession.id) {
        s.is_current = true;
      }
    }

    res.json({ sessions: sessionsWithCurrent });
  } catch (error) {
    logger.error('[Session] Erreur listing:', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /sessions/:id — Révoquer une session
router.delete('/sessions/:id', authenticateAdmin, async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Empêcher de révoquer sa propre session
    const currentHash = hashToken(req.token);
    const { data: targetSession } = await supabase
      .from('admin_sessions')
      .select('token_hash')
      .eq('id', sessionId)
      .eq('admin_id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!targetSession) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    if (targetSession.token_hash === currentHash) {
      return res.status(400).json({ error: 'Impossible de révoquer la session courante' });
    }

    const success = await revokeSession(sessionId, req.admin.id, req.admin.tenant_id);
    if (!success) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Session] Erreur révocation:', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /sessions/revoke-all — Révoquer toutes les sessions sauf la courante
router.post('/sessions/revoke-all', authenticateAdmin, async (req, res) => {
  try {
    const currentHash = hashToken(req.token);
    const success = await revokeAllSessions(req.admin.id, req.admin.tenant_id, currentHash);

    if (!success) {
      return res.status(500).json({ error: 'Erreur lors de la révocation' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[Session] Erreur révocation all:', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
