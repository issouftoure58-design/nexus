/**
 * Routes de paiement - Stripe & PayPal
 * Fat's Hair-Afro - Franconville
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  createStripePaymentIntent,
  confirmStripePayment,
  refundStripePayment,
  createPayPalOrder,
  capturePayPalOrder,
  refundPayPalPayment,
  eurosToCents,
  centsToEuros,
} from '../services/paymentService.js';
import { getDistanceFromSalon } from '../services/googleMapsService.js';
import { calculerFraisDepl } from '../utils/tarification.js';
import { sendConfirmation, sendAnnulation } from '../services/notificationService.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { authenticateAdmin } from './adminAuth.js';

// ============= SUPABASE CLIENT =============

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && process.env.SUPABASE_URL) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

const router = express.Router();

// Middleware d'idempotence pour prévenir les doubles paiements
router.use(idempotencyMiddleware);

// Montant de l'acompte fixe
const MONTANT_ACOMPTE = 10; // 10€

// ============= HELPERS =============

/**
 * Calcule le montant total avec frais de déplacement
 */
async function calculerMontantTotal(prixService, adresseClient) {
  let fraisDeplacement = 0;

  if (adresseClient) {
    try {
      const distance = await getDistanceFromSalon(adresseClient);
      // calculerFraisDepl retourne directement le montant en euros
      fraisDeplacement = calculerFraisDepl(distance.distance_km);
    } catch (error) {
      console.error('[Payment] Erreur calcul frais déplacement:', error.message);
      // Continuer sans frais de déplacement en cas d'erreur
    }
  }

  return {
    prix_service: prixService,
    frais_deplacement: fraisDeplacement,
    total: prixService + fraisDeplacement,
  };
}

/**
 * Sauvegarde une transaction dans la table payments
 */
async function saveTransaction(data) {
  const db = getSupabase();
  if (!db) {
    console.error('[Payment] Supabase non configuré');
    return { id: null, ...data };
  }

  const row = {
    reservation_id: data.rdv_id || null,
    order_id: data.order_id || null,
    provider: data.provider,
    payment_intent_id: data.payment_intent_id || null,
    paypal_order_id: data.paypal_order_id || null,
    amount: data.amount,
    type: data.type || 'acompte',
    status: data.status || 'pending',
    metadata: data.metadata || {},
    tenant_id: data.tenant_id, // REQUIRED - no fallback allowed
  };

  const { data: inserted, error } = await db
    .from('payments')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[Payment] Erreur saveTransaction:', error);
    return { id: null, ...data };
  }

  console.log(`[Payment] Transaction #${inserted.id} sauvegardée (${data.provider} - ${data.amount}€)`);
  return inserted;
}

/**
 * Récupère un RDV par ID avec les infos client
 * ⚠️ SECURITY: tenant_id REQUIRED for isolation
 */
async function getRdvById(rdvId, tenantId) {
  if (!tenantId) {
    console.error('[Payment] SECURITY: getRdvById called without tenantId!');
    return null;
  }

  const db = getSupabase();
  if (!db) return null;

  const { data: rdv, error } = await db
    .from('reservations')
    .select(`
      id, date, heure, statut, service_nom, duree_minutes,
      prix_service, frais_deplacement, prix_total,
      adresse_client, telephone, notes, created_via,
      client_id, created_at, updated_at, tenant_id,
      clients ( id, nom, prenom, telephone, email )
    `)
    .eq('id', rdvId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('[Payment] Erreur getRdvById:', error);
    return null;
  }

  return rdv;
}

/**
 * Met à jour un RDV (statut sur reservations + paiement dans payments)
 * ⚠️ SECURITY: tenant_id REQUIRED for isolation
 */
async function updateRdv(rdvId, tenantId, data) {
  if (!tenantId) {
    console.error('[Payment] SECURITY: updateRdv called without tenantId!');
    return { id: rdvId, error: 'TENANT_REQUIRED' };
  }

  const db = getSupabase();
  if (!db) return { id: rdvId, ...data };

  // Champs réservation (existent dans la table reservations)
  const rdvUpdate = {};
  if (data.statut) rdvUpdate.statut = data.statut;
  if (data.notes) rdvUpdate.notes = data.notes;
  rdvUpdate.updated_at = new Date().toISOString();

  // Mettre à jour la réservation avec filtre tenant_id
  if (Object.keys(rdvUpdate).length > 1) {
    const { error: rdvError } = await db
      .from('reservations')
      .update(rdvUpdate)
      .eq('id', rdvId)
      .eq('tenant_id', tenantId);

    if (rdvError) {
      console.error('[Payment] Erreur updateRdv reservations:', rdvError);
    }
  }

  // Mettre à jour le paiement associé (dans la table payments)
  const paymentUpdate = {};
  if (data.paiement_statut) {
    paymentUpdate.status = data.paiement_statut === 'paye' ? 'succeeded'
      : data.paiement_statut === 'acompte' ? 'succeeded'
      : data.paiement_statut;
  }
  if (data.paiement_id) paymentUpdate.payment_intent_id = data.paiement_id;
  if (data.paiement_capture_id) paymentUpdate.paypal_capture_id = data.paiement_capture_id;
  if (data.remboursement_id) paymentUpdate.refund_id = data.remboursement_id;
  if (data.remboursement_montant !== undefined) paymentUpdate.refund_amount = data.remboursement_montant;
  if (data.statut === 'annule') paymentUpdate.status = 'refunded';

  if (Object.keys(paymentUpdate).length > 0) {
    const { error: payError } = await db
      .from('payments')
      .update(paymentUpdate)
      .eq('reservation_id', rdvId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (payError) {
      console.error('[Payment] Erreur updateRdv payments:', payError);
    }
  }

  console.log(`[Payment] RDV #${rdvId} (tenant: ${tenantId}) mis à jour:`, data.statut || 'pas de changement statut');
  return { id: rdvId, ...data };
}

/**
 * Récupère les infos de paiement d'un RDV (le plus récent)
 * ⚠️ SECURITY: tenant_id REQUIRED for isolation
 */
async function getPaymentInfoByRdvId(rdvId, tenantId) {
  if (!tenantId) {
    console.error('[Payment] SECURITY: getPaymentInfoByRdvId called without tenantId!');
    return null;
  }

  const db = getSupabase();
  if (!db) return null;

  const { data: payment, error } = await db
    .from('payments')
    .select('*')
    .eq('reservation_id', rdvId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('[Payment] Erreur getPaymentInfoByRdvId:', error);
    return null;
  }

  return payment;
}

/**
 * Envoie une notification de confirmation (email + WhatsApp via notificationService)
 */
async function sendConfirmationEmail(rdvId, tenantId, paymentInfo) {
  const rdv = await getRdvById(rdvId, tenantId);
  if (!rdv) {
    console.error(`[Payment] RDV #${rdvId} introuvable pour envoi confirmation`);
    return;
  }

  const rdvData = {
    date: rdv.date,
    heure: rdv.heure,
    service_nom: rdv.service_nom,
    adresse_client: rdv.adresse_client,
    prix_service: rdv.prix_service ? rdv.prix_service / 100 : 0,
    frais_deplacement: rdv.frais_deplacement ? rdv.frais_deplacement / 100 : 0,
    total: rdv.prix_total ? rdv.prix_total / 100 : paymentInfo.montant,
    client_prenom: rdv.clients?.prenom || 'Client',
    client_nom: rdv.clients?.nom || '',
    client_email: rdv.clients?.email,
    client_telephone: rdv.clients?.telephone || rdv.telephone,
  };

  const acompte = paymentInfo.type === 'acompte' ? paymentInfo.montant : 0;

  try {
    const result = await sendConfirmation(rdvData, acompte);
    console.log(`[Payment] Confirmation envoyée pour RDV #${rdvId}:`, result);
  } catch (err) {
    console.error(`[Payment] Erreur envoi confirmation RDV #${rdvId}:`, err.message);
  }
}

/**
 * Envoie une notification d'annulation (email + WhatsApp via notificationService)
 */
async function sendCancellationEmail(rdvId, tenantId, refundInfo) {
  const rdv = await getRdvById(rdvId, tenantId);
  if (!rdv) {
    console.error(`[Payment] RDV #${rdvId} introuvable pour envoi annulation`);
    return;
  }

  const rdvData = {
    date: rdv.date,
    heure: rdv.heure,
    service_nom: rdv.service_nom,
    client_prenom: rdv.clients?.prenom || 'Client',
    client_nom: rdv.clients?.nom || '',
    client_email: rdv.clients?.email,
    client_telephone: rdv.clients?.telephone || rdv.telephone,
  };

  try {
    const result = await sendAnnulation(rdvData, refundInfo.montant_rembourse || 0);
    console.log(`[Payment] Annulation envoyée pour RDV #${rdvId}:`, result);
  } catch (err) {
    console.error(`[Payment] Erreur envoi annulation RDV #${rdvId}:`, err.message);
  }
}

// ============= ENDPOINTS STRIPE =============

/**
 * POST /api/payment/create-intent
 * Crée un PaymentIntent Stripe
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/create-intent', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { amount, type, rdv_id, adresse_client, prix_service } = req.body;

    // Validation
    if (!type || !['acompte', 'total'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type de paiement invalide (acompte ou total)',
      });
    }

    if (!rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'rdv_id requis',
      });
    }

    // Vérifier que le RDV appartient au tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    // Calculer le montant
    let montantAPayer;
    let montantDetails;

    if (type === 'acompte') {
      montantAPayer = MONTANT_ACOMPTE;
      montantDetails = { type: 'acompte', montant: MONTANT_ACOMPTE };
    } else {
      // Calculer le montant total avec frais de déplacement
      if (!prix_service && !amount) {
        return res.status(400).json({
          success: false,
          error: 'prix_service ou amount requis pour paiement total',
        });
      }

      const prixBase = prix_service || amount;
      montantDetails = await calculerMontantTotal(prixBase, adresse_client);
      montantAPayer = montantDetails.total;
    }

    // 🔒 TENANT SHIELD: Créer le PaymentIntent Stripe avec tenantId
    const paymentIntent = await createStripePaymentIntent(
      tenantId,
      eurosToCents(montantAPayer),
      {
        rdv_id: rdv_id.toString(),
        type: type,
        prix_service: montantDetails.prix_service?.toString() || '',
        frais_deplacement: montantDetails.frais_deplacement?.toString() || '0',
      }
    );

    // Sauvegarder la transaction avec tenant_id
    await saveTransaction({
      rdv_id,
      tenant_id: tenantId,
      payment_intent_id: paymentIntent.payment_intent_id,
      amount: montantAPayer,
      type,
      provider: 'stripe',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.payment_intent_id,
      amount: montantAPayer,
      amount_cents: eurosToCents(montantAPayer),
      type: type,
      details: montantDetails,
    });

  } catch (error) {
    console.error('[Payment] Erreur create-intent:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création paiement',
    });
  }
});

/**
 * POST /api/payment/confirm-stripe
 * Confirme un paiement Stripe et met à jour le RDV
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/confirm-stripe', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { payment_intent_id, rdv_id } = req.body;

    if (!payment_intent_id || !rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'payment_intent_id et rdv_id requis',
      });
    }

    // Vérifier que le RDV appartient au tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    // 🔒 TENANT SHIELD: Vérifier le paiement avec tenantId
    const paymentStatus = await confirmStripePayment(tenantId, payment_intent_id);

    if (!paymentStatus.confirmed) {
      return res.status(400).json({
        success: false,
        error: `Paiement non confirmé. Status: ${paymentStatus.status}`,
        status: paymentStatus.status,
      });
    }

    // Déterminer le type de paiement
    const type = paymentStatus.metadata?.type || 'acompte';
    const montant = centsToEuros(paymentStatus.amount);

    // Mettre à jour le RDV
    await updateRdv(rdv_id, tenantId, {
      statut: 'confirme',
      paiement_statut: type === 'total' ? 'paye' : 'acompte',
      paiement_montant: montant,
      paiement_methode: 'stripe',
      paiement_id: payment_intent_id,
      paiement_date: new Date().toISOString(),
    });

    // Envoyer email de confirmation
    await sendConfirmationEmail(rdv_id, tenantId, {
      montant,
      type,
      methode: 'Carte bancaire',
    });

    res.json({
      success: true,
      message: 'Paiement confirmé et RDV mis à jour',
      rdv_id,
      payment: {
        id: payment_intent_id,
        amount: montant,
        type,
        status: 'confirmed',
      },
    });

  } catch (error) {
    console.error('[Payment] Erreur confirm-stripe:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur confirmation paiement',
    });
  }
});

// ============= ENDPOINTS PAYPAL =============

/**
 * POST /api/payment/create-paypal-order
 * Crée une commande PayPal
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/create-paypal-order', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { amount, type, rdv_id, adresse_client, prix_service, description } = req.body;

    // Validation
    if (!type || !['acompte', 'total'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type de paiement invalide (acompte ou total)',
      });
    }

    if (!rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'rdv_id requis',
      });
    }

    // Vérifier que le RDV appartient au tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    // Calculer le montant
    let montantAPayer;
    let montantDetails;

    if (type === 'acompte') {
      montantAPayer = MONTANT_ACOMPTE;
      montantDetails = { type: 'acompte', montant: MONTANT_ACOMPTE };
    } else {
      if (!prix_service && !amount) {
        return res.status(400).json({
          success: false,
          error: 'prix_service ou amount requis pour paiement total',
        });
      }

      const prixBase = prix_service || amount;
      montantDetails = await calculerMontantTotal(prixBase, adresse_client);
      montantAPayer = montantDetails.total;
    }

    // 🔒 TENANT SHIELD: Créer la commande PayPal avec tenantId
    const order = await createPayPalOrder(tenantId, montantAPayer, {
      rdv_id: rdv_id.toString(),
      description: description || `Réservation Fat's Hair-Afro - ${type}`,
    });

    // Sauvegarder la transaction avec tenant_id
    await saveTransaction({
      rdv_id,
      tenant_id: tenantId,
      paypal_order_id: order.order_id,
      amount: montantAPayer,
      type,
      provider: 'paypal',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      order_id: order.order_id,
      approval_url: order.approval_url,
      amount: montantAPayer,
      type: type,
      details: montantDetails,
    });

  } catch (error) {
    console.error('[Payment] Erreur create-paypal-order:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création commande PayPal',
    });
  }
});

/**
 * POST /api/payment/capture-paypal
 * Capture une commande PayPal après validation
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/capture-paypal', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { order_id, rdv_id } = req.body;

    if (!order_id || !rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'order_id et rdv_id requis',
      });
    }

    // Vérifier que le RDV appartient au tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    // 🔒 TENANT SHIELD: Capturer le paiement avec tenantId
    const capture = await capturePayPalOrder(tenantId, order_id);

    if (!capture.captured) {
      return res.status(400).json({
        success: false,
        error: `Paiement non capturé. Status: ${capture.status}`,
        status: capture.status,
      });
    }

    const montant = parseFloat(capture.amount) || 0;
    const type = montant <= MONTANT_ACOMPTE ? 'acompte' : 'total';

    // Mettre à jour le RDV
    await updateRdv(rdv_id, tenantId, {
      statut: 'confirme',
      paiement_statut: type === 'total' ? 'paye' : 'acompte',
      paiement_montant: montant,
      paiement_methode: 'paypal',
      paiement_id: order_id,
      paiement_capture_id: capture.capture_id,
      paiement_date: new Date().toISOString(),
    });

    // Envoyer email de confirmation
    await sendConfirmationEmail(rdv_id, tenantId, {
      montant,
      type,
      methode: 'PayPal',
      payer_email: capture.payer_email,
    });

    res.json({
      success: true,
      message: 'Paiement PayPal capturé et RDV mis à jour',
      rdv_id,
      payment: {
        order_id,
        capture_id: capture.capture_id,
        amount: montant,
        type,
        status: 'captured',
        payer_email: capture.payer_email,
      },
    });

  } catch (error) {
    console.error('[Payment] Erreur capture-paypal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur capture PayPal',
    });
  }
});

// ============= ENDPOINT REMBOURSEMENT =============

/**
 * POST /api/payment/refund
 * Rembourse un paiement (Stripe ou PayPal)
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/refund', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { rdv_id, raison } = req.body;

    if (!rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'rdv_id requis',
      });
    }

    // Récupérer les infos du RDV et du paiement avec isolation tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    const paymentInfo = await getPaymentInfoByRdvId(rdv_id, tenantId);

    if (!paymentInfo) {
      return res.status(404).json({
        success: false,
        error: 'Aucun paiement trouvé pour ce RDV',
      });
    }

    // Calculer le montant du remboursement selon les règles d'annulation
    const dateReservation = new Date(paymentInfo.created_at);
    const maintenant = new Date();
    const heuresDepuisReservation = (maintenant - dateReservation) / (1000 * 60 * 60);

    let montantRembourse;
    let regleAppliquee;

    if (heuresDepuisReservation < 24) {
      // Moins de 24h : remboursement total
      montantRembourse = paymentInfo.amount;
      regleAppliquee = 'Annulation < 24h : remboursement total';
    } else {
      // Plus de 24h : on garde l'acompte de 10€
      montantRembourse = Math.max(0, paymentInfo.amount - MONTANT_ACOMPTE);
      regleAppliquee = `Annulation > 24h : remboursement - ${MONTANT_ACOMPTE}€ (acompte retenu)`;
    }

    // Effectuer le remboursement selon le provider
    let refundResult;

    // 🔒 TENANT SHIELD: Remboursement avec tenantId
    if (paymentInfo.provider === 'stripe') {
      refundResult = await refundStripePayment(
        tenantId,
        paymentInfo.payment_intent_id,
        montantRembourse > 0 ? eurosToCents(montantRembourse) : null
      );
    } else if (paymentInfo.provider === 'paypal') {
      refundResult = await refundPayPalPayment(
        tenantId,
        paymentInfo.capture_id,
        montantRembourse > 0 ? montantRembourse : null
      );
    } else {
      return res.status(400).json({
        success: false,
        error: `Provider de paiement inconnu: ${paymentInfo.provider}`,
      });
    }

    // Mettre à jour le RDV
    await updateRdv(rdv_id, tenantId, {
      statut: 'annule',
      annulation_date: new Date().toISOString(),
      annulation_raison: raison || 'Non spécifiée',
      remboursement_montant: montantRembourse,
      remboursement_id: refundResult.refund_id,
      remboursement_date: new Date().toISOString(),
    });

    // Envoyer email d'annulation
    await sendCancellationEmail(rdv_id, tenantId, {
      montant_initial: paymentInfo.amount,
      montant_rembourse: montantRembourse,
      montant_retenu: paymentInfo.amount - montantRembourse,
      raison,
      regle: regleAppliquee,
    });

    res.json({
      success: true,
      message: 'Remboursement effectué',
      rdv_id,
      refund: {
        refund_id: refundResult.refund_id,
        original_amount: paymentInfo.amount,
        refunded_amount: montantRembourse,
        retained_amount: paymentInfo.amount - montantRembourse,
        rule_applied: regleAppliquee,
        provider: paymentInfo.provider,
      },
    });

  } catch (error) {
    console.error('[Payment] Erreur refund:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur remboursement',
    });
  }
});

// ============= ENDPOINT STATUS =============

/**
 * GET /api/payment/status/:rdv_id
 * Récupère le statut de paiement d'un RDV
 * ⚠️ SECURED: Requires admin authentication
 */
router.get('/status/:rdv_id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { rdv_id } = req.params;

    // Vérifier que le RDV appartient au tenant
    const rdv = await getRdvById(rdv_id, tenantId);
    if (!rdv) {
      return res.status(404).json({
        success: false,
        error: 'RDV non trouvé ou accès refusé',
      });
    }

    const paymentInfo = await getPaymentInfoByRdvId(rdv_id, tenantId);

    if (!paymentInfo) {
      return res.status(404).json({
        success: false,
        error: 'Aucun paiement trouvé pour ce RDV',
      });
    }

    res.json({
      success: true,
      payment: paymentInfo,
    });

  } catch (error) {
    console.error('[Payment] Erreur status:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statut',
    });
  }
});

// ============= ENDPOINTS ORDERS (PANIER) =============

/**
 * POST /api/payment/order/create-intent
 * Crée un PaymentIntent Stripe pour une commande panier
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/order/create-intent', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { amount, orderId, clientEmail, clientName, items } = req.body;

    // Validation
    if (!amount || amount < 50) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (minimum 50 centimes)',
      });
    }

    // Validation montant positif
    if (amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (doit être positif)',
      });
    }

    // 🔒 TENANT SHIELD: Créer le PaymentIntent Stripe avec tenantId
    const paymentIntent = await createStripePaymentIntent(tenantId, amount, {
      order_id: orderId?.toString() || 'pending',
      client_email: clientEmail || '',
      client_name: clientName || '',
      items_count: items?.length?.toString() || '0',
      type: 'order',
    });

    console.log(`[Payment] PaymentIntent créé pour commande: ${paymentIntent.payment_intent_id} - ${amount / 100}€`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.payment_intent_id,
      amount: paymentIntent.amount,
    });

  } catch (error) {
    console.error('[Payment] Erreur order/create-intent:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur création paiement',
    });
  }
});

/**
 * POST /api/payment/order/confirm
 * Confirme un paiement Stripe et crée la commande
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/order/confirm', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { paymentIntentId, orderData } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId requis',
      });
    }

    // 🔒 TENANT SHIELD: Vérifier le paiement avec tenantId
    const paymentStatus = await confirmStripePayment(tenantId, paymentIntentId);

    if (!paymentStatus.confirmed) {
      return res.status(400).json({
        success: false,
        error: `Paiement non confirmé. Status: ${paymentStatus.status}`,
        status: paymentStatus.status,
      });
    }

    console.log(`[Payment] Paiement confirmé: ${paymentIntentId} (tenant: ${tenantId})`);

    res.json({
      success: true,
      message: 'Paiement confirmé',
      payment: {
        id: paymentIntentId,
        amount: centsToEuros(paymentStatus.amount),
        status: 'confirmed',
      },
    });

  } catch (error) {
    console.error('[Payment] Erreur order/confirm:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur confirmation paiement',
    });
  }
});

// ============= ENDPOINTS PAYPAL ORDERS (PANIER) =============

/**
 * POST /api/payment/order/create-paypal
 * Crée une commande PayPal pour le panier
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/order/create-paypal', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { amount, clientEmail, clientName, items } = req.body;

    // Validation
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (minimum 1€)',
      });
    }

    // Validation montant positif
    if (amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (doit être positif)',
      });
    }

    // Montant en euros pour PayPal
    const amountEuros = amount / 100;

    // Description des services
    const description = items?.length > 0
      ? `Fat's Hair-Afro - ${items.map(i => i.serviceNom).join(', ')}`
      : 'Réservation Fat\'s Hair-Afro';

    // 🔒 TENANT SHIELD: Créer la commande PayPal avec tenantId
    const order = await createPayPalOrder(tenantId, amountEuros, {
      description,
      client_email: clientEmail || '',
      client_name: clientName || '',
      return_url: `${process.env.APP_URL || 'http://localhost:5000'}/panier?paypal=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/panier?paypal=cancel`,
    });

    console.log(`[Payment] PayPal Order créé: ${order.order_id} - ${amountEuros}€`);

    res.json({
      success: true,
      orderId: order.order_id,
      approvalUrl: order.approval_url,
      amount: amountEuros,
    });

  } catch (error) {
    console.error('[Payment] Erreur order/create-paypal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur création commande PayPal',
    });
  }
});

/**
 * POST /api/payment/order/capture-paypal
 * Capture le paiement PayPal après approbation
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/order/capture-paypal', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'orderId requis',
      });
    }

    // 🔒 TENANT SHIELD: Capturer le paiement avec tenantId
    const capture = await capturePayPalOrder(tenantId, orderId);

    if (!capture.captured) {
      return res.status(400).json({
        success: false,
        error: `Paiement non capturé. Status: ${capture.status}`,
        status: capture.status,
      });
    }

    console.log(`[Payment] PayPal capturé: ${orderId} - ${capture.amount}€ (tenant: ${tenantId})`);

    res.json({
      success: true,
      message: 'Paiement PayPal confirmé',
      payment: {
        orderId: capture.order_id,
        captureId: capture.capture_id,
        amount: parseFloat(capture.amount),
        payerEmail: capture.payer_email,
        status: 'captured',
      },
    });

  } catch (error) {
    console.error('[Payment] Erreur order/capture-paypal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur capture PayPal',
    });
  }
});

export default router;
