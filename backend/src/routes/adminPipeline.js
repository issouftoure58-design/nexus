/**
 * Routes API pour Commercial Pipeline
 * Plan PRO Feature
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { getDefaultLocation } from '../services/tenantBusinessService.js';

const router = express.Router();

// Probabilités par défaut selon étape
const PROBABILITIES = {
  prospect: 10,
  contact: 25,
  devis: 50,
  negociation: 75,
  gagne: 100,
  perdu: 0
};

// Couleurs par étape (pour le frontend)
const ETAPE_CONFIG = {
  prospect: { label: 'Prospect', color: 'gray', probability: 10 },
  contact: { label: 'Contact', color: 'blue', probability: 25 },
  devis: { label: 'Devis', color: 'yellow', probability: 50 },
  negociation: { label: 'Négociation', color: 'orange', probability: 75 },
  gagne: { label: 'Gagné', color: 'green', probability: 100 },
  perdu: { label: 'Perdu', color: 'red', probability: 0 }
};

// Middleware: Vérifier plan PRO
async function requireProPlan(req, res, next) {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, plan_id, tier')
      .eq('id', req.admin.tenant_id)
      .single();

    const plan = (tenant?.plan || tenant?.plan_id || tenant?.tier || 'starter').toLowerCase();

    if (plan === 'starter') {
      return res.status(403).json({
        error: 'Pipeline commercial réservé aux plans Pro et Business',
        required_plan: 'pro'
      });
    }

    next();
  } catch (error) {
    console.error('[PIPELINE] Erreur vérification plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// Appliquer middleware
router.use(authenticateAdmin, requireProPlan);

/**
 * GET /api/admin/pipeline
 * Liste opportunités avec stats par étape
 */
router.get('/', async (req, res) => {
  try {
    const tenant_id = req.admin.tenant_id;

    // Toutes les opportunités actives (pas gagnées ni perdues)
    const { data: opportunites, error } = await supabase
      .from('opportunites')
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .eq('tenant_id', tenant_id)
      .not('etape', 'in', '("gagne","perdu")')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Grouper par étape
    const pipeline = {
      prospect: [],
      contact: [],
      devis: [],
      negociation: []
    };

    (opportunites || []).forEach(opp => {
      if (pipeline[opp.etape]) {
        pipeline[opp.etape].push({
          ...opp,
          montant: parseFloat(opp.montant || 0)
        });
      }
    });

    // Calculer stats par étape
    const stats = {};
    let previsionTotale = 0;

    Object.keys(pipeline).forEach(etape => {
      const opps = pipeline[etape];
      const count = opps.length;
      const montantTotal = opps.reduce((sum, opp) => sum + opp.montant, 0);
      const montantPondere = opps.reduce((sum, opp) => {
        return sum + (opp.montant * (opp.probabilite / 100));
      }, 0);

      stats[etape] = {
        count,
        montantTotal: montantTotal.toFixed(2),
        montantPondere: montantPondere.toFixed(2),
        ...ETAPE_CONFIG[etape]
      };

      previsionTotale += montantPondere;
    });

    res.json({
      pipeline,
      stats,
      previsionCA: previsionTotale.toFixed(2),
      etapes: ETAPE_CONFIG
    });
  } catch (error) {
    console.error('[PIPELINE] Erreur get pipeline:', error);
    res.status(500).json({ error: 'Erreur récupération pipeline' });
  }
});

/**
 * GET /api/admin/pipeline/:id
 * Détail d'une opportunité avec lignes de services
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: opportunite, error } = await supabase
      .from('opportunites')
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !opportunite) {
      return res.status(404).json({ error: 'Opportunité introuvable' });
    }

    // Récupérer les lignes de services
    const { data: lignes } = await supabase
      .from('opportunite_lignes')
      .select('*')
      .eq('opportunite_id', req.params.id)
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true });

    // Récupérer historique des changements
    const { data: historique } = await supabase
      .from('opportunites_historique')
      .select('*')
      .eq('opportunite_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      opportunite: {
        ...opportunite,
        montant: parseFloat(opportunite.montant || 0),
        lignes: lignes || []
      },
      historique: historique || []
    });
  } catch (error) {
    console.error('[PIPELINE] Erreur get opportunité:', error);
    res.status(500).json({ error: 'Erreur récupération opportunité' });
  }
});

/**
 * POST /api/admin/pipeline
 * Créer opportunité (version enrichie)
 *
 * Body attendu:
 * - nom: string (requis)
 * - client_id?: number (client existant)
 * - nouveau_client?: { prenom, nom, telephone, email? } (nouveau client)
 * - services?: [{ service_id, quantite }] (services à ajouter)
 * - date_debut?: string (date de début prévue)
 * - lieu?: 'salon' | 'domicile'
 * - adresse_client?: string (si domicile)
 * - remise?: { type: 'pourcentage' | 'montant', valeur: number, motif?: string }
 * - description?, source?, priorite?, date_cloture_prevue?, notes?, tags?
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      nom,
      description,
      client_id,
      nouveau_client,
      services,
      date_debut,
      lieu,
      adresse_client,
      remise,
      etape,
      date_cloture_prevue,
      source,
      priorite,
      notes,
      tags
    } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    // 1. Gérer le client (existant ou nouveau)
    let finalClientId = client_id || null;

    if (!client_id && nouveau_client) {
      // Créer le nouveau client
      const { prenom, nom: clientNom, telephone, email } = nouveau_client;

      if (!prenom || !clientNom || !telephone) {
        return res.status(400).json({
          error: 'Nouveau client: prénom, nom et téléphone requis'
        });
      }

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          prenom,
          nom: clientNom,
          telephone,
          email: email || null,
          adresse: adresse_client || null
        })
        .select()
        .single();

      if (clientError) {
        console.error('[PIPELINE] Erreur création client:', clientError);
        throw clientError;
      }

      finalClientId = newClient.id;
      console.log(`[PIPELINE] Nouveau client créé: ${newClient.id} - ${prenom} ${clientNom}`);
    }

    // 2. Calculer les montants si services fournis
    let montantHT = 0;
    let dureeTotale = 0;
    let lignesServices = [];

    if (services && services.length > 0) {
      // Récupérer les détails des services
      const serviceIds = services.map(s => s.service_id);
      const { data: servicesData, error: servError } = await supabase
        .from('services')
        .select('id, nom, prix, duree')
        .in('id', serviceIds)
        .eq('tenant_id', tenantId);

      if (servError) throw servError;

      // Créer le mapping service_id -> service
      const servicesMap = {};
      (servicesData || []).forEach(s => {
        servicesMap[s.id] = s;
      });

      // Calculer pour chaque ligne
      for (const ligne of services) {
        const serviceInfo = servicesMap[ligne.service_id];
        if (!serviceInfo) continue;

        const quantite = ligne.quantite || 1;
        const prixUnitaire = serviceInfo.prix || 0; // En centimes
        const prixTotal = prixUnitaire * quantite;
        const dureeService = (serviceInfo.duree || 0) * quantite;

        montantHT += prixTotal;
        dureeTotale += dureeService;

        lignesServices.push({
          tenant_id: tenantId,
          service_id: ligne.service_id,
          service_nom: serviceInfo.nom,
          quantite,
          duree_minutes: dureeService,
          prix_unitaire: prixUnitaire,
          prix_total: prixTotal
        });
      }
    }

    // 3. Frais de déplacement si domicile
    let fraisDeplacement = 0;
    if (lieu === 'domicile') {
      // Récupérer les paramètres du tenant pour frais déplacement
      const { data: tenantConfig } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      fraisDeplacement = tenantConfig?.settings?.frais_deplacement || 2000; // 20€ par défaut
      montantHT += fraisDeplacement;
    }

    // 4. Appliquer remise
    let montantRemise = 0;
    let remiseType = null;
    let remiseValeur = 0;
    let remiseMotif = null;

    if (remise && remise.valeur > 0) {
      remiseType = remise.type;
      remiseValeur = remise.valeur;
      remiseMotif = remise.motif || null;

      if (remise.type === 'pourcentage') {
        montantRemise = Math.round(montantHT * remise.valeur / 100);
      } else {
        montantRemise = remise.valeur; // Montant en centimes
      }

      montantHT -= montantRemise;
    }

    // 5. Calculer TVA et TTC
    const tauxTVA = 20;
    const montantTVA = Math.round(montantHT * tauxTVA / 100);
    const montantTTC = montantHT + montantTVA;

    // 6. Créer l'opportunité
    const etapeInitiale = etape || 'prospect';
    const probabilite = PROBABILITIES[etapeInitiale] || 10;

    // Montant pour rétrocompatibilité (en euros, pas centimes)
    const montantEuros = montantTTC / 100;

    const { data: opportunite, error } = await supabase
      .from('opportunites')
      .insert({
        tenant_id: tenantId,
        nom,
        description,
        client_id: finalClientId,
        montant: montantEuros,
        montant_ht: montantHT,
        montant_tva: montantTVA,
        montant_ttc: montantTTC,
        montant_remise: montantRemise,
        frais_deplacement: fraisDeplacement,
        remise_type: remiseType,
        remise_valeur: remiseValeur,
        remise_motif: remiseMotif,
        date_debut,
        duree_totale_minutes: dureeTotale,
        lieu: lieu || getDefaultLocation(tenantId),
        adresse_client: lieu === 'domicile' ? adresse_client : null,
        etape: etapeInitiale,
        probabilite,
        date_cloture_prevue,
        source,
        priorite: priorite || 'normale',
        notes,
        tags: tags || [],
        created_by: req.admin.id
      })
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .single();

    if (error) throw error;

    // 7. Créer les lignes de services
    if (lignesServices.length > 0) {
      const lignesAvecOppId = lignesServices.map(l => ({
        ...l,
        opportunite_id: opportunite.id
      }));

      const { error: lignesError } = await supabase
        .from('opportunite_lignes')
        .insert(lignesAvecOppId);

      if (lignesError) {
        console.error('[PIPELINE] Erreur création lignes:', lignesError);
      }
    }

    // 8. Logger dans historique
    await supabase.from('opportunites_historique').insert({
      opportunite_id: opportunite.id,
      tenant_id: tenantId,
      etape_precedente: null,
      etape_nouvelle: etapeInitiale,
      changed_by: req.admin.id,
      notes: `Création de l'opportunité${lignesServices.length > 0 ? ` avec ${lignesServices.length} service(s)` : ''}`
    });

    console.log(`[PIPELINE] Nouvelle opportunité créée: ${opportunite.id} - ${nom} (${montantTTC / 100}€)`);
    res.status(201).json({
      ...opportunite,
      lignes: lignesServices
    });
  } catch (error) {
    console.error('[PIPELINE] Erreur création opportunité:', error);
    res.status(500).json({ error: 'Erreur création opportunité: ' + error.message });
  }
});

/**
 * PATCH /api/admin/pipeline/:id/etape
 * Déplacer opportunité d'étape (drag & drop)
 */
router.patch('/:id/etape', async (req, res) => {
  try {
    const { etape, notes } = req.body;
    const opportuniteId = req.params.id;

    if (!etape || !PROBABILITIES.hasOwnProperty(etape)) {
      return res.status(400).json({
        error: 'Étape invalide',
        etapes_valides: Object.keys(PROBABILITIES)
      });
    }

    // Récupérer l'opportunité actuelle
    const { data: current } = await supabase
      .from('opportunites')
      .select('etape')
      .eq('id', opportuniteId)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!current) {
      return res.status(404).json({ error: 'Opportunité introuvable' });
    }

    const probabilite = PROBABILITIES[etape];
    const updates = {
      etape,
      probabilite,
      updated_at: new Date().toISOString()
    };

    // Si gagné ou perdu, ajouter date de clôture réelle
    if (etape === 'gagne' || etape === 'perdu') {
      updates.date_cloture_reelle = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('opportunites')
      .update(updates)
      .eq('id', opportuniteId)
      .eq('tenant_id', req.admin.tenant_id)
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .single();

    if (error) throw error;

    // Logger dans historique
    await supabase.from('opportunites_historique').insert({
      opportunite_id: opportuniteId,
      tenant_id: req.admin.tenant_id,
      etape_precedente: current.etape,
      etape_nouvelle: etape,
      changed_by: req.admin.id,
      notes: notes || `Déplacement vers ${ETAPE_CONFIG[etape].label}`
    });

    console.log(`[PIPELINE] Opportunité ${opportuniteId}: ${current.etape} → ${etape}`);
    res.json(data);
  } catch (error) {
    console.error('[PIPELINE] Erreur déplacement opportunité:', error);
    res.status(500).json({ error: 'Erreur déplacement opportunité' });
  }
});

/**
 * PUT /api/admin/pipeline/:id
 * Mettre à jour opportunité
 */
router.put('/:id', async (req, res) => {
  try {
    const {
      nom,
      description,
      client_id,
      montant,
      date_cloture_prevue,
      motif_perte,
      source,
      priorite,
      notes,
      tags
    } = req.body;

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (client_id !== undefined) updates.client_id = client_id;
    if (montant !== undefined) updates.montant = montant;
    if (date_cloture_prevue !== undefined) updates.date_cloture_prevue = date_cloture_prevue;
    if (motif_perte !== undefined) updates.motif_perte = motif_perte;
    if (source !== undefined) updates.source = source;
    if (priorite !== undefined) updates.priorite = priorite;
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;

    const { data, error } = await supabase
      .from('opportunites')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('[PIPELINE] Erreur update opportunité:', error);
    res.status(500).json({ error: 'Erreur mise à jour opportunité' });
  }
});

/**
 * DELETE /api/admin/pipeline/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('opportunites')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    console.log(`[PIPELINE] Opportunité ${req.params.id} supprimée`);
    res.json({ success: true });
  } catch (error) {
    console.error('[PIPELINE] Erreur delete opportunité:', error);
    res.status(500).json({ error: 'Erreur suppression opportunité' });
  }
});

/**
 * GET /api/admin/pipeline/historique
 * Opportunités gagnées et perdues
 */
router.get('/stats/historique', async (req, res) => {
  try {
    const { periode = '30' } = req.query;
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - parseInt(periode));

    const { data, error } = await supabase
      .from('opportunites')
      .select(`
        *,
        clients (id, prenom, nom)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .in('etape', ['gagne', 'perdu'])
      .gte('date_cloture_reelle', dateDebut.toISOString())
      .order('date_cloture_reelle', { ascending: false });

    if (error) throw error;

    const gagnees = (data || []).filter(o => o.etape === 'gagne');
    const perdues = (data || []).filter(o => o.etape === 'perdu');

    const nbTotal = gagnees.length + perdues.length;
    const caGagne = gagnees.reduce((sum, o) => sum + parseFloat(o.montant || 0), 0);
    const caPerdu = perdues.reduce((sum, o) => sum + parseFloat(o.montant || 0), 0);

    res.json({
      gagnees,
      perdues,
      stats: {
        nbGagnees: gagnees.length,
        nbPerdues: perdues.length,
        tauxConversion: nbTotal > 0 ? ((gagnees.length / nbTotal) * 100).toFixed(1) : 0,
        caGagne: caGagne.toFixed(2),
        caPerdu: caPerdu.toFixed(2)
      }
    });
  } catch (error) {
    console.error('[PIPELINE] Erreur get historique:', error);
    res.status(500).json({ error: 'Erreur récupération historique' });
  }
});

/**
 * GET /api/admin/pipeline/stats/summary
 * Statistiques globales du pipeline
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const tenant_id = req.admin.tenant_id;

    // Opportunités actives
    const { data: actives, error: errActives } = await supabase
      .from('opportunites')
      .select('montant, probabilite, etape')
      .eq('tenant_id', tenant_id)
      .not('etape', 'in', '("gagne","perdu")');

    if (errActives) throw errActives;

    // Opportunités gagnées ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: gagnesMois, error: errGagnes } = await supabase
      .from('opportunites')
      .select('montant')
      .eq('tenant_id', tenant_id)
      .eq('etape', 'gagne')
      .gte('date_cloture_reelle', startOfMonth.toISOString());

    if (errGagnes) throw errGagnes;

    const nbActives = actives?.length || 0;
    const montantTotal = (actives || []).reduce((sum, o) => sum + parseFloat(o.montant || 0), 0);
    const montantPondere = (actives || []).reduce((sum, o) => {
      return sum + (parseFloat(o.montant || 0) * (o.probabilite / 100));
    }, 0);
    const caGagneMois = (gagnesMois || []).reduce((sum, o) => sum + parseFloat(o.montant || 0), 0);

    res.json({
      nb_actives: nbActives,
      montant_total: montantTotal.toFixed(2),
      prevision_ca: montantPondere.toFixed(2),
      ca_gagne_mois: caGagneMois.toFixed(2),
      nb_gagne_mois: gagnesMois?.length || 0
    });
  } catch (error) {
    console.error('[PIPELINE] Erreur stats summary:', error);
    res.status(500).json({ error: 'Erreur récupération stats' });
  }
});

// ============================================
// INTÉGRATION DEVIS
// ============================================

/**
 * POST /api/admin/pipeline/:id/devis
 * Créer un devis depuis une opportunité
 */
router.post('/:id/devis', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer l'opportunité avec le client
    const { data: opp, error: oppError } = await supabase
      .from('opportunites')
      .select('*, clients(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (oppError || !opp) {
      return res.status(404).json({ error: 'Opportunité non trouvée' });
    }

    // Vérifier si un devis existe déjà pour cette opportunité
    const { data: existingDevis } = await supabase
      .from('devis')
      .select('id, numero')
      .eq('opportunite_id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (existingDevis) {
      return res.status(400).json({
        error: 'Un devis existe déjà pour cette opportunité',
        devis_id: existingDevis.id,
        devis_numero: existingDevis.numero
      });
    }

    // Générer numéro de devis
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('devis')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', `${year}-01-01`);

    const prefix = tenantId.slice(0, 3).toUpperCase();
    const numero = `${prefix}-${year}-${String((count || 0) + 1).padStart(5, '0')}`;

    // Calculer montants
    const montantTTC = Math.round((opp.montant || 0) * 100); // En centimes
    const montantHT = Math.round(montantTTC / 1.2);
    const montantTVA = montantTTC - montantHT;

    // Créer le devis pré-rempli
    const devisData = {
      tenant_id: tenantId,
      numero,
      opportunite_id: opp.id,
      client_id: opp.client_id,
      client_nom: opp.clients?.nom ? `${opp.clients.prenom || ''} ${opp.clients.nom}`.trim() : opp.nom,
      client_email: opp.clients?.email,
      client_telephone: opp.clients?.telephone,
      client_adresse: opp.clients?.adresse,
      montant_ht: montantHT,
      taux_tva: 20,
      montant_tva: montantTVA,
      montant_ttc: montantTTC,
      statut: 'brouillon',
      date_devis: new Date().toISOString().split('T')[0],
      validite_jours: 30,
      date_expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: opp.notes || null,
      created_by: req.admin.email
    };

    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .insert(devisData)
      .select()
      .single();

    if (devisError) throw devisError;

    // Mettre à jour l'opportunité vers l'étape "devis"
    await supabase.from('opportunites').update({
      etape: 'devis',
      probabilite: PROBABILITIES.devis,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('tenant_id', tenantId);

    // Ajouter à l'historique de l'opportunité
    await supabase.from('opportunites_historique').insert({
      opportunite_id: id,
      tenant_id: tenantId,
      etape_precedente: opp.etape,
      etape_nouvelle: 'devis',
      notes: `Devis ${numero} créé`,
      changed_by: req.admin.email
    });

    console.log(`[PIPELINE] Devis ${numero} créé pour opportunité ${id}`);
    res.json({ success: true, devis });
  } catch (error) {
    console.error('[PIPELINE] Erreur création devis:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
