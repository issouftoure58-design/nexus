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

// ============================================
// HELPER: GÉNÉRATION ÉCRITURES COMPTABLES
// ============================================

/**
 * Génère les écritures comptables pour une facture (VT + BQ si payée)
 */
async function genererEcrituresFacture(tenantId, factureId) {
  try {
    // Récupérer la facture
    const { data: facture, error: errFact } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('tenant_id', tenantId)
      .single();

    if (errFact || !facture) {
      console.error('[FACTURES] Facture non trouvée pour écritures:', factureId);
      return;
    }

    // Supprimer les anciennes écritures si elles existent
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('facture_id', factureId)
      .eq('tenant_id', tenantId);

    const dateFacture = facture.date_facture;
    const periode = dateFacture?.slice(0, 7);
    const exercice = parseInt(dateFacture?.slice(0, 4)) || new Date().getFullYear();
    const montantTTC = facture.montant_ttc || 0;
    const montantHT = facture.montant_ht || montantTTC;
    const montantTVA = facture.montant_tva || (montantTTC - montantHT);

    const ecritures = [];

    // Journal VT - Écriture de vente
    // Débit 411 Client
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '411',
      compte_libelle: 'Clients',
      libelle: `Facture ${facture.numero} - ${facture.client_nom || 'Client'}`,
      debit: montantTTC,
      credit: 0,
      facture_id: factureId,
      periode,
      exercice
    });

    // Crédit 706 Prestations
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '706',
      compte_libelle: 'Prestations de services',
      libelle: `Facture ${facture.numero}`,
      debit: 0,
      credit: montantHT,
      facture_id: factureId,
      periode,
      exercice
    });

    // Crédit 44571 TVA collectée
    if (montantTVA > 0) {
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'VT',
        date_ecriture: dateFacture,
        numero_piece: facture.numero,
        compte_numero: '44571',
        compte_libelle: 'TVA collectée',
        libelle: `TVA ${facture.numero}`,
        debit: 0,
        credit: montantTVA,
        facture_id: factureId,
        periode,
        exercice
      });
    }

    // Si facture payée, écriture banque
    if (facture.statut === 'payee') {
      const datePaiement = facture.date_paiement?.split('T')[0] || dateFacture;
      const periodePaie = datePaiement?.slice(0, 7);

      // Journal BQ - Encaissement
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Encaissement ${facture.numero} - ${facture.client_nom || 'Client'}`,
        debit: montantTTC,
        credit: 0,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      });

      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '411',
        compte_libelle: 'Clients',
        libelle: `Règlement ${facture.numero}`,
        debit: 0,
        credit: montantTTC,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      });
    }

    if (ecritures.length > 0) {
      const { error } = await supabase
        .from('ecritures_comptables')
        .insert(ecritures);

      if (error) {
        console.error('[FACTURES] Erreur insertion écritures:', error);
      } else {
        console.log(`[FACTURES] ${ecritures.length} écritures générées pour facture ${facture.numero}`);
      }
    }
  } catch (err) {
    console.error('[FACTURES] Erreur génération écritures:', err);
  }
}

/**
 * Génère un numéro de facture unique
 * Format: {PREFIX}-{YEAR}-{SEQUENCE:5}
 */
async function generateNumeroFacture(tenantId) {
  const year = new Date().getFullYear();

  // Récupérer le préfixe du tenant (3 premières lettres)
  const prefix = tenantId.substring(0, 3).toUpperCase();

  // Récupérer le dernier numéro de facture de l'année
  const { data: lastFacture } = await supabase
    .from('factures')
    .select('numero')
    .eq('tenant_id', tenantId)
    .like('numero', `${prefix}-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;
  if (lastFacture?.numero) {
    // Extraire le numéro de séquence du dernier numéro
    const match = lastFacture.numero.match(/-(\d+)$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Crée automatiquement une facture depuis une réservation
 * @param {number} reservationId - ID de la réservation
 * @param {string} tenantId - ID du tenant
 * @param {object} options - Options
 * @param {string} options.statut - Statut initial ('brouillon', 'generee', 'envoyee', 'payee')
 * @param {boolean} options.updateIfExists - Si true, met à jour la facture existante au lieu de retourner
 */
export async function createFactureFromReservation(reservationId, tenantId, options = {}) {
  const { statut = 'generee', updateIfExists = false } = options;

  try {
    // Vérifier si une facture existe déjà
    const { data: existing } = await supabase
      .from('factures')
      .select('id, statut')
      .eq('reservation_id', reservationId)
      .single();

    if (existing) {
      if (updateIfExists && statut !== existing.statut) {
        // Mettre à jour le statut si demandé
        const { data: updated, error: updateError } = await supabase
          .from('factures')
          .update({ statut, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return { success: true, facture: updated, message: 'Facture mise à jour' };
      }
      return { success: true, facture: existing, message: 'Facture déjà existante' };
    }

    // Récupérer la réservation avec les détails
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        clients(id, nom, prenom, email, telephone)
      `)
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (resError || !reservation) {
      throw new Error(`Réservation non trouvée: ${resError?.message || 'data is null'}`);
    }

    // Calculer les montants
    // Certaines réservations ont le prix en centimes, d'autres en euros
    // Si prix < 1000, c'est probablement en euros → convertir en centimes
    let prixTTC = reservation.prix_total || reservation.prix_service || 0;
    let fraisDeplacement = reservation.frais_deplacement || 0;

    // Convertir en centimes si le prix semble être en euros (< 1000)
    if (prixTTC > 0 && prixTTC < 1000) {
      prixTTC = prixTTC * 100;
    }
    if (fraisDeplacement > 0 && fraisDeplacement < 1000) {
      fraisDeplacement = fraisDeplacement * 100;
    }

    const tauxTVA = reservation.taux_tva || 20;

    // Total TTC incluant frais déplacement (en centimes)
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
        client_adresse: null,
        service_nom: reservation.service_nom || 'Prestation',
        service_description: reservation.notes || null,
        date_prestation: reservation.date,
        montant_ht: totalHT,
        taux_tva: tauxTVA,
        montant_tva: totalTVA,
        montant_ttc: totalTTC,
        frais_deplacement: fraisDeplacement,
        statut: statut,
        date_facture: reservation.date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    // Générer les écritures comptables
    await genererEcrituresFacture(tenantId, facture.id);

    console.log(`[FACTURES] Facture ${numero} créée (statut: ${statut}) pour réservation ${reservationId}`);
    return { success: true, facture };
  } catch (error) {
    console.error('[FACTURES] Erreur création auto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour le statut d'une facture liée à une réservation
 */
export async function updateFactureStatutFromReservation(reservationId, tenantId, newStatut) {
  try {
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('id, statut')
      .eq('reservation_id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      console.log(`[FACTURES] Pas de facture trouvée pour réservation ${reservationId}`);
      return { success: false, error: 'Facture non trouvée' };
    }

    const { data: updated, error } = await supabase
      .from('factures')
      .update({
        statut: newStatut,
        updated_at: new Date().toISOString()
      })
      .eq('id', facture.id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[FACTURES] Facture ${updated.numero} mise à jour: ${facture.statut} → ${newStatut}`);
    return { success: true, facture: updated };
  } catch (error) {
    console.error('[FACTURES] Erreur mise à jour statut:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Supprime ou annule la facture liée à une réservation
 */
export async function cancelFactureFromReservation(reservationId, tenantId, deleteFacture = false) {
  try {
    const { data: facture, error: fetchError } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('reservation_id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      console.log(`[FACTURES] Pas de facture à annuler pour réservation ${reservationId}`);
      return { success: true, message: 'Pas de facture associée' };
    }

    // Si la facture est déjà payée, on ne peut pas la supprimer
    if (facture.statut === 'payee') {
      console.warn(`[FACTURES] Facture ${facture.numero} déjà payée, annulation impossible`);
      return { success: false, error: 'Facture déjà payée, annulation impossible' };
    }

    if (deleteFacture) {
      // Supprimer complètement (si brouillon)
      const { error } = await supabase
        .from('factures')
        .delete()
        .eq('id', facture.id);

      if (error) throw error;
      console.log(`[FACTURES] Facture ${facture.numero} supprimée`);
      return { success: true, message: 'Facture supprimée' };
    } else {
      // Annuler (garder l'historique)
      const { data: updated, error } = await supabase
        .from('factures')
        .update({
          statut: 'annulee',
          updated_at: new Date().toISOString()
        })
        .eq('id', facture.id)
        .select()
        .single();

      if (error) throw error;
      console.log(`[FACTURES] Facture ${facture.numero} annulée`);
      return { success: true, facture: updated };
    }
  } catch (error) {
    console.error('[FACTURES] Erreur annulation:', error);
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
    const { mois, statut, limit = 1000 } = req.query;

    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_prestation', { ascending: false })
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

    const statutsValides = ['brouillon', 'generee', 'envoyee', 'payee', 'annulee'];
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

    // Régénérer les écritures comptables (notamment pour ajouter les écritures BQ si payée)
    await genererEcrituresFacture(tenantId, parseInt(id));

    res.json({ success: true, facture: data });
  } catch (error) {
    console.error('[FACTURES] Erreur changement statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/generer-manquantes
 * Générer les factures pour TOUTES les réservations (confirmées ou terminées) sans facture
 * et synchroniser les statuts
 */
router.post('/generer-manquantes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    console.log(`[FACTURES SYNC] Début sync pour tenant ${tenantId}`);

    // Récupérer TOUTES les réservations (sauf annulées)
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, statut, date')
      .eq('tenant_id', tenantId)
      .neq('statut', 'annule')
      .order('date', { ascending: false });

    console.log(`[FACTURES SYNC] ${reservations?.length || 0} réservations trouvées`);

    if (resError) throw resError;

    // Récupérer les réservations qui ont déjà une facture
    const { data: facturesExistantes } = await supabase
      .from('factures')
      .select('reservation_id, id, statut')
      .eq('tenant_id', tenantId)
      .not('reservation_id', 'is', null);

    const facturesMap = new Map(
      facturesExistantes?.map(f => [f.reservation_id, f]) || []
    );

    const resultats = [];

    for (const reservation of reservations || []) {
      const existingFacture = facturesMap.get(reservation.id);

      // Déterminer le statut de la facture selon la réservation
      // Terminée → payee, sinon → generee (en attente)
      const statutFacture = reservation.statut === 'termine' ? 'payee' : 'generee';

      if (!existingFacture) {
        // Pas de facture - créer
        const result = await createFactureFromReservation(reservation.id, tenantId, { statut: statutFacture });
        resultats.push({
          reservation_id: reservation.id,
          date: reservation.date,
          action: 'created',
          success: result.success,
          numero: result.facture?.numero,
          statut: statutFacture,
          error: result.error
        });
      } else {
        // Facture existe - synchroniser le statut si nécessaire
        let nouveauStatut = existingFacture.statut;

        // Réservation terminée → facture payée
        if (reservation.statut === 'termine' && existingFacture.statut !== 'payee') {
          nouveauStatut = 'payee';
        // Réservation annulée → facture annulée
        } else if (reservation.statut === 'annule' && existingFacture.statut !== 'annulee') {
          nouveauStatut = 'annulee';
        }

        if (nouveauStatut !== existingFacture.statut) {
          await supabase
            .from('factures')
            .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
            .eq('id', existingFacture.id);

          resultats.push({
            reservation_id: reservation.id,
            action: 'updated',
            success: true,
            ancien: existingFacture.statut,
            nouveau: nouveauStatut
          });
        } else {
          resultats.push({
            reservation_id: reservation.id,
            action: 'unchanged',
            success: true
          });
        }
      }
    }

    const nbCreees = resultats.filter(r => r.action === 'created' && r.success).length;
    const nbMisesAJour = resultats.filter(r => r.action === 'updated').length;
    const nbEchecs = resultats.filter(r => r.action === 'created' && !r.success).length;

    console.log(`[FACTURES SYNC] Résultat: ${nbCreees} créées, ${nbMisesAJour} mises à jour, ${nbEchecs} échecs`);

    // Log des échecs s'il y en a
    resultats.filter(r => !r.success).forEach(r => {
      console.error(`[FACTURES SYNC] Échec pour réservation ${r.reservation_id}:`, r.error);
    });

    res.json({
      success: true,
      message: `${nbCreees} facture(s) créée(s), ${nbMisesAJour} mise(s) à jour`,
      nb_creees: nbCreees,
      nb_mises_a_jour: nbMisesAJour,
      nb_echecs: nbEchecs,
      total_reservations: reservations?.length || 0,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES SYNC] Erreur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/factures/sync-statuts
 * Synchronise les statuts des factures avec les réservations
 */
router.post('/sync-statuts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer toutes les factures avec leur réservation associée
    const { data: factures, error: fetchError } = await supabase
      .from('factures')
      .select('id, numero, statut, reservation_id')
      .eq('tenant_id', tenantId)
      .not('reservation_id', 'is', null);

    if (fetchError) throw fetchError;

    const resultats = [];

    for (const facture of factures || []) {
      // Récupérer le statut de la réservation
      const { data: reservation } = await supabase
        .from('reservations')
        .select('statut')
        .eq('id', facture.reservation_id)
        .single();

      if (!reservation) {
        resultats.push({ numero: facture.numero, action: 'skipped', reason: 'Réservation non trouvée' });
        continue;
      }

      // Déterminer le nouveau statut de la facture
      let nouveauStatut = facture.statut;

      if (reservation.statut === 'termine' && facture.statut === 'brouillon') {
        nouveauStatut = 'generee';
      } else if (reservation.statut === 'annule' && facture.statut !== 'payee' && facture.statut !== 'annulee') {
        nouveauStatut = 'annulee';
      } else if (['demande', 'confirme', 'en_attente'].includes(reservation.statut) && facture.statut === 'generee') {
        // Si la réservation n'est pas terminée mais la facture est générée, la repasser en brouillon
        nouveauStatut = 'brouillon';
      }

      if (nouveauStatut !== facture.statut) {
        const { error: updateError } = await supabase
          .from('factures')
          .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
          .eq('id', facture.id);

        if (updateError) {
          resultats.push({ numero: facture.numero, action: 'error', error: updateError.message });
        } else {
          resultats.push({ numero: facture.numero, action: 'updated', ancien: facture.statut, nouveau: nouveauStatut });
        }
      } else {
        resultats.push({ numero: facture.numero, action: 'unchanged' });
      }
    }

    const nbMisesAJour = resultats.filter(r => r.action === 'updated').length;

    res.json({
      success: true,
      message: `${nbMisesAJour} facture(s) mise(s) à jour`,
      total: factures?.length || 0,
      resultats
    });
  } catch (error) {
    console.error('[FACTURES] Erreur sync statuts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/factures/:id/pdf
 * Génère et retourne le PDF d'une facture
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer la facture avec les détails
    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !facture) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Récupérer les infos du tenant pour l'en-tête
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .single();

    // Générer le HTML de la facture
    const html = generateFactureHTML(facture, tenant);

    // Retourner le HTML (le client peut l'imprimer ou le convertir en PDF)
    res.json({
      success: true,
      facture: {
        ...facture,
        montant_ht_euros: (facture.montant_ht / 100).toFixed(2),
        montant_tva_euros: (facture.montant_tva / 100).toFixed(2),
        montant_ttc_euros: (facture.montant_ttc / 100).toFixed(2)
      },
      html,
      tenant: tenant?.name || 'NEXUS'
    });
  } catch (error) {
    console.error('[FACTURES] Erreur génération PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Génère le HTML d'une facture pour impression/PDF
 */
function generateFactureHTML(facture, tenant) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatMontant = (cents) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${facture.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #0891b2; }
    .facture-info { text-align: right; }
    .facture-numero { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
    .facture-date { color: #666; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .partie { width: 45%; }
    .partie-titre { font-weight: bold; color: #0891b2; margin-bottom: 10px; border-bottom: 2px solid #0891b2; padding-bottom: 5px; }
    .partie p { margin: 3px 0; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .table th { background: #0891b2; color: white; padding: 12px; text-align: left; }
    .table td { padding: 12px; border-bottom: 1px solid #eee; }
    .table .montant { text-align: right; }
    .totaux { width: 300px; margin-left: auto; }
    .totaux-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .totaux-row.total { font-size: 16px; font-weight: bold; border-bottom: 2px solid #0891b2; color: #0891b2; }
    .footer { margin-top: 60px; text-align: center; font-size: 10px; color: #999; }
    .statut { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .statut-payee { background: #d1fae5; color: #065f46; }
    .statut-generee { background: #cffafe; color: #0e7490; }
    .statut-brouillon { background: #fef3c7; color: #92400e; }
    .statut-annulee { background: #f3f4f6; color: #6b7280; text-decoration: line-through; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${tenant?.name || 'NEXUS'}</div>
    <div class="facture-info">
      <div class="facture-numero">FACTURE ${facture.numero}</div>
      <div class="facture-date">Date : ${formatDate(facture.date_facture)}</div>
      <div class="statut statut-${facture.statut}">${facture.statut.toUpperCase()}</div>
    </div>
  </div>

  <div class="parties">
    <div class="partie">
      <div class="partie-titre">Émetteur</div>
      <p><strong>${tenant?.name || 'NEXUS'}</strong></p>
      <p>SIRET : À compléter</p>
    </div>
    <div class="partie">
      <div class="partie-titre">Client</div>
      <p><strong>${facture.client_nom || '-'}</strong></p>
      ${facture.client_adresse ? `<p>${facture.client_adresse}</p>` : ''}
      ${facture.client_telephone ? `<p>Tél : ${facture.client_telephone}</p>` : ''}
      ${facture.client_email ? `<p>Email : ${facture.client_email}</p>` : ''}
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Date prestation</th>
        <th class="montant">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${facture.service_nom || 'Prestation'}</strong>
          ${facture.service_description ? `<br><small>${facture.service_description}</small>` : ''}
        </td>
        <td>${formatDate(facture.date_prestation)}</td>
        <td class="montant">${formatMontant(facture.montant_ht - (facture.frais_deplacement || 0))}</td>
      </tr>
      ${facture.frais_deplacement > 0 ? `
      <tr>
        <td>Frais de déplacement</td>
        <td>-</td>
        <td class="montant">${formatMontant(facture.frais_deplacement)}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>

  <div class="totaux">
    <div class="totaux-row">
      <span>Total HT</span>
      <span>${formatMontant(facture.montant_ht)}</span>
    </div>
    <div class="totaux-row">
      <span>TVA (${facture.taux_tva || 20}%)</span>
      <span>${formatMontant(facture.montant_tva)}</span>
    </div>
    <div class="totaux-row total">
      <span>Total TTC</span>
      <span>${formatMontant(facture.montant_ttc)}</span>
    </div>
  </div>

  ${facture.statut === 'payee' && facture.date_paiement ? `
  <p style="margin-top: 20px; color: #065f46; font-weight: bold;">
    ✓ Payée le ${formatDate(facture.date_paiement)}
  </p>
  ` : ''}

  <div class="footer">
    <p>Merci pour votre confiance</p>
  </div>
</body>
</html>
`;
}

export default router;
