/**
 * Client Recognition Service
 *
 * Détecte si l'appelant/messager est un client existant
 * et charge son contexte historique pour personnaliser l'accueil.
 *
 * @module clientRecognition
 */

import { supabase } from '../config/supabase.js';

/**
 * Normalise un numéro de téléphone pour la recherche
 * Gère les formats: 0612345678, +33612345678, 33612345678, 06 12 34 56 78
 * @param {string} phone
 * @returns {string[]} - Variantes du numéro à chercher
 */
function getPhoneVariants(phone) {
  if (!phone) return [];

  // Nettoyer : garder uniquement les chiffres et le +
  const cleaned = phone.replace(/[\s\-\.()]/g, '');
  const variants = new Set();
  variants.add(cleaned);

  // Si commence par +33 → ajouter version 0x
  if (cleaned.startsWith('+33')) {
    variants.add('0' + cleaned.slice(3));
    variants.add(cleaned.slice(1)); // sans le +
  }

  // Si commence par 33 (sans +) → ajouter version 0x et +33x
  if (cleaned.startsWith('33') && cleaned.length >= 11) {
    variants.add('0' + cleaned.slice(2));
    variants.add('+' + cleaned);
  }

  // Si commence par 0 → ajouter version +33 et 33
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    variants.add('+33' + cleaned.slice(1));
    variants.add('33' + cleaned.slice(1));
  }

  return [...variants];
}

/**
 * Recherche un client par téléphone et charge son historique récent
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} phone - Numéro de téléphone de l'appelant
 * @returns {Promise<Object>} - { known, client?, displayName?, lastVisit?, visitCount?, recentServices? }
 */
export async function recognizeClient(tenantId, phone) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!phone) return { known: false };

  try {
    const variants = getPhoneVariants(phone);
    if (variants.length === 0) return { known: false };

    // Chercher le client par téléphone (toutes les variantes)
    const orFilter = variants.map(v => `telephone.eq.${v}`).join(',');
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, prenom, nom, telephone, email, type_client, raison_sociale')
      .eq('tenant_id', tenantId)
      .or(orFilter)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`[CLIENT_RECOGNITION] Erreur recherche client:`, error.message);
      return { known: false };
    }

    if (!client) return { known: false };

    // Charger les derniers RDV/réservations
    const { data: rdvs } = await supabase
      .from('reservations')
      .select('id, date, service_nom, statut')
      .eq('tenant_id', tenantId)
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(5);

    const completedRdvs = (rdvs || []).filter(r => r.statut !== 'annule');
    const displayName = client.prenom
      ? `${client.prenom} ${client.nom || ''}`.trim()
      : client.nom || 'Client';

    return {
      known: true,
      client: {
        id: client.id,
        prenom: client.prenom,
        nom: client.nom,
        telephone: client.telephone,
        email: client.email,
        type_client: client.type_client,
        raison_sociale: client.raison_sociale,
      },
      displayName,
      lastVisit: completedRdvs[0]?.date || null,
      visitCount: completedRdvs.length,
      recentServices: [...new Set(completedRdvs.map(r => r.service_nom).filter(Boolean))],
    };
  } catch (err) {
    console.error(`[CLIENT_RECOGNITION] Erreur inattendue:`, err.message);
    return { known: false };
  }
}

export default { recognizeClient };
