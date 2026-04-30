/**
 * Admin Detection Service — WhatsApp Admin routing
 * Détecte si un numéro WhatsApp entrant appartient à un admin du tenant
 *
 * 🔒 TENANT SHIELD : toujours filtré par tenant_id
 * 🛡️ FAIL-SAFE : erreur → isAdmin: false (jamais donner tools admin à un client)
 */

import { supabase } from '../config/supabase.js';
import { extractFrenchSuffix } from '../utils/phoneNormalize.js';
import logger from '../config/logger.js';

// ── Cache in-memory par tenant (TTL 5 min) ──
const adminPhoneCache = new Map(); // tenantId → { phones: Map<suffix, admin>, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Détecte si un numéro de téléphone appartient à un admin/manager du tenant
 * @param {string} phone - Numéro WhatsApp entrant (format brut Twilio/Meta)
 * @param {string} tenantId - ID du tenant
 * @returns {Promise<{ isAdmin: boolean, admin: { id: string, nom: string, role: string, source: string } | null }>}
 */
export async function detectAdminByPhone(phone, tenantId) {
  if (!phone || !tenantId) {
    return { isAdmin: false, admin: null };
  }

  try {
    const suffix = extractFrenchSuffix(phone);
    if (!suffix) {
      return { isAdmin: false, admin: null };
    }

    // Vérifier le cache
    const cached = adminPhoneCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      const admin = cached.phones.get(suffix);
      if (admin) {
        logger.info(`[ADMIN DETECT] Cache hit: ${suffix} → admin ${admin.nom} (${admin.source})`, { tenantId });
        return { isAdmin: true, admin };
      }
      // Cache valide mais pas trouvé → pas admin
      return { isAdmin: false, admin: null };
    }

    // Cache miss ou expiré → recharger depuis DB
    const phones = await loadAdminPhones(tenantId);
    adminPhoneCache.set(tenantId, {
      phones,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    const admin = phones.get(suffix);
    if (admin) {
      logger.info(`[ADMIN DETECT] DB match: ${suffix} → admin ${admin.nom} (${admin.source})`, { tenantId });
      return { isAdmin: true, admin };
    }

    return { isAdmin: false, admin: null };
  } catch (error) {
    // 🛡️ FAIL-SAFE : erreur → jamais admin
    logger.error(`[ADMIN DETECT] Erreur detection — fail-safe client: ${error.message}`, { tenantId });
    return { isAdmin: false, admin: null };
  }
}

/**
 * Charge tous les numéros admin/manager d'un tenant
 * Sources : admin_users.telephone + rh_membres.telephone (role admin/manager)
 * @returns {Map<string, { id, nom, role, source }>}
 */
async function loadAdminPhones(tenantId) {
  const phones = new Map();

  // 1. admin_users avec telephone non null
  const { data: admins, error: adminsErr } = await supabase
    .from('admin_users')
    .select('id, nom, role, telephone')
    .eq('tenant_id', tenantId)
    .not('telephone', 'is', null);

  if (adminsErr) {
    logger.error(`[ADMIN DETECT] Erreur query admin_users: ${adminsErr.message}`, { tenantId });
  } else if (admins) {
    for (const admin of admins) {
      const suffix = extractFrenchSuffix(admin.telephone);
      if (suffix) {
        phones.set(suffix, {
          id: admin.id,
          nom: admin.nom || 'Admin',
          role: admin.role || 'admin',
          source: 'admin_users',
        });
      }
    }
  }

  // 2. rh_membres avec role admin ou manager et telephone non null
  const { data: membres, error: membresErr } = await supabase
    .from('rh_membres')
    .select('id, nom, prenom, role, telephone')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'manager'])
    .not('telephone', 'is', null);

  if (membresErr) {
    logger.error(`[ADMIN DETECT] Erreur query rh_membres: ${membresErr.message}`, { tenantId });
  } else if (membres) {
    for (const m of membres) {
      const suffix = extractFrenchSuffix(m.telephone);
      if (suffix) {
        // Ne pas écraser un admin_users existant (priorité admin_users)
        if (!phones.has(suffix)) {
          phones.set(suffix, {
            id: m.id,
            nom: [m.prenom, m.nom].filter(Boolean).join(' ') || 'Manager',
            role: m.role,
            source: 'rh_membres',
          });
        }
      }
    }
  }

  logger.info(`[ADMIN DETECT] Loaded ${phones.size} admin phones for tenant`, { tenantId });
  return phones;
}

/**
 * Invalide le cache admin pour un tenant
 * À appeler quand un téléphone admin/membre change
 * @param {string} tenantId
 */
export function invalidateAdminPhoneCache(tenantId) {
  if (tenantId) {
    adminPhoneCache.delete(tenantId);
    logger.info(`[ADMIN DETECT] Cache invalidated`, { tenantId });
  }
}
