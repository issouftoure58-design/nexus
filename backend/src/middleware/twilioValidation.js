/**
 * Middleware de validation des webhooks Twilio
 * ⚠️ SECURITY: Valide la signature X-Twilio-Signature pour prévenir le spoofing
 *
 * Documentation: https://www.twilio.com/docs/usage/security#validating-requests
 */

import twilio from 'twilio';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

/**
 * Middleware pour valider les requêtes Twilio
 * Vérifie que la requête provient bien de Twilio via X-Twilio-Signature
 */
export function validateTwilioSignature(req, res, next) {
  // En développement, permettre de désactiver la validation (uniquement si explicitement configuré)
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_VALIDATION === 'true') {
    console.warn('[TWILIO SECURITY] ⚠️ Validation désactivée en développement');
    return next();
  }

  // Vérifier que le token est configuré
  if (!TWILIO_AUTH_TOKEN) {
    console.error('[TWILIO SECURITY] ❌ TWILIO_AUTH_TOKEN non configuré!');
    // En production, rejeter. En dev, avertir et continuer
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).send('Server configuration error');
    }
    console.warn('[TWILIO SECURITY] ⚠️ Continuant sans validation (non-production)');
    return next();
  }

  // Extraire la signature
  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    console.error('[TWILIO SECURITY] ❌ X-Twilio-Signature manquante');
    return res.status(403).send('Forbidden: Missing signature');
  }

  // Construire l'URL complète
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['host'];
  const url = `${protocol}://${host}${req.originalUrl}`;

  // Valider la signature
  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    req.body || {}
  );

  if (!isValid) {
    console.error('[TWILIO SECURITY] ❌ Signature invalide!', {
      url,
      signatureReceived: twilioSignature.substring(0, 20) + '...',
      body: Object.keys(req.body || {})
    });
    return res.status(403).send('Forbidden: Invalid signature');
  }

  console.log('[TWILIO SECURITY] ✅ Signature validée');
  next();
}

/**
 * Version allégée pour les webhooks de status (moins critique)
 */
export function validateTwilioSignatureLoose(req, res, next) {
  // Vérifier au moins que la signature est présente
  const twilioSignature = req.headers['x-twilio-signature'];

  if (!twilioSignature && process.env.NODE_ENV === 'production') {
    console.warn('[TWILIO SECURITY] ⚠️ X-Twilio-Signature manquante sur status webhook');
    // Pour les status, on log mais on continue (moins critique)
  }

  // En production avec token, valider
  if (TWILIO_AUTH_TOKEN && twilioSignature && process.env.NODE_ENV === 'production') {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const url = `${protocol}://${host}${req.originalUrl}`;

    const isValid = twilio.validateRequest(
      TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      req.body || {}
    );

    if (!isValid) {
      console.error('[TWILIO SECURITY] ❌ Signature invalide sur status webhook');
      return res.status(403).send('Forbidden');
    }
  }

  next();
}

export default { validateTwilioSignature, validateTwilioSignatureLoose };
