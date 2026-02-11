/**
 * Middleware d'idempotence pour les paiements
 * Empêche les doubles transactions en cachant les réponses
 */

import { supabase } from '../config/supabase.js';
import crypto from 'crypto';

/**
 * Génère une clé d'idempotence à partir du body de la requête
 */
function generateIdempotencyKey(body) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex');
  return `auto_${hash.substring(0, 32)}`;
}

/**
 * Middleware d'idempotence
 * Vérifie si une requête identique a déjà été traitée
 */
export async function idempotencyMiddleware(req, res, next) {
  // Seulement pour les méthodes qui modifient les données
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Skip pour certains endpoints
  if (req.path.includes('/webhook') || req.path.includes('/verify')) {
    return next();
  }

  // Récupérer ou générer la clé d'idempotence
  let idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    idempotencyKey = generateIdempotencyKey(req.body);
  }

  // Identifier le tenant
  const tenantId = req.admin?.tenant_id || req.body?.tenant_id || 'default';

  try {
    // Vérifier si cette clé existe déjà
    const { data: existing, error: fetchError } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('key', idempotencyKey)
      .eq('tenant_id', tenantId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (fetchError) {
      // Si la table n'existe pas encore, continuer normalement
      if (fetchError.message?.includes('does not exist')) {
        console.log('[IDEMPOTENCY] Table non disponible, skip');
        return next();
      }
      console.error('[IDEMPOTENCY] Erreur fetch:', fetchError.message);
      return next();
    }

    // Si une réponse existe déjà, la renvoyer
    if (existing && existing.response_body) {
      console.log(`[IDEMPOTENCY] Requête dupliquée bloquée: ${idempotencyKey.substring(0, 16)}...`);
      return res
        .status(existing.response_status || 200)
        .json({
          ...existing.response_body,
          _idempotent: true,
          _originalTimestamp: existing.created_at
        });
    }

    // Intercepter la réponse pour la sauvegarder
    const originalJson = res.json.bind(res);
    res.json = async function(body) {
      try {
        // Sauvegarder la réponse pour les futures requêtes identiques
        await supabase.from('idempotency_keys').upsert({
          key: idempotencyKey,
          tenant_id: tenantId,
          request_path: req.path,
          request_method: req.method,
          request_body: req.body,
          response_status: res.statusCode,
          response_body: body,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'key,tenant_id'
        });
      } catch (saveError) {
        console.error('[IDEMPOTENCY] Erreur save:', saveError.message);
      }

      return originalJson(body);
    };

    // Ajouter la clé à la requête pour référence
    req.idempotencyKey = idempotencyKey;
    next();

  } catch (err) {
    console.error('[IDEMPOTENCY] Erreur:', err.message);
    // En cas d'erreur, continuer normalement
    next();
  }
}

/**
 * Nettoie les clés expirées (à appeler périodiquement)
 */
export async function cleanupExpiredKeys() {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_idempotency_keys');
    if (error) throw error;
    if (data > 0) {
      console.log(`[IDEMPOTENCY] ${data} clés expirées supprimées`);
    }
    return data;
  } catch (err) {
    console.error('[IDEMPOTENCY] Erreur cleanup:', err.message);
    return 0;
  }
}

export default {
  idempotencyMiddleware,
  cleanupExpiredKeys
};
