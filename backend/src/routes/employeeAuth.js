/**
 * Employee Auth Routes — NEXUS
 * Authentification du portail employe.
 * Routes: login, logout, me, setup-password, change-password
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { createEmployeeSession, validateEmployeeSession, revokeEmployeeSession } from '../services/employeeSessionService.js';
import { hashToken } from '../services/sessionService.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('ERREUR CRITIQUE: JWT_SECRET non defini');
}

// Rate limiting en memoire
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

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

// ─── Middleware authenticateEmployee ─────────────────────────────────────────

export async function authenticateEmployee(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verifier que c'est un token employe
    if (decoded.role !== 'employee') {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Verifier session active
    const sessionValid = await validateEmployeeSession(token);
    if (!sessionValid) {
      return res.status(401).json({ error: 'Session expiree ou revoquee' });
    }

    // Enrichir avec donnees DB
    const { data: empUser, error } = await supabase
      .from('employee_users')
      .select('id, email, tenant_id, membre_id, statut')
      .eq('id', decoded.id)
      .eq('tenant_id', decoded.tenant_id)
      .single();

    if (error || !empUser) {
      return res.status(401).json({ error: 'Employe non trouve' });
    }

    if (empUser.statut !== 'actif') {
      return res.status(403).json({ error: 'Compte desactive' });
    }

    req.employee = {
      id: empUser.id,
      email: empUser.email,
      tenant_id: empUser.tenant_id,
      membre_id: empUser.membre_id,
    };
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// ─── POST /login ─────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Trop de tentatives. Reessayez dans ${rateCheck.remainingMin} minutes.`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Chercher l'employe
    const { data: empUser, error } = await supabase
      .from('employee_users')
      .select('id, email, tenant_id, membre_id, password_hash, statut')
      .eq('email', email)
      .single();

    if (error || !empUser) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (empUser.statut === 'desactive') {
      return res.status(403).json({ error: 'Compte desactive. Contactez votre employeur.' });
    }

    if (empUser.statut === 'invite_pending' || !empUser.password_hash) {
      return res.status(403).json({ error: 'Compte non active. Verifiez votre email d\'invitation.' });
    }

    // Verifier mot de passe
    const validPassword = await bcrypt.compare(password, empUser.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Recuperer infos rh_membres
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, poste, avatar_url')
      .eq('id', empUser.membre_id)
      .eq('tenant_id', empUser.tenant_id)
      .single();

    // Generer JWT 24h
    const token = jwt.sign(
      {
        id: empUser.id,
        email: empUser.email,
        membre_id: empUser.membre_id,
        tenant_id: empUser.tenant_id,
        tenant_slug: empUser.tenant_id,
        role: 'employee',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    resetRateLimit(clientIp);

    // Creer session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    createEmployeeSession({
      employeeId: empUser.id,
      tenantId: empUser.tenant_id,
      token,
      ip: clientIp,
      userAgent: req.headers['user-agent'],
      expiresAt,
    }).catch(err => logger.error('[EmployeeAuth] Erreur creation session:', { error: err.message }));

    // Mettre a jour last_login
    supabase
      .from('employee_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', empUser.id)
      .eq('tenant_id', empUser.tenant_id)
      .then(() => {})
      .catch(() => {});

    res.json({
      token,
      employee: {
        id: empUser.id,
        email: empUser.email,
        membre_id: empUser.membre_id,
        nom: membre?.nom || '',
        prenom: membre?.prenom || '',
        role: membre?.role || '',
        poste: membre?.poste || '',
        avatar_url: membre?.avatar_url || null,
      },
    });
  } catch (error) {
    logger.error('[EmployeeAuth] Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /logout ────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        jwt.verify(token, JWT_SECRET);
        await revokeEmployeeSession(token);
      } catch (_) { /* Token invalide — ignorer */ }
    }

    res.json({ message: 'Deconnecte avec succes' });
  } catch (error) {
    logger.error('[EmployeeAuth] Erreur logout:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

router.get('/me', authenticateEmployee, async (req, res) => {
  try {
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, email, telephone, role, poste, avatar_url, date_embauche, type_contrat, heures_hebdo')
      .eq('id', req.employee.membre_id)
      .eq('tenant_id', req.employee.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employe non trouve' });
    }

    res.json({
      id: req.employee.id,
      email: req.employee.email,
      membre_id: req.employee.membre_id,
      tenant_id: req.employee.tenant_id,
      nom: membre.nom,
      prenom: membre.prenom,
      telephone: membre.telephone,
      role: membre.role,
      poste: membre.poste,
      avatar_url: membre.avatar_url,
      date_embauche: membre.date_embauche,
      type_contrat: membre.type_contrat,
      heures_hebdo: membre.heures_hebdo,
    });
  } catch (error) {
    logger.error('[EmployeeAuth] Erreur /me:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /setup-password ────────────────────────────────────────────────────

router.post('/setup-password', async (req, res) => {
  try {
    const { token: inviteToken, password } = req.body;

    if (!inviteToken || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
    }

    // Trouver l'employe par token invite
    const { data: empUser, error } = await supabase
      .from('employee_users')
      .select('id, email, tenant_id, membre_id, invite_expires_at, statut')
      .eq('invite_token', inviteToken)
      .single();

    if (error || !empUser) {
      return res.status(400).json({ error: 'Lien d\'invitation invalide ou expire' });
    }

    if (empUser.statut !== 'invite_pending') {
      return res.status(400).json({ error: 'Ce compte est deja active' });
    }

    if (empUser.invite_expires_at && new Date(empUser.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Le lien d\'invitation a expire. Demandez un nouveau lien a votre employeur.' });
    }

    // Hasher et sauvegarder le mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    const { error: updateError } = await supabase
      .from('employee_users')
      .update({
        password_hash: passwordHash,
        statut: 'actif',
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', empUser.id)
      .eq('tenant_id', empUser.tenant_id);

    if (updateError) throw updateError;

    // Recuperer infos rh_membres pour la reponse
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, poste, avatar_url')
      .eq('id', empUser.membre_id)
      .eq('tenant_id', empUser.tenant_id)
      .single();

    // Auto-login : generer JWT
    const jwtToken = jwt.sign(
      {
        id: empUser.id,
        email: empUser.email,
        membre_id: empUser.membre_id,
        tenant_id: empUser.tenant_id,
        tenant_slug: empUser.tenant_id,
        role: 'employee',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Creer session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    createEmployeeSession({
      employeeId: empUser.id,
      tenantId: empUser.tenant_id,
      token: jwtToken,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt,
    }).catch(() => {});

    res.json({
      success: true,
      token: jwtToken,
      employee: {
        id: empUser.id,
        email: empUser.email,
        membre_id: empUser.membre_id,
        nom: membre?.nom || '',
        prenom: membre?.prenom || '',
        role: membre?.role || '',
        poste: membre?.poste || '',
        avatar_url: membre?.avatar_url || null,
      },
    });
  } catch (error) {
    logger.error('[EmployeeAuth] Erreur setup-password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /change-password ───────────────────────────────────────────────────

router.post('/change-password', authenticateEmployee, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres' });
    }

    // Recuperer le hash actuel
    const { data: empUser } = await supabase
      .from('employee_users')
      .select('password_hash')
      .eq('id', req.employee.id)
      .eq('tenant_id', req.employee.tenant_id)
      .single();

    if (!empUser) {
      return res.status(404).json({ error: 'Employe non trouve' });
    }

    // Verifier mot de passe actuel
    const validPassword = await bcrypt.compare(currentPassword, empUser.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher et sauvegarder
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error } = await supabase
      .from('employee_users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.employee.id)
      .eq('tenant_id', req.employee.tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'Mot de passe modifie avec succes' });
  } catch (error) {
    logger.error('[EmployeeAuth] Erreur change-password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
