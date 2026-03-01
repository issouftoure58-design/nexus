/**
 * Middleware de validation des webhooks Twilio
 * ⚠️ SECURITY: Valide la signature X-Twilio-Signature pour prévenir le spoofing
 *
 * Documentation: https://www.twilio.com/docs/usage/security#validating-requests
 */

import twilio from 'twilio';
import logger from '../config/logger.js';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;

/**
 * Middleware pour valider les requêtes Twilio
 * Vérifie que la requête provient bien de Twilio via X-Twilio-Signature
 */
export function validateTwilioSignature(req, res, next) {
  // En développement, permettre de désactiver la validation (uniquement si explicitement configuré)
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_VALIDATION === 'true') {
    logger.warn('Validation désactivée en développement', { tag: 'TWILIO SECURITY' });
    return next();
  }

  // Vérifier que le token est configuré
  if (!TWILIO_AUTH_TOKEN) {
    logger.error('TWILIO_AUTH_TOKEN non configuré', { tag: 'TWILIO SECURITY' });
    // En production, rejeter. En dev, avertir et continuer
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).send('Server configuration error');
    }
    logger.warn('Continuant sans validation (non-production)', { tag: 'TWILIO SECURITY' });
    return next();
  }

  // Extraire la signature
  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    logger.error('X-Twilio-Signature manquante', { tag: 'TWILIO SECURITY' });
    return res.status(403).send('Forbidden: Missing signature');
  }

  // Construire l'URL complète
  // Utiliser WEBHOOK_BASE_URL pour éviter les problèmes de reconstruction derrière un proxy (Render)
  let url;
  if (WEBHOOK_BASE_URL) {
    url = `${WEBHOOK_BASE_URL}${req.originalUrl}`;
  } else {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    url = `${protocol}://${host}${req.originalUrl}`;
  }

  // Valider la signature
  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    req.body || {}
  );

  if (!isValid) {
    logger.error('Signature invalide', {
      tag: 'TWILIO SECURITY',
      url,
      signatureReceived: twilioSignature.substring(0, 20) + '...',
      body: Object.keys(req.body || {})
    });
    return res.status(403).send('Forbidden: Invalid signature');
  }

  logger.info('Signature validée', { tag: 'TWILIO SECURITY' });
  next();
}

/**
 * Version allégée pour les webhooks de status (moins critique)
 */
export function validateTwilioSignatureLoose(req, res, next) {
  // Vérifier au moins que la signature est présente
  const twilioSignature = req.headers['x-twilio-signature'];

  if (!twilioSignature && process.env.NODE_ENV === 'production') {
    logger.warn('X-Twilio-Signature manquante sur status webhook', { tag: 'TWILIO SECURITY' });
    // Pour les status, on log mais on continue (moins critique)
  }

  // En production avec token, valider
  if (TWILIO_AUTH_TOKEN && twilioSignature && process.env.NODE_ENV === 'production') {
    let url;
    if (WEBHOOK_BASE_URL) {
      url = `${WEBHOOK_BASE_URL}${req.originalUrl}`;
    } else {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['host'];
      url = `${protocol}://${host}${req.originalUrl}`;
    }

    const isValid = twilio.validateRequest(
      TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      req.body || {}
    );

    if (!isValid) {
      logger.error('Signature invalide sur status webhook', { tag: 'TWILIO SECURITY' });
      return res.status(403).send('Forbidden');
    }
  }

  next();
}

export default { validateTwilioSignature, validateTwilioSignatureLoose };
