/**
 * Routes API pour la gestion du Menu Restaurant
 * Visible uniquement pour les tenants de type 'restaurant'
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { getBusinessInfoSync } from '../services/tenantBusinessService.js';

const router = express.Router();

// Middleware: Vérifier que c'est un restaurant
async function requireRestaurant(req, res, next) {
  try {
    const businessInfo = getBusinessInfoSync(req.admin.tenant_id);
    if (businessInfo?.type !== 'restaurant') {
      return res.status(403).json({
        error: 'Cette fonctionnalité est réservée aux restaurants'
      });
    }
    next();
  } catch (error) {
    console.error('[MENU] Erreur vérification type:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

router.use(authenticateAdmin, requireRestaurant);

// ═══════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/menu/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('ordre', { ascending: true });

    if (error) throw error;
    res.json({ categories: data || [] });
  } catch (error) {
    console.error('[MENU] Erreur get categories:', error);
    res.status(500).json({ error: 'Erreur récupération catégories' });
  }
});

/**
 * POST /api/admin/menu/categories
 */
router.post('/categories', async (req, res) => {
  try {
    const { nom, description, ordre } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        tenant_id: req.admin.tenant_id,
        nom,
        description,
        ordre: ordre || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[MENU] Erreur création catégorie:', error);
    res.status(500).json({ error: 'Erreur création catégorie' });
  }
});

/**
 * PUT /api/admin/menu/categories/:id
 */
router.put('/categories/:id', async (req, res) => {
  try {
    const { nom, description, ordre, actif } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (ordre !== undefined) updates.ordre = ordre;
    if (actif !== undefined) updates.actif = actif;

    const { data, error } = await supabase
      .from('menu_categories')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[MENU] Erreur update catégorie:', error);
    res.status(500).json({ error: 'Erreur mise à jour catégorie' });
  }
});

/**
 * DELETE /api/admin/menu/categories/:id
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[MENU] Erreur delete catégorie:', error);
    res.status(500).json({ error: 'Erreur suppression catégorie' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PLATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/menu/plats
 */
router.get('/plats', async (req, res) => {
  try {
    const { categorie_id, actif, plat_du_jour, service } = req.query;

    let query = supabase
      .from('plats')
      .select(`
        *,
        menu_categories (id, nom)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('categorie_id', { ascending: true })
      .order('ordre', { ascending: true });

    if (categorie_id) query = query.eq('categorie_id', categorie_id);
    if (actif !== undefined) query = query.eq('actif', actif === 'true');
    if (plat_du_jour !== undefined) query = query.eq('plat_du_jour', plat_du_jour === 'true');
    if (service === 'midi') query = query.eq('disponible_midi', true);
    if (service === 'soir') query = query.eq('disponible_soir', true);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ plats: data || [] });
  } catch (error) {
    console.error('[MENU] Erreur get plats:', error);
    res.status(500).json({ error: 'Erreur récupération plats' });
  }
});

/**
 * GET /api/admin/menu/plats/:id
 */
router.get('/plats/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('plats')
      .select(`
        *,
        menu_categories (id, nom)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Plat non trouvé' });
    }

    res.json(data);
  } catch (error) {
    console.error('[MENU] Erreur get plat:', error);
    res.status(500).json({ error: 'Erreur récupération plat' });
  }
});

/**
 * POST /api/admin/menu/plats
 */
router.post('/plats', async (req, res) => {
  try {
    const {
      nom, description, prix, categorie_id,
      allergenes, regime,
      disponible_midi, disponible_soir, plat_du_jour,
      stock_limite, stock_quantite,
      image_url, ordre
    } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    const { data, error } = await supabase
      .from('plats')
      .insert({
        tenant_id: req.admin.tenant_id,
        nom,
        description,
        prix: prix || 0,
        categorie_id: categorie_id || null,
        allergenes: allergenes || [],
        regime: regime || [],
        disponible_midi: disponible_midi !== false,
        disponible_soir: disponible_soir !== false,
        plat_du_jour: plat_du_jour || false,
        stock_limite: stock_limite || false,
        stock_quantite: stock_quantite || 0,
        image_url,
        ordre: ordre || 0
      })
      .select(`
        *,
        menu_categories (id, nom)
      `)
      .single();

    if (error) throw error;

    console.log(`[MENU] Plat créé: ${data.id} - ${nom}`);
    res.status(201).json(data);
  } catch (error) {
    console.error('[MENU] Erreur création plat:', error);
    res.status(500).json({ error: 'Erreur création plat' });
  }
});

/**
 * PUT /api/admin/menu/plats/:id
 */
router.put('/plats/:id', async (req, res) => {
  try {
    const {
      nom, description, prix, categorie_id,
      allergenes, regime,
      disponible_midi, disponible_soir, plat_du_jour,
      stock_limite, stock_quantite,
      image_url, ordre, actif
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };

    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (prix !== undefined) updates.prix = prix;
    if (categorie_id !== undefined) updates.categorie_id = categorie_id;
    if (allergenes !== undefined) updates.allergenes = allergenes;
    if (regime !== undefined) updates.regime = regime;
    if (disponible_midi !== undefined) updates.disponible_midi = disponible_midi;
    if (disponible_soir !== undefined) updates.disponible_soir = disponible_soir;
    if (plat_du_jour !== undefined) updates.plat_du_jour = plat_du_jour;
    if (stock_limite !== undefined) updates.stock_limite = stock_limite;
    if (stock_quantite !== undefined) updates.stock_quantite = stock_quantite;
    if (image_url !== undefined) updates.image_url = image_url;
    if (ordre !== undefined) updates.ordre = ordre;
    if (actif !== undefined) updates.actif = actif;

    const { data, error } = await supabase
      .from('plats')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select(`
        *,
        menu_categories (id, nom)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[MENU] Erreur update plat:', error);
    res.status(500).json({ error: 'Erreur mise à jour plat' });
  }
});

/**
 * DELETE /api/admin/menu/plats/:id
 */
router.delete('/plats/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('plats')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[MENU] Erreur delete plat:', error);
    res.status(500).json({ error: 'Erreur suppression plat' });
  }
});

/**
 * PATCH /api/admin/menu/plats/:id/plat-du-jour
 * Toggle plat du jour
 */
router.patch('/plats/:id/plat-du-jour', async (req, res) => {
  try {
    const { plat_du_jour } = req.body;

    const { data, error } = await supabase
      .from('plats')
      .update({
        plat_du_jour,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[MENU] Erreur toggle plat du jour:', error);
    res.status(500).json({ error: 'Erreur mise à jour' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MENU DU JOUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/menu/du-jour
 * Récupère le menu du jour (aujourd'hui par défaut)
 */
router.get('/du-jour', async (req, res) => {
  try {
    const { date, service } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('menu_du_jour')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('date', targetDate);

    if (service) {
      query = query.eq('service', service);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Récupérer les plats associés si menu existe
    if (data && data.length > 0) {
      const menu = data[0];
      const allPlatIds = [
        ...(menu.entrees || []),
        ...(menu.plats || []),
        ...(menu.desserts || [])
      ];

      if (allPlatIds.length > 0) {
        const { data: platsData } = await supabase
          .from('plats')
          .select('id, nom, description, prix, categorie_id')
          .in('id', allPlatIds);

        menu.plats_details = platsData || [];
      }

      res.json({ menu });
    } else {
      res.json({ menu: null });
    }
  } catch (error) {
    console.error('[MENU] Erreur get menu du jour:', error);
    res.status(500).json({ error: 'Erreur récupération menu du jour' });
  }
});

/**
 * POST /api/admin/menu/du-jour
 * Créer/Mettre à jour le menu du jour
 */
router.post('/du-jour', async (req, res) => {
  try {
    const {
      date,
      service,
      formule_entree_plat,
      formule_plat_dessert,
      formule_complete,
      entrees,
      plats,
      desserts,
      notes
    } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetService = service || 'midi_soir';

    // Upsert (créer ou mettre à jour)
    const { data, error } = await supabase
      .from('menu_du_jour')
      .upsert({
        tenant_id: req.admin.tenant_id,
        date: targetDate,
        service: targetService,
        formule_entree_plat: formule_entree_plat || 0,
        formule_plat_dessert: formule_plat_dessert || 0,
        formule_complete: formule_complete || 0,
        entrees: entrees || [],
        plats: plats || [],
        desserts: desserts || [],
        notes,
        actif: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,date,service'
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[MENU] Menu du jour créé/mis à jour: ${targetDate} (${targetService})`);
    res.json(data);
  } catch (error) {
    console.error('[MENU] Erreur création menu du jour:', error);
    res.status(500).json({ error: 'Erreur création menu du jour' });
  }
});

/**
 * GET /api/admin/menu/stats
 * Statistiques du menu
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Compter les plats
    const { count: totalPlats } = await supabase
      .from('plats')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Compter les catégories
    const { count: totalCategories } = await supabase
      .from('menu_categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Plats du jour actifs
    const { count: platsDuJour } = await supabase
      .from('plats')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .eq('plat_du_jour', true);

    res.json({
      total_plats: totalPlats || 0,
      total_categories: totalCategories || 0,
      plats_du_jour: platsDuJour || 0
    });
  } catch (error) {
    console.error('[MENU] Erreur stats:', error);
    res.status(500).json({ error: 'Erreur récupération stats' });
  }
});

export default router;
