/**
 * Routes Admin Hotel - Gestion chambres, tarifs, occupation
 * Module: reservations + businessType: hotel
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware auth admin pour toutes les routes
router.use(authenticateAdmin);

// ============================================================================
// MIDDLEWARE - Vérifier que c'est un tenant hotel
// ============================================================================

async function requireHotel(req, res, next) {
  const tenantId = req.admin?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ error: 'tenant_id requis' });
  }

  // Vérifier le type de business
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_type')
    .eq('id', tenantId)
    .single();

  if (tenant?.business_type !== 'hotel') {
    return res.status(403).json({
      error: 'Cette fonctionnalité est réservée aux hôtels'
    });
  }

  next();
}

// Appliquer les middlewares
router.use(requireAdmin);
router.use(requireHotel);

// ============================================================================
// CHAMBRES (via services avec type_chambre)
// ============================================================================

/**
 * GET /api/admin/hotel/chambres
 * Liste des chambres de l'hôtel
 */
router.get('/chambres', async (req, res) => {
  const tenantId = req.admin.tenant_id;

  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null)
      .order('nom');

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Erreur liste chambres:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/hotel/chambres/:id
 * Détails d'une chambre avec tarifs saisonniers
 */
router.get('/chambres/:id', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { id } = req.params;

  try {
    // Chambre
    const { data: chambre, error: chambreError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null)
      .single();

    if (chambreError || !chambre) {
      return res.status(404).json({ error: 'Chambre non trouvée' });
    }

    // Tarifs saisonniers
    const { data: tarifs } = await supabase
      .from('tarifs_saisonniers')
      .select('*')
      .eq('service_id', id)
      .eq('tenant_id', tenantId)
      .order('date_debut');

    res.json({ ...chambre, tarifs: tarifs || [] });
  } catch (error) {
    console.error('Erreur détails chambre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================================
// TARIFS SAISONNIERS
// ============================================================================

/**
 * GET /api/admin/hotel/tarifs
 * Liste de tous les tarifs saisonniers
 */
router.get('/tarifs', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { chambre_id } = req.query;

  try {
    let query = supabase
      .from('tarifs_saisonniers')
      .select(`
        *,
        service:services(id, nom, type_chambre)
      `)
      .eq('tenant_id', tenantId)
      .order('date_debut');

    if (chambre_id) {
      query = query.eq('service_id', chambre_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Erreur liste tarifs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/hotel/tarifs
 * Créer un tarif saisonnier
 */
router.post('/tarifs', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const {
    service_id,
    nom,
    date_debut,
    date_fin,
    prix_nuit,
    prix_weekend,
    prix_semaine,
    petit_dejeuner_inclus,
    prix_petit_dejeuner,
    duree_min_nuits
  } = req.body;

  if (!service_id || !nom || !date_debut || !date_fin || !prix_nuit) {
    return res.status(400).json({
      error: 'service_id, nom, date_debut, date_fin et prix_nuit requis'
    });
  }

  try {
    // Vérifier que le service appartient au tenant
    const { data: service } = await supabase
      .from('services')
      .select('id')
      .eq('id', service_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!service) {
      return res.status(404).json({ error: 'Chambre non trouvée' });
    }

    const { data, error } = await supabase
      .from('tarifs_saisonniers')
      .insert({
        tenant_id: tenantId,
        service_id,
        nom,
        date_debut,
        date_fin,
        prix_nuit,
        prix_weekend: prix_weekend || null,
        prix_semaine: prix_semaine || null,
        petit_dejeuner_inclus: petit_dejeuner_inclus || false,
        prix_petit_dejeuner: prix_petit_dejeuner || 0,
        duree_min_nuits: duree_min_nuits || 1
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Erreur création tarif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/hotel/tarifs/:id
 * Modifier un tarif saisonnier
 */
router.put('/tarifs/:id', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { id } = req.params;
  const updates = req.body;

  try {
    // Vérifier l'appartenance
    const { data: existing } = await supabase
      .from('tarifs_saisonniers')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Tarif non trouvé' });
    }

    const { data, error } = await supabase
      .from('tarifs_saisonniers')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Erreur modification tarif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/hotel/tarifs/:id
 * Supprimer un tarif saisonnier
 */
router.delete('/tarifs/:id', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('tarifs_saisonniers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression tarif:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================================
// CALENDRIER OCCUPATION
// ============================================================================

/**
 * GET /api/admin/hotel/occupation
 * Calendrier d'occupation des chambres
 */
router.get('/occupation', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { date_debut, date_fin, chambre_id } = req.query;

  // Par défaut: mois courant
  const start = date_debut || new Date().toISOString().slice(0, 7) + '-01';
  const end = date_fin || new Date(new Date(start).setMonth(new Date(start).getMonth() + 1)).toISOString().slice(0, 10);

  try {
    // Récupérer les chambres
    let chambresQuery = supabase
      .from('services')
      .select('id, nom, type_chambre, capacite, prix, actif')
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null)
      .order('nom');

    if (chambre_id) {
      chambresQuery = chambresQuery.eq('id', chambre_id);
    }

    const { data: chambres, error: chambresError } = await chambresQuery;
    if (chambresError) throw chambresError;

    // Récupérer l'occupation
    let occupationQuery = supabase
      .from('chambres_occupation')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date_occupation', start)
      .lte('date_occupation', end);

    if (chambre_id) {
      occupationQuery = occupationQuery.eq('service_id', chambre_id);
    }

    const { data: occupation, error: occupationError } = await occupationQuery;
    if (occupationError) throw occupationError;

    // Récupérer les réservations en cours
    const { data: reservations, error: resaError } = await supabase
      .from('reservations')
      .select(`
        id,
        client_id,
        service_id,
        date_debut,
        date_fin,
        statut,
        nb_personnes,
        client:clients(prenom, nom, telephone)
      `)
      .eq('tenant_id', tenantId)
      .gte('date_fin', start)
      .lte('date_debut', end)
      .in('statut', ['confirmee', 'en_cours']);

    if (resaError) throw resaError;

    // Construire la vue calendrier
    const calendar = chambres.map(chambre => {
      const chambreOccupation = occupation.filter(o => o.service_id === chambre.id);
      const chambreReservations = reservations.filter(r => r.service_id === chambre.id);

      return {
        ...chambre,
        occupation: chambreOccupation,
        reservations: chambreReservations
      };
    });

    res.json({
      date_debut: start,
      date_fin: end,
      chambres: calendar
    });
  } catch (error) {
    console.error('Erreur calendrier occupation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/hotel/occupation
 * Marquer une occupation (maintenance, blocage, etc.)
 */
router.post('/occupation', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { service_id, dates, statut, notes } = req.body;

  if (!service_id || !dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ error: 'service_id et dates[] requis' });
  }

  const validStatuts = ['maintenance', 'bloquee'];
  if (!validStatuts.includes(statut)) {
    return res.status(400).json({
      error: `Statut invalide. Valeurs acceptées: ${validStatuts.join(', ')}`
    });
  }

  try {
    // Vérifier que le service appartient au tenant
    const { data: service } = await supabase
      .from('services')
      .select('id')
      .eq('id', service_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!service) {
      return res.status(404).json({ error: 'Chambre non trouvée' });
    }

    // Insérer les occupations (upsert pour éviter les doublons)
    const records = dates.map(date => ({
      tenant_id: tenantId,
      service_id,
      date_occupation: date,
      statut,
      notes
    }));

    const { data, error } = await supabase
      .from('chambres_occupation')
      .upsert(records, {
        onConflict: 'tenant_id,service_id,date_occupation',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Erreur création occupation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/hotel/occupation
 * Supprimer des occupations (libérer des dates)
 */
router.delete('/occupation', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { service_id, dates } = req.body;

  if (!service_id || !dates || !Array.isArray(dates)) {
    return res.status(400).json({ error: 'service_id et dates[] requis' });
  }

  try {
    const { error } = await supabase
      .from('chambres_occupation')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('service_id', service_id)
      .in('date_occupation', dates)
      .in('statut', ['maintenance', 'bloquee']); // Ne pas supprimer les réservations

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression occupation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================================
// STATISTIQUES
// ============================================================================

/**
 * GET /api/admin/hotel/stats
 * Statistiques de l'hôtel
 */
router.get('/stats', async (req, res) => {
  const tenantId = req.admin.tenant_id;

  try {
    // Nombre de chambres
    const { count: nbChambres } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null);

    // Réservations du mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const { count: resaMois, error: resaError } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('date_debut', startOfMonth.toISOString().slice(0, 10))
      .lt('date_debut', endOfMonth.toISOString().slice(0, 10));

    // Occupation aujourd'hui
    const today = new Date().toISOString().slice(0, 10);
    const { count: occupeesAujourdhui } = await supabase
      .from('chambres_occupation')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('date_occupation', today)
      .in('statut', ['reservee', 'occupee']);

    // Tarifs actifs
    const { count: tarifsActifs } = await supabase
      .from('tarifs_saisonniers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .gte('date_fin', today);

    res.json({
      nb_chambres: nbChambres || 0,
      reservations_mois: resaMois || 0,
      occupees_aujourdhui: occupeesAujourdhui || 0,
      tarifs_actifs: tarifsActifs || 0,
      taux_occupation: nbChambres ? Math.round((occupeesAujourdhui / nbChambres) * 100) : 0
    });
  } catch (error) {
    console.error('Erreur stats hotel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/hotel/calcul-prix
 * Calculer le prix d'un séjour
 */
router.post('/calcul-prix', async (req, res) => {
  const tenantId = req.admin.tenant_id;
  const { service_id, date_debut, date_fin } = req.body;

  if (!service_id || !date_debut || !date_fin) {
    return res.status(400).json({
      error: 'service_id, date_debut et date_fin requis'
    });
  }

  try {
    // Récupérer la chambre et son prix de base
    const { data: chambre } = await supabase
      .from('services')
      .select('id, nom, prix')
      .eq('id', service_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!chambre) {
      return res.status(404).json({ error: 'Chambre non trouvée' });
    }

    // Récupérer les tarifs saisonniers
    const { data: tarifs } = await supabase
      .from('tarifs_saisonniers')
      .select('*')
      .eq('service_id', service_id)
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .lte('date_debut', date_fin)
      .gte('date_fin', date_debut);

    // Calculer le prix nuit par nuit
    const startDate = new Date(date_debut);
    const endDate = new Date(date_fin);
    const details = [];
    let total = 0;

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Trouver le tarif applicable
      const tarif = tarifs?.find(t =>
        dateStr >= t.date_debut && dateStr <= t.date_fin
      );

      let prixNuit;
      let saisonNom;

      if (tarif) {
        prixNuit = isWeekend && tarif.prix_weekend ? tarif.prix_weekend : tarif.prix_nuit;
        saisonNom = tarif.nom;
      } else {
        prixNuit = chambre.prix;
        saisonNom = 'Standard';
      }

      details.push({
        date: dateStr,
        prix: prixNuit,
        saison: saisonNom,
        is_weekend: isWeekend
      });

      total += prixNuit;
    }

    const nbNuits = details.length;

    res.json({
      chambre: chambre.nom,
      date_debut,
      date_fin,
      nb_nuits: nbNuits,
      prix_total: total,
      prix_moyen_nuit: nbNuits > 0 ? Math.round(total / nbNuits) : 0,
      details
    });
  } catch (error) {
    console.error('Erreur calcul prix:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
