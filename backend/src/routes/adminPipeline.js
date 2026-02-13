/**
 * Routes API pour Commercial Pipeline
 * Plan PRO Feature
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

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
      .select('subscription_plan')
      .eq('id', req.admin.tenant_id)
      .single();

    const plan = tenant?.subscription_plan?.toLowerCase() || 'starter';

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
 * Détail d'une opportunité
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: opportunite, error } = await supabase
      .from('opportunites')
      .select(`
        *,
        clients (id, prenom, nom, email, telephone)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error || !opportunite) {
      return res.status(404).json({ error: 'Opportunité introuvable' });
    }

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
        montant: parseFloat(opportunite.montant || 0)
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
 * Créer opportunité
 */
router.post('/', async (req, res) => {
  try {
    const {
      nom,
      description,
      client_id,
      montant,
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

    const etapeInitiale = etape || 'prospect';
    const probabilite = PROBABILITIES[etapeInitiale] || 10;

    const { data, error } = await supabase
      .from('opportunites')
      .insert({
        tenant_id: req.admin.tenant_id,
        nom,
        description,
        client_id: client_id || null,
        montant: montant || 0,
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

    // Logger dans historique
    await supabase.from('opportunites_historique').insert({
      opportunite_id: data.id,
      tenant_id: req.admin.tenant_id,
      etape_precedente: null,
      etape_nouvelle: etapeInitiale,
      changed_by: req.admin.id,
      notes: 'Création de l\'opportunité'
    });

    console.log(`[PIPELINE] Nouvelle opportunité créée: ${data.id} - ${nom}`);
    res.status(201).json(data);
  } catch (error) {
    console.error('[PIPELINE] Erreur création opportunité:', error);
    res.status(500).json({ error: 'Erreur création opportunité' });
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

export default router;
