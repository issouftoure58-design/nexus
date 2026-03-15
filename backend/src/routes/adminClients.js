import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireClientsQuota } from '../middleware/quotas.js';
import { triggerWorkflows } from '../automation/workflowEngine.js';
import { enforceTrialLimit } from '../services/trialService.js';
import logger from '../config/logger.js';
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { success, error as apiError, paginated } from '../utils/response.js';

const createClientSchema = z.object({
  prenom: z.string().max(100).optional(),
  nom: z.string().max(100).optional(),
  telephone: z.string().min(1, 'Téléphone requis').max(20),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  adresse: z.string().max(500).optional(),
  code_postal: z.string().max(10).optional(),
  ville: z.string().max(100).optional(),
  complement_adresse: z.string().max(500).optional(),
  type_client: z.enum(['particulier', 'professionnel']).optional(),
  raison_sociale: z.string().max(200).optional(),
  siret: z.string().max(20).optional(),
}).passthrough();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

// ════════════════════════════════════════════════════════════════════
// CLIENTS - LISTE ET CRUD
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/clients
// Liste tous les clients avec pagination et recherche
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const {
      search = '',
      sort = 'created_at',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Query de base (🔒 TENANT ISOLATION)
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Recherche par nom, prénom, téléphone ou email
    if (search) {
      query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,telephone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Tri
    query = query.order(sort, { ascending: order === 'asc' });

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: clients, error, count } = await query;

    if (error) throw error;

    // 🚀 OPTIMISATION: 1 requête au lieu de 2N requêtes (N+1 fix)
    // Récupérer tous les RDV des clients en une seule requête
    const clientIds = clients.map(c => c.id);

    let rdvStats = {};
    let derniersRdv = {};

    if (clientIds.length > 0) {
      // Une seule requête pour récupérer les stats RDV de tous les clients
      const { data: allRdv } = await supabase
        .from('reservations')
        .select('client_id, date, heure, service, statut')
        .eq('tenant_id', tenantId)
        .in('client_id', clientIds)
        .order('date', { ascending: false });

      // Grouper les RDV par client côté JS (beaucoup plus rapide que N requêtes DB)
      if (allRdv) {
        allRdv.forEach(rdv => {
          // Compter les RDV par client
          rdvStats[rdv.client_id] = (rdvStats[rdv.client_id] || 0) + 1;

          // Garder le dernier RDV (premier dans l'ordre DESC)
          if (!derniersRdv[rdv.client_id]) {
            derniersRdv[rdv.client_id] = {
              date: rdv.date,
              heure: rdv.heure,
              service: rdv.service,
              statut: rdv.statut
            };
          }
        });
      }
    }

    // Enrichir les clients avec leurs stats (sans requête supplémentaire)
    const clientsWithStats = clients.map(client => ({
      ...client,
      nb_rdv: rdvStats[client.id] || 0,
      dernier_rdv: derniersRdv[client.id] || null
    }));

    paginated(res, { data: clientsWithStats, page: pageNum, limit: limitNum, total: count });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur liste:', err);
    apiError(res, 'Erreur serveur');
  }
});

// POST /api/admin/clients
// Créer un nouveau client
// 🔒 TRIAL CHECK: Vérifie limite trial (50 clients)
// 🔒 QUOTA CHECK: Vérifie limite clients selon plan (Starter: 1000, Pro: 3000, Business: illimité)
router.post('/', authenticateAdmin, enforceTrialLimit('clients'), requireClientsQuota, validate(createClientSchema), async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { prenom, nom, telephone, email, adresse, code_postal, ville, complement_adresse, type_client, raison_sociale, siret } = req.body;
    const isPro = type_client === 'professionnel';

    // Validation
    if (isPro) {
      if (!raison_sociale?.trim()) {
        return apiError(res, 'La raison sociale est requise', 'BAD_REQUEST', 400);
      }
    } else {
      if (!prenom?.trim()) {
        return apiError(res, 'Le prénom est requis', 'BAD_REQUEST', 400);
      }
      if (!nom?.trim()) {
        return apiError(res, 'Le nom est requis', 'BAD_REQUEST', 400);
      }
    }
    if (!telephone?.trim()) {
      return apiError(res, 'Le téléphone est requis', 'BAD_REQUEST', 400);
    }

    // Vérifier si le téléphone existe déjà (🔒 TENANT ISOLATION)
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('telephone', telephone.trim())
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      return apiError(res, 'Un client avec ce numéro de téléphone existe déjà', 'CONFLICT', 409);
    }

    // Créer le client (🔒 TENANT ISOLATION)
    const clientData = {
      tenant_id: tenantId,
      type_client: isPro ? 'professionnel' : 'particulier',
      prenom: prenom?.trim() || null,
      nom: isPro ? (nom?.trim() || raison_sociale.trim()) : nom.trim(),
      telephone: telephone.trim(),
      email: email?.trim() || null,
      adresse: adresse?.trim() || null,
      code_postal: code_postal?.trim() || null,
      ville: ville?.trim() || null,
      complement_adresse: complement_adresse?.trim() || null,
      raison_sociale: isPro ? raison_sociale.trim() : null,
      siret: isPro && siret?.trim() ? siret.trim() : null
    };

    const { data: client, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (error) throw error;

    const displayName = isPro ? raison_sociale : `${prenom} ${nom}`;
    console.log('[ADMIN CLIENTS] Nouveau client créé:', client.id, displayName, `(${type_client || 'particulier'})`);

    // Déclencher les workflows "new_client"
    try {
      await triggerWorkflows('new_client', {
        tenant_id: tenantId,
        entity: { ...client, type: 'client' }
      });
    } catch (workflowErr) {
      console.error('[ADMIN CLIENTS] Erreur workflow (non bloquant):', workflowErr.message);
    }

    success(res, { client }, 201);
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur création:', err);
    apiError(res, 'Erreur serveur');
  }
});

// GET /api/admin/clients/:id
// Détail complet d'un client
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Infos client (🔒 TENANT ISOLATION)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError) throw clientError;

    if (!client) {
      return apiError(res, 'Client introuvable', 'NOT_FOUND', 404);
    }

    // Historique RDV (10 derniers) (🔒 TENANT ISOLATION)
    // Note: service_nom est dénormalisé dans reservations, pas besoin de join
    const { data: historiqueRdv } = await supabase
      .from('reservations')
      .select('*')
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(10);

    // Notes privées (🔒 TENANT ISOLATION)
    const { data: notes } = await supabase
      .from('notes_clients')
      .select('*')
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // STATISTIQUES (🔒 TENANT ISOLATION)
    // Note: service_nom est dénormalisé dans reservations
    const { data: allRdv } = await supabase
      .from('reservations')
      .select('statut, prix_total, service_nom, date')
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId);

    const nbRdvTotal = allRdv?.length || 0;
    const nbRdvHonores = allRdv?.filter(r => r.statut === 'termine').length || 0;
    const nbRdvAnnules = allRdv?.filter(r => r.statut === 'annule').length || 0;

    // CA total (RDV terminés uniquement) - prix stocké en centimes, converti en euros
    const caTotal = (allRdv
      ?.filter(r => r.statut === 'termine')
      .reduce((sum, r) => sum + (r.prix_total || 0), 0) || 0) / 100;

    // Service favori (le plus demandé)
    const servicesCount = {};
    allRdv?.forEach(r => {
      if (r.service_nom) {
        servicesCount[r.service_nom] = (servicesCount[r.service_nom] || 0) + 1;
      }
    });
    const serviceFavori = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Fréquence moyenne entre RDV (en jours)
    let frequenceJours = null;
    if (allRdv && allRdv.length > 1) {
      const dates = allRdv
        .map(r => new Date(r.date))
        .sort((a, b) => a - b);

      let totalJours = 0;
      for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        totalJours += diff;
      }
      frequenceJours = Math.round(totalJours / (dates.length - 1));
    }

    // Dernière visite
    const derniereVisite = allRdv
      ?.filter(r => r.statut === 'termine')
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date || null;

    success(res, {
      client: {
        ...client,
        derniere_visite: derniereVisite
      },
      stats: {
        ca_total: caTotal,
        nb_rdv_total: nbRdvTotal,
        nb_rdv_honores: nbRdvHonores,
        nb_rdv_annules: nbRdvAnnules,
        service_favori: serviceFavori,
        frequence_jours: frequenceJours
      },
      notes: notes || [],
      // service_nom est déjà une colonne dans reservations
      historique_rdv: historiqueRdv || []
    });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur détail:', err);
    apiError(res, 'Erreur serveur');
  }
});

// PUT /api/admin/clients/:id
// Modifier les infos d'un client
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { nom, prenom, telephone, email, adresse } = req.body;

    // Colonnes existantes sur la table clients: id, tenant_id, nom, prenom, telephone, email, adresse, tags, created_at, loyalty_points
    const updates = {};
    if (nom !== undefined) updates.nom = nom || null;
    if (prenom !== undefined) updates.prenom = prenom || null;
    if (telephone !== undefined) updates.telephone = telephone;
    if (email !== undefined) updates.email = email || null;
    if (adresse !== undefined) updates.adresse = adresse || null;

    // 🔒 TENANT ISOLATION
    const { data: client, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[ADMIN CLIENTS] Erreur Supabase update:', error.message, error.code);
      return apiError(res, error.message || 'Erreur modification client', 'BAD_REQUEST', 400);
    }

    if (!client) {
      return apiError(res, 'Client introuvable', 'NOT_FOUND', 404);
    }

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update',
      entite: 'client',
      entite_id: client.id,
      details: { updates }
    });

    success(res, { client });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur modification:', err.message || err);
    apiError(res, err.message || 'Erreur serveur');
  }
});

// DELETE /api/admin/clients/:id
// Supprimer un client
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Vérifier s'il y a des RDV futurs (🔒 TENANT ISOLATION)
    const today = new Date().toISOString().split('T')[0];
    const { count: rdvFuturs } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId)
      .gte('date', today)
      .neq('statut', 'annule');

    if (rdvFuturs > 0) {
      return apiError(res, `Impossible de supprimer : ${rdvFuturs} rendez-vous futur(s) planifié(s)`, 'BAD_REQUEST', 400);
    }

    // Supprimer les notes d'abord (foreign key) (🔒 TENANT ISOLATION)
    await supabase
      .from('notes_clients')
      .delete()
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId);

    // Supprimer le client (🔒 TENANT ISOLATION)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'client',
      entite_id: req.params.id
    });

    success(res, { message: 'Client supprimé' });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur suppression:', err);
    apiError(res, 'Erreur serveur');
  }
});

// ════════════════════════════════════════════════════════════════════
// NOTES PRIVÉES
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/clients/:id/notes
// Liste les notes d'un client
router.get('/:id/notes', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: notes, error } = await supabase
      .from('notes_clients')
      .select('*')
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    success(res, { notes });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur liste notes:', err);
    apiError(res, 'Erreur serveur');
  }
});

// POST /api/admin/clients/:id/notes
// Ajouter une note privée
router.post('/:id/notes', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { note } = req.body;

    if (!note || note.trim() === '') {
      return apiError(res, 'La note ne peut pas être vide', 'BAD_REQUEST', 400);
    }

    // 🔒 TENANT ISOLATION: Inclure tenant_id dans l'insert
    const { data: newNote, error } = await supabase
      .from('notes_clients')
      .insert({
        tenant_id: tenantId,
        client_id: req.params.id,
        note: note.trim()
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'note_client',
      entite_id: newNote.id,
      details: { client_id: req.params.id }
    });

    success(res, { note: newNote });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur création note:', err);
    apiError(res, 'Erreur serveur');
  }
});

// DELETE /api/admin/clients/:id/notes/:noteId
// Supprimer une note
router.delete('/:id/notes/:noteId', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // 🔒 TENANT ISOLATION
    const { error } = await supabase
      .from('notes_clients')
      .delete()
      .eq('id', req.params.noteId)
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'note_client',
      entite_id: req.params.noteId
    });

    success(res, { message: 'Note supprimée' });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur suppression note:', err);
    apiError(res, 'Erreur serveur');
  }
});

// ════════════════════════════════════════════════════════════════════
// STATISTIQUES CLIENT
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/clients/:id/stats
// Statistiques détaillées d'un client
router.get('/:id/stats', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Récupérer tous les RDV du client (🔒 TENANT ISOLATION)
    // Note: service_nom est dénormalisé dans reservations
    const { data: rdv } = await supabase
      .from('reservations')
      .select('statut, prix_total, service_nom, date')
      .eq('client_id', req.params.id)
      .eq('tenant_id', tenantId);

    if (!rdv) {
      return success(res, {
        ca_total: 0,
        nb_rdv_total: 0,
        nb_rdv_honores: 0,
        nb_rdv_annules: 0,
        service_favori: null,
        frequence_jours: null
      });
    }

    const nbRdvTotal = rdv.length;
    const nbRdvHonores = rdv.filter(r => r.statut === 'termine').length;
    const nbRdvAnnules = rdv.filter(r => r.statut === 'annule').length;

    // CA total - prix stocké en centimes, convertir en euros
    const caTotal = rdv
      .filter(r => r.statut === 'termine')
      .reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

    // Service favori
    const servicesCount = {};
    rdv.forEach(r => {
      if (r.service_nom) {
        servicesCount[r.service_nom] = (servicesCount[r.service_nom] || 0) + 1;
      }
    });
    const serviceFavori = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Fréquence moyenne
    let frequenceJours = null;
    if (rdv.length > 1) {
      const dates = rdv
        .map(r => new Date(r.date))
        .sort((a, b) => a - b);

      let totalJours = 0;
      for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        totalJours += diff;
      }
      frequenceJours = Math.round(totalJours / (dates.length - 1));
    }

    success(res, {
      ca_total: caTotal,
      nb_rdv_total: nbRdvTotal,
      nb_rdv_honores: nbRdvHonores,
      nb_rdv_annules: nbRdvAnnules,
      service_favori: serviceFavori,
      frequence_jours: frequenceJours
    });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur stats:', err);
    apiError(res, 'Erreur serveur');
  }
});

// ════════════════════════════════════════════════════════════════════
// IMPORT CSV
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/clients/import
 * Import clients depuis un fichier CSV
 * Colonnes attendues : nom, prenom, email, telephone, adresse, notes
 */
router.post('/import', authenticateAdmin, requireClientsQuota, upload.single('file'), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    if (!req.file) {
      return apiError(res, 'Fichier CSV requis', 'BAD_REQUEST', 400);
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      return apiError(res, 'Le fichier doit contenir au moins un en-tête et une ligne de données', 'BAD_REQUEST', 400);
    }

    // Parser l'en-tête
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Mapping colonnes flexibles
    const colMap = {
      nom: headers.findIndex(h => ['nom', 'name', 'last_name', 'lastname', 'nom_famille'].includes(h)),
      prenom: headers.findIndex(h => ['prenom', 'prénom', 'first_name', 'firstname'].includes(h)),
      email: headers.findIndex(h => ['email', 'e-mail', 'mail', 'courriel'].includes(h)),
      telephone: headers.findIndex(h => ['telephone', 'téléphone', 'tel', 'phone', 'mobile'].includes(h)),
      adresse: headers.findIndex(h => ['adresse', 'address', 'ville', 'city'].includes(h)),
      notes: headers.findIndex(h => ['notes', 'note', 'commentaire', 'comment'].includes(h)),
    };

    // Vérifier qu'au moins nom ou email est présent
    if (colMap.nom === -1 && colMap.email === -1) {
      return apiError(res, 'Colonnes requises manquantes. Le fichier doit contenir au moins une colonne "nom" ou "email"', 'BAD_REQUEST', 400);
    }

    const imported = [];
    const errors = [];
    const skipped = [];

    // Parser chaque ligne
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/^['"]|['"]$/g, ''));

      const nom = colMap.nom >= 0 ? values[colMap.nom] : '';
      const prenom = colMap.prenom >= 0 ? values[colMap.prenom] : '';
      const email = colMap.email >= 0 ? values[colMap.email] : '';
      const telephone = colMap.telephone >= 0 ? values[colMap.telephone] : '';
      const adresse = colMap.adresse >= 0 ? values[colMap.adresse] : '';
      const notes = colMap.notes >= 0 ? values[colMap.notes] : '';

      // Validation
      if (!nom && !email) {
        errors.push({ line: i + 1, reason: 'Ni nom ni email fourni' });
        continue;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ line: i + 1, reason: `Email invalide: ${email}` });
        continue;
      }

      // Vérifier doublon par email
      if (email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', email)
          .limit(1);

        if (existing?.length > 0) {
          skipped.push({ line: i + 1, email, reason: 'Email déjà existant' });
          continue;
        }
      }

      // Insérer
      const { error: insertErr } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          nom: nom || prenom || email.split('@')[0],
          prenom: prenom || '',
          email: email || null,
          telephone: telephone || null,
          adresse: adresse || null,
        });

      if (insertErr) {
        errors.push({ line: i + 1, reason: insertErr.message });
      } else {
        imported.push({ line: i + 1, nom: nom || prenom, email });
      }
    }

    success(res, {
      summary: {
        total_lines: lines.length - 1,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported,
      skipped,
      errors,
      columns_detected: headers,
      columns_mapped: Object.fromEntries(
        Object.entries(colMap).filter(([, v]) => v >= 0).map(([k, v]) => [k, headers[v]])
      ),
    });
  } catch (err) {
    console.error('[ADMIN CLIENTS] Erreur import CSV:', err);
    apiError(res, 'Erreur serveur');
  }
});

export default router;
