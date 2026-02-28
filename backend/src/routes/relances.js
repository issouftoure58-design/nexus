/**
 * Routes API pour la gestion des relances factures
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  getFacturesARelancer,
  getStatsRelances,
  envoyerRelance,
  traiterRelancesTenant,
  transmettreContentieux,
  getRelanceSettings,
  saveRelanceSettings
} from '../services/relancesService.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let _supabase = null;
function getSupabase() {
  if (!_supabase && supabaseUrl && supabaseKey) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

/**
 * GET /api/relances
 * Liste les factures à relancer pour le tenant avec stats
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const [factures, stats] = await Promise.all([
      getFacturesARelancer(tenantId),
      getStatsRelances(tenantId)
    ]);

    res.json({
      success: true,
      factures,
      stats,
      count: factures.length
    });
  } catch (error) {
    console.error('[API Relances] Erreur liste:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/relances/stats
 * Statistiques des relances pour le dashboard
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const stats = await getStatsRelances(tenantId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[API Relances] Erreur stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/relances/historique/:factureId
 * Historique des relances pour une facture
 */
router.get('/historique/:factureId', authenticateAdmin, async (req, res) => {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Base de données non disponible' });
    }

    const tenantId = req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const { factureId } = req.params;

    const { data, error } = await db
      .from('relances_factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('facture_id', factureId)
      .order('date_envoi', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      historique: data || []
    });
  } catch (error) {
    console.error('[API Relances] Erreur historique:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/relances/:factureId/envoyer
 * Envoyer manuellement une relance pour une facture
 */
router.post('/:factureId/envoyer', authenticateAdmin, async (req, res) => {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Base de données non disponible' });
    }

    const tenantId = req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const { factureId } = req.params;
    const { niveau } = req.body;

    // Valider le niveau
    if (!niveau || niveau < 1 || niveau > 4) {
      return res.status(400).json({
        success: false,
        error: 'Niveau de relance invalide (1-4 attendu)'
      });
    }

    // Récupérer la facture
    const { data: facture, error: fetchError } = await db
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !facture) {
      return res.status(404).json({
        success: false,
        error: 'Facture non trouvée'
      });
    }

    // Vérifier que la facture n'est pas déjà payée
    if (facture.statut === 'payee') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de relancer une facture déjà payée'
      });
    }

    // Envoyer la relance
    const result = await envoyerRelance(facture, niveau, tenantId);

    res.json({
      success: result.success,
      message: result.success
        ? `Relance niveau ${niveau} envoyée avec succès`
        : 'Échec de l\'envoi de la relance',
      details: result
    });
  } catch (error) {
    console.error('[API Relances] Erreur envoi:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/relances/traiter
 * Traiter toutes les relances en attente (manuellement)
 * Normalement appelé par le CRON job
 */
router.post('/traiter', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();

    // Vérifier si l'utilisateur est super admin (peut traiter tous les tenants)
    const admin = req.admin;
    const isSuperAdmin = admin?.role === 'super_admin' || admin?.super_admin;

    let result;
    if (isSuperAdmin && req.body.allTenants) {
      // Traiter tous les tenants
      const { traiterToutesRelances } = await import('../services/relancesService.js');
      result = await traiterToutesRelances();
    } else {
      // Traiter uniquement le tenant courant
      result = await traiterRelancesTenant(tenantId);
    }

    res.json({
      success: true,
      message: 'Traitement des relances terminé',
      result
    });
  } catch (error) {
    console.error('[API Relances] Erreur traitement:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/relances/:factureId/marquer-payee
 * Marquer une facture comme payée (annule les relances)
 */
router.patch('/:factureId/marquer-payee', authenticateAdmin, async (req, res) => {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Base de données non disponible' });
    }

    const tenantId = req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const { factureId } = req.params;

    const { error } = await db
      .from('factures')
      .update({
        statut: 'payee',
        date_paiement: new Date().toISOString()
      })
      .eq('id', factureId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: 'Facture marquée comme payée'
    });
  } catch (error) {
    console.error('[API Relances] Erreur marquer payée:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/relances/:factureId/contentieux
 * Transmettre un dossier au service contentieux
 */
router.post('/:factureId/contentieux', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const { factureId } = req.params;
    const { service } = req.body; // 'interne' ou 'huissier'

    const result = await transmettreContentieux(
      parseInt(factureId),
      tenantId,
      service || 'interne'
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[API Relances] Erreur contentieux:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/relances/settings
 * Récupérer les paramètres de relance du tenant
 */
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const settings = await getRelanceSettings(tenantId);

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('[API Relances] Erreur get settings:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/relances/settings
 * Mettre à jour les paramètres de relance du tenant
 */
router.put('/settings', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.admin?.tenant_id || (() => { throw new Error('TENANT_ID_REQUIRED'); })();
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants'
      });
    }

    const result = await saveRelanceSettings(tenantId, settings);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[API Relances] Erreur save settings:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
