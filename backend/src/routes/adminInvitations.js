/**
 * Routes Invitations Equipe — NEXUS
 * Invitation par email avec token unique, expiration 72h
 */

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { sendEmail } from '../services/emailService.js';
import { validatePasswordStrength } from '../sentinel/security/passwordPolicy.js';
import logger from '../config/logger.js';

const router = express.Router();

const INVITE_EXPIRY_HOURS = 72;
const VALID_ROLES = ['admin', 'manager', 'viewer', 'comptable'];

// Limites utilisateurs par plan (modèle 2026 — révision finale 9 avril 2026)
const PLAN_USER_LIMITS = {
  free: { max: 1, extraPrice: 0 },          // Free: 1 user (pas d'ajout possible)
  basic: { max: 5, extraPrice: 1500 },      // Basic 29€: 5 users (+15€/user)
  business: { max: 20, extraPrice: 1200 },  // Business 149€: 20 users (+12€/user)
  // DEPRECATED aliases (retro-compat anciens tenants)
  starter: { max: 1, extraPrice: 0 },
  pro: { max: 5, extraPrice: 1500 },
};

// Normalise plan legacy → nouveau modèle
function normalizePlan(plan) {
  const p = (plan || '').toLowerCase();
  if (p === 'starter') return 'free';
  if (p === 'pro') return 'basic';
  if (p === 'free' || p === 'basic' || p === 'business') return p;
  return 'free';
}

// GET /api/admin/invitations/limits — Limites du plan
router.get('/limits', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, statut')
      .eq('id', tenantId)
      .single();

    // En mode essai, déverrouiller comme Basic (5 seats) pour tester pleinement
    const storedPlan = normalizePlan(tenant?.plan);
    const plan = tenant?.statut === 'essai' ? 'basic' : storedPlan;
    const limit = PLAN_USER_LIMITS[plan] || PLAN_USER_LIMITS.free;

    const { count: currentUsers } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    const { count: pendingInvites } = await supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    res.json({
      plan,
      maxUsers: limit.max,
      extraPriceCents: limit.extraPrice,
      currentUsers: currentUsers || 0,
      pendingInvites: pendingInvites || 0,
      remainingSeats: limit.max - (currentUsers || 0) - (pendingInvites || 0),
    });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur limits:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/admin/invitations — Lister les invitations du tenant
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    const { data, error } = await supabase
      .from('invitations')
      .select('id, email, role, invited_by, expires_at, accepted_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ invitations: data || [] });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur list:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des invitations' });
  }
});

// POST /api/admin/invitations — Envoyer une invitation
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    const { email: rawEmail, role = 'manager', permissions = null } = req.body;

    if (!rawEmail) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Rôle invalide. Valeurs possibles: ${VALID_ROLES.join(', ')}` });
    }

    // Vérifier le quota utilisateurs du plan
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('plan, name, statut')
      .eq('id', tenantId)
      .single();

    // En mode essai, déverrouiller comme Basic pour tester pleinement
    const storedPlan = normalizePlan(tenantData?.plan);
    const plan = tenantData?.statut === 'essai' ? 'basic' : storedPlan;
    const limit = PLAN_USER_LIMITS[plan] || PLAN_USER_LIMITS.free;

    const { count: currentUsers } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    const { count: pendingInvites } = await supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    const totalSeats = (currentUsers || 0) + (pendingInvites || 0);

    if (totalSeats >= limit.max) {
      return res.status(403).json({
        error: `Limite atteinte : ${limit.max} utilisateur(s) pour le plan ${plan}. Passez au plan supérieur ou contactez le support.`,
        currentUsers: currentUsers || 0,
        pendingInvites: pendingInvites || 0,
        maxUsers: limit.max,
        plan,
      });
    }

    // Vérifier si l'email existe déjà dans le tenant
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Cet utilisateur fait déjà partie de l\'équipe' });
    }

    // Vérifier si une invitation non expirée existe déjà
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id, expires_at')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return res.status(400).json({ error: 'Une invitation active existe déjà pour cet email' });
    }

    // Générer le token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // Créer l'invitation
    const insertData = {
      tenant_id: tenantId,
      email,
      role,
      token,
      invited_by: req.admin.id,
      expires_at: expiresAt,
    };
    if (permissions) {
      insertData.custom_permissions = permissions;
    }

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert(insertData)
      .select('id, email, role, expires_at, created_at')
      .single();

    if (error) throw error;

    const tenantName = tenantData?.name || 'NEXUS';
    const appUrl = process.env.APP_URL || 'https://app.nexus-ai-saas.com';
    const inviteUrl = `${appUrl}/accept-invite?token=${token}`;

    // Envoyer l'email
    await sendEmail({
      to: email,
      subject: `${req.admin.nom || 'Un administrateur'} vous invite à rejoindre ${tenantName} sur NEXUS`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; margin: 0 auto; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #2563eb); display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 20px;">N</span>
            </div>
          </div>
          <h2 style="text-align: center; color: #111827; margin-bottom: 8px;">Invitation à rejoindre ${tenantName}</h2>
          <p style="text-align: center; color: #6b7280; margin-bottom: 24px;">
            <strong>${req.admin.nom || 'Un administrateur'}</strong> vous invite à rejoindre l'équipe en tant que <strong>${role}</strong>.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #06b6d4, #2563eb); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Accepter l'invitation
            </a>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 13px;">
            Ce lien expire dans ${INVITE_EXPIRY_HOURS} heures.
          </p>
        </div>
      `,
    });

    logger.info(`[INVITATIONS] Invitation envoyée: ${email} (role: ${role}) par admin ${req.admin.id}`);
    res.status(201).json({ invitation });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur create:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'invitation' });
  }
});

// DELETE /api/admin/invitations/:id — Révoquer une invitation
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    logger.info(`[INVITATIONS] Invitation ${req.params.id} révoquée par admin ${req.admin.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur delete:', error);
    res.status(500).json({ error: 'Erreur lors de la révocation' });
  }
});

// POST /api/admin/auth/accept-invite — Accepter une invitation (pas auth, utilise token)
router.post('/accept', async (req, res) => {
  try {
    const { token, nom, password } = req.body;

    if (!token || !nom || !password) {
      return res.status(400).json({ error: 'Token, nom et mot de passe requis' });
    }

    // Valider le mot de passe
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: 'Mot de passe trop faible', details: passwordValidation.errors });
    }

    // Trouver l'invitation
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation non trouvée ou déjà utilisée' });
    }

    // Vérifier expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Cette invitation a expiré' });
    }

    // Vérifier que l'email n'existe pas déjà dans le tenant
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', invitation.email.toLowerCase())
      .eq('tenant_id', invitation.tenant_id)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cet email' });
    }

    // Créer l'utilisateur
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUserData = {
      email: invitation.email.toLowerCase(),
      password_hash: hashedPassword,
      nom,
      role: invitation.role,
      tenant_id: invitation.tenant_id,
      password_changed_at: new Date().toISOString(),
    };
    // Copier les custom_permissions de l'invitation vers le nouvel utilisateur
    if (invitation.custom_permissions) {
      newUserData.custom_permissions = invitation.custom_permissions;
    }

    const { data: newUser, error: userError } = await supabase
      .from('admin_users')
      .insert(newUserData)
      .select('id, email, nom, role')
      .single();

    if (userError) throw userError;

    // Marquer l'invitation comme acceptée
    await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .eq('tenant_id', invitation.tenant_id);

    logger.info(`[INVITATIONS] Invitation acceptée: ${invitation.email} → tenant ${invitation.tenant_id}`);

    res.json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      user: newUser,
    });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur accept:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation de l\'invitation' });
  }
});

// GET /api/admin/invitations/verify/:token — Vérifier un token d'invitation (public)
router.get('/verify/:token', async (req, res) => {
  try {
    const { data: invitation } = await supabase
      .from('invitations')
      .select('email, role, expires_at, accepted_at, tenant_id, custom_permissions')
      .eq('token', req.params.token)
      .single();

    if (!invitation) {
      return res.status(404).json({ valid: false, error: 'Invitation non trouvée' });
    }

    if (invitation.accepted_at) {
      return res.status(410).json({ valid: false, error: 'Invitation déjà utilisée' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ valid: false, error: 'Invitation expirée' });
    }

    // Récupérer le nom du tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', invitation.tenant_id)
      .single();

    res.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      tenant_name: tenant?.name || 'NEXUS',
      custom_permissions: invitation.custom_permissions || null,
    });
  } catch (error) {
    logger.error('[INVITATIONS] Erreur verify:', error);
    res.status(500).json({ valid: false, error: 'Erreur' });
  }
});

export default router;
