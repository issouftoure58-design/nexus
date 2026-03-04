import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Paramètres par défaut du système
const PARAMETRES_DEFAUT = [
  // Tarification déplacement
  {
    cle: 'frais_base_deplacement',
    valeur: '10',
    categorie: 'tarification',
    description: 'Frais de base déplacement (0-8km)'
  },
  {
    cle: 'seuil_km_gratuit',
    valeur: '8',
    categorie: 'tarification',
    description: 'Distance sans supplément (km)'
  },
  {
    cle: 'tarif_km_supplementaire',
    valeur: '1.10',
    categorie: 'tarification',
    description: 'Prix par km au-delà du seuil'
  },
  {
    cle: 'distance_max_km',
    valeur: '30',
    categorie: 'tarification',
    description: 'Distance maximale acceptée (km)'
  },

  // Paiement
  {
    cle: 'montant_acompte',
    valeur: '10',
    categorie: 'paiement',
    description: 'Montant acompte (€)'
  },
  {
    cle: 'acompte_obligatoire',
    valeur: 'true',
    categorie: 'paiement',
    description: 'Acompte obligatoire pour confirmer'
  },

  // Annulation
  {
    cle: 'delai_annulation_heures',
    valeur: '24',
    categorie: 'annulation',
    description: 'Délai annulation gratuite (heures)'
  },
  {
    cle: 'remboursement_hors_delai',
    valeur: 'false',
    categorie: 'annulation',
    description: 'Rembourser si annulation tardive'
  },

  // Salon
  {
    cle: 'nom_salon',
    valeur: "Fat's Hair-Afro",
    categorie: 'salon',
    description: 'Nom du salon'
  },
  {
    cle: 'adresse_salon',
    valeur: '8 rue des Monts Rouges, 95130 Franconville',
    categorie: 'salon',
    description: 'Adresse du salon'
  },
  {
    cle: 'telephone_salon',
    valeur: '07 82 23 50 20',
    categorie: 'salon',
    description: 'Téléphone de contact'
  },
  {
    cle: 'email_salon',
    valeur: 'fatou@fatshairafro.fr',
    categorie: 'salon',
    description: 'Email de contact'
  },

  // Messages templates
  {
    cle: 'msg_confirmation',
    valeur: 'Votre RDV est confirmé pour le {date} à {heure}. À bientôt !',
    categorie: 'messages',
    description: 'Message confirmation RDV'
  },
  {
    cle: 'msg_rappel_j1',
    valeur: 'Rappel : RDV demain à {heure}. À très vite !',
    categorie: 'messages',
    description: 'Message rappel J-1'
  },
  {
    cle: 'msg_annulation',
    valeur: 'Votre RDV du {date} a été annulé.',
    categorie: 'messages',
    description: 'Message annulation'
  },
  {
    cle: 'msg_remerciement',
    valeur: 'Merci pour votre visite ! À bientôt chez Fat\'s Hair-Afro 💜',
    categorie: 'messages',
    description: 'Message remerciement J+1'
  }
];

// ════════════════════════════════════════════════════════════════════
// PARAMÈTRES GÉNÉRAUX
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/parametres
// Retourne tous les paramètres groupés par catégorie
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: parametres, error } = await supabase
      .from('parametres')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('categorie', { ascending: true })
      .order('cle', { ascending: true });

    if (error) throw error;

    // Grouper par catégorie
    const parCategorie = {};
    (parametres || []).forEach(param => {
      const categorie = param.categorie || 'autres';
      if (!parCategorie[categorie]) {
        parCategorie[categorie] = [];
      }
      parCategorie[categorie].push({
        id: param.id,
        cle: param.cle,
        valeur: param.valeur,
        description: param.description,
        updated_at: param.updated_at
      });
    });

    res.json({
      parametres: parCategorie,
      total: parametres?.length || 0
    });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/parametres/:cle
// Retourne un paramètre spécifique
router.get('/:cle', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: parametre, error } = await supabase
      .from('parametres')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cle', req.params.cle)
      .single();

    if (error) throw error;

    if (!parametre) {
      return res.status(404).json({ error: 'Paramètre introuvable' });
    }

    res.json({ parametre });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur détail:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/parametres
// Met à jour plusieurs paramètres d'un coup
router.put('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { parametres } = req.body;

    if (!parametres || !Array.isArray(parametres)) {
      return res.status(400).json({ error: 'Format invalide : parametres doit être un tableau' });
    }

    // Mettre à jour chaque paramètre (🔒 TENANT ISOLATION)
    const updates = [];
    for (const param of parametres) {
      if (!param.cle) {
        continue;
      }

      // Try update first
      const { data, error } = await supabase
        .from('parametres')
        .update({
          valeur: param.valeur,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('cle', param.cle)
        .select()
        .single();

      let saved = data;

      // If update returned nothing (row doesn't exist), insert
      if (!data && (!error || error.code === 'PGRST116')) {
        const { data: inserted, error: insertError } = await supabase
          .from('parametres')
          .insert({
            tenant_id: tenantId,
            cle: param.cle,
            valeur: param.valeur,
            categorie: param.categorie || 'autres',
            description: param.description || ''
          })
          .select()
          .single();

        if (!insertError && inserted) {
          saved = inserted;
        }
      }

      if (saved) {
        updates.push(saved);

        // Logger l'action (🔒 TENANT ISOLATION)
        await supabase.from('historique_admin').insert({
          tenant_id: tenantId,
          admin_id: req.admin.id,
          action: data ? 'update' : 'create',
          entite: 'parametre',
          entite_id: saved.id,
          details: {
            cle: param.cle,
            ancienne_valeur: data?.valeur || null,
            nouvelle_valeur: param.valeur
          }
        });
      }
    }

    res.json({
      message: `${updates.length} paramètre(s) mis à jour`,
      parametres: updates
    });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur mise à jour multiple:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/parametres/:cle
// Met à jour un paramètre spécifique
router.put('/:cle', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { valeur } = req.body;

    if (valeur === undefined) {
      return res.status(400).json({ error: 'La valeur est requise' });
    }

    // Récupérer l'ancienne valeur (🔒 TENANT ISOLATION)
    const { data: ancien } = await supabase
      .from('parametres')
      .select('valeur')
      .eq('tenant_id', tenantId)
      .eq('cle', req.params.cle)
      .single();

    // Mettre à jour (🔒 TENANT ISOLATION)
    const { data: parametre, error } = await supabase
      .from('parametres')
      .update({
        valeur: valeur.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('cle', req.params.cle)
      .select()
      .single();

    if (error) throw error;

    if (!parametre) {
      return res.status(404).json({ error: 'Paramètre introuvable' });
    }

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update',
      entite: 'parametre',
      entite_id: parametre.id,
      details: {
        cle: req.params.cle,
        ancienne_valeur: ancien?.valeur || null,
        nouvelle_valeur: valeur
      }
    });

    res.json({ parametre });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════════════

// POST /api/admin/parametres/init
// Initialise les paramètres par défaut s'ils n'existent pas
router.post('/init', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Récupérer les paramètres existants (🔒 TENANT ISOLATION)
    const { data: existants } = await supabase
      .from('parametres')
      .select('cle')
      .eq('tenant_id', tenantId);

    const clesExistantes = new Set((existants || []).map(p => p.cle));

    // Insérer les paramètres manquants (🔒 TENANT ISOLATION: ajouter tenant_id)
    const aInserer = PARAMETRES_DEFAUT
      .filter(p => !clesExistantes.has(p.cle))
      .map(p => ({ ...p, tenant_id: tenantId }));

    if (aInserer.length === 0) {
      return res.json({
        message: 'Tous les paramètres sont déjà initialisés',
        total: PARAMETRES_DEFAUT.length
      });
    }

    const { data: inseres, error } = await supabase
      .from('parametres')
      .insert(aInserer)
      .select();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'init',
      entite: 'parametres',
      details: { nombre_crees: inseres?.length || 0 }
    });

    res.json({
      message: `${inseres?.length || 0} paramètre(s) initialisé(s)`,
      parametres: inseres
    });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur initialisation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// HISTORIQUE
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/parametres/historique
// Retourne les dernières modifications de paramètres
router.get('/historique/modifications', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { limit = 50 } = req.query;

    // 🔒 TENANT ISOLATION
    const { data: historique, error } = await supabase
      .from('historique_admin')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entite', 'parametre')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({
      historique: historique || [],
      total: historique?.length || 0
    });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur historique:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// RESET
// ════════════════════════════════════════════════════════════════════

// POST /api/admin/parametres/:cle/reset
// Réinitialise un paramètre à sa valeur par défaut
router.post('/:cle/reset', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const paramDefaut = PARAMETRES_DEFAUT.find(p => p.cle === req.params.cle);

    if (!paramDefaut) {
      return res.status(404).json({ error: 'Paramètre par défaut introuvable' });
    }

    // 🔒 TENANT ISOLATION
    const { data: parametre, error } = await supabase
      .from('parametres')
      .update({
        valeur: paramDefaut.valeur,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('cle', req.params.cle)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'reset',
      entite: 'parametre',
      entite_id: parametre.id,
      details: {
        cle: req.params.cle,
        valeur_defaut: paramDefaut.valeur
      }
    });

    res.json({
      message: 'Paramètre réinitialisé',
      parametre
    });
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur reset:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT (BONUS)
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/parametres/export/json
// Exporte tous les paramètres en JSON
router.get('/export/json', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // 🔒 TENANT ISOLATION
    const { data: parametres, error } = await supabase
      .from('parametres')
      .select('cle, valeur, categorie, description')
      .eq('tenant_id', tenantId)
      .order('categorie', { ascending: true })
      .order('cle', { ascending: true });

    if (error) throw error;

    const exportData = {
      export_date: new Date().toISOString(),
      version: '1.0',
      parametres: parametres || []
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="parametres_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('[ADMIN PARAMETRES] Erreur export:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
