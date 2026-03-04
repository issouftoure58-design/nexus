/**
 * Service Handler — get_services, list_services
 * Gestion du catalogue de services pour l'admin chat.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

/**
 * Récupère la liste des services actifs du tenant, formatée avec prix et durée.
 */
async function get_services(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    let query = supabase
      .from('services')
      .select('id, nom, description, prix, duree_minutes, categorie, actif')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('categorie', { ascending: true });

    // Filtre par catégorie si spécifié
    if (toolInput.categorie) {
      query = query.eq('categorie', toolInput.categorie);
    }

    const { data: services, error } = await query;

    if (error) {
      logger.error('[SERVICE HANDLER] Erreur get_services:', { error, tenantId });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      nb_services: services?.length || 0,
      services: services?.map(s => ({
        id: s.id,
        nom: s.nom,
        description: s.description,
        prix: `${(s.prix / 100).toFixed(2)}€`,
        prix_centimes: s.prix,
        duree: s.duree_minutes >= 60
          ? `${Math.floor(s.duree_minutes / 60)}h${s.duree_minutes % 60 > 0 ? s.duree_minutes % 60 : ''}`
          : `${s.duree_minutes}min`,
        duree_minutes: s.duree_minutes,
        categorie: s.categorie
      })) || []
    };
  } catch (error) {
    logger.error('[SERVICE HANDLER] Erreur get_services:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const serviceHandlers = {
  get_services,
  list_services: get_services
};
