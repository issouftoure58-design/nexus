/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES DÉPENSES - API pour le suivi des charges                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin);

// Catégories disponibles
const CATEGORIES = [
  'fournitures', 'loyer', 'charges', 'telecom', 'assurance',
  'transport', 'marketing', 'bancaire', 'formation', 'materiel',
  'logiciel', 'comptabilite', 'taxes', 'autre'
];

const RECURRENCES = ['ponctuelle', 'mensuelle', 'trimestrielle', 'annuelle'];

// Taux de TVA disponibles
const TAUX_TVA = [20, 10, 5.5, 2.1, 0];

/**
 * Formate une dépense pour la réponse API
 */
function formatDepense(d) {
  const montantHT = d.montant || 0;
  const montantTTC = d.montant_ttc || montantHT;
  const tauxTVA = d.taux_tva || 0;
  const montantTVA = d.montant_tva || (montantTTC - montantHT);

  return {
    id: d.id,
    categorie: d.categorie,
    libelle: d.libelle,
    description: d.description,
    // Montants
    montant: montantHT,
    montant_euros: (montantHT / 100).toFixed(2),
    montant_ttc: montantTTC,
    montant_ttc_euros: (montantTTC / 100).toFixed(2),
    montant_tva: montantTVA,
    montant_tva_euros: (montantTVA / 100).toFixed(2),
    // TVA
    taux_tva: tauxTVA,
    deductible_tva: d.deductible_tva !== false,
    // Autres
    date_depense: d.date_depense,
    recurrence: d.recurrence,
    justificatif_url: d.justificatif_url,
    created_at: d.created_at,
    updated_at: d.updated_at
  };
}

/**
 * GET /api/depenses
 * Liste des dépenses avec filtres optionnels
 * Query: ?mois=2026-02&categorie=fournitures
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois, categorie, limit = 100 } = req.query;

    let query = supabase
      .from('depenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_depense', { ascending: false })
      .limit(parseInt(limit));

    // Filtre par mois (format: 2026-02)
    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_depense', startDate).lte('date_depense', endDate);
    }

    // Filtre par catégorie
    if (categorie && CATEGORIES.includes(categorie)) {
      query = query.eq('categorie', categorie);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculs des totaux
    const totalHT = data.reduce((sum, d) => sum + (d.montant || 0), 0);
    const totalTTC = data.reduce((sum, d) => sum + (d.montant_ttc || d.montant || 0), 0);
    const totalTVA = data.reduce((sum, d) => sum + (d.montant_tva || 0), 0);
    const totalTVADeductible = data
      .filter(d => d.deductible_tva !== false)
      .reduce((sum, d) => sum + (d.montant_tva || 0), 0);

    res.json({
      success: true,
      depenses: data.map(formatDepense),
      totaux: {
        ht: (totalHT / 100).toFixed(2),
        ttc: (totalTTC / 100).toFixed(2),
        tva: (totalTVA / 100).toFixed(2),
        tva_deductible: (totalTVADeductible / 100).toFixed(2)
      },
      total: totalHT / 100 // Legacy
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur liste:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/resume
 * Résumé par catégorie pour un mois
 * Query: ?mois=2026-02
 */
router.get('/resume', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('depenses')
      .select('categorie, montant')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    if (error) throw error;

    // Grouper par catégorie
    const parCategorie = {};
    let total = 0;

    data.forEach(d => {
      parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
      total += d.montant;
    });

    // Formater
    const resume = Object.entries(parCategorie)
      .map(([categorie, montant]) => ({
        categorie,
        montant_centimes: montant,
        montant_euros: (montant / 100).toFixed(2),
        pourcentage: ((montant / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.montant_centimes - a.montant_centimes);

    res.json({
      success: true,
      mois: targetMois,
      total_centimes: total,
      total_euros: (total / 100).toFixed(2),
      par_categorie: resume
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur résumé:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/compte-resultat
 * Compte de résultat complet (revenus - charges)
 * Query: ?mois=2026-02
 */
router.get('/compte-resultat', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    // 1. Récupérer les revenus (réservations confirmées/terminées)
    const { data: reservations } = await supabase
      .from('reservations')
      .select('prix_total, prix_service, frais_deplacement, statut')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('statut', ['confirme', 'termine']);

    const revenus = reservations?.reduce((sum, r) => {
      const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      return sum + prix;
    }, 0) || 0;

    // 2. Récupérer les charges
    const { data: depenses } = await supabase
      .from('depenses')
      .select('categorie, montant')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    const chargesParCategorie = {};
    let totalCharges = 0;

    depenses?.forEach(d => {
      chargesParCategorie[d.categorie] = (chargesParCategorie[d.categorie] || 0) + d.montant;
      totalCharges += d.montant;
    });

    // 3. Calculer le résultat
    const resultatNet = revenus - totalCharges;
    const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      mois: targetMois,
      compte_resultat: {
        chiffre_affaires: {
          total_centimes: revenus,
          total_euros: (revenus / 100).toFixed(2)
        },
        charges: {
          total_centimes: totalCharges,
          total_euros: (totalCharges / 100).toFixed(2),
          detail: Object.entries(chargesParCategorie).map(([cat, montant]) => ({
            categorie: cat,
            montant_euros: (montant / 100).toFixed(2)
          }))
        },
        resultat_net: {
          total_centimes: resultatNet,
          total_euros: (resultatNet / 100).toFixed(2),
          marge_nette: margeNette,
          marge_nette_pourcent: margeNette,
          positif: resultatNet >= 0
        }
      }
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur compte résultat:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/depenses
 * Ajouter une dépense
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      categorie,
      libelle,
      description,
      montant,          // Montant HT en centimes (legacy)
      montant_ttc,      // Montant TTC en centimes (nouveau)
      taux_tva,         // Taux TVA (20, 10, 5.5, 0)
      deductible_tva,   // TVA déductible ?
      date_depense,
      recurrence,
      justificatif_url
    } = req.body;

    // Validation
    if (!categorie || !CATEGORIES.includes(categorie)) {
      return res.status(400).json({ success: false, error: 'Catégorie invalide' });
    }

    // Accepter libelle ou description comme nom de la dépense
    const nomDepense = libelle || description;
    if (!nomDepense || nomDepense.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Libellé/description requis' });
    }

    // Calcul des montants
    const tauxTVA = parseFloat(taux_tva) || 20;
    const estDeductible = deductible_tva !== false;
    let montantTTC, montantHT;

    if (montant_ttc) {
      // Nouveau mode: saisie TTC
      montantTTC = Math.round(montant_ttc);
      if (estDeductible && tauxTVA > 0) {
        // Calcul HT depuis TTC
        montantHT = Math.round(montantTTC / (1 + tauxTVA / 100));
      } else {
        // Non assujetti ou taux 0: HT = TTC
        montantHT = montantTTC;
      }
    } else if (montant) {
      // Mode legacy: montant direct (considéré comme HT)
      montantHT = Math.round(montant);
      montantTTC = estDeductible && tauxTVA > 0
        ? Math.round(montantHT * (1 + tauxTVA / 100))
        : montantHT;
    } else {
      return res.status(400).json({ success: false, error: 'Montant requis' });
    }

    if (montantHT <= 0) {
      return res.status(400).json({ success: false, error: 'Montant invalide' });
    }

    const { data, error } = await supabase
      .from('depenses')
      .insert({
        tenant_id: tenantId,
        categorie,
        libelle: nomDepense.trim(),
        description: description?.trim() || null,
        montant: montantHT,
        montant_ttc: montantTTC,
        taux_tva: tauxTVA,
        deductible_tva: estDeductible,
        date_depense: date_depense || new Date().toISOString().split('T')[0],
        recurrence: recurrence && RECURRENCES.includes(recurrence) ? recurrence : 'ponctuelle',
        justificatif_url: justificatif_url || null
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      depense: formatDepense(data)
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur création:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * PUT /api/depenses/:id
 * Modifier une dépense
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const {
      categorie,
      libelle,
      description,
      montant,
      montant_ttc,
      taux_tva,
      deductible_tva,
      date_depense,
      recurrence,
      justificatif_url
    } = req.body;

    const updates = {};
    if (categorie && CATEGORIES.includes(categorie)) updates.categorie = categorie;
    if (libelle) updates.libelle = libelle.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (date_depense) updates.date_depense = date_depense;
    if (recurrence && RECURRENCES.includes(recurrence)) updates.recurrence = recurrence;
    if (justificatif_url !== undefined) updates.justificatif_url = justificatif_url || null;

    // Gestion TVA
    if (taux_tva !== undefined) updates.taux_tva = parseFloat(taux_tva) || 0;
    if (deductible_tva !== undefined) updates.deductible_tva = deductible_tva !== false;

    // Recalcul des montants si modifiés
    const tauxTVA = updates.taux_tva !== undefined ? updates.taux_tva : 20;
    const estDeductible = updates.deductible_tva !== undefined ? updates.deductible_tva : true;

    if (montant_ttc) {
      updates.montant_ttc = Math.round(montant_ttc);
      if (estDeductible && tauxTVA > 0) {
        updates.montant = Math.round(updates.montant_ttc / (1 + tauxTVA / 100));
      } else {
        updates.montant = updates.montant_ttc;
      }
    } else if (montant && montant > 0) {
      updates.montant = Math.round(montant);
      updates.montant_ttc = estDeductible && tauxTVA > 0
        ? Math.round(updates.montant * (1 + tauxTVA / 100))
        : updates.montant;
    }

    const { data, error } = await supabase
      .from('depenses')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Dépense non trouvée' });

    res.json({
      success: true,
      depense: formatDepense(data)
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur modification:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * DELETE /api/depenses/:id
 * Supprimer une dépense
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('depenses')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Dépense supprimée' });
  } catch (error) {
    console.error('[DEPENSES] Erreur suppression:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/tva
 * Résumé TVA pour un mois (TVA collectée, TVA déductible, TVA à payer)
 * Query: ?mois=2026-02
 */
router.get('/tva', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    // 1. TVA COLLECTÉE - depuis les réservations/ventes
    // Récupérer les réservations confirmées/terminées du mois avec les infos service
    const { data: reservations } = await supabase
      .from('reservations')
      .select('prix_total, prix_service, frais_deplacement, statut, service_id, services(taux_tva)')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('statut', ['confirme', 'termine']);

    // Calcul CA TTC et TVA collectée (utilisant le taux de chaque service)
    let chiffreAffairesTTC = 0;
    let chiffreAffairesHT = 0;
    let tvaCollectee = 0;
    const tvaParTaux = {};

    reservations?.forEach(r => {
      const prixTTC = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      const tauxTVA = r.services?.taux_tva || 20; // Taux du service ou 20% par défaut

      const prixHT = Math.round(prixTTC / (1 + tauxTVA / 100));
      const tva = prixTTC - prixHT;

      chiffreAffairesTTC += prixTTC;
      chiffreAffairesHT += prixHT;
      tvaCollectee += tva;

      // Grouper par taux
      if (!tvaParTaux[tauxTVA]) {
        tvaParTaux[tauxTVA] = { base_ht: 0, tva: 0, nb: 0 };
      }
      tvaParTaux[tauxTVA].base_ht += prixHT;
      tvaParTaux[tauxTVA].tva += tva;
      tvaParTaux[tauxTVA].nb += 1;
    });

    // 2. TVA DÉDUCTIBLE - depuis les dépenses
    const { data: depenses } = await supabase
      .from('depenses')
      .select('montant, montant_ttc, montant_tva, taux_tva, deductible_tva')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    // Calcul TVA déductible (uniquement les dépenses avec deductible_tva = true)
    let tvaDeductible = 0;
    let totalDepensesHT = 0;
    let totalDepensesTTC = 0;

    depenses?.forEach(d => {
      const montantHT = d.montant || 0;
      const montantTTC = d.montant_ttc || montantHT;
      const tauxTVA = d.taux_tva || 0;
      const montantTVA = d.montant_tva || (tauxTVA > 0 ? Math.round(montantTTC - montantHT) : 0);

      totalDepensesHT += montantHT;
      totalDepensesTTC += montantTTC;

      // TVA déductible uniquement si marquée comme telle
      if (d.deductible_tva !== false && montantTVA > 0) {
        tvaDeductible += montantTVA;
      }
    });

    // 3. TVA À PAYER = TVA collectée - TVA déductible
    const tvaAPayer = tvaCollectee - tvaDeductible;

    // 4. Détail par taux de TVA (dépenses)
    const detailParTaux = {};
    depenses?.forEach(d => {
      if (d.deductible_tva !== false) {
        const taux = d.taux_tva || 0;
        const montantTVA = d.montant_tva || 0;
        if (!detailParTaux[taux]) {
          detailParTaux[taux] = { base_ht: 0, tva: 0 };
        }
        detailParTaux[taux].base_ht += d.montant || 0;
        detailParTaux[taux].tva += montantTVA;
      }
    });

    res.json({
      success: true,
      mois: targetMois,
      tva: {
        // TVA Collectée (sur ventes)
        collectee: {
          base_ht: chiffreAffairesHT,
          base_ht_euros: (chiffreAffairesHT / 100).toFixed(2),
          tva: tvaCollectee,
          tva_euros: (tvaCollectee / 100).toFixed(2),
          nb_operations: reservations?.length || 0,
          detail_par_taux: Object.entries(tvaParTaux).map(([taux, data]) => ({
            taux: parseFloat(taux),
            base_ht_euros: (data.base_ht / 100).toFixed(2),
            tva_euros: (data.tva / 100).toFixed(2),
            nb_operations: data.nb
          }))
        },
        // TVA Déductible (sur achats)
        deductible: {
          base_ht: totalDepensesHT,
          base_ht_euros: (totalDepensesHT / 100).toFixed(2),
          tva: tvaDeductible,
          tva_euros: (tvaDeductible / 100).toFixed(2),
          nb_operations: depenses?.filter(d => d.deductible_tva !== false).length || 0,
          detail_par_taux: Object.entries(detailParTaux).map(([taux, data]) => ({
            taux: parseFloat(taux),
            base_ht_euros: (data.base_ht / 100).toFixed(2),
            tva_euros: (data.tva / 100).toFixed(2)
          }))
        },
        // Solde TVA à payer (ou crédit si négatif)
        solde: {
          montant: tvaAPayer,
          montant_euros: (tvaAPayer / 100).toFixed(2),
          a_payer: tvaAPayer > 0,
          credit: tvaAPayer < 0
        }
      }
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur TVA:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/categories
 * Liste des catégories disponibles
 */
router.get('/categories', (req, res) => {
  const categoriesLabels = {
    fournitures: 'Fournitures (produits)',
    loyer: 'Loyer / Local',
    charges: 'Charges (électricité, eau)',
    telecom: 'Téléphone / Internet',
    assurance: 'Assurances',
    transport: 'Transport / Essence',
    marketing: 'Marketing / Publicité',
    bancaire: 'Frais bancaires',
    formation: 'Formation',
    materiel: 'Matériel / Équipement',
    logiciel: 'Logiciels / Abonnements',
    comptabilite: 'Comptabilité',
    taxes: 'Taxes / Impôts',
    autre: 'Autre'
  };

  res.json({
    success: true,
    categories: CATEGORIES.map(c => ({
      id: c,
      label: categoriesLabels[c]
    }))
  });
});

export default router;
