/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ADMIN DEVIS - Gestion des devis clients                  ║
 * ║   Chantier 2 - Module Devis intégré au pipeline                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();
router.use(authenticateAdmin);

// ============================================
// HELPERS
// ============================================

/**
 * Génère un numéro de devis unique
 * Format: DEV-YYYY-XXXXX
 */
async function generateNumeroDevis(tenantId) {
  const year = new Date().getFullYear();

  // Récupérer le préfixe du tenant (3 premières lettres)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single();

  const prefix = tenant?.id?.slice(0, 3)?.toUpperCase() || 'DEV';

  // Compter les devis de l'année
  const { count } = await supabase
    .from('devis')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', `${year}-01-01`);

  const sequence = String((count || 0) + 1).padStart(5, '0');
  return `${prefix}-${year}-${sequence}`;
}

/**
 * Log une action dans l'historique du devis
 */
async function logDevisHistorique(devisId, tenantId, action, ancienStatut, nouveauStatut, notes, changedBy) {
  await supabase.from('devis_historique').insert({
    devis_id: devisId,
    tenant_id: tenantId,
    action,
    ancien_statut: ancienStatut,
    nouveau_statut: nouveauStatut,
    notes,
    changed_by: changedBy
  });
}

// ============================================
// ROUTES CRUD
// ============================================

/**
 * GET /api/admin/devis
 * Liste des devis avec filtres
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, mois, client_id, limit = 100 } = req.query;

    let query = supabase
      .from('devis')
      .select(`
        *,
        clients:client_id (id, nom, prenom, email, telephone),
        opportunites:opportunite_id (id, nom, etape)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) {
      query = query.eq('statut', statut);
    }

    if (mois) {
      const startDate = `${mois}-01`;
      const endDate = `${mois}-31`;
      query = query.gte('date_devis', startDate).lte('date_devis', endDate);
    }

    if (client_id) {
      query = query.eq('client_id', parseInt(client_id));
    }

    const { data: devis, error } = await query;

    if (error) throw error;

    // Stats rapides
    const stats = {
      total: devis?.length || 0,
      brouillon: devis?.filter(d => d.statut === 'brouillon').length || 0,
      envoye: devis?.filter(d => d.statut === 'envoye').length || 0,
      accepte: devis?.filter(d => d.statut === 'accepte').length || 0,
      rejete: devis?.filter(d => d.statut === 'rejete').length || 0,
      montant_total: devis?.reduce((sum, d) => sum + (d.montant_ttc || 0), 0) || 0
    };

    res.json({ devis, stats });
  } catch (error) {
    console.error('[DEVIS] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/devis/:id
 * Détail d'un devis
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    console.log(`[DEVIS] GET /${id} - tenant: ${tenantId}`);

    const { data: devis, error } = await supabase
      .from('devis')
      .select(`
        *,
        clients:client_id (id, nom, prenom, email, telephone),
        opportunites:opportunite_id (id, nom, etape, montant)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !devis) {
      console.log(`[DEVIS] Non trouvé: id=${id}, tenant=${tenantId}, error=${error?.message}`);
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    console.log(`[DEVIS] Trouvé: ${devis.numero}`);

    // Récupérer les lignes du devis
    const { data: lignes } = await supabase
      .from('devis_lignes')
      .select('*')
      .eq('devis_id', id)
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true });

    console.log(`[DEVIS] Lignes trouvées: ${lignes?.length || 0}`);
    lignes?.forEach(l => console.log(`  - ${l.service_nom}: ${l.duree_minutes} min`));

    // Récupérer l'historique
    const { data: historique } = await supabase
      .from('devis_historique')
      .select('*')
      .eq('devis_id', id)
      .order('created_at', { ascending: false });

    res.json({ devis, lignes: lignes || [], historique });
  } catch (error) {
    console.error('[DEVIS] Erreur détail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/devis
 * Créer un nouveau devis
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      client_id,
      client_nom,
      client_email,
      client_telephone,
      client_adresse,
      adresse_facturation,
      service_id,
      service_nom,
      service_description,
      duree_minutes,
      lieu,
      montant_ht,
      taux_tva = 20,
      frais_deplacement = 0,
      validite_jours = 30,
      notes,
      opportunite_id,
      lignes, // Lignes de services individuelles
      date_prestation, // Date prévue de la prestation
      heure_prestation // Heure prévue de la prestation
    } = req.body;

    // Validation
    if (!client_id && !client_nom) {
      return res.status(400).json({ error: 'Client requis (client_id ou client_nom)' });
    }

    // Générer numéro
    const numero = await generateNumeroDevis(tenantId);

    // Calculer montants
    const montantHT = montant_ht || 0;
    const montantTVA = Math.round(montantHT * taux_tva / 100);
    const montantTTC = montantHT + montantTVA + (frais_deplacement || 0);

    // Calculer date expiration
    const dateDevis = new Date();
    const dateExpiration = new Date(dateDevis);
    dateExpiration.setDate(dateExpiration.getDate() + validite_jours);

    // Récupérer infos client si client_id fourni
    let clientData = { client_nom, client_email, client_telephone, client_adresse };
    if (client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('nom, prenom, email, telephone, adresse')
        .eq('id', client_id)
        .eq('tenant_id', tenantId)
        .single();

      if (client) {
        clientData = {
          client_nom: client_nom || `${client.prenom || ''} ${client.nom || ''}`.trim(),
          client_email: client_email || client.email,
          client_telephone: client_telephone || client.telephone,
          client_adresse: client_adresse || client.adresse
        };
      }
    }

    const devisData = {
      tenant_id: tenantId,
      numero,
      client_id: client_id || null,
      ...clientData,
      adresse_facturation: adresse_facturation || null,
      service_id: service_id || null,
      service_nom,
      service_description,
      duree_minutes,
      lieu: lieu || null,
      montant_ht: montantHT,
      taux_tva,
      montant_tva: montantTVA,
      montant_ttc: montantTTC,
      frais_deplacement: frais_deplacement || 0,
      statut: 'brouillon',
      date_devis: dateDevis.toISOString().split('T')[0],
      validite_jours,
      date_expiration: dateExpiration.toISOString().split('T')[0],
      notes,
      opportunite_id: opportunite_id || null,
      date_prestation: date_prestation || null,
      heure_prestation: heure_prestation || null,
      created_by: req.admin.email
    };

    const { data: devis, error } = await supabase
      .from('devis')
      .insert(devisData)
      .select()
      .single();

    if (error) throw error;

    // Créer les lignes de services si fournies (avec affectations pour mode horaire)
    if (lignes && Array.isArray(lignes) && lignes.length > 0) {
      // Pour chaque ligne, créer une entrée par affectation si présentes
      const lignesData = [];

      for (const ligne of lignes) {
        // Si la ligne a des affectations (mode horaire), créer une ligne par affectation
        if (ligne.affectations && Array.isArray(ligne.affectations) && ligne.affectations.length > 0) {
          for (const aff of ligne.affectations) {
            lignesData.push({
              devis_id: devis.id,
              tenant_id: tenantId,
              service_id: ligne.service_id || null,
              service_nom: ligne.service_nom,
              quantite: 1, // Une ligne par affectation
              duree_minutes: ligne.duree_minutes || 60,
              prix_unitaire: ligne.prix_unitaire || 0,
              prix_total: ligne.prix_total || 0,
              taux_horaire: ligne.taux_horaire || null,
              // Affectation avec heures
              membre_id: aff.membre_id || null,
              heure_debut: aff.heure_debut || null,
              heure_fin: aff.heure_fin || null
            });
          }
        } else {
          // Pas d'affectations, créer une seule ligne
          lignesData.push({
            devis_id: devis.id,
            tenant_id: tenantId,
            service_id: ligne.service_id || null,
            service_nom: ligne.service_nom,
            quantite: ligne.quantite || 1,
            duree_minutes: ligne.duree_minutes || 60,
            prix_unitaire: ligne.prix_unitaire || 0,
            prix_total: ligne.prix_total || 0,
            taux_horaire: ligne.taux_horaire || null
          });
        }
      }

      const { error: lignesError } = await supabase
        .from('devis_lignes')
        .insert(lignesData);

      if (lignesError) {
        console.error('[DEVIS] Erreur création lignes:', lignesError);
      } else {
        console.log(`[DEVIS] ${lignesData.length} ligne(s) créée(s) avec affectations`);
      }
    }

    // Logger création
    await logDevisHistorique(
      devis.id, tenantId, 'cree', null, 'brouillon',
      'Devis créé', req.admin.email
    );

    console.log(`[DEVIS] Devis ${numero} créé pour tenant ${tenantId}`);
    res.status(201).json({ success: true, devis });
  } catch (error) {
    console.error('[DEVIS] Erreur création:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/devis/:id
 * Modifier un devis
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Vérifier que le devis existe et est modifiable
    const { data: existing } = await supabase
      .from('devis')
      .select('statut')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (!['brouillon', 'envoye'].includes(existing.statut)) {
      return res.status(400).json({ error: 'Seuls les devis en brouillon ou envoyés peuvent être modifiés' });
    }

    const {
      client_id,
      client_nom,
      client_email,
      client_telephone,
      client_adresse,
      adresse_facturation,
      service_id,
      service_nom,
      service_description,
      duree_minutes,
      lieu,
      montant_ht,
      taux_tva,
      frais_deplacement,
      validite_jours,
      notes,
      date_prestation,
      heure_prestation
    } = req.body;

    // Recalculer montants si modifiés
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (client_id !== undefined) updateData.client_id = client_id;
    if (client_nom !== undefined) updateData.client_nom = client_nom;
    if (client_email !== undefined) updateData.client_email = client_email;
    if (client_telephone !== undefined) updateData.client_telephone = client_telephone;
    if (client_adresse !== undefined) updateData.client_adresse = client_adresse;
    if (adresse_facturation !== undefined) updateData.adresse_facturation = adresse_facturation;
    if (service_id !== undefined) updateData.service_id = service_id;
    if (service_nom !== undefined) updateData.service_nom = service_nom;
    if (service_description !== undefined) updateData.service_description = service_description;
    if (duree_minutes !== undefined) updateData.duree_minutes = duree_minutes;
    if (lieu !== undefined) updateData.lieu = lieu;
    if (notes !== undefined) updateData.notes = notes;
    if (date_prestation !== undefined) updateData.date_prestation = date_prestation;
    if (heure_prestation !== undefined) updateData.heure_prestation = heure_prestation;

    if (montant_ht !== undefined || taux_tva !== undefined || frais_deplacement !== undefined) {
      const ht = montant_ht !== undefined ? montant_ht : 0;
      const tva = taux_tva !== undefined ? taux_tva : 20;
      const frais = frais_deplacement !== undefined ? frais_deplacement : 0;

      updateData.montant_ht = ht;
      updateData.taux_tva = tva;
      updateData.montant_tva = Math.round(ht * tva / 100);
      updateData.montant_ttc = ht + updateData.montant_tva + frais;
      updateData.frais_deplacement = frais;
    }

    if (validite_jours !== undefined) {
      updateData.validite_jours = validite_jours;
      const dateDevis = new Date();
      const dateExpiration = new Date(dateDevis);
      dateExpiration.setDate(dateExpiration.getDate() + validite_jours);
      updateData.date_expiration = dateExpiration.toISOString().split('T')[0];
    }

    const { data: devis, error } = await supabase
      .from('devis')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Logger modification
    await logDevisHistorique(
      id, tenantId, 'modifie', existing.statut, existing.statut,
      'Devis modifié', req.admin.email
    );

    res.json({ success: true, devis });
  } catch (error) {
    console.error('[DEVIS] Erreur modification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/devis/:id
 * Supprimer un devis (brouillon uniquement)
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Vérifier le statut
    const { data: existing } = await supabase
      .from('devis')
      .select('statut, numero')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (existing.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Seuls les devis en brouillon peuvent être supprimés' });
    }

    const { error } = await supabase
      .from('devis')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    console.log(`[DEVIS] Devis ${existing.numero} supprimé`);
    res.json({ success: true, message: 'Devis supprimé' });
  } catch (error) {
    console.error('[DEVIS] Erreur suppression:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/devis/:id/statut
 * Changer le statut d'un devis (admin override)
 */
router.patch('/:id/statut', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { statut } = req.body;

    const statutsValides = ['brouillon', 'envoye', 'accepte', 'rejete', 'expire', 'annule', 'execute'];

    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({
        error: `Statut invalide. Valeurs acceptées: ${statutsValides.join(', ')}`
      });
    }

    // Vérifier que le devis existe
    const { data: existing } = await supabase
      .from('devis')
      .select('statut, numero')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (existing.statut === statut) {
      return res.json({ success: true, message: 'Statut inchangé', devis: existing });
    }

    // Préparer les données de mise à jour
    const updateData = {
      statut,
      updated_at: new Date().toISOString()
    };

    // Ajouter les dates spécifiques selon le statut
    if (statut === 'envoye' && !existing.date_envoi) {
      updateData.date_envoi = new Date().toISOString();
    }
    if (statut === 'accepte') {
      updateData.date_acceptation = new Date().toISOString();
    }
    if (statut === 'rejete') {
      updateData.date_rejet = new Date().toISOString();
    }
    if (statut === 'execute') {
      updateData.date_execution = new Date().toISOString();
    }

    const { data: devis, error: updateError } = await supabase
      .from('devis')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Logger le changement
    await logDevisHistorique(
      id, tenantId, 'statut_change', existing.statut, statut,
      `Statut changé de ${existing.statut} à ${statut}`,
      req.admin.email
    );

    console.log(`[DEVIS] Devis ${existing.numero}: ${existing.statut} → ${statut}`);
    res.json({ success: true, devis });
  } catch (error) {
    console.error('[DEVIS] Erreur changement statut:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES ACTIONS
// ============================================

/**
 * POST /api/admin/devis/:id/envoyer
 * Envoyer le devis par email
 */
router.post('/:id/envoyer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer le devis
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !devis) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (!['brouillon', 'envoye'].includes(devis.statut)) {
      return res.status(400).json({ error: 'Ce devis ne peut pas être envoyé' });
    }

    if (!devis.client_email) {
      return res.status(400).json({ error: 'Email client requis pour l\'envoi' });
    }

    // Récupérer infos tenant pour le branding
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, email, telephone')
      .eq('id', tenantId)
      .single();

    // Envoyer l'email avec le devis
    // TODO: Générer PDF et envoyer
    // Pour l'instant, on marque juste comme envoyé

    const ancienStatut = devis.statut;
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        statut: 'envoye',
        date_envoi: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Logger envoi
    await logDevisHistorique(
      id, tenantId, 'envoye', ancienStatut, 'envoye',
      `Envoyé à ${devis.client_email}`, req.admin.email
    );

    console.log(`[DEVIS] Devis ${devis.numero} envoyé à ${devis.client_email}`);
    res.json({ success: true, message: 'Devis envoyé' });
  } catch (error) {
    console.error('[DEVIS] Erreur envoi:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/devis/:id/accepter
 * Accepter le devis (juste changer le statut, pas de création de réservation)
 */
router.post('/:id/accepter', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer le devis
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !devis) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (devis.statut !== 'envoye') {
      return res.status(400).json({ error: 'Seul un devis envoyé peut être accepté' });
    }

    // Mettre à jour le devis - juste le statut
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        statut: 'accepte',
        date_acceptation: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Logger acceptation
    await logDevisHistorique(
      id, tenantId, 'accepte', 'envoye', 'accepte',
      'Devis accepté par le client',
      req.admin.email
    );

    console.log(`[DEVIS] Devis ${devis.numero} accepté`);
    res.json({
      success: true,
      message: 'Devis accepté',
      devis: { ...devis, statut: 'accepte' }
    });
  } catch (error) {
    console.error('[DEVIS] Erreur acceptation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/devis/:id/executer
 * Exécuter le devis = créer une PRESTATION avec ressources affectées
 * Body: { date_rdv, heure_rdv, affectations: [{ ligne_id, ressource_id }] }
 */
router.post('/:id/executer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { date_rdv, heure_rdv, affectations = [] } = req.body;

    // Validation
    if (!date_rdv || !heure_rdv) {
      return res.status(400).json({ error: 'Date et heure de début requises' });
    }

    // Validation: au moins un membre doit être assigné
    const hasValidAffectation = affectations.some(aff => aff.membre_id || aff.ressource_id);
    if (!hasValidAffectation) {
      return res.status(400).json({
        error: 'MEMBRE_REQUIS',
        message: 'Vous devez affecter au moins un membre du personnel à cette prestation'
      });
    }

    // Récupérer le devis
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !devis) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (devis.statut !== 'accepte') {
      return res.status(400).json({ error: 'Seul un devis accepté peut être exécuté' });
    }

    console.log('[DEVIS] Devis chargé:', {
      id: devis.id,
      client_id: devis.client_id,
      client_nom: devis.client_nom,
      montant_ttc: devis.montant_ttc
    });

    // ============================================
    // RÉSOUDRE LE CLIENT SI NÉCESSAIRE
    // ============================================
    let clientId = devis.client_id;

    // Si pas de client_id mais on a des infos client, chercher ou créer
    if (!clientId && (devis.client_email || devis.client_telephone)) {
      console.log('[DEVIS] Recherche client par email/téléphone:', {
        email: devis.client_email,
        telephone: devis.client_telephone
      });

      // Chercher par email d'abord
      if (devis.client_email) {
        const { data: clientByEmail } = await supabase
          .from('clients')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', devis.client_email)
          .single();

        if (clientByEmail) {
          clientId = clientByEmail.id;
          console.log('[DEVIS] Client trouvé par email:', clientId);
        }
      }

      // Sinon chercher par téléphone
      if (!clientId && devis.client_telephone) {
        const { data: clientByPhone } = await supabase
          .from('clients')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('telephone', devis.client_telephone)
          .single();

        if (clientByPhone) {
          clientId = clientByPhone.id;
          console.log('[DEVIS] Client trouvé par téléphone:', clientId);
        }
      }

      // Si toujours pas trouvé, créer le client
      if (!clientId && devis.client_nom) {
        // Parser le nom (format "prénom nom")
        const nomComplet = devis.client_nom.trim();
        const parts = nomComplet.split(' ');
        const prenom = parts[0] || '';
        const nom = parts.slice(1).join(' ') || parts[0] || 'Client';

        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            tenant_id: tenantId,
            prenom,
            nom,
            email: devis.client_email || null,
            telephone: devis.client_telephone || null,
            adresse: devis.client_adresse || null,
            source: 'devis',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (newClient) {
          clientId = newClient.id;
          console.log('[DEVIS] Nouveau client créé:', clientId);

          // Mettre à jour le devis avec le client_id
          await supabase
            .from('devis')
            .update({ client_id: clientId })
            .eq('id', id)
            .eq('tenant_id', tenantId);
        } else if (clientError) {
          console.error('[DEVIS] Erreur création client:', clientError);
        }
      }
    }

    // Récupérer les lignes du devis
    const { data: devisLignes } = await supabase
      .from('devis_lignes')
      .select('*')
      .eq('devis_id', id)
      .eq('tenant_id', tenantId);

    // Calculer durée totale - utiliser les heures des affectations si disponibles
    let dureeTotale = devis.duree_minutes || 60;
    let heureFinCalculee = null;

    // Vérifier si des affectations ont des heures définies
    const affectationsAvecHeures = affectations.filter(aff => aff.heure_debut && aff.heure_fin);

    if (affectationsAvecHeures.length > 0) {
      // Calculer la durée basée sur les heures réelles des affectations
      dureeTotale = affectationsAvecHeures.reduce((sum, aff) => {
        const [startH, startM] = aff.heure_debut.split(':').map(Number);
        const [endH, endM] = aff.heure_fin.split(':').map(Number);
        let startMinutes = startH * 60 + (startM || 0);
        let endMinutes = endH * 60 + (endM || 0);
        if (endMinutes < startMinutes) endMinutes += 24 * 60;
        return sum + (endMinutes - startMinutes);
      }, 0);

      // Trouver l'heure de fin la plus tardive
      let heureFinMax = 0;
      affectationsAvecHeures.forEach(aff => {
        const [endH, endM] = aff.heure_fin.split(':').map(Number);
        let endMinutes = endH * 60 + (endM || 0);
        if (endMinutes > heureFinMax) heureFinMax = endMinutes;
      });
      const finH = Math.floor(heureFinMax / 60) % 24;
      const finM = heureFinMax % 60;
      heureFinCalculee = `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}`;
    } else if (devisLignes && devisLignes.length > 0) {
      dureeTotale = devisLignes.reduce((sum, l) => sum + (l.duree_minutes || 60) * (l.quantite || 1), 0);
    }

    // Calculer heure de fin si pas encore calculée
    if (!heureFinCalculee) {
      const [h, m] = heure_rdv.split(':').map(Number);
      const totalMinutes = h * 60 + m + dureeTotale;
      const finH = Math.floor(totalMinutes / 60) % 24; // Modulo 24 pour gérer le passage à minuit
      const finM = totalMinutes % 60;
      heureFinCalculee = `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}`;
    }
    const heureFin = heureFinCalculee;

    // ============================================
    // FLUX SIMPLIFIÉ: DEVIS → RESERVATION
    // ============================================

    // ============================================
    // 1. CRÉER LA RÉSERVATION (événement agenda)
    // ============================================
    // Trouver les membres assignés (accepter membre_id OU ressource_id)
    let membrePrincipalId = null;
    const membresAssignes = [];

    // Créer un mapping ligne_id -> { membre_id, heure_debut, heure_fin } pour les reservation_lignes
    const ligneAffectationMap = {};

    for (const aff of affectations) {
      // Accepter membre_id ou ressource_id (les deux peuvent être utilisés)
      const membreId = aff.membre_id || aff.ressource_id;
      if (membreId) {
        // Mapper ligne_id -> affectation complète avec heures
        if (aff.ligne_id) {
          ligneAffectationMap[aff.ligne_id] = {
            membre_id: membreId,
            heure_debut: aff.heure_debut || heure_rdv,
            heure_fin: aff.heure_fin || null
          };
        }

        if (!membresAssignes.includes(membreId)) {
          membresAssignes.push(membreId);
          if (!membrePrincipalId) {
            membrePrincipalId = membreId;
          }
        }
      }
    }

    // Pour compatibilité avec l'ancien format
    const ligneMembreMap = {};
    for (const [ligneId, aff] of Object.entries(ligneAffectationMap)) {
      ligneMembreMap[ligneId] = aff.membre_id;
    }

    console.log('[DEVIS] Membres assignés:', membresAssignes);
    console.log('[DEVIS] Mapping ligne->membre:', ligneMembreMap);

    // Nom du service principal pour affichage
    const serviceNomPrincipal = devisLignes?.length > 1
      ? `${devisLignes.length} services - ${devis.client_nom || 'Client'}`
      : (devisLignes?.[0]?.service_nom || 'Prestation');

    const reservationData = {
      tenant_id: tenantId,
      date: date_rdv,
      heure: heure_rdv,
      heure_fin: heureFin,
      client_id: clientId, // Utiliser le client résolu (trouvé ou créé)
      service_nom: serviceNomPrincipal,
      service_id: devisLignes?.[0]?.service_id || null,
      duree_minutes: dureeTotale,
      duree_totale_minutes: dureeTotale,
      prix_service: devisLignes?.[0]?.prix_total || 0,
      prix_total: devis.montant_ttc,
      montant_ht: devis.montant_ht,
      montant_tva: devis.montant_tva,
      taux_tva: devis.taux_tva || 20,
      statut: 'confirme',
      adresse_client: devis.client_adresse || null,
      notes: devis.notes || null,
      devis_id: devis.id,
      membre_id: membrePrincipalId,
      created_via: 'devis'
    };

    const { data: reservation, error: resaError } = await supabase
      .from('reservations')
      .insert(reservationData)
      .select()
      .single();

    if (resaError) {
      console.error('[DEVIS] Erreur création réservation:', resaError);
      return res.status(500).json({ error: 'Erreur création réservation: ' + resaError.message });
    }

    console.log(`[DEVIS] Réservation ${reservation.id} créée pour ${date_rdv} ${heure_rdv}`);

    // ============================================
    // 2. CRÉER LES LIGNES DE RÉSERVATION (multi-services)
    // ============================================
    if (devisLignes && devisLignes.length > 0) {
      // Cas normal: devis_lignes existent
      const lignesData = devisLignes.map(l => {
        // Récupérer l'affectation complète pour cette ligne (avec heures)
        const affectation = ligneAffectationMap[l.id] || {};
        const heureDebut = affectation.heure_debut || heure_rdv;
        const heureFin = affectation.heure_fin;

        // Calculer la durée réelle si heure_debut et heure_fin sont définies
        let dureeMinutes = l.duree_minutes || 60;
        if (heureDebut && heureFin) {
          const [startH, startM] = heureDebut.split(':').map(Number);
          const [endH, endM] = heureFin.split(':').map(Number);
          let startMinutes = startH * 60 + (startM || 0);
          let endMinutes = endH * 60 + (endM || 0);
          if (endMinutes < startMinutes) endMinutes += 24 * 60; // Passage minuit
          dureeMinutes = endMinutes - startMinutes;
        }

        // Tronquer les heures au format HH:MM (VARCHAR(5) en base)
        const heureDebutShort = heureDebut ? heureDebut.slice(0, 5) : null;
        const heureFinShort = heureFin ? heureFin.slice(0, 5) : null;

        return {
          reservation_id: reservation.id,
          tenant_id: tenantId,
          service_id: l.service_id,
          service_nom: l.service_nom,
          quantite: l.quantite || 1,
          duree_minutes: dureeMinutes,
          prix_unitaire: l.prix_unitaire || 0,
          prix_total: l.prix_total || 0,
          // Membre assigné à cette ligne (depuis le mapping des affectations)
          membre_id: affectation.membre_id || membrePrincipalId || null,
          // Heures réelles (pour mode horaire) - format HH:MM
          heure_debut: heureDebutShort,
          heure_fin: heureFinShort
        };
      });

      const { error: lignesError } = await supabase
        .from('reservation_lignes')
        .insert(lignesData);

      if (lignesError) {
        console.error('[DEVIS] Erreur création lignes réservation:', lignesError);
      } else {
        console.log(`[DEVIS] ${lignesData.length} ligne(s) de service créée(s) avec membres et heures assignés`);
      }
    } else if (affectations.length > 0) {
      // Fallback: pas de devis_lignes mais des affectations - créer lignes depuis les affectations
      // Ceci gère les anciens devis créés avant le système multi-lignes
      console.log('[DEVIS] Pas de devis_lignes, création depuis affectations');

      // Parser les noms de services depuis devis.service_nom (format: "Service1 x1, Service2 x1")
      let parsedServiceNames = [];
      const serviceNomRaw = devis.service_nom || '';
      if (serviceNomRaw && !serviceNomRaw.match(/^\d+ services/)) {
        // Format "Service1 x1, Service2 x1" ou "Service1, Service2"
        parsedServiceNames = serviceNomRaw.split(',').map(part => {
          // Enlever " xN" à la fin si présent
          const cleaned = part.trim().replace(/\s*x\d+$/i, '').trim();
          return cleaned || 'Prestation';
        });
      }

      const lignesData = affectations
        .filter(aff => aff.membre_id || aff.ressource_id)
        .map((aff, index) => {
          const membreId = aff.membre_id || aff.ressource_id;
          const heureDebut = aff.heure_debut || heure_rdv;
          const heureFin = aff.heure_fin;

          // Calculer durée depuis les heures
          let dureeMinutes = devis.duree_minutes || 60;
          if (heureDebut && heureFin) {
            const [startH, startM] = heureDebut.split(':').map(Number);
            const [endH, endM] = heureFin.split(':').map(Number);
            let startMinutes = startH * 60 + (startM || 0);
            let endMinutes = endH * 60 + (endM || 0);
            if (endMinutes < startMinutes) endMinutes += 24 * 60;
            dureeMinutes = endMinutes - startMinutes;
          }

          // Utiliser le nom de service parsé ou fallback
          const serviceNom = parsedServiceNames[index] || parsedServiceNames[0] || 'Prestation';

          // Tronquer les heures au format HH:MM (VARCHAR(5) en base)
          const heureDebutShort = heureDebut ? heureDebut.slice(0, 5) : null;
          const heureFinShort = heureFin ? heureFin.slice(0, 5) : null;

          return {
            reservation_id: reservation.id,
            tenant_id: tenantId,
            service_id: devis.service_id || null,
            service_nom: serviceNom,
            quantite: 1,
            duree_minutes: dureeMinutes,
            prix_unitaire: Math.round((devis.montant_ht || 0) / affectations.length),
            prix_total: Math.round((devis.montant_ht || 0) / affectations.length),
            membre_id: membreId,
            heure_debut: heureDebutShort,
            heure_fin: heureFinShort
          };
        });

      if (lignesData.length > 0) {
        const { error: lignesError } = await supabase
          .from('reservation_lignes')
          .insert(lignesData);

        if (lignesError) {
          console.error('[DEVIS] Erreur création lignes réservation (fallback):', lignesError);
        } else {
          console.log(`[DEVIS] ${lignesData.length} ligne(s) créée(s) depuis affectations (fallback)`);
        }
      }
    }

    // ============================================
    // 3. AFFECTER LES MEMBRES (multi-affectation)
    // ============================================
    if (membresAssignes.length > 0) {
      const membresData = membresAssignes.map((membreId, index) => ({
        reservation_id: reservation.id,
        tenant_id: tenantId,
        membre_id: membreId,
        role: index === 0 ? 'principal' : 'assistant'
      }));

      console.log('[DEVIS] Création reservation_membres:', membresData);

      const { error: membresError } = await supabase
        .from('reservation_membres')
        .insert(membresData);

      if (membresError) {
        console.error('[DEVIS] Erreur affectation membres:', membresError);
      } else {
        console.log(`[DEVIS] ${membresData.length} membre(s) affecté(s) à la réservation ${reservation.id}`);
      }
    } else {
      console.warn('[DEVIS] Aucun membre assigné dans les affectations');
    }

    // ============================================
    // 4. METTRE À JOUR LE DEVIS
    // ============================================
    // Note: On ne stocke pas reservation_id car le champ est UUID et reservations.id est INTEGER
    // La liaison se fait via reservations.devis_id
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        statut: 'execute',
        date_execution: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[DEVIS] Erreur update devis:', updateError);
      // En cas d'erreur, on retourne une erreur car le statut doit être mis à jour
      return res.status(500).json({
        error: 'Erreur mise à jour devis',
        details: updateError.message,
        reservation_id: reservation.id // Renvoyer l'ID au cas où
      });
    }

    // Mettre à jour l'opportunité si liée
    if (devis.opportunite_id) {
      await supabase.from('opportunites').update({
        etape: 'gagne',
        probabilite: 100,
        date_cloture_reelle: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }).eq('id', devis.opportunite_id).eq('tenant_id', tenantId);
    }

    // Logger exécution
    await logDevisHistorique(
      id, tenantId, 'execute', 'accepte', 'execute',
      `Réservation créée pour le ${date_rdv} à ${heure_rdv}`,
      req.admin.email
    );

    console.log(`[DEVIS] Devis ${devis.numero} exécuté → Réservation ${reservation.id}`);
    res.json({
      success: true,
      message: `Réservation créée pour le ${date_rdv} à ${heure_rdv}`,
      reservation,
      membres_affectes: membresAssignes.length,
      services: devisLignes?.length || 0
    });
  } catch (error) {
    console.error('[DEVIS] Erreur exécution:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/devis/:id/rejeter
 * Rejeter le devis
 */
router.post('/:id/rejeter', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { raison } = req.body;

    // Récupérer le devis
    const { data: devis, error: fetchError } = await supabase
      .from('devis')
      .select('statut, numero, opportunite_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !devis) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    if (!['envoye', 'brouillon'].includes(devis.statut)) {
      return res.status(400).json({ error: 'Ce devis ne peut pas être rejeté' });
    }

    const ancienStatut = devis.statut;

    // Mettre à jour le devis
    const { error: updateError } = await supabase
      .from('devis')
      .update({
        statut: 'rejete',
        date_rejet: new Date().toISOString(),
        raison_rejet: raison || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Mettre à jour l'opportunité si liée
    if (devis.opportunite_id) {
      await supabase.from('opportunites').update({
        etape: 'perdu',
        probabilite: 0,
        motif_perte: raison || 'Devis rejeté',
        date_cloture_reelle: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }).eq('id', devis.opportunite_id).eq('tenant_id', tenantId);
    }

    // Logger rejet
    await logDevisHistorique(
      id, tenantId, 'rejete', ancienStatut, 'rejete',
      raison || 'Rejeté par le client', req.admin.email
    );

    console.log(`[DEVIS] Devis ${devis.numero} rejeté`);
    res.json({ success: true, message: 'Devis rejeté' });
  } catch (error) {
    console.error('[DEVIS] Erreur rejet:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/devis/:id/pdf
 * Générer le HTML du devis (pour aperçu/impression)
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer le devis
    const { data: devis, error } = await supabase
      .from('devis')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !devis) {
      return res.status(404).json({ error: 'Devis non trouvé' });
    }

    // Récupérer infos tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, email, telephone, adresse, siret, logo_url')
      .eq('id', tenantId)
      .single();

    // Générer HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Devis ${devis.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { max-height: 80px; }
    .company { text-align: right; }
    .title { font-size: 28px; color: #2563eb; margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .client-box, .devis-box { background: #f8fafc; padding: 20px; border-radius: 8px; width: 45%; }
    .label { font-weight: bold; color: #64748b; font-size: 12px; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .total-row { background: #f8fafc; font-weight: bold; }
    .total-ttc { font-size: 18px; color: #2563eb; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    .validity { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${tenant?.logo_url ? `<img src="${tenant.logo_url}" class="logo" />` : ''}
      <h2>${tenant?.business_name || 'Entreprise'}</h2>
    </div>
    <div class="company">
      <p>${tenant?.adresse || ''}</p>
      <p>${tenant?.telephone || ''}</p>
      <p>${tenant?.email || ''}</p>
      ${tenant?.siret ? `<p>SIRET: ${tenant.siret}</p>` : ''}
    </div>
  </div>

  <h1 class="title">DEVIS N° ${devis.numero}</h1>

  <div class="info-row">
    <div class="client-box">
      <div class="label">CLIENT</div>
      <p><strong>${devis.client_nom || 'Client'}</strong></p>
      <p>${devis.client_adresse || ''}</p>
      <p>${devis.client_telephone || ''}</p>
      <p>${devis.client_email || ''}</p>
    </div>
    <div class="devis-box">
      <div class="label">DEVIS</div>
      <p><strong>Date:</strong> ${new Date(devis.date_devis).toLocaleDateString('fr-FR')}</p>
      <p><strong>Validité:</strong> ${devis.validite_jours} jours</p>
      <p><strong>Expire le:</strong> ${new Date(devis.date_expiration).toLocaleDateString('fr-FR')}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="width: 100px; text-align: right;">Montant</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${devis.service_nom || 'Prestation'}</strong>
          ${devis.service_description ? `<br><small>${devis.service_description}</small>` : ''}
          ${devis.duree_minutes ? `<br><small>Durée: ${devis.duree_minutes} min</small>` : ''}
          ${devis.lieu ? `<br><small>Lieu: ${devis.lieu}</small>` : ''}
        </td>
        <td style="text-align: right;">${(devis.montant_ht / 100).toFixed(2)} €</td>
      </tr>
      ${devis.frais_deplacement > 0 ? `
      <tr>
        <td>Frais de déplacement</td>
        <td style="text-align: right;">${(devis.frais_deplacement / 100).toFixed(2)} €</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total HT</td>
        <td style="text-align: right;">${((devis.montant_ht + (devis.frais_deplacement || 0)) / 100).toFixed(2)} €</td>
      </tr>
      <tr class="total-row">
        <td>TVA (${devis.taux_tva}%)</td>
        <td style="text-align: right;">${(devis.montant_tva / 100).toFixed(2)} €</td>
      </tr>
      <tr class="total-row">
        <td class="total-ttc">TOTAL TTC</td>
        <td style="text-align: right;" class="total-ttc">${(devis.montant_ttc / 100).toFixed(2)} €</td>
      </tr>
    </tbody>
  </table>

  ${devis.notes ? `
  <div>
    <div class="label">NOTES</div>
    <p>${devis.notes}</p>
  </div>
  ` : ''}

  <div class="validity">
    <strong>Ce devis est valable ${devis.validite_jours} jours</strong> à compter de sa date d'émission.
    Pour accepter ce devis, merci de nous contacter.
  </div>

  <div class="footer">
    <p>${tenant?.business_name || ''} ${tenant?.siret ? `- SIRET: ${tenant.siret}` : ''}</p>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[DEVIS] Erreur génération PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
