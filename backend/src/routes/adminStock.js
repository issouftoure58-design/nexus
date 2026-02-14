/**
 * Routes Admin Stock - Alias pour les routes stock
 * Ces routes exposent /api/admin/stock pour l'admin-ui
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware auth admin
router.use(authenticateAdmin);

/**
 * GET /api/admin/stock
 * Liste des produits (alias simplifié pour l'admin-ui)
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { search, limit = 100 } = req.query;

    let query = supabase
      .from('produits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('nom', { ascending: true })
      .limit(parseInt(limit));

    if (search) {
      query = query.or(`nom.ilike.%${search}%,reference.ilike.%${search}%`);
    }

    const { data: produits, error } = await query;

    if (error) throw error;

    // Formater pour l'admin-ui (prix en centimes)
    const produitsFormatted = (produits || []).map(p => ({
      id: p.id,
      nom: p.nom,
      description: p.description,
      quantite: p.stock_actuel,
      prix_achat: p.prix_achat_unitaire,  // En centimes
      prix_vente: p.prix_vente_unitaire,  // En centimes
      seuil_alerte: p.stock_minimum,
      reference: p.reference,
      categorie: p.categorie,
      unite: p.unite,
      stock_bas: p.stock_actuel <= p.stock_minimum,
    }));

    res.json({ produits: produitsFormatted });
  } catch (error) {
    console.error('[ADMIN STOCK] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stock
 * Créer un produit
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { nom, description, quantite, prix_achat, prix_vente, seuil_alerte } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    // Générer une référence automatique
    const reference = `PROD-${Date.now().toString(36).toUpperCase()}`;

    const { data: produit, error } = await supabase
      .from('produits')
      .insert({
        tenant_id: tenantId,
        reference,
        nom,
        description: description || null,
        categorie: 'produits_vente',
        stock_actuel: parseInt(quantite) || 0,
        stock_minimum: parseInt(seuil_alerte) || 5,
        prix_achat_unitaire: Math.round((parseFloat(prix_achat) || 0) * 100),
        prix_vente_unitaire: Math.round((parseFloat(prix_vente) || 0) * 100),
        unite: 'piece',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      produit: {
        id: produit.id,
        nom: produit.nom,
        description: produit.description,
        quantite: produit.stock_actuel,
        prix_achat: produit.prix_achat_unitaire,  // En centimes
        prix_vente: produit.prix_vente_unitaire,  // En centimes
        seuil_alerte: produit.stock_minimum,
      },
    });
  } catch (error) {
    console.error('[ADMIN STOCK] Erreur création:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/stock/:id
 * Modifier un produit
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { nom, description, quantite, prix_achat, prix_vente, seuil_alerte } = req.body;

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (quantite !== undefined) updates.stock_actuel = parseInt(quantite);
    if (seuil_alerte !== undefined) updates.stock_minimum = parseInt(seuil_alerte);
    if (prix_achat !== undefined) updates.prix_achat_unitaire = Math.round(parseFloat(prix_achat) * 100);
    if (prix_vente !== undefined) updates.prix_vente_unitaire = Math.round(parseFloat(prix_vente) * 100);

    const { data: produit, error } = await supabase
      .from('produits')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      produit: {
        id: produit.id,
        nom: produit.nom,
        description: produit.description,
        quantite: produit.stock_actuel,
        prix_achat: produit.prix_achat_unitaire,  // En centimes
        prix_vente: produit.prix_vente_unitaire,  // En centimes
        seuil_alerte: produit.stock_minimum,
      },
    });
  } catch (error) {
    console.error('[ADMIN STOCK] Erreur modification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/stock/:id
 * Supprimer un produit (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('produits')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Produit supprimé' });
  } catch (error) {
    console.error('[ADMIN STOCK] Erreur suppression:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stock/:id/ajuster
 * Ajuster la quantité d'un produit
 */
router.post('/:id/ajuster', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { quantite, raison } = req.body;

    // Récupérer produit actuel
    const { data: produit, error: fetchError } = await supabase
      .from('produits')
      .select('stock_actuel, nom')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const stockAvant = produit.stock_actuel;
    const ajustement = parseInt(quantite);
    const stockApres = stockAvant + ajustement;

    if (stockApres < 0) {
      return res.status(400).json({ error: 'Stock ne peut pas être négatif' });
    }

    // Créer mouvement
    await supabase
      .from('mouvements_stock')
      .insert({
        tenant_id: tenantId,
        produit_id: parseInt(id),
        type: 'ajustement',
        quantite: ajustement,
        stock_avant: stockAvant,
        stock_apres: stockApres,
        motif: raison || 'Ajustement manuel',
      });

    // Mettre à jour stock
    const { error: updateError } = await supabase
      .from('produits')
      .update({ stock_actuel: stockApres, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      stock_avant: stockAvant,
      stock_apres: stockApres,
    });
  } catch (error) {
    console.error('[ADMIN STOCK] Erreur ajustement:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
