/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES FACTURES - Gestion des factures et envoi PDF             ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
router.use(authenticateAdmin);

/**
 * Génère un numéro de facture unique
 * Format: {PREFIX}-{YEAR}-{SEQUENCE:5}
 */
async function generateNumeroFacture(tenantId) {
  const year = new Date().getFullYear();

  // Récupérer le préfixe du tenant (3 premières lettres)
  const prefix = tenantId.substring(0, 3).toUpperCase();

  // Compter les factures existantes de l'année
  const { count } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('date_facture', `${year}-01-01`)
    .lte('date_facture', `${year}-12-31`);

  const sequence = (count || 0) + 1;
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Crée automatiquement une facture depuis une réservation
 */
export async function createFactureFromReservation(reservationId, tenantId) {
  try {
    // Vérifier si une facture existe déjà
    const { data: existing } = await supabase
      .from('factures')
      .select('id')
      .eq('reservation_id', reservationId)
      .single();

    if (existing) {
      return { success: true, facture: existing, message: 'Facture déjà existante' };
    }

    // Récupérer la réservation avec les détails
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        clients(id, nom, prenom, email, telephone, adresse),
        services(id, nom, description, taux_tva)
      `)
      .eq('id', reservationId)
      .single();

    if (resError || !reservation) {
      throw new Error('Réservation non trouvée');
    }

    // Calculer les montants
    const prixTTC = reservation.prix_total || reservation.prix_service || 0;
    const fraisDeplacement = reservation.frais_deplacement || 0;
    const tauxTVA = reservation.services?.taux_tva || 20;

    // Total TTC incluant frais déplacement
    const totalTTC = prixTTC + fraisDeplacement;
    const totalHT = Math.round(totalTTC / (1 + tauxTVA / 100));
    const totalTVA = totalTTC - totalHT;

    // Générer le numéro
    const numero = await generateNumeroFacture(tenantId);

    // Créer la facture
    const { data: facture, error } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        reservation_id: reservationId,
        client_id: reservation.client_id,
        client_nom: reservation.clients
          ? `${reservation.clients.prenom} ${reservation.clients.nom}`
          : reservation.client_nom || 'Client',
        client_email: reservation.clients?.email || reservation.client_email,
        client_telephone: reservation.clients?.telephone || reservation.client_telephone,
        client_adresse: reservation.clients?.adresse || null,
        service_nom: reservation.services?.nom || reservation.service_nom || 'Prestation',
        service_description: reservation.services?.description || null,
        date_prestation: reservation.date,
        montant_ht: totalHT,
        taux_tva: tauxTVA,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        frais_deplacement: fraisDeplacement,
        statut: 'generee',
        date_facture: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, facture };
  } catch (error) {
    console.error('[FACTURES] Erreur création auto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/factures
 * Liste des factures avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois, statut, limit = 100 } = req.query;

    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_facture', { ascending: false })
      .limit(parseInt(limit));

    // Filtre par mois
    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_facture', startDate).lte('date_facture', endDate);
    }

    // Filtre par statut
    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Formater les factures
    const factures = data.map(f => ({
      ...f,
      montant_ht_euros: (f.montant_ht / 100).toFixed(2),
      montant_tva_euros: (f.montant_tva / 100).toFixed(2),
      montant_ttc_euros: (f.montant_ttc / 100).toFixed(2),
      frais_deplacement_euros: ((f.frais_deplacement || 0) / 100).toFixed(2)
    }));

    // Stats
    const total_ttc = data.reduce((sum, f) => sum + f.montant_ttc, 0);
    const total_tva = data.reduce((sum, f) => sum + f.montant_tva, 0);
    const nb_envoyees = data.filter(f => f.statut === 'envoyee' || f.statut === 'payee').length;
    const nb_en_attente = data.filter(f => f.statut === 'generee').length;

    res.json({
      success: true,
      factures,
      stats: {
        total: data.length,
        total_ttc_euros: (total_ttc / 100).toFixed(2),
        total_tva_euros: (total_tva / 100).toFixed(2),
        nb_envoyees,
        nb_en_attente
      }
    });
  } catch (error) {
    console.error('[FACTURES] Erreur liste:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/factures/:id
 * Détail d'une facture
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      facture: {
        ...data,
        montant_ht_euros: (data.montant_ht / 100).toFixed(2),
        montant_tva_euros: (data.montant_tva / 100).toFixed(2),
        montant_ttc_euros: (data.montant_ttc / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[FACTURES] Erreur détail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/:id/envoyer
 * Envoyer une facture par email (PDF)
 */
router.post('/:id/envoyer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer la facture
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (!facture.client_email) {
      return res.status(400).json({ success: false, error: 'Pas d\'email client' });
    }

    // TODO: Générer le PDF et l'envoyer par email
    // Pour l'instant, on simule l'envoi

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('factures')
      .update({
        statut: 'envoyee',
        date_envoi: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Facture ${facture.numero} envoyée à ${facture.client_email}`
    });
  } catch (error) {
    console.error('[FACTURES] Erreur envoi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/envoyer-toutes
 * Envoyer toutes les factures en attente
 */
router.post('/envoyer-toutes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.body;

    // Récupérer les factures en attente
    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('statut', 'generee')
      .not('client_email', 'is', null);

    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_facture', startDate).lte('date_facture', endDate);
    }

    const { data: factures, error } = await query;
    if (error) throw error;

    if (!factures || factures.length === 0) {
      return res.json({ success: true, message: 'Aucune facture à envoyer', nb_envoyees: 0 });
    }

    // Envoyer chaque facture
    const resultats = [];
    for (const facture of factures) {
      try {
        // TODO: Générer et envoyer le PDF

        // Mettre à jour le statut
        await supabase
          .from('factures')
          .update({
            statut: 'envoyee',
            date_envoi: new Date().toISOString()
          })
          .eq('id', facture.id);

        resultats.push({ id: facture.id, numero: facture.numero, success: true });
      } catch (err) {
        resultats.push({ id: facture.id, numero: facture.numero, success: false, error: err.message });
      }
    }

    const nbSuccess = resultats.filter(r => r.success).length;

    res.json({
      success: true,
      message: `${nbSuccess}/${factures.length} factures envoyées`,
      nb_envoyees: nbSuccess,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES] Erreur envoi multiple:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/factures/:id/statut
 * Changer le statut d'une facture
 */
router.patch('/:id/statut', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { statut } = req.body;

    const statutsValides = ['generee', 'envoyee', 'payee', 'annulee'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const updates = { statut };
    if (statut === 'payee') {
      updates.date_paiement = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('factures')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, facture: data });
  } catch (error) {
    console.error('[FACTURES] Erreur changement statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/generer-manquantes
 * Générer les factures pour toutes les réservations terminées sans facture
 */
router.post('/generer-manquantes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer les réservations terminées sans facture
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('statut', 'termine');

    if (resError) throw resError;

    // Récupérer les réservations qui ont déjà une facture
    const { data: facturesExistantes } = await supabase
      .from('factures')
      .select('reservation_id')
      .eq('tenant_id', tenantId)
      .not('reservation_id', 'is', null);

    const reservationsAvecFacture = new Set(
      facturesExistantes?.map(f => f.reservation_id) || []
    );

    // Filtrer les réservations sans facture
    const reservationsSansFacture = reservations?.filter(
      r => !reservationsAvecFacture.has(r.id)
    ) || [];

    // Générer les factures
    const resultats = [];
    for (const reservation of reservationsSansFacture) {
      const result = await createFactureFromReservation(reservation.id, tenantId);
      resultats.push({
        reservation_id: reservation.id,
        success: result.success,
        numero: result.facture?.numero
      });
    }

    const nbCreees = resultats.filter(r => r.success).length;

    res.json({
      success: true,
      message: `${nbCreees} facture(s) générée(s)`,
      nb_creees: nbCreees,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES] Erreur génération manquantes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
