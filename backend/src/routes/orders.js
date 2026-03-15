import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendConfirmation } from '../services/notificationService.js';
// 🔒 NEXUS CORE - Fonction unique de création RDV
import { createReservationUnified } from '../core/unified/nexusCore.js';
// 🔒 Config publique pour le checkout + règles métier
import { SERVICE_OPTIONS, TRAVEL_FEES, BLOCKING_STATUTS, BUSINESS_HOURS } from '../config/businessRules.js';
// 🔒 Horaires dynamiques par tenant
import { getBusinessHoursForTenant } from '../services/tenantBusinessRules.js';
// 🔒 Business type pour default lieu
import { getDefaultLocation } from '../services/tenantBusinessService.js';

const router = express.Router();

// ============= CHECKOUT - CONFIG PUBLIQUE =============
// GET /api/orders/checkout/config
// Expose les options de service pour le frontend
router.get('/checkout/config', (req, res) => {
  res.json({
    success: true,
    config: {
      domicileEnabled: SERVICE_OPTIONS.DOMICILE_ENABLED,
      domicileDisabledMessage: SERVICE_OPTIONS.DOMICILE_DISABLED_MESSAGE,
    },
  });
});

// ============= CRÉER UNE COMMANDE =============
// POST /api/orders
router.post('/', async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    const {
      items,
      clientId: providedClientId, // ID client si utilisateur connecté
      lieu,
      adresseClient,
      distanceKm,
      dureeTrajetMinutes,
      dateRdv,
      heureDebut,
      sousTotal,
      fraisDeplacement,
      total,
      clientNom,
      clientPrenom,
      clientTelephone,
      clientEmail,
      paiementMethode,
      paiementId,  // ID PayPal si paiement déjà capturé
      notes,
    } = req.body;

    // ═══════════════════════════════════════════════════════════════════════
    // 🔒 VALIDATION SÉCURISÉE CÔTÉ SERVEUR
    // ═══════════════════════════════════════════════════════════════════════

    // 1. Validation basique
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Panier vide' });
    }
    if (!lieu || !dateRdv || !heureDebut) {
      return res.status(400).json({ success: false, error: 'Informations de réservation incomplètes' });
    }
    if (!clientNom || !clientTelephone) {
      return res.status(400).json({ success: false, error: 'Informations client requises' });
    }

    // 2. C4: Validation DOMICILE_ENABLED côté serveur
    if (lieu === 'domicile' && !SERVICE_OPTIONS.DOMICILE_ENABLED) {
      return res.status(400).json({
        success: false,
        error: SERVICE_OPTIONS.DOMICILE_DISABLED_MESSAGE || 'Les réservations à domicile ne sont pas disponibles actuellement.'
      });
    }

    // 3. G1: Validation téléphone (format français)
    const phoneRegex = /^(?:0[1-9][0-9]{8}|\+33[1-9][0-9]{8})$/;
    const cleanPhoneForValidation = clientTelephone.replace(/[\s.-]/g, '');
    if (!phoneRegex.test(cleanPhoneForValidation)) {
      return res.status(400).json({ success: false, error: 'Numéro de téléphone invalide (format: 0612345678 ou +33612345678)' });
    }

    // 4. M7: Validation date pas dans le passé
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rdvDate = new Date(dateRdv);
    if (rdvDate < today) {
      return res.status(400).json({ success: false, error: 'La date de réservation ne peut pas être dans le passé' });
    }

    // 5. C1: RECALCUL DES PRIX CÔTÉ SERVEUR (anti-manipulation)
    let calculatedSousTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      // 🔒 BUG 2 FIX: Réparation Locks est un service SPÉCIAL avec prix variable
      // Il faut le traiter AVANT la recherche DB car il existe en DB avec prix unitaire
      if (item.serviceNom === 'Réparation Locks') {
        // Validation quantité (1-100 locks)
        const quantity = Math.round(item.dureeMinutes / 30); // 30 min par lock
        if (quantity < 1 || quantity > 100) {
          return res.status(400).json({ success: false, error: 'Quantité de locks invalide (1-100)' });
        }
        const expectedPrice = quantity * 1000; // 10€ par lock en centimes
        const expectedDuration = quantity * 30;

        // Vérifier cohérence prix/durée (tolérance pour arrondis)
        if (Math.abs(item.prix - expectedPrice) > 100 || Math.abs(item.dureeMinutes - expectedDuration) > 5) {
          console.warn(`[ORDERS] Réparation Locks: prix=${item.prix} vs expected=${expectedPrice}, durée=${item.dureeMinutes} vs expected=${expectedDuration}`);
          return res.status(400).json({ success: false, error: 'Prix ou durée incohérents pour Réparation Locks' });
        }
        calculatedSousTotal += expectedPrice;
        validatedItems.push({ ...item, prix: expectedPrice, dureeMinutes: expectedDuration });
        continue; // Passer au prochain item
      }

      // Vérifier que le service existe en DB (🔒 TENANT ISOLATION)
      const { data: dbService, error: serviceError } = await supabase
        .from('services')
        .select('id, nom, prix, duree')
        .eq('nom', item.serviceNom)
        .eq('tenant_id', tenantId)
        .single();

      if (serviceError || !dbService) {
        return res.status(400).json({ success: false, error: `Service inconnu: ${item.serviceNom}` });
      }

      // Service standard - utiliser le prix de la DB
      calculatedSousTotal += dbService.prix; // prix en centimes
      validatedItems.push({
        ...item,
        prix: dbService.prix,
        dureeMinutes: item.dureeMinutes || dbService.duree
      });
    }

    // 6. Recalculer les frais de déplacement si domicile
    let calculatedFraisDeplacement = 0;
    if (lieu === 'domicile' && distanceKm > 0) {
      calculatedFraisDeplacement = Math.round(TRAVEL_FEES.calculate(distanceKm) * 100); // en centimes

      // G3: Si calcul impossible (distanceKm = 0 mais domicile), bloquer
      if (!distanceKm || distanceKm <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Impossible de calculer les frais de déplacement. Veuillez vérifier votre adresse.'
        });
      }
    }

    // 7. Calculer le total serveur
    const calculatedTotal = calculatedSousTotal + calculatedFraisDeplacement;

    // 8. M1: Vérifier que les prix sont positifs
    if (calculatedSousTotal <= 0) {
      return res.status(400).json({ success: false, error: 'Le montant de la commande doit être positif' });
    }

    // 9. Comparer avec les prix client (tolérance 1€ pour arrondis)
    const priceTolerance = 100; // 1€ en centimes
    if (Math.abs(calculatedTotal - total) > priceTolerance) {
      console.warn(`[ORDERS] ⚠️ Incohérence prix: client=${total}, serveur=${calculatedTotal}`);
      return res.status(400).json({
        success: false,
        error: 'Incohérence de prix détectée. Veuillez rafraîchir la page et réessayer.'
      });
    }

    // Utiliser les prix recalculés par le serveur
    const finalSousTotal = calculatedSousTotal;
    const finalFraisDeplacement = calculatedFraisDeplacement;
    const finalTotal = calculatedTotal;

    // Utiliser le clientId fourni (utilisateur connecté) ou chercher/créer
    let clientId = providedClientId || null;
    const cleanPhone = clientTelephone.replace(/\s/g, '');

    // Si clientId fourni, vérifier qu'il existe (🔒 TENANT ISOLATION)
    if (clientId) {
      const { data: existingClient, error: clientCheckError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('tenant_id', tenantId)
        .single();

      if (clientCheckError || !existingClient) {
        console.error('[ORDERS] Client ID invalide:', clientId);
        clientId = null; // Réinitialiser pour chercher par téléphone
      }
    }

    // Si pas de clientId valide, chercher par téléphone ou créer (🔒 TENANT ISOLATION)
    if (!clientId) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('telephone', cleanPhone)
        .eq('tenant_id', tenantId)
        .single();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            tenant_id: tenantId,
            nom: clientNom,
            prenom: clientPrenom,
            telephone: cleanPhone,
            email: clientEmail,
          })
          .select('id')
          .single();

        if (clientError) {
          console.error('[ORDERS] Erreur création client:', clientError);
          return res.status(500).json({ success: false, error: 'Erreur création client' });
        }
        clientId = newClient.id;
      }
    }

    // Créer la commande (avec prix recalculés par le serveur) (🔒 TENANT ISOLATION)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        statut: paiementMethode === 'sur_place' ? 'en_attente' : 'en_attente',
        sous_total: finalSousTotal,           // 🔒 Prix recalculé serveur
        frais_deplacement: finalFraisDeplacement, // 🔒 Frais recalculés serveur
        total: finalTotal,                     // 🔒 Total recalculé serveur
        paiement_methode: paiementMethode,
        paiement_statut: paiementMethode === 'sur_place' ? 'en_attente' : 'en_attente',
        lieu: lieu,
        adresse_client: adresseClient,
        distance_km: distanceKm,
        duree_trajet_minutes: dureeTrajetMinutes,
        date_rdv: dateRdv,
        heure_debut: heureDebut,
        client_nom: clientNom,
        client_prenom: clientPrenom,
        client_telephone: cleanPhone,
        client_email: clientEmail,
        notes: notes,
      })
      .select()
      .single();

    if (orderError) {
      console.error('[ORDERS] Erreur création commande:', orderError);
      return res.status(500).json({ success: false, error: 'Erreur création commande' });
    }

    // Créer les items de commande (avec prix validés serveur) (🔒 TENANT ISOLATION)
    const orderItems = validatedItems.map((item, index) => ({
      tenant_id: tenantId,
      order_id: order.id,
      service_nom: item.serviceNom,
      service_description: item.serviceDescription,
      duree_minutes: item.dureeMinutes,
      prix: item.prix,  // 🔒 Prix de la DB, pas du client
      ordre: index,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('[ORDERS] Erreur création items:', itemsError);
      // Supprimer la commande si les items échouent (🔒 TENANT ISOLATION)
      await supabase.from('orders').delete().eq('id', order.id).eq('tenant_id', tenantId);
      return res.status(500).json({ success: false, error: 'Erreur création items commande' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CRÉER LES RÉSERVATIONS POUR TOUS LES MODES DE PAIEMENT
    // Statut différent selon le mode de paiement:
    // - sur_place → 'demande' (confirmé immédiatement)
    // - paypal avec paiementId → 'demande' (paiement déjà capturé)
    // - stripe/paypal sans paiementId → 'en_attente_paiement' (confirmé après paiement)
    // ═══════════════════════════════════════════════════════════════════════
    const isPaymentAlreadyCaptured = paiementMethode === 'paypal' && paiementId;
    const statutReservation = (paiementMethode === 'sur_place' || isPaymentAlreadyCaptured) ? 'demande' : 'en_attente_paiement';
    // 🔒 TENANT ISOLATION: Passer le tenantId
    await createReservationsFromOrder(order.id, clientId, items, dateRdv, heureDebut, lieu, adresseClient, statutReservation, {}, tenantId);
    console.log(`[ORDERS] ✅ Réservations créées avec statut: ${statutReservation}`);

    // 📱 Toujours envoyer SMS de confirmation (même en attente de paiement)
    await sendOrderConfirmation(order, items, clientTelephone, clientEmail, tenantId);

    if (paiementMethode === 'sur_place' || isPaymentAlreadyCaptured) {
      // Mettre à jour statut commande (🔒 TENANT ISOLATION)
      const updateData = {
        statut: 'confirme',
        ...(isPaymentAlreadyCaptured && {
          paiement_statut: 'paye',
          paiement_id: paiementId,
          paiement_date: new Date().toISOString(),
        }),
      };
      await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id)
        .eq('tenant_id', tenantId);

      if (isPaymentAlreadyCaptured) {
        console.log(`[ORDERS] ✅ Commande PayPal confirmée automatiquement (paiement déjà capturé)`);
      }
    }

    res.json({
      success: true,
      orderId: order.id,
      message: paiementMethode === 'sur_place'
        ? 'Commande confirmée ! Vous recevrez une confirmation par SMS.'
        : 'Commande créée. Procédez au paiement.',
    });

  } catch (error) {
    console.error('[ORDERS] Erreur:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= RÉCUPÉRER UNE COMMANDE =============
// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, error: 'Commande non trouvée' });
    }

    res.json({ success: true, order });

  } catch (error) {
    console.error('[ORDERS] Erreur get order:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= CONFIRMER PAIEMENT SUR PLACE =============
// POST /api/orders/:id/confirm-onsite
router.post('/:id/confirm-onsite', async (req, res) => {
  try {
    const { id } = req.params;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    // Récupérer la commande (🔒 TENANT ISOLATION)
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ success: false, error: 'Commande non trouvée' });
    }

    if (order.statut !== 'en_attente') {
      return res.status(400).json({ success: false, error: 'Commande déjà traitée' });
    }

    // Vérifier si des réservations existent déjà pour cette commande (🔒 TENANT ISOLATION)
    const { data: existingReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('order_id', order.id)
      .eq('tenant_id', tenantId);

    if (!existingReservations || existingReservations.length === 0) {
      // Créer les réservations (pour les anciennes commandes sans réservations)
      await createReservationsFromOrder(
        order.id,
        order.client_id,
        order.order_items,
        order.date_rdv,
        order.heure_debut,
        order.lieu,
        order.adresse_client,
        'demande',  // Statut pour paiement sur place
        {},
        tenantId  // 🔒 TENANT ISOLATION: Passer le tenantId
      );
    } else {
      // Mettre à jour le statut des réservations existantes (🔒 TENANT ISOLATION)
      await supabase
        .from('reservations')
        .update({ statut: 'demande' })
        .eq('order_id', order.id)
        .eq('tenant_id', tenantId);
    }

    // Mettre à jour la commande (🔒 TENANT ISOLATION)
    await supabase
      .from('orders')
      .update({
        statut: 'confirme',
        paiement_methode: 'sur_place',
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    // Envoyer notifications
    await sendOrderConfirmation(order, order.order_items, order.client_telephone, order.client_email, tenantId);

    res.json({
      success: true,
      message: 'Réservation confirmée ! Vous recevrez une confirmation par SMS.',
    });

  } catch (error) {
    console.error('[ORDERS] Erreur confirm-onsite:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= CONFIRMER PAIEMENT EN LIGNE (Stripe/PayPal) =============
// POST /api/orders/:id/confirm-payment
// Appelé après succès du paiement Stripe ou PayPal
router.post('/:id/confirm-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paiementId, paiementMethode } = req.body;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    console.log(`[ORDERS] Confirmation paiement en ligne pour commande #${id}`);

    // Récupérer la commande (🔒 TENANT ISOLATION)
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ success: false, error: 'Commande non trouvée' });
    }

    if (order.statut === 'confirme' || order.paiement_statut === 'paye') {
      return res.status(400).json({ success: false, error: 'Commande déjà payée' });
    }

    // Mettre à jour la commande (🔒 TENANT ISOLATION)
    await supabase
      .from('orders')
      .update({
        statut: 'confirme',
        paiement_statut: 'paye',
        paiement_id: paiementId,
        paiement_methode: paiementMethode || order.paiement_methode,
        paiement_date: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    // Mettre à jour le statut des réservations (🔒 TENANT ISOLATION)
    const { error: updateError } = await supabase
      .from('reservations')
      .update({ statut: 'demande' })
      .eq('order_id', order.id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[ORDERS] Erreur mise à jour réservations:', updateError);
    } else {
      console.log(`[ORDERS] ✅ Réservations mises à jour: en_attente_paiement → demande`);
    }

    // Envoyer notifications
    await sendOrderConfirmation(order, order.order_items, order.client_telephone, order.client_email, tenantId);

    res.json({
      success: true,
      message: 'Paiement confirmé ! Vous recevrez une confirmation par SMS.',
    });

  } catch (error) {
    console.error('[ORDERS] Erreur confirm-payment:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= CRÉER LES RÉSERVATIONS DEPUIS UNE COMMANDE =============
// 🔒 Utilise createReservationUnified (NEXUS CORE)
// statut: 'demande' (paiement sur place) ou 'en_attente_paiement' (paiement en ligne)
// 🔒 TENANT ISOLATION: Ajout du paramètre tenantId
async function createReservationsFromOrder(orderId, clientId, items, dateRdv, heureDebut, lieu, adresseClient, statut = 'demande', clientInfo = {}, tenantId = null) {
  let currentTime = heureDebut;
  console.log(`[ORDERS] Création de ${items.length} réservation(s) pour commande #${orderId} avec statut: ${statut}`);

  // Récupérer les infos client si pas fournies (🔒 TENANT ISOLATION)
  let clientData = clientInfo;
  if (!clientData.telephone && clientId) {
    const query = supabase
      .from('clients')
      .select('nom, prenom, telephone, email')
      .eq('id', clientId);

    // Ajouter le filtre tenant_id si disponible
    if (tenantId) {
      query.eq('tenant_id', tenantId);
    }

    const { data: client } = await query.single();
    if (client) {
      clientData = {
        nom: `${client.prenom} ${client.nom}`.trim(),
        telephone: client.telephone,
        email: client.email
      };
    }
  }

  for (const item of items) {
    const dureeMinutes = item.duree_minutes || item.dureeMinutes;
    const serviceNom = item.service_nom || item.serviceNom;

    // Utiliser createReservationUnified via NEXUS CORE
    // 🔒 TENANT ISOLATION: Passer le tenant_id pour la création de réservation
    const result = await createReservationUnified({
      tenant_id: tenantId,  // 🔒 CRITICAL: tenant_id requis pour créer la réservation
      service_name: serviceNom,
      date: dateRdv,
      heure: currentTime,
      client_nom: clientData.nom || 'Client Panier',
      client_telephone: clientData.telephone || '',
      client_email: clientData.email || null,
      lieu: lieu === 'domicile' ? 'domicile' : getDefaultLocation(tenantId),
      adresse: adresseClient || null,
      order_id: orderId,
      statut: statut,
      notes: `Commande panier #${orderId}`,
      duree_minutes: dureeMinutes
    }, 'panier', {
      sendSMS: false,  // SMS envoyé séparément pour la commande complète
      skipValidation: true  // Validation déjà faite au niveau panier
    });

    if (result.success) {
      // Mettre à jour l'item avec l'ID de réservation
      await supabase
        .from('order_items')
        .update({ reservation_id: result.reservationId })
        .eq('id', item.id);
    } else {
      console.error('[ORDERS] Erreur création réservation:', result.error);
    }

    // Calculer l'heure du prochain service (+10 min pause)
    const [hours, minutes] = currentTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + dureeMinutes + 10;
    const nextHours = Math.floor(totalMinutes / 60);
    const nextMinutes = totalMinutes % 60;
    currentTime = `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
  }
}

// ============= ENVOYER CONFIRMATION COMMANDE =============
async function sendOrderConfirmation(order, items, telephone, email, tenantId = null) {
  try {
    // Formater la liste des services
    const servicesList = items.map(item => {
      const nom = item.service_nom || item.serviceNom;
      const prix = (item.prix / 100).toFixed(0);
      return `- ${nom} (${prix}€)`;
    }).join('\n');

    const dateFormatted = new Date(order.date_rdv).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let defaultAddress = 'Sur place';
    try {
      const info = getDefaultLocation(tenantId);
      defaultAddress = info || defaultAddress;
    } catch (e) { /* fallback */ }
    const lieuText = order.lieu === 'sur_place'
      ? defaultAddress
      : order.adresse_client;

    const totalEuros = (order.total / 100).toFixed(0);
    const paiementText = order.paiement_methode === 'sur_place'
      ? 'À régler sur place'
      : 'Payé en ligne';

    // Envoyer notification (Email + WhatsApp) via notificationService
    try {
      const rdvForNotification = {
        client_telephone: telephone,
        client_email: email,
        client_nom: order.client_nom,
        date: order.date_rdv,
        heure: order.heure_debut,
        service_nom: items.map(i => i.service_nom || i.serviceNom).join(', '),
        adresse_client: lieuText,
        total: order.total / 100, // Convertir centimes en euros
      };

      const acompte = order.paiement_methode === 'sur_place' ? 0 : 10;
      await sendConfirmation(rdvForNotification, acompte, tenantId || order.tenant_id);
    } catch (notifError) {
      console.error('[ORDERS] Erreur notification:', notifError);
    }

  } catch (error) {
    console.error('[ORDERS] Erreur notifications:', error);
  }
}

// ============= CHECKOUT - CALCULER LE TOTAL =============
// POST /api/orders/checkout/calculate
router.post('/checkout/calculate', async (req, res) => {
  try {
    const { items, lieu, adresse } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Panier vide' });
    }

    // Calculer sous-total
    const sousTotal = items.reduce((sum, item) => sum + (item.prix * 100), 0); // en centimes

    // Calculer frais de déplacement si domicile
    let fraisDeplacement = 0;
    let distanceKm = 0;
    let dureeTrajetMinutes = 0;

    if (lieu === 'domicile' && adresse) {
      try {
        // Import dynamique pour éviter les erreurs
        const { getDistanceFromSalon } = await import('../../../server/google-maps-service.js');

        const distance = await getDistanceFromSalon(adresse);
        console.log('[ORDERS] Distance result:', distance);

        if (distance) {
          distanceKm = distance.distance_km;
          dureeTrajetMinutes = distance.duree_minutes;

          // Calcul des frais de déplacement
          // Tarif: 10€ base (8km inclus) + 1.10€/km au-delà
          const FRAIS_BASE = 10;
          const DISTANCE_INCLUSE = 8;
          const TARIF_KM_SUP = 1.10;

          let fraisTotal = FRAIS_BASE;
          if (distanceKm > DISTANCE_INCLUSE) {
            fraisTotal += (distanceKm - DISTANCE_INCLUSE) * TARIF_KM_SUP;
          }
          fraisTotal = Math.round(fraisTotal * 100) / 100;
          fraisDeplacement = Math.round(fraisTotal * 100); // en centimes

          console.log('[ORDERS] Frais calculés:', fraisTotal, '€ =', fraisDeplacement, 'centimes');
        }
      } catch (error) {
        console.error('[ORDERS] Erreur calcul distance:', error);
        // Frais par défaut si erreur
        fraisDeplacement = 1000; // 10€
      }
    }

    const total = sousTotal + fraisDeplacement;

    // Calculer durée totale
    const dureeTotale = items.reduce((sum, item) => sum + item.duree, 0);

    res.json({
      success: true,
      sousTotal,
      fraisDeplacement,
      total,
      distanceKm,
      dureeTrajetMinutes,
      dureeTotale,
    });

  } catch (error) {
    console.error('[ORDERS] Erreur calculate:', error);
    res.status(500).json({ success: false, error: 'Erreur calcul' });
  }
});

// ============= CHECKOUT - CRÉNEAUX DISPONIBLES =============
// GET /api/orders/checkout/available-slots?date=YYYY-MM-DD&duration=minutes
router.get('/checkout/available-slots', async (req, res) => {
  try {
    const { date, duration } = req.query;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date requise' });
    }

    const dureeTotale = parseInt(duration) || 60; // Durée en minutes

    // Parser la date pour obtenir le jour de la semaine
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // 🔒 Horaires dynamiques depuis DB (fallback hardcodé)
    const tenantHours = await getBusinessHoursForTenant(tenantId);
    const dayHours = tenantHours.getHours(dayOfWeek);
    const horaires = dayHours ? { ouverture: dayHours.open, fermeture: dayHours.close } : null;

    if (!horaires) {
      return res.json({
        success: true,
        date,
        slots: [],
        message: 'Fermé ce jour',
      });
    }

    // Générer tous les créneaux possibles (intervalle 1h)
    const toMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const ouvertureMin = toMinutes(horaires.ouverture);
    const fermetureMin = toMinutes(horaires.fermeture);

    const allSlots = [];
    for (let min = ouvertureMin; min < fermetureMin; min += 60) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      allSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }

    // Récupérer les RDV existants pour cette date (🔒 TENANT ISOLATION)
    const { data: existingRdvs, error: rdvError } = await supabase
      .from('reservations')
      .select('heure, duree_minutes, service_nom')
      .eq('date', date)
      .eq('tenant_id', tenantId)
      .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés

    if (rdvError) {
      console.error('[ORDERS] Erreur fetch RDV:', rdvError);
    }

    // Calculer les plages occupées
    const occupiedRanges = (existingRdvs || []).map(rdv => {
      const start = toMinutes(rdv.heure);
      // Durée par défaut si non renseignée
      const duration = rdv.duree_minutes || 60;
      return { start, end: start + duration };
    });

    // Filtrer les créneaux disponibles
    const availableSlots = allSlots.filter(slot => {
      const slotStart = toMinutes(slot);
      const slotEnd = slotStart + dureeTotale;

      // Vérifier que le service ne dépasse pas la fermeture
      if (slotEnd > fermetureMin) {
        return false;
      }

      // Vérifier qu'il n'y a pas de chevauchement
      for (const range of occupiedRanges) {
        // Chevauchement si : slotStart < range.end ET slotEnd > range.start
        if (slotStart < range.end && slotEnd > range.start) {
          return false;
        }
      }

      return true;
    });

    // Si c'est aujourd'hui, filtrer les créneaux passés
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const filteredSlots = date === today
      ? availableSlots.filter(slot => slot > currentTime)
      : availableSlots;

    res.json({
      success: true,
      date,
      duration: dureeTotale,
      horaires: `${horaires.ouverture} - ${horaires.fermeture}`,
      slots: filteredSlots,
      count: filteredSlots.length,
    });

  } catch (error) {
    console.error('[ORDERS] Erreur available-slots:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= CHECKOUT - DATES DISPONIBLES =============
// GET /api/orders/checkout/available-dates?duration=minutes&days=14
router.get('/checkout/available-dates', async (req, res) => {
  try {
    const { duration, days } = req.query;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;
    const dureeTotale = parseInt(duration) || 60;
    const nbDays = parseInt(days) || 14;

    // 🔒 Horaires dynamiques depuis DB
    const tenantHours = await getBusinessHoursForTenant(tenantId);
    const getHoraires = (dow) => {
      const bh = tenantHours.getHours(dow);
      return bh ? { ouverture: bh.open, fermeture: bh.close } : null;
    };

    const toMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const availableDates = [];
    const today = new Date();

    for (let i = 1; i <= nbDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dayOfWeek = date.getDay();
      const horaires = getHoraires(dayOfWeek);

      // Ignorer les jours fermés
      if (!horaires) continue;

      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // Récupérer les RDV pour ce jour (🔒 TENANT ISOLATION)
      const { data: existingRdvs } = await supabase
        .from('reservations')
        .select('heure, duree_minutes')
        .eq('date', dateStr)
        .eq('tenant_id', tenantId)
        .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés

      // Calculer les plages occupées
      const occupiedRanges = (existingRdvs || []).map(rdv => {
        const start = toMinutes(rdv.heure);
        const dur = rdv.duree_minutes || 60;
        return { start, end: start + dur };
      });

      // Générer tous les créneaux possibles
      const ouvertureMin = toMinutes(horaires.ouverture);
      const fermetureMin = toMinutes(horaires.fermeture);

      let hasAvailableSlot = false;
      for (let min = ouvertureMin; min < fermetureMin; min += 60) {
        const slotEnd = min + dureeTotale;

        // Vérifier que le service ne dépasse pas la fermeture
        if (slotEnd > fermetureMin) continue;

        // Vérifier qu'il n'y a pas de chevauchement
        let isAvailable = true;
        for (const range of occupiedRanges) {
          if (min < range.end && slotEnd > range.start) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          hasAvailableSlot = true;
          break;
        }
      }

      if (hasAvailableSlot) {
        const joursFr = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
        availableDates.push({
          value: dateStr,
          jour: joursFr[dayOfWeek],
          label: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        });
      }
    }

    res.json({
      success: true,
      duration: dureeTotale,
      dates: availableDates,
      count: availableDates.length,
    });

  } catch (error) {
    console.error('[ORDERS] Erreur available-dates:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============= CHECKOUT - DISPONIBILITÉS DE LA SEMAINE =============
// GET /api/orders/checkout/week-availability?startDate=YYYY-MM-DD&duration=minutes&blocksDays=N
router.get('/checkout/week-availability', async (req, res) => {
  // 🔒 Empêcher le cache navigateur pour toujours avoir les dispos à jour
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { startDate, duration, blocksDays } = req.query;
    // 🔒 TENANT ISOLATION: Récupérer le tenant_id du middleware
    const tenantId = req.tenantId;

    if (!startDate) {
      return res.status(400).json({ success: false, error: 'startDate requise' });
    }

    const dureeTotale = parseInt(duration) || 60;
    const nbDays = parseInt(blocksDays) || 1;

    // Pour les prestations multi-jours, calculer la durée par jour
    const durationPerDay = nbDays > 1 ? Math.ceil(dureeTotale / nbDays) : dureeTotale;

    // 🔒 Horaires dynamiques depuis DB (fallback hardcodé)
    const tenantHours = await getBusinessHoursForTenant(tenantId);

    const getHoraires = (dow) => {
      const bh = tenantHours.getHours(dow);
      return bh ? { ouverture: bh.open, fermeture: bh.close } : null;
    };

    const JOURS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

    const toMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const formatHeure = (min) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const formatDateStr = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Helper: Trouve les N prochains jours ouvrés
    const getWorkingDays = (startDateObj, nbDaysNeeded) => {
      const workingDays = [];
      const current = new Date(startDateObj);

      while (workingDays.length < nbDaysNeeded) {
        const dayOfWeek = current.getDay();
        if (tenantHours.isOpen(dayOfWeek)) {
          workingDays.push(formatDateStr(current));
        }
        current.setDate(current.getDate() + 1);
      }

      return workingDays;
    };

    // Helper: Vérifie si un jour a au moins un créneau disponible pour la durée donnée
    // 🔒 TENANT ISOLATION: Utilise tenantId de la closure
    const isDayAvailable = async (dateStr, durationMin) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();
      const horaires = getHoraires(dayOfWeek);

      if (!horaires) return false;

      const ouvertureMin = toMinutes(horaires.ouverture);
      const fermetureMin = toMinutes(horaires.fermeture);

      // Récupérer les RDV existants (🔒 TENANT ISOLATION)
      const { data: existingRdvs } = await supabase
        .from('reservations')
        .select('heure, duree_minutes')
        .eq('date', dateStr)
        .eq('tenant_id', tenantId)
        .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés

      const occupiedRanges = (existingRdvs || []).map(rdv => ({
        start: toMinutes(rdv.heure),
        end: toMinutes(rdv.heure) + (rdv.duree_minutes || 60)
      }));

      // Vérifier chaque créneau horaire
      for (let min = ouvertureMin; min < fermetureMin; min += 60) {
        const slotEnd = min + durationMin;

        if (slotEnd > fermetureMin) continue;

        let hasConflict = false;
        for (const range of occupiedRanges) {
          if (min < range.end && slotEnd > range.start) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) return true;
      }

      return false;
    };

    const result = {};
    const [year, month, day] = startDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);

    // Récupérer la date d'aujourd'hui pour filtrer les créneaux passés
    const now = new Date();
    const todayStr = formatDateStr(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = formatDateStr(date);
      const dayOfWeek = date.getDay();

      // Vérifier si le jour est dans le passé (avant aujourd'hui)
      const isDateInPast = dateStr < todayStr;

      if (isDateInPast) {
        result[dateStr] = {
          jour: JOURS_FR[dayOfWeek],
          label: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          slots: [],
          allSlots: [],
          closed: true,
          isPast: true  // Indicateur pour le frontend
        };
        continue;
      }

      const horaires = getHoraires(dayOfWeek);

      // Jour fermé
      if (!horaires) {
        result[dateStr] = {
          jour: JOURS_FR[dayOfWeek],
          label: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          slots: [],
          allSlots: [],
          closed: true
        };
        continue;
      }

      // Générer tous les créneaux possibles
      const ouvertureMin = toMinutes(horaires.ouverture);
      const fermetureMin = toMinutes(horaires.fermeture);

      const allSlots = [];
      for (let min = ouvertureMin; min < fermetureMin; min += 60) {
        allSlots.push(formatHeure(min));
      }

      // Récupérer les RDV existants pour cette date (🔒 TENANT ISOLATION)
      const { data: existingRdvs, error: rdvError } = await supabase
        .from('reservations')
        .select('heure, duree_minutes')
        .eq('date', dateStr)
        .eq('tenant_id', tenantId)
        .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés

      if (rdvError) {
        console.error('[ORDERS] Erreur fetch RDV:', rdvError);
      }

      // Calculer les plages occupées
      const occupiedRanges = (existingRdvs || []).map(rdv => {
        const rdvStart = toMinutes(rdv.heure);
        const rdvDuration = rdv.duree_minutes || 60;
        return { start: rdvStart, end: rdvStart + rdvDuration };
      });

      // Filtrer les créneaux disponibles
      const availableSlots = [];

      for (const slot of allSlots) {
        const slotStart = toMinutes(slot);
        const slotEnd = slotStart + durationPerDay;

        // Vérifier que le service ne dépasse pas la fermeture (jour 1)
        if (slotEnd > fermetureMin) {
          continue;
        }

        // Si c'est aujourd'hui, filtrer les créneaux passés
        if (dateStr === todayStr && slotStart <= currentMinutes) {
          continue;
        }

        // Vérifier qu'il n'y a pas de chevauchement (jour 1)
        let hasConflictDay1 = false;
        for (const range of occupiedRanges) {
          if (slotStart < range.end && slotEnd > range.start) {
            hasConflictDay1 = true;
            break;
          }
        }
        if (hasConflictDay1) continue;

        // Si multi-jours: vérifier que les N-1 jours suivants sont aussi disponibles
        if (nbDays > 1) {
          const workingDays = getWorkingDays(date, nbDays);
          // workingDays[0] = jour actuel (déjà vérifié ci-dessus)
          // Vérifier les jours 2 à N

          let allDaysAvailable = true;
          for (let d = 1; d < workingDays.length; d++) {
            const nextDayAvailable = await isDayAvailable(workingDays[d], durationPerDay);
            if (!nextDayAvailable) {
              allDaysAvailable = false;
              break;
            }
          }

          if (!allDaysAvailable) continue;
        }

        // ✅ Créneau valide
        availableSlots.push(slot);
      }

      result[dateStr] = {
        jour: JOURS_FR[dayOfWeek],
        label: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        slots: availableSlots,
        allSlots,
        closed: false
      };
    }

    res.json({
      success: true,
      startDate,
      duration: dureeTotale,
      blocksDays: nbDays,
      durationPerDay,
      week: result
    });

  } catch (error) {
    console.error('[ORDERS] Erreur week-availability:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
