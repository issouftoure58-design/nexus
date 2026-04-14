/**
 * Service de gestion des acomptes
 * Chaque tenant configure son propre lien de paiement externe
 * NEXUS ne gere PAS le paiement — notification + confirmation manuelle
 */

import { supabase } from '../config/supabase.js';
import { sendConfirmation } from './notificationService.js';
import logger from '../config/logger.js';

/**
 * Recupere la configuration acompte d'un tenant
 * @param {string} tenantId
 * @returns {Promise<{ enabled: boolean, rate: number, paymentUrl: string|null }>}
 */
export async function getDepositConfig(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('tenants')
    .select('deposit_enabled, deposit_rate, deposit_payment_url')
    .eq('id', tenantId)
    .single();

  if (error) {
    logger.warn('Erreur lecture deposit config', { tag: 'DepositService', tenantId, error: error.message });
    return { enabled: false, rate: 30, paymentUrl: null };
  }

  return {
    enabled: !!data.deposit_enabled,
    rate: data.deposit_rate || 30,
    paymentUrl: data.deposit_payment_url || null,
  };
}

/**
 * Calcule le montant de l'acompte en euros
 * @param {number} prixTotalCentimes - Prix total en centimes
 * @param {number} rate - Pourcentage (ex: 30)
 * @returns {number} Montant en euros (arrondi au centime)
 */
export function calculateDeposit(prixTotalCentimes, rate) {
  const prixEuros = prixTotalCentimes / 100;
  return Math.round(prixEuros * rate) / 100;
}

/**
 * Confirme la reception du paiement d'acompte
 * Passe le RDV en 'confirme' et envoie la confirmation cascade
 * @param {string} reservationId
 * @param {string} tenantId
 * @returns {Promise<{ success: boolean, notification?: object }>}
 */
export async function handleDepositReceived(reservationId, tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Charger le RDV avec les infos client
  const { data: rdv, error } = await supabase
    .from('reservations')
    .select('*, clients(telephone, email, prenom, nom)')
    .eq('id', reservationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !rdv) {
    throw new Error(`Reservation ${reservationId} non trouvee`);
  }

  if (rdv.statut !== 'demande') {
    throw new Error(`Reservation ${reservationId} n'est pas en demande (statut: ${rdv.statut})`);
  }

  // Passer en confirme
  const { error: updateErr } = await supabase
    .from('reservations')
    .update({ statut: 'confirme', updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    throw new Error(`Erreur mise a jour statut: ${updateErr.message}`);
  }

  logger.info('Acompte recu — RDV confirme', {
    tag: 'DepositService',
    reservationId,
    tenantId,
  });

  // Envoyer confirmation cascade (Email → WA → SMS)
  const depositConfig = await getDepositConfig(tenantId);
  const prixTotal = rdv.prix_total || rdv.prix_service || 0;
  const acompte = calculateDeposit(prixTotal, depositConfig.rate);

  const notifResult = await sendConfirmation({
    client_telephone: rdv.clients?.telephone || rdv.client_telephone,
    client_email: rdv.clients?.email || rdv.client_email,
    client_prenom: rdv.clients?.prenom || rdv.client_prenom,
    client_nom: rdv.clients?.nom || rdv.client_nom,
    service_nom: rdv.service_nom,
    date: rdv.date,
    heure: rdv.heure,
    prix_service: rdv.prix_service,
    frais_deplacement: rdv.frais_deplacement || 0,
    total: prixTotal / 100,
    adresse_client: rdv.adresse_client,
  }, acompte, tenantId);

  return { success: true, notification: notifResult };
}
