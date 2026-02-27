/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ADMIN RESSOURCES - Gestion des ressources planifiables   ║
 * ║   Modèle générique: humains (collaborateurs) et physiques        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
router.use(authenticateAdmin);

// ============================================
// TYPES DE RESSOURCES
// ============================================

/**
 * GET /api/admin/ressources/types
 * Liste des types de ressources du tenant
 */
router.get('/types', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: types, error } = await supabase
      .from('types_ressources')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('ordre', { ascending: true });

    if (error) throw error;

    res.json({ types: types || [] });
  } catch (error) {
    console.error('[RESSOURCES] Erreur liste types:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/ressources/types
 * Créer un nouveau type de ressource
 */
router.post('/types', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { code, nom, nom_pluriel, categorie, icone, couleur, multi_affectation, a_capacite, capacite_defaut } = req.body;

    if (!code || !nom) {
      return res.status(400).json({ error: 'Code et nom requis' });
    }

    const { data: type, error } = await supabase
      .from('types_ressources')
      .insert({
        tenant_id: tenantId,
        code: code.toLowerCase().replace(/\s+/g, '_'),
        nom,
        nom_pluriel: nom_pluriel || nom + 's',
        categorie: categorie || 'humain',
        icone,
        couleur,
        multi_affectation: multi_affectation || false,
        a_capacite: a_capacite || false,
        capacite_defaut: capacite_defaut || 1
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[RESSOURCES] Type ${code} créé pour tenant ${tenantId}`);
    res.status(201).json({ success: true, type });
  } catch (error) {
    console.error('[RESSOURCES] Erreur création type:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RESSOURCES
// ============================================

/**
 * GET /api/admin/ressources
 * Liste des ressources du tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { type, categorie, actif } = req.query;

    let query = supabase
      .from('ressources')
      .select(`
        *,
        type:types_ressources(id, code, nom, categorie, icone, couleur),
        membre:rh_membres(id, nom, prenom, email, telephone)
      `)
      .eq('tenant_id', tenantId)
      .order('nom', { ascending: true });

    if (type) {
      // Filtrer par code de type
      const { data: typeData } = await supabase
        .from('types_ressources')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('code', type)
        .single();

      if (typeData) {
        query = query.eq('type_ressource_id', typeData.id);
      }
    }

    if (categorie) {
      // Filtrer par catégorie de type (humain/physique)
      const { data: typesData } = await supabase
        .from('types_ressources')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('categorie', categorie);

      if (typesData && typesData.length > 0) {
        query = query.in('type_ressource_id', typesData.map(t => t.id));
      }
    }

    if (actif !== undefined) {
      query = query.eq('actif', actif === 'true');
    }

    const { data: ressources, error } = await query;

    if (error) throw error;

    res.json({ ressources: ressources || [] });
  } catch (error) {
    console.error('[RESSOURCES] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ressources/disponibles
 * Trouver les ressources DISPONIBLES et COMPÉTENTES pour un service/créneau
 * IMPORTANT: Cette route doit être AVANT /:id pour éviter que "disponibles" soit traité comme un ID
 *
 * Query params:
 * - service_id: ID du service demandé (filtre par compétence)
 * - date: Date demandée (YYYY-MM-DD)
 * - heure_debut: Heure de début (HH:MM)
 * - duree_minutes: Durée en minutes (pour calculer heure_fin)
 */
router.get('/disponibles', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { service_id, date, heure_debut, duree_minutes = 60 } = req.query;

    if (!date || !heure_debut) {
      return res.status(400).json({ error: 'date et heure_debut requis' });
    }

    // Nettoyer heure_debut (supprimer les secondes si présentes)
    const heureDebutClean = heure_debut.substring(0, 5);

    // Calculer heure de fin
    const [h, m] = heureDebutClean.split(':').map(Number);
    const totalMin = h * 60 + m + parseInt(duree_minutes);
    const heureFin = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

    console.log(`[RESSOURCES] Recherche dispo: ${date} ${heureDebutClean}-${heureFin}, durée ${duree_minutes}min`);

    // 1. Récupérer les ressources compétentes pour ce service
    let ressourcesQuery = supabase
      .from('ressources')
      .select(`
        id, nom, categorie, actif,
        type:types_ressources(id, nom, categorie)
      `)
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Si service_id fourni, filtrer par compétence
    if (service_id) {
      const { data: competences } = await supabase
        .from('ressource_competences')
        .select('ressource_id')
        .eq('service_id', parseInt(service_id))
        .eq('tenant_id', tenantId)
        .eq('actif', true);

      if (competences && competences.length > 0) {
        const ids = competences.map(c => c.ressource_id);
        ressourcesQuery = ressourcesQuery.in('id', ids);
      } else {
        // Aucune ressource compétente pour ce service
        return res.json({
          disponibles: [],
          occupees: [],
          message: 'Aucune ressource configurée pour ce service',
          prochaines_dispos: []
        });
      }
    }

    const { data: ressources, error: resErr } = await ressourcesQuery;

    if (resErr) {
      console.error('[RESSOURCES] Erreur query ressources:', resErr);
    }

    console.log(`[RESSOURCES] ${ressources?.length || 0} ressources trouvées`);

    // 2. Pour chaque ressource, vérifier la disponibilité
    const disponibles = [];
    const occupees = [];

    for (const ressource of ressources || []) {
      // Vérifier les indisponibilités ponctuelles
      const { data: indispos } = await supabase
        .from('ressource_indisponibilites')
        .select('*')
        .eq('ressource_id', ressource.id)
        .eq('tenant_id', tenantId)
        .lte('date_debut', date)
        .gte('date_fin', date);

      const estIndisponible = (indispos || []).some(i => {
        if (!i.heure_debut) return true; // Journée entière
        return heureDebutClean < i.heure_fin && heureFin > i.heure_debut;
      });

      if (estIndisponible) {
        occupees.push({
          ...ressource,
          raison: 'indisponible',
          conflit: indispos[0]
        });
        continue;
      }

      // Vérifier les prestations existantes
      const { data: prestations } = await supabase
        .from('prestation_ressources')
        .select(`
          prestation:prestations!inner(
            id, numero, date_debut, heure_debut, heure_fin, statut, client_nom
          )
        `)
        .eq('ressource_id', ressource.id)
        .eq('tenant_id', tenantId)
        .eq('prestation.date_debut', date)
        .not('prestation.statut', 'in', '("annulee","facturee")');

      // Vérifier aussi les réservations legacy
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, date, heure, duree_minutes, statut, client_id')
        .eq('membre_id', ressource.membre_id)
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .not('statut', 'in', '("annule","termine")');

      // Combiner et vérifier les conflits
      const conflits = [];

      // Conflits prestations
      for (const p of prestations || []) {
        const prest = p.prestation;
        if (heureDebutClean < prest.heure_fin && heureFin > prest.heure_debut) {
          conflits.push({
            type: 'prestation',
            id: prest.id,
            numero: prest.numero,
            heure_debut: prest.heure_debut,
            heure_fin: prest.heure_fin,
            client: prest.client_nom
          });
        }
      }

      // Conflits réservations legacy
      for (const r of reservations || []) {
        const resHeureFin = (() => {
          const [rh, rm] = r.heure.split(':').map(Number);
          const total = rh * 60 + rm + (r.duree_minutes || 60);
          return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })();

        if (heureDebutClean < resHeureFin && heureFin > r.heure) {
          conflits.push({
            type: 'reservation',
            id: r.id,
            heure_debut: r.heure,
            heure_fin: resHeureFin
          });
        }
      }

      if (conflits.length === 0) {
        disponibles.push(ressource);
      } else {
        occupees.push({
          ...ressource,
          raison: 'occupee',
          conflits
        });
      }
    }

    console.log(`[RESSOURCES] Résultat: ${disponibles.length} dispo, ${occupees.length} occupées`);

    // 3. Si aucune ressource disponible, proposer les prochaines dispos
    let prochaines_dispos = [];
    if (disponibles.length === 0 && occupees.length > 0) {
      prochaines_dispos = await trouverProchainesDisposHelper(
        tenantId,
        occupees.map(r => r.id),
        date,
        heureDebutClean,
        parseInt(duree_minutes)
      );
    }

    res.json({
      disponibles,
      occupees,
      prochaines_dispos
    });
  } catch (error) {
    console.error('[RESSOURCES] Erreur disponibles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ressources/:id
 * Détail d'une ressource
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: ressource, error } = await supabase
      .from('ressources')
      .select(`
        *,
        type:types_ressources(id, code, nom, categorie, icone, couleur),
        membre:rh_membres(id, nom, prenom, email, telephone, poste)
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !ressource) {
      return res.status(404).json({ error: 'Ressource non trouvée' });
    }

    res.json({ ressource });
  } catch (error) {
    console.error('[RESSOURCES] Erreur détail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/ressources
 * Créer une nouvelle ressource
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      type_ressource_id,
      code,
      nom,
      membre_id,
      capacite,
      categorie,
      attributs,
      horaires_defaut,
      notes
    } = req.body;

    if (!type_ressource_id || !nom) {
      return res.status(400).json({ error: 'Type et nom requis' });
    }

    // Vérifier que le type existe et appartient au tenant
    const { data: typeExists } = await supabase
      .from('types_ressources')
      .select('id')
      .eq('id', type_ressource_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!typeExists) {
      return res.status(400).json({ error: 'Type de ressource invalide' });
    }

    const { data: ressource, error } = await supabase
      .from('ressources')
      .insert({
        tenant_id: tenantId,
        type_ressource_id,
        code,
        nom,
        membre_id: membre_id || null,
        capacite: capacite || 1,
        categorie,
        attributs: attributs || {},
        horaires_defaut,
        notes
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[RESSOURCES] Ressource ${nom} créée pour tenant ${tenantId}`);
    res.status(201).json({ success: true, ressource });
  } catch (error) {
    console.error('[RESSOURCES] Erreur création:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/ressources/:id
 * Modifier une ressource
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const {
      code,
      nom,
      capacite,
      categorie,
      attributs,
      horaires_defaut,
      notes,
      actif
    } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (code !== undefined) updateData.code = code;
    if (nom !== undefined) updateData.nom = nom;
    if (capacite !== undefined) updateData.capacite = capacite;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (attributs !== undefined) updateData.attributs = attributs;
    if (horaires_defaut !== undefined) updateData.horaires_defaut = horaires_defaut;
    if (notes !== undefined) updateData.notes = notes;
    if (actif !== undefined) updateData.actif = actif;

    const { data: ressource, error } = await supabase
      .from('ressources')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, ressource });
  } catch (error) {
    console.error('[RESSOURCES] Erreur modification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/ressources/:id
 * Supprimer une ressource
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('ressources')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Ressource supprimée' });
  } catch (error) {
    console.error('[RESSOURCES] Erreur suppression:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DISPONIBILITÉ / PLANNING
// ============================================

/**
 * GET /api/admin/ressources/:id/planning
 * Planning d'une ressource (prestations affectées)
 */
router.get('/:id/planning', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { date_debut, date_fin } = req.query;

    let query = supabase
      .from('prestation_ressources')
      .select(`
        *,
        prestation:prestations(
          id, numero, client_nom, statut,
          date_debut, heure_debut, date_fin, heure_fin,
          duree_minutes, montant_ttc
        )
      `)
      .eq('ressource_id', id)
      .eq('tenant_id', tenantId);

    if (date_debut) {
      query = query.gte('prestation.date_debut', date_debut);
    }
    if (date_fin) {
      query = query.lte('prestation.date_debut', date_fin);
    }

    const { data: affectations, error } = await query;

    if (error) throw error;

    res.json({ affectations: affectations || [] });
  } catch (error) {
    console.error('[RESSOURCES] Erreur planning:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ressources/disponibilite
 * Vérifier la disponibilité des ressources pour un créneau
 */
router.get('/check/disponibilite', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { date, heure_debut, heure_fin, ressource_ids } = req.query;

    if (!date || !heure_debut) {
      return res.status(400).json({ error: 'Date et heure requises' });
    }

    // Récupérer les ressources demandées
    let ressourcesQuery = supabase
      .from('ressources')
      .select('id, nom, actif')
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    if (ressource_ids) {
      const ids = ressource_ids.split(',').map(Number);
      ressourcesQuery = ressourcesQuery.in('id', ids);
    }

    const { data: ressources } = await ressourcesQuery;

    // Pour chaque ressource, vérifier s'il y a un conflit
    const disponibilites = [];

    for (const ressource of ressources || []) {
      // Chercher des prestations qui chevauchent le créneau
      const { data: conflits } = await supabase
        .from('prestation_ressources')
        .select(`
          prestation:prestations!inner(
            id, numero, date_debut, heure_debut, heure_fin, statut
          )
        `)
        .eq('ressource_id', ressource.id)
        .eq('tenant_id', tenantId)
        .eq('prestation.date_debut', date)
        .not('prestation.statut', 'in', '("annulee","facturee")');

      // Vérifier les chevauchements horaires
      const conflitsReels = (conflits || []).filter(c => {
        const prest = c.prestation;
        // Conflit si: debut_demande < fin_existant ET fin_demande > debut_existant
        return heure_debut < prest.heure_fin && (heure_fin || '23:59') > prest.heure_debut;
      });

      disponibilites.push({
        ressource_id: ressource.id,
        nom: ressource.nom,
        disponible: conflitsReels.length === 0,
        conflits: conflitsReels.map(c => ({
          prestation_id: c.prestation.id,
          numero: c.prestation.numero,
          heure_debut: c.prestation.heure_debut,
          heure_fin: c.prestation.heure_fin
        }))
      });
    }

    res.json({ disponibilites });
  } catch (error) {
    console.error('[RESSOURCES] Erreur disponibilité:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COMPÉTENCES
// ============================================

/**
 * GET /api/admin/ressources/:id/competences
 * Liste des compétences (services) d'une ressource
 */
router.get('/:id/competences', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: competences, error } = await supabase
      .from('ressource_competences')
      .select(`
        id,
        niveau,
        actif,
        service:services(id, nom, prix, duree)
      `)
      .eq('ressource_id', id)
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    if (error) throw error;

    res.json({ competences: competences || [] });
  } catch (error) {
    console.error('[RESSOURCES] Erreur compétences:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/ressources/:id/competences
 * Ajouter une compétence à une ressource
 */
router.post('/:id/competences', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { service_id, niveau } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: 'service_id requis' });
    }

    const { data: competence, error } = await supabase
      .from('ressource_competences')
      .insert({
        ressource_id: parseInt(id),
        service_id,
        tenant_id: tenantId,
        niveau: niveau || 'standard'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, competence });
  } catch (error) {
    console.error('[RESSOURCES] Erreur ajout compétence:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/ressources/:id/competences/:competenceId
 * Supprimer une compétence
 */
router.delete('/:id/competences/:competenceId', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { competenceId } = req.params;

    const { error } = await supabase
      .from('ressource_competences')
      .delete()
      .eq('id', competenceId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Compétence supprimée' });
  } catch (error) {
    console.error('[RESSOURCES] Erreur suppression compétence:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/ressources/:id/competences/bulk
 * Mettre à jour toutes les compétences d'une ressource en une fois
 */
router.put('/:id/competences/bulk', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { service_ids } = req.body; // Array d'IDs de services

    if (!Array.isArray(service_ids)) {
      return res.status(400).json({ error: 'service_ids doit être un tableau' });
    }

    // Supprimer les anciennes compétences
    await supabase
      .from('ressource_competences')
      .delete()
      .eq('ressource_id', parseInt(id))
      .eq('tenant_id', tenantId);

    // Ajouter les nouvelles
    if (service_ids.length > 0) {
      const competences = service_ids.map(serviceId => ({
        ressource_id: parseInt(id),
        service_id: serviceId,
        tenant_id: tenantId,
        niveau: 'standard'
      }));

      const { error } = await supabase
        .from('ressource_competences')
        .insert(competences);

      if (error) throw error;
    }

    res.json({ success: true, message: `${service_ids.length} compétence(s) configurée(s)` });
  } catch (error) {
    console.error('[RESSOURCES] Erreur bulk compétences:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER: Prochaines disponibilités
// ============================================

/**
 * Fonction helper pour trouver les prochaines disponibilités
 */
async function trouverProchainesDisposHelper(tenantId, ressourceIds, date, heureDebut, dureeMinutes) {
  const suggestions = [];
  const creneaux = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  // Chercher sur les prochaines heures de la même journée
  const heureDebutNum = parseInt(heureDebut.split(':')[0]) * 60 + parseInt(heureDebut.split(':')[1]);

  for (const ressourceId of ressourceIds.slice(0, 3)) { // Max 3 ressources
    const { data: ressource } = await supabase
      .from('ressources')
      .select('id, nom')
      .eq('id', ressourceId)
      .single();

    if (!ressource) continue;

    // Chercher dans les créneaux suivants
    for (const creneau of creneaux) {
      const creneauNum = parseInt(creneau.split(':')[0]) * 60 + parseInt(creneau.split(':')[1]);
      if (creneauNum <= heureDebutNum) continue; // Ignorer les créneaux passés

      // Calculer heure fin
      const finNum = creneauNum + dureeMinutes;
      const heureFin = `${String(Math.floor(finNum / 60)).padStart(2, '0')}:${String(finNum % 60).padStart(2, '0')}`;

      // Vérifier dispo
      const { data: conflits } = await supabase
        .from('prestation_ressources')
        .select(`
          prestation:prestations!inner(heure_debut, heure_fin, statut)
        `)
        .eq('ressource_id', ressourceId)
        .eq('tenant_id', tenantId)
        .eq('prestation.date_debut', date)
        .not('prestation.statut', 'in', '("annulee","facturee")');

      const estLibre = !(conflits || []).some(c => {
        const p = c.prestation;
        return creneau < p.heure_fin && heureFin > p.heure_debut;
      });

      if (estLibre) {
        suggestions.push({
          ressource_id: ressource.id,
          ressource_nom: ressource.nom,
          date,
          heure_debut: creneau,
          heure_fin: heureFin
        });
        break; // Une suggestion par ressource
      }
    }
  }

  return suggestions;
}

export default router;
