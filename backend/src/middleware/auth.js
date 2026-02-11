/**
 * Authentication Middleware
 * Verification des tokens JWT pour les routes protegees
 */

import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-dev-secret-change-in-production';

/**
 * Middleware d'authentification par token JWT
 * Verifie le token et ajoute les infos utilisateur a req.user
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token manquant',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7);

    // Verifier le token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expire',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }

    // Verifier que l'utilisateur existe encore
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, tenant_id, is_active')
      .eq('id', decoded.userId || decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouve',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Compte desactive',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Recuperer le plan du tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, plan_id, modules_actifs, statut')
      .eq('id', user.tenant_id)
      .single();

    // Ajouter les infos a la requete
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      plan: tenant?.plan_id || 'starter'
    };

    req.tenant = tenant;
    req.tenantId = user.tenant_id;

    next();

  } catch (error) {
    console.error('[AUTH] Erreur:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur authentification',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware pour verifier un role specifique
 * @param {string|string[]} roles - Role(s) autorises
 */
export const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifie',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acces refuse',
        code: 'INSUFFICIENT_ROLE',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware pour verifier un plan minimum
 * @param {string} minPlan - Plan minimum requis ('starter', 'pro', 'business', 'enterprise')
 */
export const requirePlan = (minPlan) => {
  const planOrder = ['starter', 'pro', 'business', 'enterprise'];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifie',
        code: 'AUTH_REQUIRED'
      });
    }

    const userPlanIndex = planOrder.indexOf(req.user.plan);
    const requiredPlanIndex = planOrder.indexOf(minPlan);

    if (userPlanIndex < requiredPlanIndex) {
      return res.status(403).json({
        success: false,
        error: `Plan ${minPlan} ou superieur requis`,
        code: 'PLAN_REQUIRED',
        required_plan: minPlan,
        current_plan: req.user.plan
      });
    }

    next();
  };
};

/**
 * Genere un token JWT pour un utilisateur
 * @param {object} user - Utilisateur
 * @param {string} expiresIn - Duree de validite (ex: '7d', '24h')
 * @returns {string} Token JWT
 */
export function generateToken(user, expiresIn = '7d') {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id
    },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Verifie un token sans middleware (utile pour WebSockets)
 * @param {string} token
 * @returns {object|null} Payload decode ou null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export default {
  authenticateToken,
  requireRole,
  requirePlan,
  generateToken,
  verifyToken
};
