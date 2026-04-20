/**
 * Service de Checkout Stripe dynamique pour les acomptes
 * Crée une session Stripe Checkout avec le montant exact de l'acompte
 * en utilisant la clé Stripe du tenant (pas celle de NEXUS)
 */

import Stripe from 'stripe';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Récupère la clé Stripe secrète d'un tenant
 * @param {string} tenantId
 * @returns {Promise<string|null>}
 */
async function getTenantStripeKey(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('tenants')
    .select('stripe_secret_key')
    .eq('id', tenantId)
    .single();

  if (error || !data?.stripe_secret_key) {
    return null;
  }

  return data.stripe_secret_key;
}

/**
 * Crée une session Stripe Checkout pour un acompte
 * Utilise la clé Stripe du tenant pour que le paiement arrive chez lui
 *
 * @param {string} tenantId
 * @param {Object} params
 * @param {number} params.montantCentimes - Montant de l'acompte en centimes
 * @param {string} params.serviceName - Nom du service
 * @param {string} params.clientNom - Nom du client
 * @param {string} params.clientEmail - Email du client (optionnel)
 * @param {string} params.reservationId - ID de la réservation
 * @param {string} params.date - Date du RDV
 * @param {string} params.heure - Heure du RDV
 * @param {string} params.salonName - Nom du salon
 * @returns {Promise<{url: string, sessionId: string}|null>} URL de checkout ou null si pas de clé
 */
export async function createDepositCheckoutSession(tenantId, params) {
  if (!tenantId) throw new Error('tenant_id requis');

  const stripeKey = await getTenantStripeKey(tenantId);
  if (!stripeKey) {
    logger.info('Pas de clé Stripe tenant, fallback lien statique', { tag: 'DepositCheckout', tenantId });
    return null;
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  const { montantCentimes, serviceName, clientNom, clientEmail, reservationId, date, heure, salonName } = params;

  // URL de callback après paiement réussi
  const backendUrl = process.env.BACKEND_URL || 'https://nexus-backend-dev.onrender.com';
  const successUrl = `${backendUrl}/api/deposit/success?session_id={CHECKOUT_SESSION_ID}&tenant_id=${tenantId}`;
  const cancelUrl = `${backendUrl}/api/deposit/cancel?tenant_id=${tenantId}`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Reservation - ${serviceName}`,
            description: `RDV du ${date} a ${heure} - ${salonName}`,
          },
          unit_amount: Math.round(montantCentimes),
        },
        quantity: 1,
      }],
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      metadata: {
        tenant_id: tenantId,
        reservation_id: reservationId,
        type: 'deposit',
        client_nom: clientNom || '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(`[DepositCheckout] Session créée: ${session.id} — ${montantCentimes / 100}€ pour tenant ${tenantId}`);

    return {
      url: session.url,
      sessionId: session.id,
    };
  } catch (error) {
    console.error(`[DepositCheckout] Erreur création session:`, error.message);
    logger.error('Erreur création Checkout Session', { tag: 'DepositCheckout', tenantId, error: error.message });
    return null;
  }
}

/**
 * Vérifie le paiement d'une session Checkout et confirme la réservation
 * @param {string} sessionId - ID de la session Stripe
 * @param {string} tenantId
 * @returns {Promise<{success: boolean, reservationId?: string, error?: string}>}
 */
export async function verifyDepositPayment(sessionId, tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!sessionId) throw new Error('session_id requis');

  console.log(`[DepositCheckout] 🔍 verifyDepositPayment(session=${sessionId}, tenant=${tenantId})`);

  const stripeKey = await getTenantStripeKey(tenantId);
  if (!stripeKey) {
    console.error(`[DepositCheckout] ❌ Pas de stripe_secret_key pour tenant ${tenantId}`);
    return { success: false, error: 'Clé Stripe tenant non configurée' };
  }

  console.log(`[DepositCheckout] ✅ Clé Stripe trouvée (${stripeKey.substring(0, 7)}...)`);
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  try {
    // Retry avec délai progressif — Stripe peut rediriger AVANT que payment_status passe à 'paid'
    // Surtout avec 3D Secure, le paiement peut prendre plusieurs secondes
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log(`[DepositCheckout] Session récupérée: payment_status=${session.payment_status}, status=${session.status}`);
    } catch (stripeErr) {
      console.error(`[DepositCheckout] ❌ Erreur retrieve session: ${stripeErr.message}`);
      return { success: false, error: `Erreur Stripe: ${stripeErr.message}` };
    }

    // Retries progressifs pour les paiements 3D Secure
    const delays = [2000, 3000, 5000];
    for (const delay of delays) {
      if (session.payment_status === 'paid') break;
      console.log(`[DepositCheckout] ⏳ payment_status=${session.payment_status}, retry dans ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      session = await stripe.checkout.sessions.retrieve(sessionId);
    }

    if (session.payment_status !== 'paid') {
      console.warn(`[DepositCheckout] ❌ Paiement non confirmé après retries (payment_status=${session.payment_status}, status=${session.status})`);
      return { success: false, error: `Paiement non complété (statut: ${session.payment_status})` };
    }

    console.log(`[DepositCheckout] ✅ Paiement confirmé !`);

    const reservationId = session.metadata?.reservation_id;
    if (!reservationId) {
      console.error(`[DepositCheckout] ❌ reservation_id manquant dans metadata:`, JSON.stringify(session.metadata));
      return { success: false, error: 'reservation_id manquant dans metadata' };
    }

    console.log(`[DepositCheckout] 📋 reservation_id=${reservationId}, metadata:`, JSON.stringify(session.metadata));

    // Vérifier que la réservation appartient bien au tenant (avec client + adresse)
    const { data: rdv, error: rdvError } = await supabase
      .from('reservations')
      .select('id, statut, client_id, telephone, service_nom, date, heure, prix_total, prix_service, frais_deplacement, adresse_client, clients(nom, prenom, telephone, email)')
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (rdvError || !rdv) {
      console.error(`[DepositCheckout] ❌ Réservation non trouvée: rdv=${reservationId}, tenant=${tenantId}, err=${rdvError?.message}`);
      return { success: false, error: `Réservation non trouvée (${rdvError?.message || 'aucun résultat'})` };
    }

    console.log(`[DepositCheckout] 📋 RDV trouvé: id=${rdv.id}, statut=${rdv.statut}, service=${rdv.service_nom}`);

    // Idempotent: si déjà confirmé, renvoyer succès sans re-update
    if (rdv.statut === 'confirme') {
      console.log(`[DepositCheckout] ℹ️ RDV déjà confirmé, skip update`);
      return { success: true, reservationId };
    }

    // Passer en confirmé — .select() pour vérifier que l'update a bien affecté la ligne
    const { data: updated, error: updateError } = await supabase
      .from('reservations')
      .update({
        statut: 'confirme',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .select('id, statut')
      .single();

    if (updateError || !updated) {
      console.error(`[DepositCheckout] ❌ Update statut failed: ${updateError?.message || 'Aucune ligne affectée'} (rdv=${reservationId}, tenant=${tenantId})`);
      return { success: false, error: `Erreur mise à jour: ${updateError?.message || 'Aucune ligne affectée'}` };
    }

    console.log(`[DepositCheckout] ✅ Acompte payé — RDV ${reservationId} statut=${updated.statut} pour tenant ${tenantId}`);

    const { calculateDeposit, getDepositConfig } = await import('./depositService.js');
    const depositConfig = await getDepositConfig(tenantId);
    const acompte = calculateDeposit(rdv.prix_total || 0, depositConfig.rate);

    // Envoyer confirmation au client
    try {
      const { sendConfirmation } = await import('./notificationService.js');

      await sendConfirmation({
        client_telephone: rdv.clients?.telephone || rdv.telephone,
        client_email: rdv.clients?.email || null,
        client_prenom: rdv.clients?.prenom || null,
        client_nom: rdv.clients?.nom || null,
        service_nom: rdv.service_nom,
        date: rdv.date,
        heure: rdv.heure,
        prix_service: rdv.prix_service || rdv.prix_total,
        frais_deplacement: (rdv.frais_deplacement || 0) / 100,
        adresse_client: rdv.adresse_client,
        total: (rdv.prix_total || 0) / 100,
      }, acompte, tenantId);
    } catch (notifError) {
      console.error('[DepositCheckout] Erreur envoi confirmation client:', notifError.message);
    }

    // Notifier le tenant (in-app + SMS admin)
    try {
      const { notifyAllAdmins } = await import('./inboxService.js');
      await notifyAllAdmins(tenantId, {
        type: 'success',
        title: 'Paiement recu',
        message: `Acompte de ${acompte}\u20AC regle pour ${rdv.service_nom} le ${rdv.date} a ${rdv.heure}. RDV confirme automatiquement.`,
        link: '/activites',
        icon: 'credit-card',
      });

      // SMS au premier admin qui a un telephone
      const { data: admins } = await supabase
        .from('admin_users')
        .select('telephone')
        .eq('tenant_id', tenantId)
        .not('telephone', 'is', null)
        .limit(1);

      if (admins?.[0]?.telephone) {
        const { sendSMS } = await import('./notificationService.js');
        await sendSMS(
          admins[0].telephone,
          `Paiement recu : ${acompte}\u20AC\n${rdv.service_nom} - ${rdv.date} a ${rdv.heure}\nRDV confirme automatiquement.`,
          tenantId,
          { essential: true }
        );
      }
    } catch (adminNotifError) {
      console.error('[DepositCheckout] Erreur notif admin:', adminNotifError.message);
    }

    return { success: true, reservationId };
  } catch (error) {
    console.error('[DepositCheckout] Erreur vérification:', error.message);
    return { success: false, error: error.message };
  }
}
