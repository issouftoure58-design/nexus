/**
 * Routes API pour la gestion des commandes Commerce
 * Wrapper admin autour du commerce orderService existant
 */

import crypto from 'crypto';
import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import { supabase } from '../config/supabase.js';
import {
  getOrders,
  getOrderById,
  getOrderStats,
  updateOrderStatus,
  cancelOrder,
  generateOrderNumber,
} from '../modules/commerce/orderService.js';
import {
  genererEcrituresFacture,
  genererEcrituresPaiement,
  generateNumeroFacture,
} from './factures.js';
import { generateInvoicePDF } from '../services/pdfService.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// Auth + module ecommerce requis
router.use(authenticateAdmin, requireModule('ecommerce'));

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/commerce/orders — Créer une commande (admin)
// Utilise les services comme catalogue produit
// ═══════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const {
      customerName, customerPhone, customerEmail,
      orderType = 'click_collect',
      items, pickupDate, pickupTime, customerNotes, paymentMethod,
    } = req.body;

    // Validation
    if (!customerName?.trim() || !customerPhone?.trim()) {
      return res.status(400).json({ error: 'Nom et téléphone du client requis' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un produit requis' });
    }

    // Load services to validate items and get prices
    const serviceIds = items.map(i => i.serviceId);
    const { data: services, error: svcError } = await supabase
      .from('services')
      .select('id, nom, prix, taux_tva')
      .eq('tenant_id', tenantId)
      .in('id', serviceIds);

    if (svcError || !services) {
      return res.status(400).json({ error: 'Erreur chargement produits' });
    }

    // Validate all items exist
    const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));
    for (const item of items) {
      if (!serviceMap[item.serviceId]) {
        return res.status(400).json({ error: `Produit ID ${item.serviceId} introuvable` });
      }
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = items.map(item => {
      const service = serviceMap[item.serviceId];
      const qty = parseInt(item.quantity, 10) || 1;
      const unitPrice = service.prix; // Already in cents
      const lineTotal = unitPrice * qty;
      const taxRate = service.taux_tva || 20;
      const lineTax = Math.round(lineTotal * taxRate / (100 + taxRate));

      subtotal += lineTotal;
      taxAmount += lineTax;

      return {
        product_name: service.nom,
        quantity: qty,
        unit_price: unitPrice,
        tax_rate: taxRate,
        line_total: lineTotal,
      };
    });

    const orderNumber = generateOrderNumber();
    const trackingToken = crypto.randomUUID();

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('commerce_orders')
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        tracking_token: trackingToken,
        customer_name: customerName.trim(),
        customer_email: customerEmail?.trim() || null,
        customer_phone: customerPhone.trim(),
        order_type: orderType,
        status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        delivery_fee: 0,
        total: subtotal,
        pickup_date: pickupDate || null,
        pickup_time: pickupTime || null,
        customer_notes: customerNotes?.trim() || null,
        payment_method: paymentMethod || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('[ADMIN_COMMERCE_ORDERS] POST insert error:', orderError.message);
      return res.status(500).json({ error: 'Erreur création commande' });
    }

    // Insert items
    const orderItems = processedItems.map(item => ({
      tenant_id: tenantId,
      order_id: order.id,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from('commerce_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('[ADMIN_COMMERCE_ORDERS] POST items error:', itemsError.message);
    }

    // ── Email de confirmation pour Click & Collect / Livraison ──
    const trimmedEmail = customerEmail?.trim();
    if ((orderType === 'click_collect' || orderType === 'delivery') && trimmedEmail) {
      try {
        const trackingUrl = `${process.env.APP_URL}/suivi/${order.tracking_token}`;
        const isDelivery = orderType === 'delivery';
        const typeLabel = isDelivery ? 'livraison' : 'retrait';
        const montantFormate = (subtotal / 100).toFixed(2) + ' \u20ac';

        const itemsHtml = processedItems.map(i =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${i.quantity}x ${i.product_name}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${((i.unit_price * i.quantity) / 100).toFixed(2)} &euro;</td></tr>`
        ).join('');

        const dateInfo = pickupDate
          ? `<p style="color:#333;margin:8px 0"><strong>Date de ${typeLabel} :</strong> ${pickupDate}${pickupTime ? ` à ${pickupTime}` : ''}</p>`
          : '';

        await sendEmail({
          to: trimmedEmail,
          subject: `Commande ${orderNumber} confirmée — suivi en ligne`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#333">Bonjour ${customerName.trim()} !</h2>
            <p>Votre commande <strong>${orderNumber}</strong> a bien été enregistrée.</p>
            ${dateInfo}
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              ${itemsHtml}
              <tr style="border-top:2px solid #333;font-weight:bold">
                <td style="padding:8px 0">Total</td>
                <td style="text-align:right;padding:8px 0">${montantFormate}</td>
              </tr>
            </table>
            <p style="text-align:center;margin:24px 0">
              <a href="${trackingUrl}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Suivre ma commande</a>
            </p>
            <p style="color:#666;font-size:13px;margin-top:16px">Vous pouvez suivre l'avancement de votre ${typeLabel} en temps réel grâce au lien ci-dessus.</p>
            <p style="margin-top:24px;color:#333">À bientôt !</p>
          </div>`,
        });
        console.log(`[ADMIN_COMMERCE_ORDERS] Email confirmation envoyé à ${trimmedEmail} pour ${orderNumber}`);
      } catch (emailErr) {
        console.error('[ADMIN_COMMERCE_ORDERS] Erreur envoi email confirmation:', emailErr.message);
      }
    }

    res.status(201).json({ success: true, order: { ...order, items: processedItems } });
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] POST error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/commerce/orders — Liste des commandes avec filtres
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { status, orderType, startDate, endDate, limit, offset } = req.query;

    const result = await getOrders(tenantId, {
      status: status || undefined,
      orderType: orderType || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ orders: result.data, count: result.count });
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] GET / error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/commerce/orders/stats — Statistiques commandes
// ═══════════════════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const result = await getOrderStats(tenantId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result.data);
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] GET /stats error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/commerce/orders/:id — Détail d'une commande
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const result = await getOrderById(tenantId, req.params.id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result.data);
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] GET /:id error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/commerce/orders/:id/status — Changer le statut
// Si status=completed + mode_paiement → encaissement (facture + compta + PDF + email)
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/:id/status', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { status, adminNotes, mode_paiement } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Statut requis' });
    }

    const result = await updateOrderStatus(tenantId, req.params.id, status, adminNotes || null);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // ── Encaissement: créer facture + compta quand completed avec mode_paiement ──
    if (status === 'completed' && mode_paiement) {
      try {
        // 1. Charger la commande (les totaux sont déjà dedans)
        const { data: order } = await supabase
          .from('commerce_orders')
          .select('*, items:commerce_order_items(*)')
          .eq('id', req.params.id)
          .eq('tenant_id', tenantId)
          .single();

        if (!order) {
          console.error('[COMMERCE_CHECKOUT] Commande introuvable:', req.params.id);
          return res.json(result.data);
        }

        // 2. Utiliser les totaux de la commande (déjà calculés à la création)
        const totalTTC = order.total || 0;
        const totalTVA = order.tax_amount || 0;
        const totalHT = totalTTC - totalTVA;
        const items = order.items || [];

        // 3. Créer facture — réutilise generateNumeroFacture existant
        const today = new Date().toISOString().split('T')[0];
        const numero = await generateNumeroFacture(tenantId);

        // Stocker le détail des items en JSON pour le PDF détaillé
        const lignesJson = items.length > 0
          ? JSON.stringify(items.map(i => ({
              nom: i.product_name,
              quantite: i.quantity,
              prix_unitaire: i.unit_price,
              total: i.line_total || (i.unit_price * i.quantity),
            })))
          : null;

        const { data: facture, error: factureError } = await supabase
          .from('factures')
          .insert({
            tenant_id: tenantId,
            numero,
            client_id: null,
            client_nom: order.customer_name,
            client_email: order.customer_email || null,
            client_telephone: order.customer_phone,
            service_nom: `Commande ${order.order_number}`,
            service_description: lignesJson,
            date_prestation: today,
            date_facture: today,
            montant_ht: totalHT,
            taux_tva: 20,
            montant_tva: totalTVA,
            montant_ttc: totalTTC,
            frais_deplacement: 0,
            statut: 'generee',
          })
          .select()
          .single();

        if (factureError || !facture) {
          console.error('[COMMERCE_CHECKOUT] Erreur création facture:', factureError?.message);
          return res.json(result.data);
        }

        // 4. Écritures VT (ventes) — réutilise genererEcrituresFacture existant
        await genererEcrituresFacture(tenantId, facture.id);

        // 5. Marquer payée + écritures paiement — réutilise genererEcrituresPaiement existant
        const datePaiement = new Date().toISOString();
        await supabase
          .from('factures')
          .update({
            statut: 'payee',
            mode_paiement,
            date_paiement: datePaiement,
            updated_at: datePaiement,
          })
          .eq('id', facture.id)
          .eq('tenant_id', tenantId);

        await genererEcrituresPaiement(tenantId, { ...facture, montant_ttc: totalTTC }, mode_paiement, datePaiement);

        // 6. PDF + email — réutilise generateInvoicePDF + sendEmail existants
        try {
          const pdfResult = await generateInvoicePDF(tenantId, facture.id);
          const attachments = pdfResult?.success ? [{ filename: pdfResult.filename, content: pdfResult.buffer }] : [];

          if (order.customer_email) {
            const montantFormate = (totalTTC / 100).toFixed(2) + ' €';
            const modePaiementLabel = mode_paiement === 'cb' ? 'Carte bancaire'
              : mode_paiement === 'especes' ? 'Espèces' : 'Chèque';

            const itemsHtml = items.length > 0
              ? items.map(i =>
                  `<tr><td>${i.quantity}x ${i.product_name}</td><td style="text-align:right">${((i.unit_price * i.quantity) / 100).toFixed(2)} &euro;</td></tr>`
                ).join('')
              : `<tr><td>Commande ${order.order_number}</td><td style="text-align:right">${montantFormate}</td></tr>`;

            await sendEmail({
              to: order.customer_email,
              subject: `Votre ticket — ${montantFormate}`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2>Merci ${order.customer_name} !</h2>
                <p>Voici le récapitulatif de votre commande <strong>${order.order_number}</strong> :</p>
                <table style="width:100%;border-collapse:collapse">
                  ${itemsHtml}
                  <tr style="border-top:2px solid #333;font-weight:bold">
                    <td>Total</td>
                    <td style="text-align:right">${montantFormate}</td>
                  </tr>
                </table>
                <p style="color:#666;margin-top:16px">Paiement : ${modePaiementLabel}</p>
                ${pdfResult?.success ? '<p style="color:#666">Votre facture est jointe à cet email.</p>' : ''}
                <p style="margin-top:24px">À bientôt !</p>
              </div>`,
              attachments,
            });
            console.log(`[COMMERCE_CHECKOUT] Email ticket envoyé à ${order.customer_email}`);
          }
        } catch (emailErr) {
          console.error('[COMMERCE_CHECKOUT] Erreur envoi ticket:', emailErr.message);
        }

        console.log(`[COMMERCE_CHECKOUT] Encaissement terminé — Facture ${numero}, ${mode_paiement}`);
      } catch (checkoutErr) {
        console.error('[COMMERCE_CHECKOUT] Erreur encaissement:', checkoutErr.message);
      }
    }

    res.json(result.data);
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] PATCH /:id/status error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/commerce/orders/:id — Annuler une commande
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { reason } = req.body || {};
    const result = await cancelOrder(tenantId, req.params.id, reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, order: result.data });
  } catch (err) {
    console.error('[ADMIN_COMMERCE_ORDERS] DELETE /:id error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
