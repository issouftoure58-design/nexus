import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// GET /api/admin/services - Liste tous les services
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: true });

    if (error) throw error;

    // Mapper les champs pour le frontend (duree -> duree_minutes)
    const mappedServices = services.map(s => ({
      ...s,
      duree_minutes: s.duree_minutes || s.duree || 0, // Compatibilité avec les deux noms de champ
      actif: s.actif !== false,
      taux_tva: s.taux_tva || 20, // TVA par défaut 20%
      // Calculs prix HT et TVA
      prix_ht: s.taux_tva > 0 ? Math.round(s.prix / (1 + (s.taux_tva || 20) / 100)) : s.prix,
      prix_tva: s.taux_tva > 0 ? s.prix - Math.round(s.prix / (1 + (s.taux_tva || 20) / 100)) : 0
    }));

    res.json({ services: mappedServices });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/services/:id - Un service
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    res.json({ service });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur détail:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/services - Créer service
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { nom, description, prix, duree_minutes, categorie, actif, taux_tva } = req.body;

    if (!nom || !prix || !duree_minutes) {
      return res.status(400).json({ error: 'Nom, prix et durée requis' });
    }

    // Récupérer le prochain ordre (🔒 TENANT ISOLATION)
    const { data: maxOrdre } = await supabase
      .from('services')
      .select('ordre')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: false })
      .limit(1)
      .single();

    const ordre = (maxOrdre?.ordre || 0) + 1;

    // 🔒 TENANT ISOLATION: Inclure tenant_id dans l'insert
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        nom,
        description,
        prix: Math.round(prix * 100), // Convertir en centimes (TTC)
        duree: duree_minutes, // Le champ s'appelle 'duree' dans la DB
        categorie: categorie || 'Coiffure',
        actif: actif !== false,
        taux_tva: taux_tva !== undefined ? parseFloat(taux_tva) : 20, // TVA par défaut 20%
        ordre
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'service',
      entite_id: service.id,
      details: { nom: service.nom, prix: service.prix }
    });

    res.json({ service });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur création:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/services/:id - Modifier service
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { nom, description, prix, duree_minutes, categorie, actif, taux_tva } = req.body;

    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (prix !== undefined) updates.prix = Math.round(prix * 100); // Convertir en centimes (TTC)
    if (duree_minutes !== undefined) updates.duree = duree_minutes; // Le champ s'appelle 'duree' dans la DB
    if (categorie !== undefined) updates.categorie = categorie;
    if (actif !== undefined) updates.actif = actif;
    if (taux_tva !== undefined) updates.taux_tva = parseFloat(taux_tva);
    updates.updated_at = new Date().toISOString();

    // 🔒 TENANT ISOLATION
    const { data: service, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update',
      entite: 'service',
      entite_id: service.id,
      details: { updates }
    });

    res.json({ service });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur modification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/services/:id - Supprimer service
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Vérifier si service utilisé dans des réservations (🔒 TENANT ISOLATION)
    const { count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', req.params.id)
      .eq('tenant_id', tenantId);

    if (count > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer: ${count} réservation(s) utilisent ce service`
      });
    }

    // 🔒 TENANT ISOLATION
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'service',
      entite_id: req.params.id
    });

    res.json({ message: 'Service supprimé' });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/services/:id/toggle - Activer/Désactiver
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: service } = await supabase
      .from('services')
      .select('actif')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    // 🔒 TENANT ISOLATION
    const { data: updated, error } = await supabase
      .from('services')
      .update({ actif: !service.actif })
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'toggle',
      entite: 'service',
      entite_id: updated.id,
      details: { actif: updated.actif }
    });

    res.json({ service: updated });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur toggle:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
