/**
 * Route publique de suivi de commande
 * GET /api/orders/track/:token
 *
 * Sans authentification — le token UUID est la seule clé d'accès.
 */

import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/orders/track/:token — Suivi public d'une commande
// ═══════════════════════════════════════════════════════════════════════════
router.get('/track/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Lookup order by tracking token + join items + tenant name
    const { data: order, error } = await supabase
      .from('commerce_orders')
      .select(`
        id, order_number, status, order_type,
        customer_name, subtotal, tax_amount, total, delivery_fee,
        pickup_date, pickup_time, customer_notes,
        created_at, updated_at,
        tenant_id
      `)
      .eq('tracking_token', token)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    // Load items
    const { data: items } = await supabase
      .from('commerce_order_items')
      .select('product_name, quantity, unit_price, line_total')
      .eq('order_id', order.id)
      .eq('tenant_id', order.tenant_id);

    // Load tenant name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', order.tenant_id)
      .single();

    res.json({
      order: {
        order_number: order.order_number,
        status: order.status,
        order_type: order.order_type,
        customer_name: order.customer_name,
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total: order.total,
        delivery_fee: order.delivery_fee,
        pickup_date: order.pickup_date,
        pickup_time: order.pickup_time,
        customer_notes: order.customer_notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: items || [],
      },
      tenant_name: tenant?.name || 'Commerce',
    });
  } catch (err) {
    console.error('[ORDER_TRACKING] GET /track/:token error:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
