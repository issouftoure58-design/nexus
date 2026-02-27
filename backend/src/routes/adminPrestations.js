/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ADMIN PRESTATIONS - Gestion des prestations              ║
 * ║   Suivi des prestations planifiées et réalisées                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
router.use(authenticateAdmin);

// ============================================
// ROUTES CRUD
// ============================================

/**
 * GET /api/admin/prestations
 * Liste des prestations avec filtres et stats
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, date, client_id, limit = 100 } = req.query;

    let query = supabase
      .from('prestations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_debut', { ascending: false })
      .order('heure_debut', { ascending: false })
      .limit(parseInt(limit));

    if (statut) {
      query = query.eq('statut', statut);
    }

    if (date) {
      query = query.eq('date_debut', date);
    }

    if (client_id) {
      query = query.eq('client_id', parseInt(client_id));
    }

    const { data: prestations, error } = await query;

    if (error) throw error;

    // Calculer les stats
    const { data: allPrestations } = await supabase
      .from('prestations')
      .select('statut, montant_ttc')
      .eq('tenant_id', tenantId);

    const stats = {
      total: allPrestations?.length || 0,
      planifiee: allPrestations?.filter(p => p.statut === 'planifiee').length || 0,
      en_cours: allPrestations?.filter(p => p.statut === 'en_cours').length || 0,
      terminee: allPrestations?.filter(p => p.statut === 'terminee').length || 0,
      annulee: allPrestations?.filter(p => p.statut === 'annulee').length || 0,
      facturee: allPrestations?.filter(p => p.statut === 'facturee').length || 0,
      montant_total: allPrestations?.reduce((sum, p) => sum + (p.montant_ttc || 0), 0) || 0
    };

    res.json({ prestations: prestations || [], stats });
  } catch (error) {
    console.error('[PRESTATIONS] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/prestations/:id
 * Détail d'une prestation avec lignes et ressources
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer la prestation
    const { data: prestation, error } = await supabase
      .from('prestations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !prestation) {
      return res.status(404).json({ error: 'Prestation non trouvée' });
    }

    // Récupérer les lignes
    const { data: lignes } = await supabase
      .from('prestation_lignes')
      .select('*')
      .eq('prestation_id', id)
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true });

    // Récupérer les ressources affectées
    const { data: ressources } = await supabase
      .from('prestation_ressources')
      .select(`
        *,
        ressource:ressources(id, nom, categorie)
      `)
      .eq('prestation_id', id)
      .eq('tenant_id', tenantId);

    res.json({
      prestation,
      lignes: lignes || [],
      ressources: ressources || []
    });
  } catch (error) {
    console.error('[PRESTATIONS] Erreur détail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/prestations/:id/statut
 * Changer le statut d'une prestation
 * Si terminée → génère automatiquement une facture
 */
router.patch('/:id/statut', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { statut } = req.body;

    const validStatuts = ['planifiee', 'en_cours', 'terminee', 'annulee', 'facturee'];
    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    // Récupérer la prestation actuelle
    const { data: prestationActuelle } = await supabase
      .from('prestations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!prestationActuelle) {
      return res.status(404).json({ error: 'Prestation non trouvée' });
    }

    const { data: prestation, error } = await supabase
      .from('prestations')
      .update({
        statut,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[PRESTATIONS] Statut ${id} → ${statut}`);

    let facture = null;

    // ============================================
    // GÉNÉRATION FACTURE SI TERMINÉE
    // ============================================
    if (statut === 'terminee' && prestationActuelle.statut !== 'terminee') {
      try {
        // Vérifier qu'une facture n'existe pas déjà pour cette prestation
        const { data: factureExistante } = await supabase
          .from('factures')
          .select('id, numero')
          .eq('prestation_id', id)
          .eq('tenant_id', tenantId)
          .single();

        if (factureExistante) {
          console.log(`[PRESTATIONS] Facture ${factureExistante.numero} déjà existante pour prestation ${id}`);
          facture = factureExistante;
        } else {
          // Générer numéro de facture
          const year = new Date().getFullYear();
          const prefix = tenantId.substring(0, 3).toUpperCase();

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
            const match = lastFacture.numero.match(/-(\d+)$/);
            if (match) {
              sequence = parseInt(match[1], 10) + 1;
            }
          }
          const numeroFacture = `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;

          // Récupérer les lignes de prestation pour la description
          const { data: lignes } = await supabase
            .from('prestation_lignes')
            .select('designation, quantite, prix_total')
            .eq('prestation_id', id)
            .eq('tenant_id', tenantId);

          const serviceNom = lignes?.length > 0
            ? lignes.map(l => l.designation).join(', ')
            : 'Prestation';

          // Créer la facture
          const factureData = {
            tenant_id: tenantId,
            numero: numeroFacture,
            prestation_id: id,
            client_id: prestation.client_id,
            client_nom: prestation.client_nom,
            client_email: prestation.client_email,
            client_telephone: prestation.client_telephone,
            service_nom: serviceNom,
            date_prestation: prestation.date_debut,
            date_facture: new Date().toISOString().split('T')[0],
            montant_ht: prestation.montant_ht,
            taux_tva: prestation.taux_tva || 20,
            montant_tva: prestation.montant_tva,
            montant_ttc: prestation.montant_ttc,
            statut: 'generee'
          };

          const { data: newFacture, error: factureError } = await supabase
            .from('factures')
            .insert(factureData)
            .select()
            .single();

          if (factureError) {
            console.error('[PRESTATIONS] Erreur création facture:', factureError);
          } else {
            facture = newFacture;
            console.log(`[PRESTATIONS] Facture ${numeroFacture} générée pour prestation ${prestation.numero}`);

            // Mettre à jour la prestation avec l'ID de la facture
            await supabase.from('prestations').update({
              facture_id: newFacture.id,
              statut: 'facturee'
            }).eq('id', id).eq('tenant_id', tenantId);

            // Mettre à jour la réservation liée si elle existe
            if (prestation.reservation_id) {
              await supabase.from('reservations').update({
                statut: 'termine'
              }).eq('id', prestation.reservation_id).eq('tenant_id', tenantId);
            }
          }
        }
      } catch (factureErr) {
        console.error('[PRESTATIONS] Erreur génération facture:', factureErr);
      }
    }

    // Mettre à jour la réservation liée si annulée
    if (statut === 'annulee' && prestation.reservation_id) {
      await supabase.from('reservations').update({
        statut: 'annule'
      }).eq('id', prestation.reservation_id).eq('tenant_id', tenantId);
    }

    res.json({
      success: true,
      prestation,
      facture: facture ? {
        id: facture.id,
        numero: facture.numero,
        message: `Facture ${facture.numero} générée`
      } : null
    });
  } catch (error) {
    console.error('[PRESTATIONS] Erreur changement statut:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/prestations/:id
 * Modifier une prestation
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const {
      date_debut,
      heure_debut,
      heure_fin,
      notes,
      notes_internes,
      adresse
    } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (date_debut !== undefined) updateData.date_debut = date_debut;
    if (heure_debut !== undefined) updateData.heure_debut = heure_debut;
    if (heure_fin !== undefined) updateData.heure_fin = heure_fin;
    if (notes !== undefined) updateData.notes = notes;
    if (notes_internes !== undefined) updateData.notes_internes = notes_internes;
    if (adresse !== undefined) updateData.adresse = adresse;

    const { data: prestation, error } = await supabase
      .from('prestations')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, prestation });
  } catch (error) {
    console.error('[PRESTATIONS] Erreur modification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/prestations/:id
 * Annuler/supprimer une prestation
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Vérifier le statut actuel
    const { data: existing } = await supabase
      .from('prestations')
      .select('statut')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Prestation non trouvée' });
    }

    if (existing.statut === 'facturee') {
      return res.status(400).json({ error: 'Impossible de supprimer une prestation facturée' });
    }

    // Soft delete - passer en annulée
    const { error } = await supabase
      .from('prestations')
      .update({ statut: 'annulee', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[PRESTATIONS] Erreur suppression:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
