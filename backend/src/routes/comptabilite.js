/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES COMPTABILITÉ - Transactions + Rapports P&L               ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   TRANSACTIONS                                                     ║
 * ║   POST /api/comptabilite/transactions     - Créer transaction      ║
 * ║   GET  /api/comptabilite/transactions     - Liste transactions     ║
 * ║   GET  /api/comptabilite/transactions/:id - Détail transaction     ║
 * ║   PATCH /api/comptabilite/transactions/:id - Modifier              ║
 * ║   DELETE /api/comptabilite/transactions/:id - Supprimer            ║
 * ║   CATÉGORIES                                                       ║
 * ║   GET  /api/comptabilite/categories       - Liste catégories       ║
 * ║   POST /api/comptabilite/categories       - Créer catégorie        ║
 * ║   RAPPORTS                                                         ║
 * ║   GET  /api/comptabilite/rapports/mensuel - Rapport mensuel P&L    ║
 * ║   GET  /api/comptabilite/rapports/annuel  - Rapport annuel         ║
 * ║   GET  /api/comptabilite/dashboard        - Dashboard comptable    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();

// Middleware auth admin
router.use(authenticateAdmin);

// Middleware verification plan (comptabilite = Pro+)
router.use(requireModule('comptabilite'));

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/comptabilite/transactions
 * Créer une transaction (revenu ou dépense)
 */
router.post('/transactions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      type,           // 'revenue' ou 'expense'
      amount,
      category_id,
      description,
      date,
      payment_method,
      reference,
      notes,
      invoice_id,
    } = req.body;

    // Validation
    if (!type || !amount || !description) {
      return res.status(400).json({
        success: false,
        error: 'Type, montant et description requis',
      });
    }

    if (!['revenue', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type invalide (revenue ou expense)',
      });
    }

    // Calculer TVA si non fournie
    const vatRate = req.body.vat_rate || 20;
    const vatAmount = (parseFloat(amount) * vatRate) / 100;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        tenant_id: tenantId,
        type,
        amount: parseFloat(amount),
        category_id: category_id || null,
        description,
        date: date || new Date().toISOString().split('T')[0],
        payment_method: payment_method || null,
        reference: reference || null,
        notes: notes || null,
        invoice_id: invoice_id || null,
        vat_rate: vatRate,
        vat_amount: vatAmount,
      })
      .select('*, accounting_categories(name, color)')
      .single();

    if (error) throw error;

    console.log(`[COMPTABILITE] Transaction créée: ${type} ${amount}€`);

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur création transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/comptabilite/transactions
 * Liste des transactions avec filtres
 */
router.get('/transactions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      type,
      category_id,
      date_debut,
      date_fin,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    let query = supabase
      .from('transactions')
      .select('*, accounting_categories(id, name, color)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false });

    if (type) query = query.eq('type', type);
    if (category_id) query = query.eq('category_id', category_id);
    if (date_debut) query = query.gte('date', date_debut);
    if (date_fin) query = query.lte('date', date_fin);
    if (search) query = query.ilike('description', `%${search}%`);

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: transactions, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      transactions: transactions || [],
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur liste transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/comptabilite/transactions/:id
 * Détail d'une transaction
 */
router.get('/transactions/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*, accounting_categories(id, name, color)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !transaction) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur détail transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/comptabilite/transactions/:id
 * Modifier une transaction
 */
router.patch('/transactions/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { type, amount, category_id, description, date, payment_method, reference, notes } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (type) updates.type = type;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (category_id !== undefined) updates.category_id = category_id;
    if (description !== undefined) updates.description = description;
    if (date) updates.date = date;
    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (reference !== undefined) updates.reference = reference;
    if (notes !== undefined) updates.notes = notes;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, accounting_categories(id, name, color)')
      .single();

    if (error) throw error;

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur modification transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/comptabilite/transactions/:id
 * Supprimer une transaction
 */
router.delete('/transactions/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Transaction supprimée' });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur suppression transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/comptabilite/categories
 * Liste des catégories comptables
 */
router.get('/categories', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { type } = req.query;

    let query = supabase
      .from('accounting_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (type) query = query.eq('type', type);

    const { data: categories, error } = await query;

    if (error) throw error;

    res.json({ success: true, categories: categories || [] });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur liste catégories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/comptabilite/categories
 * Créer une catégorie
 */
router.post('/categories', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { name, type, description, color } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Nom et type requis' });
    }

    if (!['revenue', 'expense'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type invalide' });
    }

    const { data: category, error } = await supabase
      .from('accounting_categories')
      .insert({
        tenant_id: tenantId,
        name,
        type,
        description: description || null,
        color: color || '#3B82F6',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, category });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur création catégorie:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// RAPPORTS P&L
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/comptabilite/rapports/mensuel
 * Rapport Profit & Loss mensuel
 */
router.get('/rapports/mensuel', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { annee, mois } = req.query;

    if (!annee || !mois) {
      return res.status(400).json({ success: false, error: 'Année et mois requis' });
    }

    const year = parseInt(annee);
    const month = parseInt(mois);

    const rapport = await genererRapportMensuel(tenantId, year, month);

    res.json({ success: true, rapport });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur rapport mensuel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/comptabilite/rapports/annuel
 * Rapport annuel avec évolution mensuelle
 */
router.get('/rapports/annuel', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { annee } = req.query;

    if (!annee) {
      return res.status(400).json({ success: false, error: 'Année requise' });
    }

    const year = parseInt(annee);

    // Générer rapport pour chaque mois
    const rapportsMois = [];
    for (let mois = 1; mois <= 12; mois++) {
      const rapport = await genererRapportMensuel(tenantId, year, mois);
      rapportsMois.push({ mois, ...rapport });
    }

    // Totaux annuels
    const totalAnnuel = {
      total_revenus: rapportsMois.reduce((sum, r) => sum + r.total_revenus, 0),
      total_depenses: rapportsMois.reduce((sum, r) => sum + r.total_depenses, 0),
    };
    totalAnnuel.benefice_net = totalAnnuel.total_revenus - totalAnnuel.total_depenses;
    totalAnnuel.marge = totalAnnuel.total_revenus > 0
      ? ((totalAnnuel.benefice_net / totalAnnuel.total_revenus) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      annee: year,
      rapports_mensuels: rapportsMois,
      total_annuel: totalAnnuel,
    });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur rapport annuel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/comptabilite/dashboard
 * Dashboard comptable avec KPIs
 */
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const aujourdhui = new Date();
    const moisActuel = aujourdhui.getMonth() + 1;
    const anneeActuelle = aujourdhui.getFullYear();

    // Rapport mois actuel
    const rapportActuel = await genererRapportMensuel(tenantId, anneeActuelle, moisActuel);

    // Rapport mois précédent
    const moisPrecedent = moisActuel === 1 ? 12 : moisActuel - 1;
    const anneePrecedente = moisActuel === 1 ? anneeActuelle - 1 : anneeActuelle;
    const rapportPrecedent = await genererRapportMensuel(tenantId, anneePrecedente, moisPrecedent);

    // Évolutions
    const evolution = {
      revenus: calculerEvolution(rapportPrecedent.total_revenus, rapportActuel.total_revenus),
      depenses: calculerEvolution(rapportPrecedent.total_depenses, rapportActuel.total_depenses),
      benefice: calculerEvolution(rapportPrecedent.benefice_net, rapportActuel.benefice_net),
    };

    // Dernières transactions
    const { data: dernieresTransactions } = await supabase
      .from('transactions')
      .select('*, accounting_categories(name, color)')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(10);

    // Top catégories revenus
    const { data: topRevenus } = await supabase
      .from('transactions')
      .select('category_id, accounting_categories(name)')
      .eq('tenant_id', tenantId)
      .eq('type', 'revenue')
      .gte('date', `${anneeActuelle}-${String(moisActuel).padStart(2, '0')}-01`);

    // Top catégories dépenses
    const { data: topDepenses } = await supabase
      .from('transactions')
      .select('category_id, accounting_categories(name)')
      .eq('tenant_id', tenantId)
      .eq('type', 'expense')
      .gte('date', `${anneeActuelle}-${String(moisActuel).padStart(2, '0')}-01`);

    res.json({
      success: true,
      mois_actuel: {
        annee: anneeActuelle,
        mois: moisActuel,
        ...rapportActuel,
      },
      mois_precedent: {
        annee: anneePrecedente,
        mois: moisPrecedent,
        ...rapportPrecedent,
      },
      evolution,
      dernieres_transactions: dernieresTransactions || [],
    });
  } catch (error) {
    console.error('[COMPTABILITE] Erreur dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

async function genererRapportMensuel(tenantId, annee, mois) {
  // Dates période
  const dateDebut = `${annee}-${String(mois).padStart(2, '0')}-01`;
  const dateFin = new Date(annee, mois, 0).toISOString().split('T')[0];

  // Récupérer transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, accounting_categories(name)')
    .eq('tenant_id', tenantId)
    .gte('date', dateDebut)
    .lte('date', dateFin);

  if (!transactions || transactions.length === 0) {
    return {
      total_revenus: 0,
      total_depenses: 0,
      benefice_net: 0,
      marge: 0,
      nb_transactions: 0,
      revenus_par_categorie: [],
      depenses_par_categorie: [],
    };
  }

  // Calculer totaux
  const revenus = transactions.filter(t => t.type === 'revenue');
  const depenses = transactions.filter(t => t.type === 'expense');

  const totalRevenus = revenus.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const totalDepenses = depenses.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const beneficeNet = totalRevenus - totalDepenses;
  const marge = totalRevenus > 0 ? ((beneficeNet / totalRevenus) * 100).toFixed(1) : 0;

  // Par catégorie
  const revenusParCategorie = {};
  revenus.forEach(t => {
    const catName = t.accounting_categories?.name || 'Sans catégorie';
    revenusParCategorie[catName] = (revenusParCategorie[catName] || 0) + parseFloat(t.amount);
  });

  const depensesParCategorie = {};
  depenses.forEach(t => {
    const catName = t.accounting_categories?.name || 'Sans catégorie';
    depensesParCategorie[catName] = (depensesParCategorie[catName] || 0) + parseFloat(t.amount);
  });

  return {
    total_revenus: totalRevenus,
    total_depenses: totalDepenses,
    benefice_net: beneficeNet,
    marge: parseFloat(marge),
    nb_transactions: transactions.length,
    revenus_par_categorie: Object.entries(revenusParCategorie).map(([nom, montant]) => ({ nom, montant })),
    depenses_par_categorie: Object.entries(depensesParCategorie).map(([nom, montant]) => ({ nom, montant })),
  };
}

function calculerEvolution(ancien, nouveau) {
  if (ancien === 0) return nouveau > 0 ? 100 : 0;
  return parseFloat((((nouveau - ancien) / Math.abs(ancien)) * 100).toFixed(1));
}

export default router;
