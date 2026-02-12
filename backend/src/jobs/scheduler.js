/**
 * Scheduler de jobs - Fat's Hair-Afro
 * Tâches planifiées automatiques
 */

import { sendRemerciement, sendRappelJ1, sendDemandeAvis } from '../services/notificationService.js';
import { getTenantConfig } from '../config/tenants/index.js';
import { traiterToutesRelances } from '../services/relancesService.js';
import { traiterToutesRelancesJ7J14J21 } from './relancesFacturesJob.js';
import { publishScheduledPosts } from './publishScheduledPosts.js';
import { checkStockLevels } from './stockAlertes.js';
import { jobIntelligenceMonitoring } from '../ai/intelligenceMonitor.js';
import { createClient } from '@supabase/supabase-js';

import crypto from 'crypto';

// Supabase client for scheduler queries
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let _supabase = null;
function getSupabase() {
  if (!_supabase && supabaseUrl && supabaseKey) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// ============= CONFIGURATION =============

// Intervalle de vérification (toutes les minutes)
const CHECK_INTERVAL_MS = 60 * 1000;

// Heures d'exécution des jobs
const JOBS_SCHEDULE = {
  remerciements: { hour: 10, minute: 0 },   // 10h00
  rappelsJ1: { hour: 18, minute: 0 },       // 18h00 (ancien système, désactivé)
  demandesAvis: { hour: 14, minute: 0 },    // 14h00 (J+2)
  relance24h: { interval: 5 },              // Toutes les 5 minutes (timing exact 24h)
  relancesFactures: { hour: 9, minute: 0 }, // 09h00 - Relances factures impayées (ancien système)
  relancesJ7J14J21: { hour: 9, minute: 30 }, // 09h30 - Relances J+7, J+14, J+21 (nouveau système)
  socialPublish: { interval: 15 },          // Toutes les 15 minutes (publication posts programmés)
  stockAlertes: { interval: 60 },           // Toutes les heures (vérification stock - Plan PRO)
  intelligenceMonitoring: { interval: 60 }, // Toutes les heures (surveillance IA - Plan Business)
};

// Jobs optionnels (désactivés par défaut)
// Pour activer : ENABLE_AVIS_JOB=true dans .env
const OPTIONAL_JOBS = {
  demandesAvis: process.env.ENABLE_AVIS_JOB === 'true',
};

// URL de base pour les formulaires
const BASE_URL = process.env.BASE_URL || 'https://fatshairafro.fr';

// Secret pour générer les tokens (à définir dans .env)
const AVIS_TOKEN_SECRET = process.env.AVIS_TOKEN_SECRET || 'default-secret-change-in-production';

// Tracking des jobs exécutés aujourd'hui
const executedToday = new Map();

// ============= FONCTIONS DB (TODO: implémenter avec Supabase) =============

/**
 * Récupère les RDV terminés de la veille sans remerciement envoyé
 * @returns {Promise<Array>} Liste des RDV
 */
async function getRdvTerminesHier() {
  const db = getSupabase();
  if (!db) {
    console.log('[Scheduler] ⚠️ Supabase non configuré, skip');
    return [];
  }

  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  const hierStr = hier.toISOString().split('T')[0];

  console.log(`[Scheduler] Recherche RDV terminés du ${hierStr}`);

  const { data, error } = await db
    .from('reservations')
    .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, remerciement_envoye, clients(nom, prenom, telephone, email)')
    .eq('date', hierStr)
    .eq('statut', 'termine')
    .eq('remerciement_envoye', false);

  if (error) {
    console.error('[Scheduler] Erreur query RDV hier:', error.message);
    return [];
  }

  console.log(`[Scheduler] ${data?.length || 0} RDV terminés trouvés`);
  return (data || []).map(r => ({
    ...r,
    client_nom: r.clients?.nom || '',
    client_prenom: r.clients?.prenom || '',
    client_telephone: r.telephone || r.clients?.telephone || '',
    client_email: r.clients?.email || '',
  }));
}

/**
 * Récupère les RDV entre 24h et 30h dans le futur
 * Fenêtre large pour ne rater aucun RDV
 * Le flag relance_24h_envoyee évite les doublons
 *
 * CORRECTION BUG #2: Fenêtre élargie de ±3min à 24-30h
 * @returns {Promise<Array>} Liste des RDV à relancer
 */
async function getRdvDans24h() {
  const db = getSupabase();
  if (!db) {
    console.log('[Scheduler] ⚠️ Supabase non configuré, skip');
    return [];
  }

  const now = new Date();

  // Fenêtre : entre 24h et 30h dans le futur
  // Envoie rappel AU MOINS 24h avant, jusqu'à 30h avant
  const dans24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dans30h = new Date(now.getTime() + 30 * 60 * 60 * 1000);

  // Dates au format YYYY-MM-DD
  const date24h = dans24h.toISOString().split('T')[0];
  const date30h = dans30h.toISOString().split('T')[0];

  // Heures au format HH:MM
  const heure24h = `${String(dans24h.getHours()).padStart(2, '0')}:${String(dans24h.getMinutes()).padStart(2, '0')}`;
  const heure30h = `${String(dans30h.getHours()).padStart(2, '0')}:${String(dans30h.getMinutes()).padStart(2, '0')}`;

  console.log(`[Scheduler] 🔍 Recherche RDV entre 24h et 30h: ${date24h} ${heure24h} → ${date30h} ${heure30h}`);

  // Si les dates sont différentes (fenêtre traverse minuit), on doit faire 2 requêtes
  let allData = [];

  if (date24h === date30h) {
    // Même jour : simple query
    const { data, error } = await db
      .from('reservations')
      .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, tenant_id, relance_24h_envoyee, adresse_client, duree_minutes, clients(nom, prenom, telephone, email)')
      .eq('date', date24h)
      .gte('heure', heure24h)
      .lte('heure', heure30h)
      .in('statut', ['demande', 'confirme'])
      .or('relance_24h_envoyee.is.null,relance_24h_envoyee.eq.false');

    if (error) {
      console.error('[Scheduler] ❌ Erreur query RDV 24h:', error.message);
      return [];
    }
    allData = data || [];
  } else {
    // Fenêtre traverse minuit : 2 requêtes
    // Partie 1 : date24h de heure24h à 23:59
    const { data: data1, error: error1 } = await db
      .from('reservations')
      .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, tenant_id, relance_24h_envoyee, adresse_client, duree_minutes, clients(nom, prenom, telephone, email)')
      .eq('date', date24h)
      .gte('heure', heure24h)
      .in('statut', ['demande', 'confirme'])
      .or('relance_24h_envoyee.is.null,relance_24h_envoyee.eq.false');

    // Partie 2 : date30h de 00:00 à heure30h
    const { data: data2, error: error2 } = await db
      .from('reservations')
      .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, tenant_id, relance_24h_envoyee, adresse_client, duree_minutes, clients(nom, prenom, telephone, email)')
      .eq('date', date30h)
      .lte('heure', heure30h)
      .in('statut', ['demande', 'confirme'])
      .or('relance_24h_envoyee.is.null,relance_24h_envoyee.eq.false');

    if (error1) console.error('[Scheduler] ❌ Erreur query date1:', error1.message);
    if (error2) console.error('[Scheduler] ❌ Erreur query date2:', error2.message);

    allData = [...(data1 || []), ...(data2 || [])];
  }

  console.log(`[Scheduler] 📋 ${allData.length} RDV trouvés pour relance 24h`);
  return allData.map(r => ({
    ...r,
    client_nom: r.clients?.nom || '',
    client_prenom: r.clients?.prenom || '',
    client_telephone: r.telephone || r.clients?.telephone || '',
    client_email: r.clients?.email || '',
  }));
}

/**
 * Récupère les RDV de demain pour rappel J-1 (ancien système - backup)
 * @returns {Promise<Array>} Liste des RDV
 * @deprecated Utiliser getRdvDans24h() pour un timing exact
 */
async function getRdvDemain() {
  const db = getSupabase();
  if (!db) {
    console.log('[Scheduler] ⚠️ Supabase non configuré, skip');
    return [];
  }

  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const demainStr = demain.toISOString().split('T')[0];

  console.log(`[Scheduler] Recherche RDV du ${demainStr} pour rappel J-1`);

  const { data, error } = await db
    .from('reservations')
    .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, rappel_j1_envoye, clients(nom, prenom, telephone, email)')
    .eq('date', demainStr)
    .in('statut', ['demande', 'confirme'])
    .eq('rappel_j1_envoye', false);

  if (error) {
    // Column may not exist yet - graceful degradation
    if (error.message?.includes('rappel_j1_envoye')) {
      console.log('[Scheduler] ⚠️ Colonne rappel_j1_envoye manquante, query sans filtre');
      const { data: fallback } = await db
        .from('reservations')
        .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, clients(nom, prenom, telephone, email)')
        .eq('date', demainStr)
        .in('statut', ['demande', 'confirme']);
      return (fallback || []).map(r => ({
        ...r,
        client_nom: r.clients?.nom || '',
        client_prenom: r.clients?.prenom || '',
        client_telephone: r.telephone || r.clients?.telephone || '',
        client_email: r.clients?.email || '',
      }));
    }
    console.error('[Scheduler] Erreur query RDV demain:', error.message);
    return [];
  }

  console.log(`[Scheduler] ${data?.length || 0} RDV demain trouvés`);
  return (data || []).map(r => ({
    ...r,
    client_nom: r.clients?.nom || '',
    client_prenom: r.clients?.prenom || '',
    client_telephone: r.telephone || r.clients?.telephone || '',
    client_email: r.clients?.email || '',
  }));
}

/**
 * Récupère les RDV d'il y a 2 jours pour demande d'avis
 * @returns {Promise<Array>} Liste des RDV
 */
async function getRdvPourAvis() {
  const db = getSupabase();
  if (!db) return [];

  const j2 = new Date();
  j2.setDate(j2.getDate() - 2);
  const j2Str = j2.toISOString().split('T')[0];

  console.log(`[Scheduler] Recherche RDV du ${j2Str} pour demande d'avis`);

  const { data, error } = await db
    .from('reservations')
    .select('id, service_nom, date, heure, prix_total, client_id, telephone, statut, clients(nom, prenom, telephone, email)')
    .eq('date', j2Str)
    .eq('statut', 'termine');

  if (error) {
    console.error('[Scheduler] Erreur query RDV avis:', error.message);
    return [];
  }

  return (data || []).map(r => ({
    ...r,
    client_nom: r.clients?.nom || '',
    client_prenom: r.clients?.prenom || '',
    client_telephone: r.telephone || r.clients?.telephone || '',
    client_email: r.clients?.email || '',
  }));
}

/**
 * Marque un RDV comme remerciement envoyé
 * @param {string} rdvId - ID du RDV
 */
async function markRemerciementEnvoye(rdvId) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('reservations')
    .update({ remerciement_envoye: true, remerciement_date: new Date().toISOString() })
    .eq('id', rdvId);
  if (error) console.error(`[Scheduler] Erreur mark remerciement RDV ${rdvId}:`, error.message);
  else console.log(`[Scheduler] RDV ${rdvId} marqué comme remerciement envoyé`);
}

/**
 * Marque un RDV comme rappel J-1 envoyé (ancien système)
 * @param {string} rdvId - ID du RDV
 * @deprecated Utiliser markRelance24hEnvoyee()
 */
async function markRappelJ1Envoye(rdvId) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('reservations')
    .update({ rappel_j1_envoye: true, rappel_j1_date: new Date().toISOString() })
    .eq('id', rdvId);
  if (error) console.error(`[Scheduler] Erreur mark rappel RDV ${rdvId}:`, error.message);
  else console.log(`[Scheduler] RDV ${rdvId} marqué comme rappel J-1 envoyé`);
}

/**
 * Marque un RDV comme relance 24h envoyée (nouveau système)
 * CORRECTION BUG #1: Utilise condition atomique pour éviter doublons
 *
 * @param {string} rdvId - ID du RDV
 * @param {string} telephone - Téléphone du client (pour log)
 * @returns {Promise<boolean>} true si marqué avec succès, false si déjà marqué
 */
async function markRelance24hEnvoyee(rdvId, telephone = '') {
  const db = getSupabase();
  if (!db) return false;

  const now = new Date().toISOString();

  // IMPORTANT: Update conditionnel - ne met à jour QUE si pas déjà envoyé
  // Cela évite les doublons en cas de race condition
  const { data, error } = await db
    .from('reservations')
    .update({
      relance_24h_envoyee: true,
      relance_24h_date: now,
      // Aussi mettre à jour l'ancien champ pour compatibilité
      rappel_j1_envoye: true,
      rappel_j1_date: now
    })
    .eq('id', rdvId)
    .or('relance_24h_envoyee.is.null,relance_24h_envoyee.eq.false')
    .select('id');

  if (error) {
    console.error(`[Scheduler] ❌ Erreur mark relance 24h RDV ${rdvId}:`, error.message);
    return false;
  }

  // Si aucune ligne mise à jour, c'est que la relance était déjà envoyée
  if (!data || data.length === 0) {
    console.log(`[Scheduler] ⏭️ RDV ${rdvId} déjà marqué (race condition évitée)`);
    return false;
  }

  console.log(`[Scheduler] ✅ RDV ${rdvId} marqué relance_24h_envoyee=true (tel: ...${telephone.slice(-4) || '****'})`);
  return true;
}

/**
 * Marque un RDV comme avis demandé
 * @param {string} rdvId - ID du RDV
 * @param {string} token - Token généré pour le lien
 */
async function markAvisDemande(rdvId, token) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('reservations')
    .update({ avis_demande: true, avis_date: new Date().toISOString(), avis_token: token })
    .eq('id', rdvId);
  if (error) console.error(`[Scheduler] Erreur mark avis RDV ${rdvId}:`, error.message);
  else console.log(`[Scheduler] RDV ${rdvId} marqué comme avis demandé (token: ${token.substring(0, 8)}...)`);
}

// ============= FONCTIONS UTILITAIRES =============

/**
 * Génère un token sécurisé pour le lien d'avis
 * Le token est basé sur l'ID du RDV + un secret + timestamp
 *
 * @param {string} rdvId - ID du rendez-vous
 * @returns {string} Token hexadécimal de 32 caractères
 */
function generateAvisToken(rdvId) {
  const data = `${rdvId}:${AVIS_TOKEN_SECRET}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Génère le lien complet pour le formulaire d'avis
 *
 * @param {string} rdvId - ID du rendez-vous
 * @param {string} token - Token de sécurité
 * @returns {string} URL complète du formulaire
 */
function generateAvisLink(rdvId, token, tenantId = null) {
  const tc = getTenantConfig(tenantId || 'fatshairafro');
  const baseUrl = `https://${tc.domain || 'fatshairafro.fr'}`;
  return `${baseUrl}/avis?rdv_id=${rdvId}&token=${token}`;
}

// ============= JOBS =============

/**
 * Job: Envoyer les remerciements J+1
 * S'exécute tous les jours à 10h
 * Envoie un message de remerciement aux clients dont le RDV était hier
 */
export async function sendRemerciementsJ1() {
  const jobName = 'sendRemerciementsJ1';
  console.log(`\n[Scheduler] 🎁 Début job: ${jobName}`);

  try {
    // 1. Récupérer les RDV terminés d'hier
    const rdvs = await getRdvTerminesHier();

    if (rdvs.length === 0) {
      console.log(`[Scheduler] Aucun RDV à remercier`);
      return { success: true, sent: 0, errors: 0 };
    }

    console.log(`[Scheduler] ${rdvs.length} RDV à remercier`);

    let sent = 0;
    let errors = 0;

    // 2. Pour chaque RDV, envoyer le remerciement
    for (const rdv of rdvs) {
      try {
        // Vérifier que remerciement pas déjà envoyé (double check)
        if (rdv.remerciement_envoye) {
          console.log(`[Scheduler] RDV ${rdv.id}: remerciement déjà envoyé, skip`);
          continue;
        }

        // Envoyer Email + WhatsApp (tenant-aware)
        const tenantId = rdv.tenant_id || 'fatshairafro';
        const result = await sendRemerciement(rdv, tenantId);

        // Au moins un canal a fonctionné
        if (result.email.success || result.whatsapp.success) {
          await markRemerciementEnvoye(rdv.id);
          sent++;
          console.log(`[Scheduler] ✅ Remerciement envoyé pour RDV ${rdv.id} (${rdv.client_prenom || rdv.client_nom})`);
        } else {
          errors++;
          console.error(`[Scheduler] ❌ Échec remerciement RDV ${rdv.id}:`, {
            email: result.email.error,
            whatsapp: result.whatsapp.error,
          });
        }
      } catch (error) {
        errors++;
        console.error(`[Scheduler] ❌ Erreur RDV ${rdv.id}:`, error.message);
      }
    }

    console.log(`[Scheduler] 🎁 Fin job ${jobName}: ${sent} envoyés, ${errors} erreurs`);
    return { success: true, sent, errors };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Job: Envoyer les relances 24-30h avant le RDV
 * S'exécute toutes les 5 minutes
 * UN SEUL SMS/EMAIL par client grâce au flag relance_24h_envoyee
 *
 * CORRECTION BUG #1: Marquage atomique AVANT envoi pour éviter doublons
 * CORRECTION BUG #2: Fenêtre 24-30h au lieu de ±3 minutes
 */
export async function sendRelance24hJob() {
  const jobName = 'sendRelance24h';
  console.log(`\n[Scheduler] ⏰ Job ${jobName} - ${new Date().toLocaleTimeString('fr-FR')}`);

  try {
    const rdvs = await getRdvDans24h();

    if (rdvs.length === 0) {
      // Log silencieux pour ne pas polluer les logs
      return { success: true, sent: 0, errors: 0, skipped: 0 };
    }

    console.log(`[Scheduler] 📬 ${rdvs.length} RDV candidats pour relance 24h`);

    let sent = 0;
    let errors = 0;
    let skipped = 0;

    for (const rdv of rdvs) {
      try {
        // Vérification préliminaire (peut être déjà filtré par la query)
        if (rdv.relance_24h_envoyee === true) {
          console.log(`[Scheduler] ⏭️ RDV ${rdv.id}: relance déjà envoyée, skip`);
          skipped++;
          continue;
        }

        const telephone = rdv.client_telephone || rdv.telephone;
        if (!telephone) {
          console.log(`[Scheduler] ⚠️ RDV ${rdv.id}: pas de téléphone, skip`);
          skipped++;
          continue;
        }

        // CORRECTION BUG #1: Marquer AVANT d'envoyer (atomique)
        // Si retourne false = déjà marqué par un autre processus
        const marked = await markRelance24hEnvoyee(rdv.id, telephone);
        if (!marked) {
          console.log(`[Scheduler] ⏭️ RDV ${rdv.id}: déjà traité (race condition), skip`);
          skipped++;
          continue;
        }

        console.log(`[Scheduler] 📤 Envoi relance 24h RDV ${rdv.id} - ${rdv.date} ${rdv.heure} - Tel: ...${telephone.slice(-4)}`);

        const acompte = rdv.acompte || 10;
        const tenantId = rdv.tenant_id || 'fatshairafro';
        const result = await sendRappelJ1(rdv, acompte, tenantId);

        // Au moins un canal a fonctionné = succès
        if (result.email.success || result.whatsapp.success) {
          sent++;
          console.log(`[Scheduler] ✅ Relance 24h envoyée: RDV ${rdv.id} - ${rdv.client_prenom || rdv.client_nom} (Email: ${result.email.success ? '✓' : '✗'}, WhatsApp: ${result.whatsapp.success ? '✓' : '✗'})`);
        } else {
          // Même si l'envoi échoue, on garde le flag pour éviter spam
          // L'admin peut voir dans les logs et renvoyer manuellement si besoin
          errors++;
          console.error(`[Scheduler] ❌ Échec relance RDV ${rdv.id} (flag conservé pour éviter spam):`, {
            email: result.email.error,
            whatsapp: result.whatsapp.error
          });
        }
      } catch (error) {
        errors++;
        console.error(`[Scheduler] ❌ Erreur relance RDV ${rdv.id}:`, error.message);
      }
    }

    if (sent > 0 || errors > 0 || skipped > 0) {
      console.log(`[Scheduler] ⏰ Fin ${jobName}: ${sent} envoyés, ${skipped} skippés, ${errors} erreurs`);
    }
    return { success: true, sent, errors, skipped };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Job: Envoyer les rappels J-1 (ancien système - backup)
 * S'exécute tous les jours à 18h
 * @deprecated Utiliser sendRelance24hJob() pour un timing exact
 */
export async function sendRappelsJ1Job() {
  const jobName = 'sendRappelsJ1';
  console.log(`\n[Scheduler] 📅 Début job: ${jobName} (ancien système)`);

  try {
    const rdvs = await getRdvDemain();

    if (rdvs.length === 0) {
      console.log(`[Scheduler] Aucun RDV demain à rappeler`);
      return { success: true, sent: 0, errors: 0 };
    }

    console.log(`[Scheduler] ${rdvs.length} RDV demain à rappeler`);

    let sent = 0;
    let errors = 0;

    for (const rdv of rdvs) {
      try {
        if (rdv.rappel_j1_envoye) {
          continue;
        }

        const acompte = rdv.acompte || 10;
        const tenantId = rdv.tenant_id || 'fatshairafro';
        const result = await sendRappelJ1(rdv, acompte, tenantId);

        if (result.email.success || result.whatsapp.success) {
          await markRappelJ1Envoye(rdv.id);
          sent++;
          console.log(`[Scheduler] ✅ Rappel J-1 envoyé pour RDV ${rdv.id}`);
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
        console.error(`[Scheduler] ❌ Erreur rappel RDV ${rdv.id}:`, error.message);
      }
    }

    console.log(`[Scheduler] 📅 Fin job ${jobName}: ${sent} envoyés, ${errors} erreurs`);
    return { success: true, sent, errors };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Job: Envoyer les demandes d'avis J+2
 * S'exécute tous les jours à 14h
 * Demande un avis aux clients 2 jours après leur RDV
 *
 * ⚠️ OPTIONNEL : Désactivé par défaut
 * Pour activer : ENABLE_AVIS_JOB=true dans .env
 *
 * Certains trouvent les demandes d'avis insistantes.
 * À activer seulement si vous voulez vraiment collecter des avis.
 */
export async function sendDemandeAvisJ2() {
  const jobName = 'sendDemandeAvisJ2';
  console.log(`\n[Scheduler] ⭐ Début job: ${jobName}`);

  try {
    // 1. Récupérer les RDV de J-2 terminés sans avis demandé
    const rdvs = await getRdvPourAvis();

    if (rdvs.length === 0) {
      console.log(`[Scheduler] Aucune demande d'avis à envoyer`);
      return { success: true, sent: 0, errors: 0 };
    }

    console.log(`[Scheduler] ${rdvs.length} demandes d'avis à envoyer`);

    let sent = 0;
    let errors = 0;

    // 2. Pour chaque RDV, envoyer la demande d'avis
    for (const rdv of rdvs) {
      try {
        // Vérifier que avis pas déjà demandé (double check)
        if (rdv.avis_demande) {
          console.log(`[Scheduler] RDV ${rdv.id}: avis déjà demandé, skip`);
          continue;
        }

        // Générer le token sécurisé et le lien
        const tenantId = rdv.tenant_id || 'fatshairafro';
        const token = generateAvisToken(rdv.id);
        const lienAvis = generateAvisLink(rdv.id, token, tenantId);

        console.log(`[Scheduler] Lien avis généré pour RDV ${rdv.id}: ${lienAvis}`);

        // Envoyer via notificationService (Email + WhatsApp, tenant-aware)
        const result = await sendDemandeAvis(rdv, lienAvis, tenantId);

        // Au moins un canal a fonctionné
        if (result.email.success || result.whatsapp.success) {
          await markAvisDemande(rdv.id, token);
          sent++;
          console.log(`[Scheduler] ✅ Demande d'avis envoyée pour RDV ${rdv.id} (${rdv.client_prenom || rdv.client_nom})`);
        } else {
          errors++;
          console.error(`[Scheduler] ❌ Échec demande avis RDV ${rdv.id}:`, {
            email: result.email.error,
            whatsapp: result.whatsapp.error,
          });
        }
      } catch (error) {
        errors++;
        console.error(`[Scheduler] ❌ Erreur demande avis RDV ${rdv.id}:`, error.message);
      }
    }

    console.log(`[Scheduler] ⭐ Fin job ${jobName}: ${sent} envoyés, ${errors} erreurs`);
    return { success: true, sent, errors };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============= SCHEDULER =============

/**
 * Job: Envoyer les relances factures impayées (ancien système 4 niveaux)
 * S'exécute tous les jours à 9h
 * Traite les 4 niveaux de relance (J-15, J+1, J+7, J+15)
 */
export async function sendRelancesFacturesJob() {
  const jobName = 'sendRelancesFactures';
  console.log(`\n[Scheduler] 💰 Début job: ${jobName} - ${new Date().toLocaleString('fr-FR')}`);

  try {
    const result = await traiterToutesRelances();

    console.log(`[Scheduler] 💰 Fin job ${jobName}: ${result.totalEnvoyees || 0} relances envoyées, ${result.totalErreurs || 0} erreurs`);
    return {
      success: true,
      envoyees: result.totalEnvoyees || 0,
      erreurs: result.totalErreurs || 0,
      details: result.details
    };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Job: Envoyer les relances factures J+7, J+14, J+21
 * S'exécute tous les jours à 9h30
 * Nouveau système de relances automatiques
 */
export async function sendRelancesJ7J14J21Job() {
  const jobName = 'sendRelancesJ7J14J21';
  console.log(`\n[Scheduler] 📧 Début job: ${jobName} - ${new Date().toLocaleString('fr-FR')}`);

  try {
    const result = await traiterToutesRelancesJ7J14J21();

    console.log(`[Scheduler] 📧 Fin job ${jobName}: ${result.totalEnvoyees || 0} relances envoyées, ${result.totalErreurs || 0} erreurs`);
    return {
      success: true,
      envoyees: result.totalEnvoyees || 0,
      erreurs: result.totalErreurs || 0,
      details: result.details
    };

  } catch (error) {
    console.error(`[Scheduler] ❌ Erreur job ${jobName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Vérifie si un job doit s'exécuter maintenant
 * @param {string} jobName - Nom du job
 * @param {Object} schedule - { hour, minute }
 * @returns {boolean}
 */
function shouldRunJob(jobName, schedule) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Vérifier l'heure
  if (currentHour !== schedule.hour || currentMinute !== schedule.minute) {
    return false;
  }

  // Vérifier si déjà exécuté aujourd'hui
  const todayKey = `${jobName}_${now.toISOString().split('T')[0]}`;
  if (executedToday.has(todayKey)) {
    return false;
  }

  return true;
}

/**
 * Marque un job comme exécuté aujourd'hui
 * @param {string} jobName
 */
function markJobExecuted(jobName) {
  const todayKey = `${jobName}_${new Date().toISOString().split('T')[0]}`;
  executedToday.set(todayKey, new Date());

  // Nettoyer les anciennes entrées (garder seulement aujourd'hui)
  const today = new Date().toISOString().split('T')[0];
  for (const key of executedToday.keys()) {
    if (!key.endsWith(today)) {
      executedToday.delete(key);
    }
  }
}

// Tracking du dernier run de la relance 24h (toutes les 5 minutes)
let lastRelance24hRun = 0;

// Tracking du dernier run de la publication sociale (toutes les 15 minutes)
let lastSocialPublishRun = 0;

// Tracking du dernier run des alertes stock (toutes les heures)
let lastStockAlertesRun = 0;

// Tracking du dernier run de l'intelligence monitoring (toutes les heures - Plan Business)
let lastIntelligenceMonitoringRun = 0;

/**
 * Boucle principale du scheduler
 */
async function runScheduler() {
  // Job: Remerciements à 10h
  if (shouldRunJob('remerciements', JOBS_SCHEDULE.remerciements)) {
    markJobExecuted('remerciements');
    await sendRemerciementsJ1();
  }

  // Job: Relance 24h exacte (toutes les 5 minutes)
  const now = Date.now();
  const interval = JOBS_SCHEDULE.relance24h.interval * 60 * 1000; // 5 min en ms
  if (now - lastRelance24hRun >= interval) {
    lastRelance24hRun = now;
    await sendRelance24hJob();
  }

  // Job: Rappels J-1 à 18h (DÉSACTIVÉ - remplacé par relance 24h exacte)
  // if (shouldRunJob('rappelsJ1', JOBS_SCHEDULE.rappelsJ1)) {
  //   markJobExecuted('rappelsJ1');
  //   await sendRappelsJ1Job();
  // }

  // Job: Demandes d'avis à 14h (OPTIONNEL - désactivé par défaut)
  if (OPTIONAL_JOBS.demandesAvis && shouldRunJob('demandesAvis', JOBS_SCHEDULE.demandesAvis)) {
    markJobExecuted('demandesAvis');
    await sendDemandeAvisJ2();
  }

  // Job: Relances factures à 9h (ancien système)
  if (shouldRunJob('relancesFactures', JOBS_SCHEDULE.relancesFactures)) {
    markJobExecuted('relancesFactures');
    await sendRelancesFacturesJob();
  }

  // Job: Relances J+7/J+14/J+21 à 9h30 (nouveau système)
  if (shouldRunJob('relancesJ7J14J21', JOBS_SCHEDULE.relancesJ7J14J21)) {
    markJobExecuted('relancesJ7J14J21');
    await sendRelancesJ7J14J21Job();
  }

  // Job: Publication posts programmés (toutes les 15 minutes)
  const socialInterval = JOBS_SCHEDULE.socialPublish.interval * 60 * 1000; // 15 min en ms
  if (now - lastSocialPublishRun >= socialInterval) {
    lastSocialPublishRun = now;
    try {
      await publishScheduledPosts();
    } catch (err) {
      console.error('[Scheduler] Erreur publication sociale:', err.message);
    }
  }

  // Job: Alertes stock (toutes les heures - Plan PRO)
  const stockInterval = JOBS_SCHEDULE.stockAlertes.interval * 60 * 1000; // 60 min en ms
  if (now - lastStockAlertesRun >= stockInterval) {
    lastStockAlertesRun = now;
    try {
      await checkStockLevels();
    } catch (err) {
      console.error('[Scheduler] Erreur alertes stock:', err.message);
    }
  }

  // Job: Intelligence Monitoring (toutes les heures - Plan Business)
  const intelligenceInterval = JOBS_SCHEDULE.intelligenceMonitoring.interval * 60 * 1000; // 60 min en ms
  if (now - lastIntelligenceMonitoringRun >= intelligenceInterval) {
    lastIntelligenceMonitoringRun = now;
    try {
      await jobIntelligenceMonitoring();
    } catch (err) {
      console.error('[Scheduler] Erreur intelligence monitoring:', err.message);
    }
  }
}

// ============= DÉMARRAGE =============

let schedulerInterval = null;

/**
 * Démarre le scheduler
 */
export function startScheduler() {
  if (schedulerInterval) {
    console.warn('[Scheduler] Déjà démarré');
    return;
  }

  console.log('[Scheduler] 🚀 Démarrage du scheduler');
  console.log('[Scheduler] Jobs planifiés:');
  console.log(`  ✅ Relances J+7/J+14/J+21: tous les jours à ${JOBS_SCHEDULE.relancesJ7J14J21.hour}h${String(JOBS_SCHEDULE.relancesJ7J14J21.minute).padStart(2, '0')} (nouveau système)`);
  console.log(`  ✅ Relances factures (legacy): tous les jours à ${JOBS_SCHEDULE.relancesFactures.hour}h${String(JOBS_SCHEDULE.relancesFactures.minute).padStart(2, '0')} (4 niveaux)`);
  console.log(`  ✅ Remerciements J+1: tous les jours à ${JOBS_SCHEDULE.remerciements.hour}h${String(JOBS_SCHEDULE.remerciements.minute).padStart(2, '0')}`);
  console.log(`  ✅ Relance 24h exacte: toutes les ${JOBS_SCHEDULE.relance24h.interval} minutes (timing précis)`);
  console.log(`  ✅ Publication sociale: toutes les ${JOBS_SCHEDULE.socialPublish.interval} minutes (posts programmés)`);
  console.log(`  ✅ Alertes stock: toutes les ${JOBS_SCHEDULE.stockAlertes.interval} minutes (Plan PRO)`);
  console.log(`  ✅ Intelligence IA: toutes les ${JOBS_SCHEDULE.intelligenceMonitoring.interval} minutes (Plan Business)`);
  console.log(`  ⏸️  Rappels J-1 (18h): DÉSACTIVÉ (remplacé par relance 24h exacte)`);

  // Job optionnel - demandes d'avis
  if (OPTIONAL_JOBS.demandesAvis) {
    console.log(`  ✅ Demandes d'avis J+2: tous les jours à ${JOBS_SCHEDULE.demandesAvis.hour}h${String(JOBS_SCHEDULE.demandesAvis.minute).padStart(2, '0')}`);
  } else {
    console.log(`  ⏸️  Demandes d'avis J+2: DÉSACTIVÉ (ENABLE_AVIS_JOB=true pour activer)`);
  }

  // Exécuter immédiatement puis toutes les minutes
  runScheduler();
  schedulerInterval = setInterval(runScheduler, CHECK_INTERVAL_MS);
}

/**
 * Arrête le scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] ⏹️ Scheduler arrêté');
  }
}

/**
 * Exécute un job manuellement (pour tests)
 * @param {string} jobName - 'remerciements' | 'rappelsJ1' | 'relance24h' | 'relancesFactures' | 'demandesAvis'
 */
export async function runJobManually(jobName) {
  console.log(`[Scheduler] 🔧 Exécution manuelle: ${jobName}`);

  switch (jobName) {
    case 'remerciements':
      return await sendRemerciementsJ1();
    case 'rappelsJ1':
      return await sendRappelsJ1Job();
    case 'relance24h':
      return await sendRelance24hJob();
    case 'relancesFactures':
      return await sendRelancesFacturesJob();
    case 'relancesJ7J14J21':
      return await sendRelancesJ7J14J21Job();
    case 'demandesAvis':
      return await sendDemandeAvisJ2();
    case 'stockAlertes':
      return await checkStockLevels();
    case 'intelligenceMonitoring':
      return await jobIntelligenceMonitoring();
    default:
      throw new Error(`Job inconnu: ${jobName}`);
  }
}

/**
 * Vérifie si le job d'avis est activé
 * @returns {boolean}
 */
export function isAvisJobEnabled() {
  return OPTIONAL_JOBS.demandesAvis;
}

// Export par défaut
export default {
  startScheduler,
  stopScheduler,
  runJobManually,
  sendRemerciementsJ1,
  sendRappelsJ1Job,
  sendRelance24hJob,
  sendRelancesFacturesJob,
  sendRelancesJ7J14J21Job,
  sendDemandeAvisJ2,
  checkStockLevels,
  jobIntelligenceMonitoring,
  isAvisJobEnabled,
};
