/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES COMMERCIAL - Détection inactifs & Relances clients       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();
router.use(authenticateAdmin);

// Middleware verification plan (commercial = Pro+)
router.use(requireModule('commercial'));

/**
 * Calcule le prix d'une réservation
 */
function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

/**
 * GET /api/commercial/clients/inactifs
 * Détecter clients inactifs avec scoring
 */
router.get('/clients/inactifs', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { periode = 3 } = req.query; // mois

    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - parseInt(periode));

    // Récupérer tous les clients avec leurs réservations
    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        id, nom, prenom, email, telephone, created_at,
        reservations(id, date, statut, prix_total, prix_service, frais_deplacement, service_nom)
      `)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const clientsInactifs = [];

    for (const client of clients || []) {
      // Filtrer les RDV confirmés/terminés
      const rdvs = (client.reservations || []).filter(r =>
        r.statut === 'confirme' || r.statut === 'termine'
      );

      if (rdvs.length === 0) continue;

      // Trier par date décroissante
      rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
      const dernierRdv = rdvs[0];
      const dateDernierRdv = new Date(dernierRdv.date);

      // Vérifier si inactif
      if (dateDernierRdv < dateLimit) {
        const joursInactivite = Math.floor((Date.now() - dateDernierRdv.getTime()) / (1000 * 60 * 60 * 24));
        const moisInactivite = Math.floor(joursInactivite / 30);

        // Calcul CA total
        const caTotal = rdvs.reduce((sum, r) => sum + getPrixReservation(r), 0);

        // ═══════════════════════════════════════════════════════════
        // SCORING CLIENT
        // ═══════════════════════════════════════════════════════════
        let score = 0;

        // 1. Fréquence RDV
        const moisDepuisPremierRdv = Math.max(1, moisInactivite + 3);
        const frequence = rdvs.length / moisDepuisPremierRdv;
        if (frequence >= 1) score += 10;       // Régulier (1/mois)
        else if (frequence >= 0.33) score += 5; // Occasionnel (1/3mois)
        else score += 2;

        // 2. CA généré
        if (caTotal >= 50000) score += 10;      // >500€
        else if (caTotal >= 20000) score += 5;  // 200-500€
        else score += 2;                         // <200€

        // 3. Ancienneté (depuis premier RDV)
        const premierRdv = new Date(rdvs[rdvs.length - 1].date);
        const ancienneteMois = Math.floor((Date.now() - premierRdv.getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (ancienneteMois >= 24) score += 10;  // >2 ans
        else if (ancienneteMois >= 6) score += 5; // 6mois-2ans
        else score += 2;                         // <6mois

        // Segment
        let segment = 'standard';
        if (score >= 20) segment = 'vip';
        else if (score >= 10) segment = 'fidele';

        // ═══════════════════════════════════════════════════════════
        // NIVEAU INACTIVITÉ & OFFRE SUGGÉRÉE
        // ═══════════════════════════════════════════════════════════
        let niveauInactivite = 'leger';
        let offreSuggeree = 5;
        let messageType = 'relance_douce';

        if (moisInactivite >= 12) {
          niveauInactivite = 'fort';
          offreSuggeree = 20;
          messageType = 'offre_exceptionnelle';
        } else if (moisInactivite >= 6) {
          niveauInactivite = 'moyen';
          offreSuggeree = 10;
          messageType = 'offre_speciale';
        }

        // Service préféré
        const servicesFrequents = {};
        rdvs.forEach(r => {
          const service = r.service_nom || 'Service';
          servicesFrequents[service] = (servicesFrequents[service] || 0) + 1;
        });
        const servicePrefere = Object.entries(servicesFrequents)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'coiffure';

        clientsInactifs.push({
          id: client.id,
          nom: client.nom,
          prenom: client.prenom,
          email: client.email,
          telephone: client.telephone,
          dernier_rdv: dernierRdv.date,
          jours_inactivite: joursInactivite,
          mois_inactivite: moisInactivite,
          niveau_inactivite: niveauInactivite,
          nb_rdv_total: rdvs.length,
          ca_total_euros: (caTotal / 100).toFixed(2),
          score,
          segment,
          service_prefere: servicePrefere,
          offre_suggeree: offreSuggeree,
          message_type: messageType
        });
      }
    }

    // Trier par score décroissant (VIP d'abord)
    clientsInactifs.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      periode_mois: parseInt(periode),
      nb_clients_inactifs: clientsInactifs.length,
      clients: clientsInactifs,
      segments: {
        vip: clientsInactifs.filter(c => c.segment === 'vip').length,
        fidele: clientsInactifs.filter(c => c.segment === 'fidele').length,
        standard: clientsInactifs.filter(c => c.segment === 'standard').length
      },
      niveaux: {
        leger: clientsInactifs.filter(c => c.niveau_inactivite === 'leger').length,
        moyen: clientsInactifs.filter(c => c.niveau_inactivite === 'moyen').length,
        fort: clientsInactifs.filter(c => c.niveau_inactivite === 'fort').length
      }
    });

  } catch (error) {
    console.error('[COMMERCIAL] Erreur détection inactifs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/clients/scoring
 * Scoring de tous les clients actifs
 */
router.get('/clients/scoring', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        id, nom, prenom, email, telephone, created_at,
        reservations(id, date, statut, prix_total, prix_service, frais_deplacement, service_nom)
      `)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const clientsScores = [];

    for (const client of clients || []) {
      const rdvs = (client.reservations || []).filter(r =>
        r.statut === 'confirme' || r.statut === 'termine'
      );

      if (rdvs.length === 0) continue;

      rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
      const dernierRdv = rdvs[0];
      const caTotal = rdvs.reduce((sum, r) => sum + getPrixReservation(r), 0);

      // Scoring
      let score = 0;
      const premierRdv = new Date(rdvs[rdvs.length - 1].date);
      const moisDepuisPremier = Math.max(1, Math.floor((Date.now() - premierRdv.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      const frequence = rdvs.length / moisDepuisPremier;

      if (frequence >= 1) score += 10;
      else if (frequence >= 0.33) score += 5;
      else score += 2;

      if (caTotal >= 50000) score += 10;
      else if (caTotal >= 20000) score += 5;
      else score += 2;

      if (moisDepuisPremier >= 24) score += 10;
      else if (moisDepuisPremier >= 6) score += 5;
      else score += 2;

      let segment = 'standard';
      if (score >= 20) segment = 'vip';
      else if (score >= 10) segment = 'fidele';

      clientsScores.push({
        id: client.id,
        nom: `${client.prenom} ${client.nom}`,
        email: client.email,
        telephone: client.telephone,
        score,
        segment,
        nb_rdv: rdvs.length,
        ca_total_euros: (caTotal / 100).toFixed(2),
        dernier_rdv: dernierRdv.date,
        anciennete_mois: moisDepuisPremier
      });
    }

    clientsScores.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      clients: clientsScores,
      segments: {
        vip: clientsScores.filter(c => c.segment === 'vip').length,
        fidele: clientsScores.filter(c => c.segment === 'fidele').length,
        standard: clientsScores.filter(c => c.segment === 'standard').length
      }
    });

  } catch (error) {
    console.error('[COMMERCIAL] Erreur scoring:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/campagnes
 * Liste des campagnes de relance
 */
router.get('/campagnes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, type_campagne, limit = 50 } = req.query;

    let query = supabase
      .from('campagnes_relance')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) query = query.eq('statut', statut);
    if (type_campagne) query = query.eq('type_campagne', type_campagne);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, campagnes: data, count: data.length });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur liste campagnes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/campagnes/:id
 * Détail d'une campagne
 */
router.get('/campagnes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { data: campagne, error } = await supabase
      .from('campagnes_relance')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Récupérer historique des relances
    const { data: historique } = await supabase
      .from('historique_relances')
      .select('*, clients(nom, prenom, email)')
      .eq('campagne_id', id)
      .order('date_envoi', { ascending: false });

    res.json({
      success: true,
      campagne,
      historique: historique || []
    });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur détail campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/commercial/campagnes
 * Créer une campagne
 */
router.post('/campagnes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      titre, type_campagne, canal, objet, message,
      offre_type, offre_valeur, offre_description,
      segment_cible, nb_cibles, date_envoi_prevue
    } = req.body;

    // Validation
    if (!titre || !type_campagne || !canal || !message) {
      return res.status(400).json({
        success: false,
        error: 'titre, type_campagne, canal et message sont requis'
      });
    }

    const { data, error } = await supabase
      .from('campagnes_relance')
      .insert({
        tenant_id: tenantId,
        titre,
        type_campagne,
        canal,
        objet: objet || null,
        message,
        offre_type: offre_type || null,
        offre_valeur: offre_valeur || null,
        offre_description: offre_description || null,
        segment_cible: segment_cible || null,
        nb_cibles: nb_cibles || 0,
        date_envoi_prevue: date_envoi_prevue || null,
        statut: 'brouillon'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, campagne: data });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur création campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/commercial/campagnes/:id
 * Modifier une campagne
 */
router.put('/campagnes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const updates = { ...req.body };
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('campagnes_relance')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, campagne: data });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur modification campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/commercial/campagnes/:id/statut
 * Changer le statut d'une campagne
 */
router.patch('/campagnes/:id/statut', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const { statut } = req.body;

    const statutsValides = ['brouillon', 'planifie', 'en_cours', 'termine', 'annule'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const updates = { statut };
    if (statut === 'en_cours') {
      updates.date_envoi_reelle = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('campagnes_relance')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, campagne: data });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur changement statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/commercial/campagnes/:id
 * Supprimer une campagne
 */
router.delete('/campagnes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { error } = await supabase
      .from('campagnes_relance')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur suppression campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/commercial/stats
 * Statistiques des campagnes
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: campagnes } = await supabase
      .from('campagnes_relance')
      .select('*')
      .eq('tenant_id', tenantId);

    const stats = {
      total_campagnes: campagnes?.length || 0,
      total_envoyes: 0,
      total_ouverts: 0,
      total_conversions: 0,
      taux_ouverture: 0,
      taux_conversion: 0,
      par_statut: {},
      par_canal: {},
      par_type: {}
    };

    (campagnes || []).forEach(c => {
      stats.total_envoyes += c.nb_envoyes || 0;
      stats.total_ouverts += c.nb_ouverts || 0;
      stats.total_conversions += c.nb_conversions || 0;
      stats.par_statut[c.statut] = (stats.par_statut[c.statut] || 0) + 1;
      stats.par_canal[c.canal] = (stats.par_canal[c.canal] || 0) + 1;
      stats.par_type[c.type_campagne] = (stats.par_type[c.type_campagne] || 0) + 1;
    });

    if (stats.total_envoyes > 0) {
      stats.taux_ouverture = ((stats.total_ouverts / stats.total_envoyes) * 100).toFixed(1);
      stats.taux_conversion = ((stats.total_conversions / stats.total_envoyes) * 100).toFixed(1);
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[COMMERCIAL] Erreur stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
