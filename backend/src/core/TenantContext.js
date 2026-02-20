/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      TENANT CONTEXT - SOURCE UNIQUE DE VÉRITÉ                  ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   Ce fichier est le SEUL endroit où le tenant est résolu et configuré.         ║
 * ║   AUCUN fallback sur un tenant par défaut - erreur si tenant non trouvé.       ║
 * ║                                                                                 ║
 * ║   RÈGLES D'OR:                                                                  ║
 * ║   1. JAMAIS de fallback sur 'fatshairafro' ou autre tenant                     ║
 * ║   2. TOUJOURS charger la config depuis la BDD, pas de fichiers statiques       ║
 * ║   3. TOUJOURS valider que le tenant existe avant toute opération               ║
 * ║   4. TOUJOURS propager le tenantId via req.tenantContext                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../config/supabase.js';

// Cache en mémoire avec TTL
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Horaires par défaut si non configurés
const DEFAULT_BUSINESS_HOURS = {
  0: null, // Dimanche - FERMÉ
  1: { open: '09:00', close: '18:00' },
  2: { open: '09:00', close: '18:00' },
  3: { open: '09:00', close: '18:00' },
  4: { open: '09:00', close: '18:00' },
  5: { open: '09:00', close: '18:00' },
  6: { open: '09:00', close: '18:00' },
};

/**
 * Classe TenantContext - Encapsule toute la logique tenant
 */
export class TenantContext {
  constructor(tenantId, tenantData, config = {}) {
    if (!tenantId) {
      throw new Error('TENANT_ID_REQUIRED: Cannot create TenantContext without tenantId');
    }

    this.id = tenantId;
    this.data = tenantData || {};
    this.config = config;
    this.loadedAt = Date.now();
  }

  // Getters pour les propriétés courantes
  get name() { return this.data.nom || this.data.name || this.id; }
  get plan() { return this.data.plan || this.data.plan_id || 'starter'; }
  get isActive() { return this.data.actif !== false; }
  get isFrozen() { return this.data.frozen === true; }

  // Config métier
  get businessHours() {
    return this.config.business_hours || this.data.horaires || DEFAULT_BUSINESS_HOURS;
  }

  get ownerName() {
    return this.config.owner_name || this.data.gerante || 'le responsable';
  }

  get assistantName() {
    return this.config.assistant_name || this.data.assistant_name || 'l\'assistant';
  }

  /**
   * Vérifie si le tenant a accès à une feature
   */
  hasFeature(featureName) {
    const plan = this.plan.toLowerCase();
    const featuresByPlan = {
      starter: ['basic', 'booking', 'clients'],
      pro: ['basic', 'booking', 'clients', 'crm', 'segments', 'workflows', 'stock', 'analytics'],
      business: ['basic', 'booking', 'clients', 'crm', 'segments', 'workflows', 'stock', 'analytics', 'sentinel', 'api', 'whitelabel'],
    };

    return featuresByPlan[plan]?.includes(featureName) || false;
  }

  /**
   * Obtient les horaires pour un jour donné
   */
  getHoursForDay(dayOfWeek) {
    const hours = this.businessHours;
    return hours[dayOfWeek] || null;
  }

  /**
   * Vérifie si un jour est ouvert
   */
  isOpenOnDay(dayOfWeek) {
    return this.getHoursForDay(dayOfWeek) !== null;
  }

  /**
   * Génère un message d'erreur tenant-aware (sans noms hardcodés)
   */
  getClosedMessage(dayOfWeek) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return `Nous sommes fermés le ${days[dayOfWeek]}.`;
  }

  getOpeningMessage(dayOfWeek) {
    const hours = this.getHoursForDay(dayOfWeek);
    if (!hours) return this.getClosedMessage(dayOfWeek);
    return `Nous ouvrons à ${hours.open} ce jour-là.`;
  }

  /**
   * Sérialise le contexte pour les logs
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      plan: this.plan,
      isActive: this.isActive,
      loadedAt: this.loadedAt,
    };
  }
}

/**
 * Charge un tenant depuis la base de données
 * JAMAIS de fallback - erreur si non trouvé
 */
export async function loadTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: tenantId parameter is required');
  }

  // Vérifier le cache
  const cached = tenantCache.get(tenantId);
  if (cached && (Date.now() - cached.loadedAt) < CACHE_TTL) {
    return cached;
  }

  // Charger depuis la BDD
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`TENANT_NOT_FOUND: Tenant '${tenantId}' does not exist in database`);
  }

  // Charger la config additionnelle si existe
  const { data: config } = await supabase
    .from('tenant_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // Charger les horaires depuis disponibilites si existent
  const { data: disponibilites } = await supabase
    .from('disponibilites')
    .select('jour_semaine, heure_debut, heure_fin, actif')
    .eq('tenant_id', tenantId);

  // Construire les business hours depuis les disponibilités
  let businessHours = { ...DEFAULT_BUSINESS_HOURS };
  if (disponibilites && disponibilites.length > 0) {
    businessHours = {};
    for (let i = 0; i < 7; i++) {
      const dispo = disponibilites.find(d => d.jour_semaine === i);
      if (dispo && dispo.actif) {
        businessHours[i] = { open: dispo.heure_debut, close: dispo.heure_fin };
      } else {
        businessHours[i] = null;
      }
    }
  }

  // Créer le contexte
  const context = new TenantContext(tenantId, tenant, {
    ...config,
    business_hours: businessHours,
  });

  // Mettre en cache
  tenantCache.set(tenantId, context);

  console.log(`[TenantContext] Loaded tenant: ${tenantId} (plan: ${context.plan})`);
  return context;
}

/**
 * Résout le tenant depuis une requête HTTP
 * Sources de tenant (par ordre de priorité):
 * 1. req.tenantId (déjà résolu par middleware auth)
 * 2. req.user.tenant_id (depuis JWT)
 * 3. req.admin.tenant_id (depuis JWT admin)
 * 4. Header X-Tenant-ID
 * 5. Query param tenant_id
 *
 * JAMAIS de fallback sur un tenant par défaut!
 */
export async function resolveTenantFromRequest(req) {
  // Essayer toutes les sources possibles
  const tenantId =
    req.tenantId ||
    req.user?.tenant_id ||
    req.admin?.tenant_id ||
    req.headers['x-tenant-id'] ||
    req.query?.tenant_id;

  if (!tenantId) {
    throw new Error('TENANT_ID_MISSING: No tenant_id found in request (checked: tenantId, user.tenant_id, admin.tenant_id, X-Tenant-ID header, query.tenant_id)');
  }

  return loadTenant(tenantId);
}

/**
 * Résout le tenant depuis un numéro de téléphone
 * Utilisé pour WhatsApp/Twilio
 * JAMAIS de fallback!
 */
export async function resolveTenantFromPhone(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('PHONE_REQUIRED: phoneNumber parameter is required');
  }

  // Nettoyer le numéro
  const cleanNumber = phoneNumber.replace(/\D/g, '').slice(-10);

  // Chercher dans la table tenants par téléphone
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .or(`telephone.ilike.%${cleanNumber},telephone_twilio.ilike.%${cleanNumber}`)
    .single();

  if (tenant) {
    return loadTenant(tenant.id);
  }

  // Chercher dans phone_routing si existe
  const { data: routing } = await supabase
    .from('phone_routing')
    .select('tenant_id')
    .eq('phone_number', cleanNumber)
    .single();

  if (routing) {
    return loadTenant(routing.tenant_id);
  }

  throw new Error(`TENANT_NOT_FOUND_FOR_PHONE: No tenant found for phone number ${phoneNumber}`);
}

/**
 * Résout le tenant depuis un domaine
 * Utilisé pour les routes publiques
 * JAMAIS de fallback!
 */
export async function resolveTenantFromDomain(host) {
  if (!host) {
    throw new Error('HOST_REQUIRED: host parameter is required');
  }

  // Nettoyer le host
  const cleanHost = host.toLowerCase().replace(/^www\./, '').split(':')[0];

  // Chercher par domaine custom
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .or(`domain.eq.${cleanHost},custom_domain.eq.${cleanHost}`)
    .single();

  if (tenant) {
    return loadTenant(tenant.id);
  }

  // Chercher par slug dans le sous-domaine
  const subdomain = cleanHost.split('.')[0];
  const { data: tenantBySlug } = await supabase
    .from('tenants')
    .select('id')
    .or(`id.eq.${subdomain},slug.eq.${subdomain}`)
    .single();

  if (tenantBySlug) {
    return loadTenant(tenantBySlug.id);
  }

  throw new Error(`TENANT_NOT_FOUND_FOR_DOMAIN: No tenant found for domain ${host}`);
}

/**
 * Middleware Express pour attacher le TenantContext à chaque requête
 * À utiliser APRÈS le middleware d'authentification
 */
export function tenantContextMiddleware(options = {}) {
  const { required = true, allowPublic = false } = options;

  return async (req, res, next) => {
    try {
      // Si déjà résolu, passer
      if (req.tenantContext) {
        return next();
      }

      // Essayer de résoudre le tenant
      try {
        req.tenantContext = await resolveTenantFromRequest(req);
        req.tenantId = req.tenantContext.id; // Compatibilité
        return next();
      } catch (resolveError) {
        // Si tenant requis, erreur
        if (required && !allowPublic) {
          console.error(`[TenantContext] ${resolveError.message}`);
          return res.status(400).json({
            error: 'tenant_required',
            message: 'A valid tenant_id is required for this operation',
            details: resolveError.message,
          });
        }

        // Si public autorisé, continuer sans tenant
        if (allowPublic) {
          req.tenantContext = null;
          return next();
        }

        throw resolveError;
      }
    } catch (error) {
      console.error(`[TenantContext] Middleware error:`, error);
      return res.status(500).json({
        error: 'tenant_resolution_failed',
        message: error.message,
      });
    }
  };
}

/**
 * Invalide le cache pour un tenant
 */
export function invalidateTenantCache(tenantId) {
  if (tenantId) {
    tenantCache.delete(tenantId);
    console.log(`[TenantContext] Cache invalidated for tenant: ${tenantId}`);
  } else {
    tenantCache.clear();
    console.log(`[TenantContext] All tenant caches cleared`);
  }
}

/**
 * Statistiques du cache (pour monitoring)
 */
export function getCacheStats() {
  return {
    size: tenantCache.size,
    tenants: Array.from(tenantCache.keys()),
  };
}

// Export par défaut
export default {
  TenantContext,
  loadTenant,
  resolveTenantFromRequest,
  resolveTenantFromPhone,
  resolveTenantFromDomain,
  tenantContextMiddleware,
  invalidateTenantCache,
  getCacheStats,
};
