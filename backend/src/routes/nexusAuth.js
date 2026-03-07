/**
 * NEXUS Operator Authentication
 *
 * Dedicated auth endpoints for super_admin login.
 * Mounted BEFORE tenant resolution — no tenant context needed.
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { createSession } from '../services/sessionService.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const EFFECTIVE_JWT_SECRET = JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-only-secret-change-in-prod' : null);
if (!EFFECTIVE_JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in .env for production');
}

// Rate limiting in-memory (brute force protection)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

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

// POST /api/nexus/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Trop de tentatives. Réessayez dans ${rateCheck.remainingMin} minutes.`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Query super_admin user by email
    const { data: user, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, password_hash, actif, locked_until')
      .eq('email', email)
      .eq('role', 'super_admin')
      .eq('actif', true)
      .maybeSingle();

    if (fetchError || !user) {
      logger.warn(`[NEXUS AUTH] Login failed — user not found or not super_admin: ${email}`);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Check account lock
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(401).json({ error: `Compte verrouillé. Réessayez dans ${remainingMinutes} minutes.` });
    }

    // Verify password
    if (!user.password_hash) {
      logger.error(`[NEXUS AUTH] No password hash found for super_admin: ${email}`);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      logger.warn(`[NEXUS AUTH] Invalid password for super_admin: ${email}`);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Generate JWT (no tenant_id for super_admin)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: 'super_admin',
        tenant_id: null,
      },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create session in DB (required for authenticateAdmin validation)
    // Use '__nexus__' as tenant_id for superadmin sessions (column is NOT NULL)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    createSession({
      adminId: user.id,
      tenantId: '__nexus__',
      token,
      ip: clientIp,
      userAgent: req.headers['user-agent'],
      expiresAt,
    }).catch(err => logger.error('[NEXUS AUTH] Session creation error:', { error: err.message }));

    // Reset rate limit on success
    loginAttempts.delete(clientIp);

    logger.info(`[NEXUS AUTH] Super admin login: ${email}`);

    res.json({
      token,
      admin: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: 'super_admin',
      },
    });
  } catch (error) {
    logger.error('[NEXUS AUTH] Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/nexus/auth/verify
router.get('/verify', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);

    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Accès réservé aux opérateurs NEXUS' });
    }

    // Verify user still exists and is active
    const { data: user } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, actif')
      .eq('id', decoded.id)
      .eq('role', 'super_admin')
      .eq('actif', true)
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ error: 'Compte désactivé ou supprimé' });
    }

    res.json({
      admin: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    logger.error('[NEXUS AUTH] Verify error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
