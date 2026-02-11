/**
 * Rate Limiting Middleware
 * Protection contre les attaques brute-force et DDoS
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter pour les tentatives de connexion
 * 5 tentatives par 15 minutes par IP+email
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Désactive la validation IPv6 car on utilise IP+email comme clé composite
  validate: { xForwardedForHeader: false, default: false },
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `${ip}:${email}`;
  },
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Login bloqué: ${req.ip} - ${req.body?.email || 'unknown'}`);
    res.status(429).json({
      success: false,
      error: 'Trop de tentatives de connexion',
      message: 'Veuillez réessayer dans 15 minutes',
      retryAfter: 15 * 60
    });
  },
  skip: (req) => {
    // Skip en dev si SKIP_RATE_LIMIT=true
    return process.env.SKIP_RATE_LIMIT === 'true';
  }
});

/**
 * Rate limiter général pour l'API
 * 100 requêtes par minute par IP
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Trop de requêtes. Ralentissez.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip les webhooks et health checks
    if (req.path === '/health') return true;
    if (req.path.includes('/webhook')) return true;
    return process.env.SKIP_RATE_LIMIT === 'true';
  }
});

/**
 * Rate limiter pour les paiements
 * 10 requêtes par minute par IP (plus strict)
 */
export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Trop de requêtes de paiement. Ralentissez.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[RATE LIMIT] Payment bloqué: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Trop de requêtes de paiement',
      message: 'Veuillez patienter avant de réessayer'
    });
  }
});

/**
 * Rate limiter pour les envois de notifications
 * 20 par minute (éviter spam)
 */
export const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Trop de notifications envoyées.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  loginLimiter,
  apiLimiter,
  paymentLimiter,
  notificationLimiter
};
