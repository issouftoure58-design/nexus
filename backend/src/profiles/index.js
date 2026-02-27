/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUSINESS PROFILES - Loader & Registry
 * Gestion centralisée des profils métiers
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../config/supabase.js';

// Cache des profils (TTL: 5 minutes)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Cache des profils par tenant
const tenantProfileCache = new Map();

/**
 * Charger un profil métier depuis la BDD
 * @param {string} profileId - ID du profil (beauty, security, etc.)
 * @returns {object|null} Configuration du profil
 */
export async function getProfileById(profileId) {
  // Vérifier le cache
  const cached = profileCache.get(profileId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error(`[PROFILES] Profil non trouvé: ${profileId}`);
      return null;
    }

    // Construire l'objet profil enrichi
    const profile = buildProfileObject(data);

    // Mettre en cache
    profileCache.set(profileId, { data: profile, timestamp: Date.now() });

    return profile;
  } catch (err) {
    console.error('[PROFILES] Erreur chargement profil:', err);
    return null;
  }
}

/**
 * Charger le profil métier d'un tenant
 * @param {string} tenantId - ID du tenant
 * @returns {object|null} Configuration du profil
 */
export async function loadProfile(tenantId) {
  if (!tenantId) {
    console.error('[PROFILES] tenant_id requis');
    return null;
  }

  // Vérifier le cache tenant
  const cached = tenantProfileCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    console.log(`[PROFILES] Recherche tenant: ${tenantId}`);

    // Récupérer le profil du tenant (colonne = 'id')
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('business_profile')
      .eq('id', tenantId)
      .single();

    console.log(`[PROFILES] Résultat:`, tenant ? `business_profile=${tenant.business_profile}` : 'null', tenantError ? `err=${tenantError.code}` : '');

    // Si toujours pas trouvé, utiliser le profil par défaut
    if (tenantError || !tenant) {
      console.warn(`[PROFILES] Tenant non trouvé: ${tenantId}, erreur:`, tenantError?.message || 'pas de données');
      // Retourner un profil beauty par défaut
      const defaultProfile = await getProfileById('beauty');
      if (defaultProfile) {
        tenantProfileCache.set(tenantId, { data: defaultProfile, timestamp: Date.now() });
        return defaultProfile;
      }
      return getDefaultProfile();
    }

    const profileId = tenant.business_profile || 'beauty';

    // Charger le profil
    const profile = await getProfileById(profileId);

    if (!profile) {
      console.error(`[PROFILES] Profil ${profileId} non trouvé pour tenant ${tenantId}`);
      return null;
    }

    // Merger avec la config personnalisée du tenant si existe
    const customConfig = {};
    const mergedProfile = {
      ...profile,
      tenantConfig: customConfig,
    };

    // Mettre en cache
    tenantProfileCache.set(tenantId, { data: mergedProfile, timestamp: Date.now() });

    console.log(`[PROFILES] ✓ Chargé ${profileId} pour ${tenantId}`);

    return mergedProfile;
  } catch (err) {
    console.error('[PROFILES] Erreur chargement profil tenant:', err);
    return null;
  }
}

/**
 * Profil par défaut (fallback absolu)
 */
function getDefaultProfile() {
  return {
    id: 'beauty',
    label: 'Beauté & Bien-être',
    description: 'Salons de coiffure, instituts de beauté',
    icon: 'Scissors',
    pricing: {
      mode: 'fixed',
      allowedModes: ['fixed'],
    },
    duration: {
      mode: 'fixed',
      allowMultiDay: false,
      allowOvernight: false,
    },
    terminology: {
      reservation: { singular: 'Prestation', plural: 'Prestations' },
      service: { singular: 'Service', plural: 'Services' },
      client: { singular: 'Client', plural: 'Clients' },
      employee: { singular: 'Employé', plural: 'Employés' },
      duration: 'Durée',
      quantity: 'Quantité',
    },
    fields: {
      service: { required: ['nom', 'prix', 'duree_minutes'], optional: [], forbidden: ['taux_horaire'] },
      reservation: { required: ['date_rdv', 'heure_rdv'], optional: [], forbidden: ['date_fin'] },
    },
    rules: {},
  };
}

/**
 * Construire l'objet profil enrichi depuis les données BDD
 */
function buildProfileObject(data) {
  return {
    id: data.id,
    label: data.label,
    description: data.description,
    icon: data.icon,

    // Configuration tarification
    pricing: {
      mode: data.pricing_mode,
      allowedModes: (data.pricing_modes_allowed || '').split(',').filter(Boolean),
      calculate: getPricingFunction(data.pricing_mode),
    },

    // Configuration durée
    duration: {
      mode: data.duration_mode,
      allowMultiDay: data.allow_multi_day,
      allowOvernight: data.allow_overnight,
    },

    // Terminologie
    terminology: data.terminology || {},

    // Configuration des champs
    fields: data.field_config || {},

    // Règles métier
    rules: data.business_rules || {},

    // Méthodes utilitaires
    getLabel: (key, plural = false) => {
      const term = data.terminology?.[key];
      if (!term) return key;
      return plural ? term.plural : term.singular;
    },

    isFieldRequired: (context, field) => {
      const required = data.field_config?.[context]?.required || [];
      return required.includes(field);
    },

    isFieldForbidden: (context, field) => {
      const forbidden = data.field_config?.[context]?.forbidden || [];
      return forbidden.includes(field);
    },

    getRule: (ruleName) => {
      return data.business_rules?.[ruleName];
    },
  };
}

/**
 * Obtenir la fonction de calcul de prix selon le mode
 */
function getPricingFunction(mode) {
  switch (mode) {
    case 'hourly':
      return (service, params) => {
        const { startTime, endTime, quantity = 1 } = params;
        const hours = calculateHours(startTime, endTime);
        const rate = service.taux_horaire || service.hourlyRate || 0;
        return Math.round(rate * hours * quantity);
      };

    case 'daily':
      return (service, params) => {
        const { startDate, endDate, quantity = 1 } = params;
        const days = calculateDays(startDate, endDate);
        const rate = service.taux_journalier || service.dailyRate || 0;
        return Math.round(rate * days * quantity);
      };

    case 'package':
      return (service, params) => {
        const { quantity = 1, options = [] } = params;
        let total = service.prix_forfait || service.packagePrice || 0;
        // Ajouter les options
        options.forEach(opt => {
          total += opt.prix || 0;
        });
        return Math.round(total * quantity);
      };

    case 'fixed':
    default:
      return (service, params) => {
        const { quantity = 1 } = params;
        const price = service.prix || service.price || 0;
        return Math.round(price * quantity);
      };
  }
}

/**
 * Calculer le nombre d'heures entre deux horaires
 */
function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Si fin < début, c'est une mission de nuit (ex: 22:00 -> 06:00)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Calculer le nombre de jours entre deux dates
 */
function calculateDays(startDate, endDate) {
  if (!startDate) return 1;
  if (!endDate) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Inclure le jour de début
}

/**
 * Valider les données selon le profil
 * @param {object} profile - Profil métier
 * @param {object} data - Données à valider
 * @param {string} context - Contexte (service, reservation)
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateProfileData(profile, data, context) {
  const errors = [];
  const fieldConfig = profile.fields?.[context];

  if (!fieldConfig) {
    return { valid: true, errors: [] };
  }

  // Vérifier les champs requis
  const required = fieldConfig.required || [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      const fieldLabel = profile.terminology?.[field] || field;
      errors.push(`Champ requis: ${fieldLabel}`);
    }
  }

  // Vérifier les champs interdits
  const forbidden = fieldConfig.forbidden || [];
  for (const field of forbidden) {
    if (data[field] !== undefined && data[field] !== null) {
      errors.push(`Champ non autorisé pour le profil ${profile.label}: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: profile.id,
  };
}

/**
 * Lister tous les profils disponibles
 */
export async function listProfiles() {
  try {
    const { data, error } = await supabase
      .from('business_profiles')
      .select('id, label, description, icon, pricing_mode')
      .eq('is_active', true)
      .order('label');

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('[PROFILES] Erreur liste profils:', err);
    return [];
  }
}

/**
 * Changer le profil d'un tenant
 */
export async function changeProfileTenant(tenantId, newProfileId, adminId = null) {
  try {
    // Vérifier que le profil existe
    const profile = await getProfileById(newProfileId);
    if (!profile) {
      return { success: false, error: 'Profil non trouvé' };
    }

    // Mettre à jour le tenant
    const { error } = await supabase
      .from('tenants')
      .update({
        business_profile: newProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) throw error;

    // Invalider le cache
    tenantProfileCache.delete(tenantId);

    // Log d'audit
    await supabase.from('business_profile_audit').insert({
      tenant_id: tenantId,
      action: 'profile_changed',
      profile_id: newProfileId,
      details: { admin_id: adminId },
    });

    console.log(`[PROFILES] ✓ Profil changé: ${tenantId} → ${newProfileId}`);

    return { success: true, profile };
  } catch (err) {
    console.error('[PROFILES] Erreur changement profil:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Invalider le cache pour un tenant
 */
export function invalidateProfileCache(tenantId) {
  if (tenantId) {
    tenantProfileCache.delete(tenantId);
  } else {
    tenantProfileCache.clear();
    profileCache.clear();
  }
}

export default {
  loadProfile,
  getProfileById,
  validateProfileData,
  listProfiles,
  changeProfileTenant,
  invalidateProfileCache,
};
