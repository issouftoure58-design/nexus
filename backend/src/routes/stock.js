/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES STOCK - Gestion des produits, mouvements et inventaires  ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   PRODUITS                                                         ║
 * ║   POST /api/stock/produits           - Créer produit               ║
 * ║   GET  /api/stock/produits           - Liste produits              ║
 * ║   GET  /api/stock/produits/:id       - Détail produit              ║
 * ║   PATCH /api/stock/produits/:id      - Modifier produit            ║
 * ║   DELETE /api/stock/produits/:id     - Supprimer produit           ║
 * ║   MOUVEMENTS                                                       ║
 * ║   POST /api/stock/mouvements         - Créer mouvement             ║
 * ║   GET  /api/stock/mouvements         - Historique mouvements       ║
 * ║   INVENTAIRES                                                      ║
 * ║   POST /api/stock/inventaires        - Créer inventaire            ║
 * ║   GET  /api/stock/inventaires        - Liste inventaires           ║
 * ║   PATCH /api/stock/inventaires/:id   - MAJ comptage                ║
 * ║   POST /api/stock/inventaires/:id/valider - Valider inventaire     ║
 * ║   ANALYTICS                                                        ║
 * ║   GET  /api/stock/dashboard          - Dashboard stock             ║
 * ║   GET  /api/stock/valorisation       - Valorisation stock          ║
 * ║   GET  /api/stock/alertes            - Liste alertes               ║
 * ║   POST /api/stock/alertes/:id/resoudre - Résoudre alerte           ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();

// Middleware auth admin
router.use(authenticateAdmin);

// Middleware verification plan (stock = Pro+)
router.use(requireModule('stock'));

// Catégories de produits
const CATEGORIES = [
  'fournitures',     // Salon: produits pro
  'produits_vente',  // Produits à vendre
  'ingredients',     // Restaurant
  'emballages',      // Emballages
  'materiaux',       // Services/artisans
  'autre'
];

const TYPES_MOUVEMENT = ['entree', 'sortie', 'ajustement', 'perte', 'transfert'];
const UNITES = ['piece', 'litre', 'kg', 'boite', 'carton', 'sachet', 'tube', 'flacon'];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Crée une alerte stock si nécessaire
 */
async function creerAlerte(tenantId, produitId, typeAlerte) {
  try {
    // Vérifier si alerte similaire existe déjà (non résolue)
    const { data: existing } = await supabase
      .from('alertes_stock')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('produit_id', produitId)
      .eq('type_alerte', typeAlerte)
      .eq('resolue', false)
      .maybeSingle();

    if (existing) return; // Alerte existe déjà

    // Récupérer produit
    const { data: produit } = await supabase
      .from('produits')
      .select('*')
      .eq('id', produitId)
      .single();

    if (!produit) return;

    let message = '';
    let niveau = 'info';

    if (typeAlerte === 'stock_bas') {
      message = `Stock bas: ${produit.nom} (${produit.stock_actuel}/${produit.stock_minimum} ${produit.unite})`;
      niveau = 'warning';
    } else if (typeAlerte === 'stock_zero') {
      message = `Stock épuisé: ${produit.nom}`;
      niveau = 'urgent';
    } else if (typeAlerte === 'peremption_proche') {
      message = `Péremption proche: ${produit.nom}`;
      niveau = 'warning';
    }

    await supabase
      .from('alertes_stock')
      .insert({
        tenant_id: tenantId,
        produit_id: produitId,
        type_alerte: typeAlerte,
        niveau,
        message,
      });

    console.log(`[STOCK] Alerte créée: ${message}`);
  } catch (error) {
    console.error('[STOCK] Erreur création alerte:', error);
  }
}

/**
 * Résout automatiquement les alertes si le stock est OK
 */
async function verifierEtResoudreAlertes(tenantId, produitId, stockActuel, stockMinimum) {
  try {
    if (stockActuel > stockMinimum) {
      // Stock OK, résoudre les alertes stock_bas
      await supabase
        .from('alertes_stock')
        .update({
          resolue: true,
          date_resolution: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('produit_id', produitId)
        .eq('type_alerte', 'stock_bas')
        .eq('resolue', false);
    }

    if (stockActuel > 0) {
      // Stock non nul, résoudre les alertes stock_zero
      await supabase
        .from('alertes_stock')
        .update({
          resolue: true,
          date_resolution: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('produit_id', produitId)
        .eq('type_alerte', 'stock_zero')
        .eq('resolue', false);
    }
  } catch (error) {
    console.error('[STOCK] Erreur résolution alertes:', error);
  }
}

// ═══════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/stock/produits
 * Créer un produit
 */
router.post('/produits', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      reference,
      nom,
      description,
      categorie,
      stock_actuel,
      stock_minimum,
      stock_optimal,
      unite,
      prix_achat_unitaire,
      prix_vente_unitaire,
      fournisseur,
      emplacement,
      notes,
    } = req.body;

    // Validation
    if (!reference || !nom || !categorie) {
      return res.status(400).json({
        success: false,
        error: 'Référence, nom et catégorie requis',
      });
    }

    if (!CATEGORIES.includes(categorie)) {
      return res.status(400).json({
        success: false,
        error: `Catégorie invalide. Valeurs: ${CATEGORIES.join(', ')}`,
      });
    }

    const { data: produit, error } = await supabase
      .from('produits')
      .insert({
        tenant_id: tenantId,
        reference: reference.toUpperCase(),
        nom,
        description: description || null,
        categorie,
        stock_actuel: parseInt(stock_actuel) || 0,
        stock_minimum: parseInt(stock_minimum) || 0,
        stock_optimal: parseInt(stock_optimal) || 0,
        unite: unite || 'piece',
        prix_achat_unitaire: Math.round(parseFloat(prix_achat_unitaire || 0) * 100), // Centimes
        prix_vente_unitaire: Math.round(parseFloat(prix_vente_unitaire || 0) * 100), // Centimes
        fournisseur: fournisseur || null,
        emplacement: emplacement || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Référence déjà utilisée' });
      }
      throw error;
    }

    // Créer alerte si stock initial bas ou nul
    if (produit.stock_actuel === 0) {
      await creerAlerte(tenantId, produit.id, 'stock_zero');
    } else if (produit.stock_actuel <= produit.stock_minimum) {
      await creerAlerte(tenantId, produit.id, 'stock_bas');
    }

    console.log(`[STOCK] Produit créé: ${produit.reference} - ${produit.nom}`);

    res.status(201).json({
      success: true,
      produit: {
        ...produit,
        prix_achat_unitaire_euros: (produit.prix_achat_unitaire / 100).toFixed(2),
        prix_vente_unitaire_euros: (produit.prix_vente_unitaire / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('[STOCK] Erreur création produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/produits
 * Liste des produits avec filtres
 */
router.get('/produits', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { categorie, stock_bas, actif, search, limit = 100 } = req.query;

    let query = supabase
      .from('produits')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nom', { ascending: true })
      .limit(parseInt(limit));

    if (categorie) query = query.eq('categorie', categorie);
    if (actif !== undefined) query = query.eq('actif', actif === 'true');
    if (search) query = query.or(`nom.ilike.%${search}%,reference.ilike.%${search}%`);

    const { data: produits, error } = await query;

    if (error) throw error;

    // Filtrer stock bas côté application (Supabase ne supporte pas les comparaisons entre colonnes simplement)
    let produitsFiltered = produits || [];
    if (stock_bas === 'true') {
      produitsFiltered = produitsFiltered.filter(p => p.stock_actuel <= p.stock_minimum);
    }

    // Formater les prix en euros
    const produitsFormatted = produitsFiltered.map(p => ({
      ...p,
      prix_achat_unitaire_euros: (p.prix_achat_unitaire / 100).toFixed(2),
      prix_vente_unitaire_euros: (p.prix_vente_unitaire / 100).toFixed(2),
      valeur_stock: ((p.stock_actuel * p.prix_achat_unitaire) / 100).toFixed(2),
      stock_bas: p.stock_actuel <= p.stock_minimum,
      stock_zero: p.stock_actuel === 0,
    }));

    res.json({
      success: true,
      produits: produitsFormatted,
      count: produitsFormatted.length,
    });
  } catch (error) {
    console.error('[STOCK] Erreur liste produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/produits/:id
 * Détail d'un produit avec historique mouvements
 */
router.get('/produits/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: produit, error } = await supabase
      .from('produits')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !produit) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }

    // Récupérer derniers mouvements
    const { data: mouvements } = await supabase
      .from('mouvements_stock')
      .select('*')
      .eq('produit_id', id)
      .order('date_mouvement', { ascending: false })
      .limit(20);

    res.json({
      success: true,
      produit: {
        ...produit,
        prix_achat_unitaire_euros: (produit.prix_achat_unitaire / 100).toFixed(2),
        prix_vente_unitaire_euros: (produit.prix_vente_unitaire / 100).toFixed(2),
      },
      mouvements: mouvements || [],
    });
  } catch (error) {
    console.error('[STOCK] Erreur détail produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/stock/produits/:id
 * Modifier un produit
 */
router.patch('/produits/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const updates = { ...req.body };

    // Nettoyer les champs non modifiables
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    // Convertir les prix en centimes si fournis
    if (updates.prix_achat_unitaire !== undefined) {
      updates.prix_achat_unitaire = Math.round(parseFloat(updates.prix_achat_unitaire) * 100);
    }
    if (updates.prix_vente_unitaire !== undefined) {
      updates.prix_vente_unitaire = Math.round(parseFloat(updates.prix_vente_unitaire) * 100);
    }

    updates.updated_at = new Date().toISOString();

    const { data: produit, error } = await supabase
      .from('produits')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      produit: {
        ...produit,
        prix_achat_unitaire_euros: (produit.prix_achat_unitaire / 100).toFixed(2),
        prix_vente_unitaire_euros: (produit.prix_vente_unitaire / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('[STOCK] Erreur modification produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/stock/produits/:id
 * Supprimer un produit (soft delete via actif=false)
 */
router.delete('/produits/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Soft delete
    const { error } = await supabase
      .from('produits')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Produit désactivé' });
  } catch (error) {
    console.error('[STOCK] Erreur suppression produit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// MOUVEMENTS STOCK
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/stock/mouvements
 * Créer un mouvement (entrée/sortie/ajustement)
 */
router.post('/mouvements', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      produit_id,
      type,
      quantite,
      prix_unitaire,
      reference_document,
      motif,
      notes,
    } = req.body;

    // Validation
    if (!produit_id || !type || quantite === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Produit, type et quantité requis',
      });
    }

    if (!TYPES_MOUVEMENT.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type invalide. Valeurs: ${TYPES_MOUVEMENT.join(', ')}`,
      });
    }

    // Récupérer produit
    const { data: produit, error: errProduit } = await supabase
      .from('produits')
      .select('*')
      .eq('id', produit_id)
      .eq('tenant_id', tenantId)
      .single();

    if (errProduit || !produit) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }

    const stockAvant = produit.stock_actuel;
    let quantiteSignee = parseInt(quantite);

    // Quantité signée selon type
    if (type === 'sortie' || type === 'perte') {
      quantiteSignee = -Math.abs(quantiteSignee);
    } else if (type === 'entree') {
      quantiteSignee = Math.abs(quantiteSignee);
    }
    // ajustement et transfert peuvent être positifs ou négatifs

    const stockApres = stockAvant + quantiteSignee;

    // Vérifier stock négatif
    if (stockApres < 0) {
      return res.status(400).json({
        success: false,
        error: `Stock insuffisant (actuel: ${stockAvant}, demandé: ${Math.abs(quantiteSignee)})`,
      });
    }

    // Créer mouvement
    const { data: mouvement, error: errMouvement } = await supabase
      .from('mouvements_stock')
      .insert({
        tenant_id: tenantId,
        produit_id,
        type,
        quantite: quantiteSignee,
        stock_avant: stockAvant,
        stock_apres: stockApres,
        prix_unitaire: prix_unitaire ? Math.round(parseFloat(prix_unitaire) * 100) : produit.prix_achat_unitaire,
        reference_document: reference_document || null,
        motif: motif || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (errMouvement) throw errMouvement;

    // Mettre à jour stock produit
    const { error: errUpdate } = await supabase
      .from('produits')
      .update({
        stock_actuel: stockApres,
        updated_at: new Date().toISOString(),
      })
      .eq('id', produit_id);

    if (errUpdate) throw errUpdate;

    // Vérifier alertes
    if (stockApres === 0) {
      await creerAlerte(tenantId, produit_id, 'stock_zero');
    } else if (stockApres <= produit.stock_minimum) {
      await creerAlerte(tenantId, produit_id, 'stock_bas');
    } else {
      // Résoudre alertes si stock OK
      await verifierEtResoudreAlertes(tenantId, produit_id, stockApres, produit.stock_minimum);
    }

    console.log(`[STOCK] Mouvement: ${produit.nom} ${type} ${quantiteSignee} (${stockAvant} → ${stockApres})`);

    res.status(201).json({
      success: true,
      mouvement,
      stock_avant: stockAvant,
      stock_apres: stockApres,
      produit_nom: produit.nom,
    });
  } catch (error) {
    console.error('[STOCK] Erreur création mouvement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/mouvements
 * Historique des mouvements
 */
router.get('/mouvements', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { produit_id, type, date_debut, date_fin, limit = 100 } = req.query;

    let query = supabase
      .from('mouvements_stock')
      .select('*, produits(nom, reference)')
      .eq('tenant_id', tenantId)
      .order('date_mouvement', { ascending: false })
      .limit(parseInt(limit));

    if (produit_id) query = query.eq('produit_id', produit_id);
    if (type) query = query.eq('type', type);
    if (date_debut) query = query.gte('date_mouvement', date_debut);
    if (date_fin) query = query.lte('date_mouvement', date_fin);

    const { data: mouvements, error } = await query;

    if (error) throw error;

    // Formater prix
    const mouvementsFormatted = (mouvements || []).map(m => ({
      ...m,
      prix_unitaire_euros: m.prix_unitaire ? (m.prix_unitaire / 100).toFixed(2) : null,
      valeur_mouvement_euros: m.prix_unitaire ? ((m.quantite * m.prix_unitaire) / 100).toFixed(2) : null,
    }));

    res.json({
      success: true,
      mouvements: mouvementsFormatted,
    });
  } catch (error) {
    console.error('[STOCK] Erreur historique mouvements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// INVENTAIRES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/stock/inventaires
 * Créer un inventaire
 */
router.post('/inventaires', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { nom, date_inventaire } = req.body;

    if (!nom || !date_inventaire) {
      return res.status(400).json({ success: false, error: 'Nom et date requis' });
    }

    // Récupérer tous les produits actifs
    const { data: produits } = await supabase
      .from('produits')
      .select('id, nom, reference, stock_actuel, prix_achat_unitaire')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('nom', { ascending: true });

    // Créer lignes inventaire avec stock théorique
    const lignes = (produits || []).map(p => ({
      produit_id: p.id,
      produit_nom: p.nom,
      produit_reference: p.reference,
      stock_theorique: p.stock_actuel,
      stock_reel: null, // À remplir lors du comptage
      ecart: null,
      valeur_ecart: null,
      prix_unitaire: p.prix_achat_unitaire,
    }));

    const { data: inventaire, error } = await supabase
      .from('inventaires')
      .insert({
        tenant_id: tenantId,
        nom,
        date_inventaire,
        lignes,
        nb_produits: lignes.length,
        statut: 'en_cours',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[STOCK] Inventaire créé: ${nom} (${lignes.length} produits)`);

    res.status(201).json({
      success: true,
      inventaire,
    });
  } catch (error) {
    console.error('[STOCK] Erreur création inventaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/inventaires
 * Liste des inventaires
 */
router.get('/inventaires', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut } = req.query;

    let query = supabase
      .from('inventaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_inventaire', { ascending: false });

    if (statut) query = query.eq('statut', statut);

    const { data: inventaires, error } = await query;

    if (error) throw error;

    // Formater valeurs
    const inventairesFormatted = (inventaires || []).map(inv => ({
      ...inv,
      valeur_ecarts_total_euros: (inv.valeur_ecarts_total / 100).toFixed(2),
    }));

    res.json({
      success: true,
      inventaires: inventairesFormatted,
    });
  } catch (error) {
    console.error('[STOCK] Erreur liste inventaires:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/inventaires/:id
 * Détail d'un inventaire
 */
router.get('/inventaires/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: inventaire, error } = await supabase
      .from('inventaires')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !inventaire) {
      return res.status(404).json({ success: false, error: 'Inventaire non trouvé' });
    }

    res.json({
      success: true,
      inventaire: {
        ...inventaire,
        valeur_ecarts_total_euros: (inventaire.valeur_ecarts_total / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('[STOCK] Erreur détail inventaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/stock/inventaires/:id
 * Mettre à jour le comptage d'un inventaire
 */
router.patch('/inventaires/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { lignes } = req.body;

    if (!lignes) {
      return res.status(400).json({ success: false, error: 'Lignes requises' });
    }

    // Vérifier que l'inventaire est en cours
    const { data: existant } = await supabase
      .from('inventaires')
      .select('statut')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existant || existant.statut !== 'en_cours') {
      return res.status(400).json({ success: false, error: 'Inventaire non modifiable' });
    }

    // Calculer écarts et valeurs
    const lignesMaj = lignes.map(ligne => {
      if (ligne.stock_reel === null || ligne.stock_reel === undefined) {
        return ligne;
      }

      const ecart = ligne.stock_reel - ligne.stock_theorique;
      const valeurEcart = ecart * (ligne.prix_unitaire || 0);

      return {
        ...ligne,
        ecart,
        valeur_ecart: valeurEcart,
      };
    });

    // Stats globales
    const lignesComptees = lignesMaj.filter(l => l.stock_reel !== null);
    const ecartsTotal = lignesComptees.reduce((sum, l) => sum + (l.ecart || 0), 0);
    const valeurEcartsTotal = lignesComptees.reduce((sum, l) => sum + (l.valeur_ecart || 0), 0);

    const { data: inventaire, error } = await supabase
      .from('inventaires')
      .update({
        lignes: lignesMaj,
        ecarts_total: ecartsTotal,
        valeur_ecarts_total: valeurEcartsTotal,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      inventaire: {
        ...inventaire,
        valeur_ecarts_total_euros: (inventaire.valeur_ecarts_total / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('[STOCK] Erreur MAJ inventaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stock/inventaires/:id/valider
 * Valider un inventaire et appliquer les ajustements
 */
router.post('/inventaires/:id/valider', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer inventaire
    const { data: inventaire, error: errFetch } = await supabase
      .from('inventaires')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (errFetch || !inventaire) {
      return res.status(404).json({ success: false, error: 'Inventaire non trouvé' });
    }

    if (inventaire.statut !== 'en_cours') {
      return res.status(400).json({ success: false, error: 'Inventaire déjà validé ou annulé' });
    }

    // Vérifier que tout est compté
    const lignesNonComptees = inventaire.lignes.filter(l => l.stock_reel === null);
    if (lignesNonComptees.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${lignesNonComptees.length} produit(s) non compté(s)`,
      });
    }

    // Appliquer ajustements
    let ajustementsAppliques = 0;
    for (const ligne of inventaire.lignes) {
      if (ligne.ecart !== 0) {
        // Créer mouvement ajustement
        await supabase
          .from('mouvements_stock')
          .insert({
            tenant_id: tenantId,
            produit_id: ligne.produit_id,
            type: 'ajustement',
            quantite: ligne.ecart,
            stock_avant: ligne.stock_theorique,
            stock_apres: ligne.stock_reel,
            prix_unitaire: ligne.prix_unitaire,
            motif: `Inventaire: ${inventaire.nom}`,
            reference_document: `INV-${inventaire.id.substring(0, 8)}`,
          });

        // Mettre à jour stock produit
        await supabase
          .from('produits')
          .update({
            stock_actuel: ligne.stock_reel,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ligne.produit_id);

        // Vérifier alertes
        const { data: produit } = await supabase
          .from('produits')
          .select('stock_minimum')
          .eq('id', ligne.produit_id)
          .single();

        if (ligne.stock_reel === 0) {
          await creerAlerte(tenantId, ligne.produit_id, 'stock_zero');
        } else if (ligne.stock_reel <= (produit?.stock_minimum || 0)) {
          await creerAlerte(tenantId, ligne.produit_id, 'stock_bas');
        } else {
          await verifierEtResoudreAlertes(tenantId, ligne.produit_id, ligne.stock_reel, produit?.stock_minimum || 0);
        }

        ajustementsAppliques++;
      }
    }

    // Marquer validé
    const { data: updated, error: errUpdate } = await supabase
      .from('inventaires')
      .update({
        statut: 'valide',
        valide_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    console.log(`[STOCK] Inventaire validé: ${inventaire.nom} (${ajustementsAppliques} ajustements)`);

    res.json({
      success: true,
      inventaire: updated,
      message: `Inventaire validé. ${ajustementsAppliques} ajustement(s) appliqué(s).`,
    });
  } catch (error) {
    console.error('[STOCK] Erreur validation inventaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stock/inventaires/:id/annuler
 * Annuler un inventaire
 */
router.post('/inventaires/:id/annuler', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('inventaires')
      .update({ statut: 'annule' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('statut', 'en_cours')
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, inventaire: data, message: 'Inventaire annulé' });
  } catch (error) {
    console.error('[STOCK] Erreur annulation inventaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stock/alertes
 * Liste des alertes
 */
router.get('/alertes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { resolue, niveau } = req.query;

    let query = supabase
      .from('alertes_stock')
      .select('*, produits(nom, reference, stock_actuel, stock_minimum)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (resolue !== undefined) query = query.eq('resolue', resolue === 'true');
    if (niveau) query = query.eq('niveau', niveau);

    const { data: alertes, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      alertes: alertes || [],
      count: alertes?.length || 0,
    });
  } catch (error) {
    console.error('[STOCK] Erreur alertes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stock/alertes/:id/resoudre
 * Résoudre une alerte manuellement
 */
router.post('/alertes/:id/resoudre', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('alertes_stock')
      .update({
        resolue: true,
        date_resolution: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Alerte résolue' });
  } catch (error) {
    console.error('[STOCK] Erreur résolution alerte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stock/alertes/:id/vue
 * Marquer une alerte comme vue
 */
router.post('/alertes/:id/vue', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('alertes_stock')
      .update({ vue: true })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[STOCK] Erreur marquer vue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stock/dashboard
 * Dashboard stock avec stats globales
 */
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Stats produits
    const { data: produits } = await supabase
      .from('produits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Alertes actives
    const { data: alertes } = await supabase
      .from('alertes_stock')
      .select('*, produits(nom)')
      .eq('tenant_id', tenantId)
      .eq('resolue', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Derniers mouvements
    const { data: derniersMouvements } = await supabase
      .from('mouvements_stock')
      .select('*, produits(nom)')
      .eq('tenant_id', tenantId)
      .order('date_mouvement', { ascending: false })
      .limit(10);

    const nbProduits = produits?.length || 0;
    const produitsStockBas = produits?.filter(p => p.stock_actuel <= p.stock_minimum && p.stock_actuel > 0) || [];
    const produitsStockZero = produits?.filter(p => p.stock_actuel === 0) || [];

    const valeurTotale = produits?.reduce(
      (sum, p) => sum + (p.stock_actuel * p.prix_achat_unitaire),
      0
    ) || 0;

    const valeurVentePotentielle = produits?.reduce(
      (sum, p) => sum + (p.stock_actuel * p.prix_vente_unitaire),
      0
    ) || 0;

    // Stats par catégorie
    const parCategorie = {};
    produits?.forEach(p => {
      if (!parCategorie[p.categorie]) {
        parCategorie[p.categorie] = { nb: 0, valeur: 0 };
      }
      parCategorie[p.categorie].nb++;
      parCategorie[p.categorie].valeur += p.stock_actuel * p.prix_achat_unitaire;
    });

    res.json({
      success: true,
      stats: {
        nb_produits: nbProduits,
        nb_stock_bas: produitsStockBas.length,
        nb_stock_zero: produitsStockZero.length,
        nb_alertes_actives: alertes?.length || 0,
        valeur_totale: valeurTotale,
        valeur_totale_euros: (valeurTotale / 100).toFixed(2),
        valeur_vente_potentielle: valeurVentePotentielle,
        valeur_vente_potentielle_euros: (valeurVentePotentielle / 100).toFixed(2),
        marge_potentielle_euros: ((valeurVentePotentielle - valeurTotale) / 100).toFixed(2),
      },
      par_categorie: Object.entries(parCategorie).map(([cat, data]) => ({
        categorie: cat,
        nb_produits: data.nb,
        valeur_euros: (data.valeur / 100).toFixed(2),
      })),
      produits_stock_bas: produitsStockBas.slice(0, 10).map(p => ({
        id: p.id,
        nom: p.nom,
        reference: p.reference,
        stock_actuel: p.stock_actuel,
        stock_minimum: p.stock_minimum,
        unite: p.unite,
      })),
      produits_stock_zero: produitsStockZero.slice(0, 10).map(p => ({
        id: p.id,
        nom: p.nom,
        reference: p.reference,
      })),
      alertes_recentes: alertes || [],
      derniers_mouvements: derniersMouvements || [],
    });
  } catch (error) {
    console.error('[STOCK] Erreur dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/valorisation
 * Valorisation détaillée du stock par catégorie
 */
router.get('/valorisation', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: produits } = await supabase
      .from('produits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Valorisation par catégorie
    const valorisation = {};
    produits?.forEach(p => {
      if (!valorisation[p.categorie]) {
        valorisation[p.categorie] = {
          categorie: p.categorie,
          nb_produits: 0,
          quantite_totale: 0,
          valeur_achat: 0,
          valeur_vente: 0,
        };
      }
      valorisation[p.categorie].nb_produits++;
      valorisation[p.categorie].quantite_totale += p.stock_actuel;
      valorisation[p.categorie].valeur_achat += p.stock_actuel * p.prix_achat_unitaire;
      valorisation[p.categorie].valeur_vente += p.stock_actuel * p.prix_vente_unitaire;
    });

    // Calculer marges et formater
    const valorisationFormatted = Object.values(valorisation).map(v => ({
      ...v,
      valeur_achat_euros: (v.valeur_achat / 100).toFixed(2),
      valeur_vente_euros: (v.valeur_vente / 100).toFixed(2),
      marge_potentielle: v.valeur_vente - v.valeur_achat,
      marge_potentielle_euros: ((v.valeur_vente - v.valeur_achat) / 100).toFixed(2),
      taux_marge: v.valeur_achat > 0
        ? (((v.valeur_vente - v.valeur_achat) / v.valeur_achat) * 100).toFixed(1)
        : '0',
    }));

    // Totaux
    const totaux = {
      nb_produits: produits?.length || 0,
      quantite_totale: valorisationFormatted.reduce((s, v) => s + v.quantite_totale, 0),
      valeur_achat: valorisationFormatted.reduce((s, v) => s + v.valeur_achat, 0),
      valeur_vente: valorisationFormatted.reduce((s, v) => s + v.valeur_vente, 0),
    };
    totaux.valeur_achat_euros = (totaux.valeur_achat / 100).toFixed(2);
    totaux.valeur_vente_euros = (totaux.valeur_vente / 100).toFixed(2);
    totaux.marge_potentielle_euros = ((totaux.valeur_vente - totaux.valeur_achat) / 100).toFixed(2);

    res.json({
      success: true,
      valorisation: valorisationFormatted,
      totaux,
    });
  } catch (error) {
    console.error('[STOCK] Erreur valorisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stock/categories
 * Liste des catégories disponibles
 */
router.get('/categories', (req, res) => {
  const labels = {
    fournitures: 'Fournitures professionnelles',
    produits_vente: 'Produits à vendre',
    ingredients: 'Ingrédients',
    emballages: 'Emballages',
    materiaux: 'Matériaux',
    autre: 'Autre',
  };

  res.json({
    success: true,
    categories: CATEGORIES.map(c => ({
      id: c,
      label: labels[c] || c,
    })),
  });
});

export default router;
