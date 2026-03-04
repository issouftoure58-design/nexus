/**
 * Recherche Handler — recherche_web, recherche_actualites, recherche_concurrent, recherche_tendances
 * Outils de recherche web via Tavily (rechercheWeb module).
 */

import logger from '../../config/logger.js';

let rechercheModule = null;

async function loadRechercheModule() {
  if (rechercheModule) return rechercheModule;

  try {
    rechercheModule = await import('../halimahPro/rechercheWeb.js');
    return rechercheModule;
  } catch (error) {
    logger.warn('[RECHERCHE HANDLER] Module rechercheWeb non disponible:', { error: error.message });
    return null;
  }
}

function serviceNonConfigure() {
  return {
    success: false,
    error: 'Service de recherche non configure (cle Tavily requise)'
  };
}

async function recherche_web(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.query) {
      return { success: false, error: 'Parametre "query" requis' };
    }

    const mod = await loadRechercheModule();
    if (!mod) return serviceNonConfigure();

    const result = await mod.rechercheWeb({
      query: toolInput.query,
      maxResults: toolInput.maxResults || 5
    });

    return {
      success: true,
      query: toolInput.query,
      resultats: result
    };
  } catch (error) {
    logger.error('[RECHERCHE HANDLER] Erreur recherche_web:', { error: error.message, tenantId });
    if (error.message?.includes('API') || error.message?.includes('key') || error.message?.includes('Tavily')) {
      return serviceNonConfigure();
    }
    return { success: false, error: error.message };
  }
}

async function recherche_actualites(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.query) {
      return { success: false, error: 'Parametre "query" requis' };
    }

    const mod = await loadRechercheModule();
    if (!mod) return serviceNonConfigure();

    const result = await mod.rechercheActualites({
      query: toolInput.query,
      maxResults: toolInput.maxResults || 5
    });

    return {
      success: true,
      query: toolInput.query,
      type: 'actualites',
      resultats: result
    };
  } catch (error) {
    logger.error('[RECHERCHE HANDLER] Erreur recherche_actualites:', { error: error.message, tenantId });
    if (error.message?.includes('API') || error.message?.includes('key') || error.message?.includes('Tavily')) {
      return serviceNonConfigure();
    }
    return { success: false, error: error.message };
  }
}

async function recherche_concurrent(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.name) {
      return { success: false, error: 'Parametre "name" (nom du concurrent) requis' };
    }

    const mod = await loadRechercheModule();
    if (!mod) return serviceNonConfigure();

    const result = await mod.rechercheEntreprise({
      name: toolInput.name,
      location: toolInput.location || ''
    });

    return {
      success: true,
      concurrent: toolInput.name,
      location: toolInput.location || 'non specifiee',
      resultats: result
    };
  } catch (error) {
    logger.error('[RECHERCHE HANDLER] Erreur recherche_concurrent:', { error: error.message, tenantId });
    if (error.message?.includes('API') || error.message?.includes('key') || error.message?.includes('Tavily')) {
      return serviceNonConfigure();
    }
    return { success: false, error: error.message };
  }
}

async function recherche_tendances(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.domain) {
      return { success: false, error: 'Parametre "domain" (theme/secteur) requis' };
    }

    const mod = await loadRechercheModule();
    if (!mod) return serviceNonConfigure();

    const result = await mod.rechercheTendances({
      domain: toolInput.domain,
      year: toolInput.year || new Date().getFullYear()
    });

    return {
      success: true,
      domain: toolInput.domain,
      year: toolInput.year || new Date().getFullYear(),
      resultats: result
    };
  } catch (error) {
    logger.error('[RECHERCHE HANDLER] Erreur recherche_tendances:', { error: error.message, tenantId });
    if (error.message?.includes('API') || error.message?.includes('key') || error.message?.includes('Tavily')) {
      return serviceNonConfigure();
    }
    return { success: false, error: error.message };
  }
}

export const rechercheHandlers = {
  recherche_web,
  recherche_actualites,
  recherche_concurrent,
  recherche_tendances
};
