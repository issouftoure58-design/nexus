import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { verifyLogin, changePassword } from '../sentinel/security/accountService.js';
import { POLICY, validatePasswordStrength } from '../sentinel/security/passwordPolicy.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import logger from '../config/logger.js';
import { totpService } from '../services/totpService.js';
import { createSession, validateSession, listSessions, revokeSession, revokeAllSessions, hashToken } from '../services/sessionService.js';

const router = express.Router();

// 🔒 C2: JWT Secret - DOIT être défini dans .env (pas de fallback)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('ERREUR CRITIQUE: JWT_SECRET non défini dans .env');
  // En dev, utiliser un secret temporaire mais loguer un warning
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Mode dev: utilisation d\'un secret temporaire (NE PAS UTILISER EN PROD)');
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-only-secret-change-in-prod' : null);
if (!EFFECTIVE_JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in .env for production');
}

// 🔒 G4: Rate limiting pour login (protection brute force)
const loginAttempts = new Map(); // IP -> { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
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
    const { email, password } = req.body;
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

    // Créer la session en DB
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    createSession({
      adminId: loginResult.user.id,
      tenantId: loginResult.user.tenant_id,
      token,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt,
    }).catch(err => logger.error('[Session] Erreur création:', { error: err.message }));

    // Logger l'action
    try {
      await supabase.from('historique_admin').insert({
        admin_id: loginResult.user.id,
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
    // En JWT, logout côté client (supprimer token)
    res.json({ message: 'Déconnecté avec succès' });
  } catch (error) {
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

    // Vérifier que l'admin a les droits (même tenant ou super_admin)
    const { data: targetUser } = await supabase
      .from('admin_users')
      .select('id, tenant_id, locked_until')
      .eq('email', email)
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
      .eq('id', targetUser.id);

    if (error) throw error;

    logger.info(`[AUTH] Compte débloqué: ${email}`);
    res.json({ success: true, message: `Compte ${email} débloqué` });
  } catch (error) {
    logger.error('[ADMIN AUTH] Erreur unlock-account:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/auth/signup (créer un compte)
router.post('/signup', async (req, res) => {
  try {
    const { entreprise, nom, email, telephone, password, plan = 'starter' } = req.body;

    // Validation
    if (!entreprise || !nom || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Valider le mot de passe
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Mot de passe trop faible',
        details: passwordValidation.errors
      });
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

    // Créer le tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        nom: entreprise,
        slug: finalSlug,
        plan: plan,
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 jours
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
      throw new Error('Erreur lors de la création du compte');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'admin user
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .insert({
        email,
        password: hashedPassword,
        nom,
        role: 'admin',
        tenant_id: tenant.id,
        telephone: telephone || null,
        password_changed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) {
      // Rollback: supprimer le tenant créé
      await supabase.from('tenants').delete().eq('id', tenant.id);
      logger.error('[SIGNUP] Erreur création admin:', userError);
      throw new Error('Erreur lors de la création du compte');
    }

    logger.info(`[SIGNUP] Nouveau compte créé: ${email} (tenant: ${finalSlug}, plan: ${plan})`);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      tenant: {
        id: tenant.id,
        slug: finalSlug,
        plan: plan
      }
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
router.post('/2fa/validate', async (req, res) => {
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
      .select('id, email, nom, role, totp_enabled, custom_permissions')
      .eq('id', req.admin.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error) {
      // Fallback si custom_permissions n'existe pas encore
      const { data: fallback } = await supabase
        .from('admin_users')
        .select('id, email, nom, role, totp_enabled')
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

// Middleware authentification
export async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);

    // Vérifier que la session est active (non révoquée)
    const sessionValid = await validateSession(token);
    if (!sessionValid) {
      return res.status(401).json({ error: 'Session expirée ou révoquée' });
    }

    // Enrichir avec les données admin (tenant_id, etc.) depuis la BDD
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

    req.admin = {
      ...decoded,
      tenant_id: adminData.tenant_id,
      nom: adminData.nom,
      custom_permissions: adminData.custom_permissions || null,
    };
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
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
