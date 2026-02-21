/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   ADMIN PRO TOOLS - Capabilities IA avancées Pro et Business                  ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   executeAdvancedQuery : requêtes complexes en langage naturel                ║
 * ║   createAutomation     : créer automatisations                                ║
 * ║   scheduleTask         : planifier tâches                                     ║
 * ║   analyzePattern       : analyser patterns métier                             ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   Disponible : Plans PRO et BUSINESS uniquement                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { createClient } from '@supabase/supabase-js';
import { predictCAnextMonth, predictClientChurn, analyzeChurnRisk } from './predictions.js';
import { generateSuggestions, generateOptimizationSuggestions } from './suggestions.js';
import { getActiveAlertes, getMetricsDashboard } from './intelligenceMonitor.js';
import { forecastRevenue, clusterClients } from './predictiveAnalytics.js';

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

// ============================================
// TOOL 1: Execute Advanced Query
// ============================================

export const executeAdvancedQueryTool = {
  name: 'executeAdvancedQuery',
  description: `Execute une requête avancée sur les données du tenant.
    Exemples:
    - "Tous les clients inactifs depuis plus de 90 jours"
    - "Top 5 des services les plus réservés ce mois"
    - "Clients qui ont dépensé plus de 500€ cette année"
    - "Taux d'annulation par jour de la semaine"`,

  input_schema: {
    type: 'object',
    properties: {
      query_description: {
        type: 'string',
        description: 'Description en langage naturel de la requête souhaitée'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['query_description', 'tenant_id']
  }
};

export async function executeAdvancedQuery({ query_description, tenant_id }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  const queryLower = query_description.toLowerCase();

  try {
    // Pattern: Clients inactifs depuis X jours
    if (queryLower.includes('inactif') || queryLower.includes('inactive')) {
      const daysMatch = query_description.match(/(\d+)\s*jours?/);
      const days = daysMatch ? parseInt(daysMatch[1]) : 90;
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);

      const { data, error } = await db
        .from('clients')
        .select('id, nom, prenom, email, telephone, derniere_visite, created_at')
        .eq('tenant_id', tenant_id)
        .or(`derniere_visite.lt.${dateLimit.toISOString()},derniere_visite.is.null`)
        .order('derniere_visite', { ascending: true, nullsFirst: true })
        .limit(100);

      if (error) throw error;
      return {
        success: true,
        query_type: 'clients_inactifs',
        results: data,
        count: data.length,
        description: `${data.length} clients inactifs depuis plus de ${days} jours`
      };
    }

    // Pattern: Top X services
    if (queryLower.includes('top') && queryLower.includes('service')) {
      const limitMatch = query_description.match(/top\s*(\d+)/i);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 5;

      const { data, error } = await db
        .from('reservations')
        .select('service_nom')
        .eq('tenant_id', tenant_id)
        .not('service_nom', 'is', null);

      if (error) throw error;

      // Compter par service
      const counts = {};
      (data || []).forEach(r => {
        counts[r.service_nom] = (counts[r.service_nom] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([service, count], i) => ({ rank: i + 1, service, count }));

      return {
        success: true,
        query_type: 'top_services',
        results: sorted,
        count: sorted.length,
        description: `Top ${limit} services les plus réservés`
      };
    }

    // Pattern: Clients qui ont dépensé plus de X€
    if (queryLower.includes('dépensé') || queryLower.includes('depense')) {
      const amountMatch = query_description.match(/(\d+)\s*€/);
      const minAmount = amountMatch ? parseInt(amountMatch[1]) : 500;

      const { data, error } = await db
        .from('reservations')
        .select('client_id, prix_total, clients(nom, prenom, email)')
        .eq('tenant_id', tenant_id)
        .eq('statut', 'termine');

      if (error) throw error;

      // Calculer total par client
      const totals = {};
      (data || []).forEach(r => {
        if (r.client_id) {
          if (!totals[r.client_id]) {
            totals[r.client_id] = {
              client_id: r.client_id,
              nom: r.clients?.nom || 'Inconnu',
              prenom: r.clients?.prenom || '',
              email: r.clients?.email || '',
              total: 0
            };
          }
          totals[r.client_id].total += (r.prix_total || 0) / 100; // Centimes → Euros
        }
      });

      const bigSpenders = Object.values(totals)
        .filter(c => c.total >= minAmount)
        .sort((a, b) => b.total - a.total);

      return {
        success: true,
        query_type: 'big_spenders',
        results: bigSpenders,
        count: bigSpenders.length,
        description: `${bigSpenders.length} clients ont dépensé plus de ${minAmount}€`
      };
    }

    // Pattern: Taux d'annulation
    if (queryLower.includes('annulation') || queryLower.includes('annulé')) {
      const { data, error } = await db
        .from('reservations')
        .select('statut, date')
        .eq('tenant_id', tenant_id);

      if (error) throw error;

      const byDay = { 0: { total: 0, annule: 0 }, 1: { total: 0, annule: 0 }, 2: { total: 0, annule: 0 },
                      3: { total: 0, annule: 0 }, 4: { total: 0, annule: 0 }, 5: { total: 0, annule: 0 },
                      6: { total: 0, annule: 0 } };
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

      (data || []).forEach(r => {
        const day = new Date(r.date).getDay();
        byDay[day].total++;
        if (r.statut === 'annule') byDay[day].annule++;
      });

      const results = Object.entries(byDay).map(([day, stats]) => ({
        jour: days[parseInt(day)],
        total: stats.total,
        annulations: stats.annule,
        taux: stats.total > 0 ? Math.round((stats.annule / stats.total) * 100) : 0
      }));

      return {
        success: true,
        query_type: 'annulation_rate',
        results,
        description: 'Taux d\'annulation par jour de la semaine'
      };
    }

    // Pattern: Chiffre d'affaires
    if (queryLower.includes('chiffre') || queryLower.includes('ca') || queryLower.includes('revenu')) {
      const { data, error } = await db
        .from('reservations')
        .select('prix_total, date')
        .eq('tenant_id', tenant_id)
        .eq('statut', 'termine');

      if (error) throw error;

      const total = (data || []).reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;
      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthTotal = (data || [])
        .filter(r => r.date?.startsWith(thisMonth))
        .reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

      return {
        success: true,
        query_type: 'revenue',
        results: { total_all_time: total, this_month: thisMonthTotal },
        description: `CA total: ${total.toFixed(2)}€, Ce mois: ${thisMonthTotal.toFixed(2)}€`
      };
    }

    return {
      success: false,
      error: 'Pattern de requête non reconnu. Essayez: "clients inactifs depuis X jours", "top X services", "clients qui ont dépensé plus de X€", "taux d\'annulation"'
    };

  } catch (error) {
    console.error('[AdminProTools] Erreur executeAdvancedQuery:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// TOOL 2: Create Automation
// ============================================

export const createAutomationTool = {
  name: 'createAutomation',
  description: `Crée une automation (workflow automatique).
    Exemples:
    - "Relancer automatiquement les clients sans RDV depuis 60 jours"
    - "Envoyer SMS de rappel 24h avant chaque RDV"
    - "Ajouter tag VIP aux clients avec + de 10 RDV"`,

  input_schema: {
    type: 'object',
    properties: {
      automation_description: {
        type: 'string',
        description: 'Description de l\'automation à créer'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['automation_description', 'tenant_id']
  }
};

export async function createAutomation({ automation_description, tenant_id }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  const descLower = automation_description.toLowerCase();

  try {
    const automation = {
      tenant_id,
      nom: automation_description.substring(0, 100),
      description: automation_description,
      actif: true,
      config: {
        created_at: new Date().toISOString(),
        created_by: 'admin_ia_pro'
      }
    };

    // Parser le type d'automation
    if (descLower.includes('relancer') || descLower.includes('inactif')) {
      automation.type = 'relance_client';
      automation.trigger = 'inactivite';
      const daysMatch = automation_description.match(/(\d+)\s*jours?/);
      automation.config.delai_jours = daysMatch ? parseInt(daysMatch[1]) : 60;
    } else if (descLower.includes('rappel') && (descLower.includes('24h') || descLower.includes('rdv'))) {
      automation.type = 'rappel_rdv';
      automation.trigger = 'before_rdv';
      automation.config.delai_heures = 24;
    } else if (descLower.includes('tag')) {
      automation.type = 'auto_tag';
      automation.trigger = 'condition';
      const tagMatch = automation_description.match(/tag\s+(\w+)/i);
      automation.config.tag_name = tagMatch ? tagMatch[1] : 'VIP';
      const rdvMatch = automation_description.match(/(\d+)\s*rdv/i);
      automation.config.min_rdv = rdvMatch ? parseInt(rdvMatch[1]) : 10;
    } else if (descLower.includes('anniversaire') || descLower.includes('birthday')) {
      automation.type = 'anniversaire';
      automation.trigger = 'date_anniversaire';
    } else {
      automation.type = 'custom';
      automation.trigger = 'manual';
    }

    // Parser l'action
    if (descLower.includes('sms')) {
      automation.config.action = 'send_sms';
    } else if (descLower.includes('email') || descLower.includes('mail')) {
      automation.config.action = 'send_email';
    } else if (descLower.includes('whatsapp')) {
      automation.config.action = 'send_whatsapp';
    } else if (descLower.includes('tag')) {
      automation.config.action = 'add_tag';
    } else {
      automation.config.action = 'notification';
    }

    // Ensure tenant_id is explicitly included
    if (!automation.tenant_id) {
      throw new Error('tenant_id is required for creating automation');
    }

    const { data, error } = await db
      .from('automations')
      .insert(automation)
      .select()
      .single();

    if (error) {
      // Table might not exist, try to create it
      if (error.message.includes('does not exist')) {
        return {
          success: true,
          simulated: true,
          automation,
          message: `Automation configurée (à activer): ${automation.nom}`
        };
      }
      throw error;
    }

    return {
      success: true,
      automation: data,
      message: `Automation créée avec succès : ${automation.nom} (${automation.type})`
    };

  } catch (error) {
    console.error('[AdminProTools] Erreur createAutomation:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// TOOL 3: Schedule Task
// ============================================

export const scheduleTaskTool = {
  name: 'scheduleTask',
  description: `Planifie une tâche à exécuter régulièrement.
    Exemples:
    - "Envoyer promo -20% tous les lundis à 9h"
    - "Exporter liste clients tous les 1er du mois"
    - "Rappel stock bas tous les vendredis"`,

  input_schema: {
    type: 'object',
    properties: {
      task_description: {
        type: 'string',
        description: 'Description de la tâche à planifier'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['task_description', 'tenant_id']
  }
};

export async function scheduleTask({ task_description, tenant_id }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  const descLower = task_description.toLowerCase();

  try {
    const task = {
      tenant_id,
      description: task_description,
      actif: true,
      created_at: new Date().toISOString()
    };

    // Parser la fréquence
    if (descLower.includes('lundi')) {
      task.cron = '0 9 * * 1';
      task.frequence = 'Tous les lundis à 9h';
    } else if (descLower.includes('mardi')) {
      task.cron = '0 9 * * 2';
      task.frequence = 'Tous les mardis à 9h';
    } else if (descLower.includes('mercredi')) {
      task.cron = '0 9 * * 3';
      task.frequence = 'Tous les mercredis à 9h';
    } else if (descLower.includes('jeudi')) {
      task.cron = '0 9 * * 4';
      task.frequence = 'Tous les jeudis à 9h';
    } else if (descLower.includes('vendredi')) {
      task.cron = '0 9 * * 5';
      task.frequence = 'Tous les vendredis à 9h';
    } else if (descLower.includes('samedi')) {
      task.cron = '0 9 * * 6';
      task.frequence = 'Tous les samedis à 9h';
    } else if (descLower.includes('dimanche')) {
      task.cron = '0 9 * * 0';
      task.frequence = 'Tous les dimanches à 9h';
    } else if (descLower.includes('1er') || descLower.includes('premier')) {
      task.cron = '0 9 1 * *';
      task.frequence = 'Tous les 1er du mois à 9h';
    } else if (descLower.includes('jour') || descLower.includes('quotidien')) {
      task.cron = '0 9 * * *';
      task.frequence = 'Tous les jours à 9h';
    } else {
      task.cron = '0 9 * * 1'; // Défaut: lundis
      task.frequence = 'Tous les lundis à 9h (défaut)';
    }

    // Parser l'action
    if (descLower.includes('promo') || descLower.includes('promotion')) {
      task.action_type = 'send_promo';
      const discountMatch = task_description.match(/-?(\d+)%/);
      task.action_params = { discount: discountMatch ? parseInt(discountMatch[1]) : 20 };
    } else if (descLower.includes('export')) {
      task.action_type = 'export_data';
      task.action_params = { type: descLower.includes('client') ? 'clients' : 'reservations' };
    } else if (descLower.includes('stock') || descLower.includes('inventaire')) {
      task.action_type = 'check_stock';
      task.action_params = { threshold: 10 };
    } else if (descLower.includes('rapport') || descLower.includes('report')) {
      task.action_type = 'generate_report';
      task.action_params = { type: 'weekly' };
    } else {
      task.action_type = 'custom';
      task.action_params = {};
    }

    // Ensure tenant_id is explicitly included
    if (!task.tenant_id) {
      throw new Error('tenant_id is required for scheduling task');
    }

    const { data, error } = await db
      .from('scheduled_tasks')
      .insert(task)
      .select()
      .single();

    if (error) {
      if (error.message.includes('does not exist')) {
        return {
          success: true,
          simulated: true,
          task,
          message: `Tâche planifiée (simulation): ${task.description} - ${task.frequence}`
        };
      }
      throw error;
    }

    return {
      success: true,
      task: data,
      message: `Tâche planifiée : ${task.description} (${task.frequence})`
    };

  } catch (error) {
    console.error('[AdminProTools] Erreur scheduleTask:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// TOOL 4: Analyze Pattern
// ============================================

export const analyzePatternTool = {
  name: 'analyzePattern',
  description: `Analyse des patterns dans les données métier.
    Exemples:
    - "Quel service marche le mieux le samedi ?"
    - "Quand est-ce qu'on a le plus d'annulations ?"
    - "Quel est le profil type de nos clients VIP ?"
    - "Quels créneaux horaires sont les plus demandés ?"`,

  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Question d\'analyse métier'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['question', 'tenant_id']
  }
};

export async function analyzePattern({ question, tenant_id }) {
  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  const qLower = question.toLowerCase();

  try {
    // Analyse: Services par jour de semaine
    if (qLower.includes('service') && (qLower.includes('jour') || qLower.includes('samedi') || qLower.includes('lundi'))) {
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      let targetDay = null;

      days.forEach((d, i) => {
        if (qLower.includes(d.toLowerCase())) targetDay = i;
      });

      const { data, error } = await db
        .from('reservations')
        .select('service_nom, date')
        .eq('tenant_id', tenant_id)
        .not('service_nom', 'is', null);

      if (error) throw error;

      // Filtrer par jour si spécifié
      const filtered = targetDay !== null
        ? (data || []).filter(r => new Date(r.date).getDay() === targetDay)
        : data || [];

      // Compter par service
      const counts = {};
      filtered.forEach(r => {
        counts[r.service_nom] = (counts[r.service_nom] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const dayName = targetDay !== null ? days[targetDay] : 'tous les jours';

      return {
        success: true,
        analysis_type: 'services_by_day',
        results: sorted.map(([service, count]) => ({ service, count })),
        insight: sorted.length > 0
          ? `Le service le plus demandé ${dayName} est "${sorted[0][0]}" avec ${sorted[0][1]} réservations.`
          : `Pas assez de données pour ${dayName}.`
      };
    }

    // Analyse: Annulations
    if (qLower.includes('annulation') || qLower.includes('annulé')) {
      const { data, error } = await db
        .from('reservations')
        .select('statut, date, heure')
        .eq('tenant_id', tenant_id);

      if (error) throw error;

      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const byDay = {};
      days.forEach((d, i) => { byDay[i] = { total: 0, annule: 0 }; });

      (data || []).forEach(r => {
        const day = new Date(r.date).getDay();
        byDay[day].total++;
        if (r.statut === 'annule') byDay[day].annule++;
      });

      const results = Object.entries(byDay)
        .map(([day, stats]) => ({
          jour: days[parseInt(day)],
          taux: stats.total > 0 ? Math.round((stats.annule / stats.total) * 100) : 0,
          annulations: stats.annule,
          total: stats.total
        }))
        .sort((a, b) => b.taux - a.taux);

      const worst = results[0];

      return {
        success: true,
        analysis_type: 'cancellation_pattern',
        results,
        insight: worst.total > 0
          ? `Le jour avec le plus d'annulations est ${worst.jour} (${worst.taux}% d'annulations sur ${worst.total} RDV).`
          : 'Pas assez de données pour analyser les annulations.'
      };
    }

    // Analyse: Clients VIP / profil
    if (qLower.includes('vip') || qLower.includes('profil') || qLower.includes('meilleur')) {
      const { data, error } = await db
        .from('reservations')
        .select('client_id, prix_total, clients(nom, prenom)')
        .eq('tenant_id', tenant_id)
        .eq('statut', 'termine');

      if (error) throw error;

      // Calculer stats par client
      const clientStats = {};
      (data || []).forEach(r => {
        if (r.client_id) {
          if (!clientStats[r.client_id]) {
            clientStats[r.client_id] = {
              nom: `${r.clients?.prenom || ''} ${r.clients?.nom || ''}`.trim(),
              rdv_count: 0,
              total_spent: 0
            };
          }
          clientStats[r.client_id].rdv_count++;
          clientStats[r.client_id].total_spent += (r.prix_total || 0) / 100;
        }
      });

      const allClients = Object.values(clientStats);
      const vipClients = allClients.filter(c => c.rdv_count >= 10);
      const totalRevenue = allClients.reduce((sum, c) => sum + c.total_spent, 0);
      const vipRevenue = vipClients.reduce((sum, c) => sum + c.total_spent, 0);

      return {
        success: true,
        analysis_type: 'vip_profile',
        results: {
          total_clients: allClients.length,
          vip_clients: vipClients.length,
          vip_percentage: allClients.length > 0 ? Math.round((vipClients.length / allClients.length) * 100) : 0,
          revenue_percentage: totalRevenue > 0 ? Math.round((vipRevenue / totalRevenue) * 100) : 0,
          top_vip: vipClients.sort((a, b) => b.total_spent - a.total_spent).slice(0, 5)
        },
        insight: `Les clients VIP (10+ RDV) représentent ${vipClients.length} clients (${allClients.length > 0 ? Math.round((vipClients.length / allClients.length) * 100) : 0}%) et génèrent ${totalRevenue > 0 ? Math.round((vipRevenue / totalRevenue) * 100) : 0}% du CA.`
      };
    }

    // Analyse: Créneaux horaires
    if (qLower.includes('créneau') || qLower.includes('heure') || qLower.includes('horaire')) {
      const { data, error } = await db
        .from('reservations')
        .select('heure')
        .eq('tenant_id', tenant_id)
        .not('heure', 'is', null);

      if (error) throw error;

      const byHour = {};
      (data || []).forEach(r => {
        const hour = typeof r.heure === 'string' ? parseInt(r.heure.split(':')[0]) : r.heure;
        byHour[hour] = (byHour[hour] || 0) + 1;
      });

      const results = Object.entries(byHour)
        .map(([hour, count]) => ({ heure: `${hour}h`, count }))
        .sort((a, b) => b.count - a.count);

      const peak = results[0];

      return {
        success: true,
        analysis_type: 'time_slots',
        results,
        insight: peak
          ? `Le créneau le plus demandé est ${peak.heure} avec ${peak.count} réservations.`
          : 'Pas assez de données pour analyser les créneaux.'
      };
    }

    return {
      success: false,
      error: 'Type d\'analyse non reconnu. Essayez: "quel service marche le mieux", "taux d\'annulation", "profil clients VIP", "créneaux les plus demandés"'
    };

  } catch (error) {
    console.error('[AdminProTools] Erreur analyzePattern:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// BUSINESS TOOLS - Plan Business uniquement
// ============================================

/**
 * TOOL BUSINESS : Predict Trend
 * Predit tendances CA, RDV, churn
 */
export const predictTrendTool = {
  name: 'predictTrend',
  description: `Predit une tendance metier (CA, RDV, churn clients).
    Exemples:
    - "Quel sera mon CA le mois prochain ?"
    - "Predis l'evolution de mon activite"
    - "Quels clients risquent de partir ?"`,

  input_schema: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: ['ca', 'rdv', 'churn'],
        description: 'Metrique a predire: ca (chiffre affaires), rdv (reservations), churn (risque perte clients)'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['metric', 'tenant_id']
  }
};

export async function predictTrend({ metric, tenant_id }) {
  try {
    if (metric === 'ca') {
      const prediction = await predictCAnextMonth(tenant_id);
      return {
        success: true,
        prediction: prediction.prediction,
        trend: prediction.trend,
        confidence: prediction.confidence,
        historique: prediction.historique,
        message: `Prediction CA mois prochain : ${prediction.prediction}EUR (tendance ${prediction.trend}, confiance ${prediction.confidence}%)`
      };
    }

    if (metric === 'churn') {
      const analysis = await analyzeChurnRisk(tenant_id, 20);
      return {
        success: true,
        clients_a_risque: analysis.clients_a_risque,
        clients_medium: analysis.clients_medium,
        top_at_risk: analysis.analyses.slice(0, 5).map(a => ({
          nom: a.client_nom,
          score: a.score,
          risk: a.risk
        })),
        message: `${analysis.clients_a_risque} client(s) a haut risque de churn detecte(s)`
      };
    }

    return { success: false, error: 'Metrique non supportee. Utilisez: ca, rdv, churn' };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur predictTrend:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TOOL BUSINESS : Suggest Action
 * Suggere des actions basees sur le contexte
 */
export const suggestActionTool = {
  name: 'suggestAction',
  description: `Suggere des actions basees sur le contexte actuel.
    Exemples:
    - "Que dois-je faire pour ameliorer mes ventes ?"
    - "Donne-moi des idees pour remplir mon agenda"
    - "Comment reduire mes annulations ?"`,

  input_schema: {
    type: 'object',
    properties: {
      context_description: {
        type: 'string',
        description: 'Description du contexte ou probleme'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['context_description', 'tenant_id']
  }
};

export async function suggestAction({ context_description, tenant_id }) {
  try {
    // Recuperer metriques et alertes actuelles
    const dashboard = await getMetricsDashboard(tenant_id);

    const context = {
      anomalies: dashboard.alertes,
      metrics: dashboard.metrics,
      predictions: {}
    };

    // Ajouter prediction CA si possible
    try {
      const caPrediction = await predictCAnextMonth(tenant_id);
      context.predictions = {
        ca_next_month: caPrediction.prediction,
        trend: caPrediction.trend
      };
    } catch (e) {
      // Ignorer erreur prediction
    }

    const suggestions = await generateSuggestions(tenant_id, context);

    return {
      success: true,
      suggestions,
      context_summary: {
        alertes_actives: dashboard.alertes?.length || 0,
        ca_daily: dashboard.metrics?.ca_daily?.value || 0,
        taux_remplissage: dashboard.metrics?.taux_remplissage?.value || 0
      },
      message: `${suggestions.length} action(s) recommandee(s)`
    };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur suggestAction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TOOL BUSINESS : Auto Optimize
 * Optimise automatiquement un processus
 */
export const autoOptimizeTool = {
  name: 'autoOptimize',
  description: `Optimise automatiquement un processus metier.
    Exemples:
    - "Optimise ma planification de RDV"
    - "Comment ameliorer ma gestion de stock ?"
    - "Optimise mes tarifs"`,

  input_schema: {
    type: 'object',
    properties: {
      process: {
        type: 'string',
        enum: ['planning', 'pricing', 'stock', 'marketing'],
        description: 'Processus a optimiser: planning, pricing, stock, marketing'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['process', 'tenant_id']
  }
};

export async function autoOptimize({ process, tenant_id }) {
  try {
    const optimization = await generateOptimizationSuggestions(tenant_id, process);

    return {
      success: true,
      title: optimization.title,
      suggestions: optimization.suggestions,
      message: `Optimisation ${process} : ${optimization.suggestions.length} recommandation(s)`
    };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur autoOptimize:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TOOL BUSINESS : Detect Anomaly
 * Detecte des anomalies dans les donnees
 */
export const detectAnomalyTool = {
  name: 'detectAnomaly',
  description: `Detecte des anomalies dans les donnees metier.
    Exemples:
    - "Y a-t-il des anomalies dans mon activite ?"
    - "Detecte les problemes potentiels"
    - "Quelles alertes sont actives ?"`,

  input_schema: {
    type: 'object',
    properties: {
      data_type: {
        type: 'string',
        enum: ['all', 'ca', 'rdv', 'stock', 'satisfaction'],
        description: 'Type de donnees a analyser (all pour tout)'
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['data_type', 'tenant_id']
  }
};

export async function detectAnomaly({ data_type, tenant_id }) {
  try {
    // Recuperer alertes actives
    const alertes = await getActiveAlertes(tenant_id);

    // Filtrer par type si specifie
    let filteredAlertes = alertes;
    if (data_type !== 'all') {
      filteredAlertes = alertes.filter(a => a.metric?.includes(data_type));
    }

    // Grouper par severite
    const bySeverity = {
      high: filteredAlertes.filter(a => a.severity === 'high'),
      medium: filteredAlertes.filter(a => a.severity === 'medium'),
      low: filteredAlertes.filter(a => a.severity === 'low')
    };

    return {
      success: true,
      anomalies: filteredAlertes,
      count: filteredAlertes.length,
      by_severity: {
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length
      },
      critical_alerts: bySeverity.high.map(a => ({
        message: a.message,
        suggestion: a.suggestion
      })),
      message: filteredAlertes.length > 0
        ? `${filteredAlertes.length} anomalie(s) detectee(s) (${bySeverity.high.length} critique(s))`
        : 'Aucune anomalie detectee'
    };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur detectAnomaly:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// BUSINESS TOOLS - Analytics Prédictifs
// ============================================

/**
 * TOOL BUSINESS : Forecast Metric
 * Prédit une métrique business future
 */
export const forecastMetricTool = {
  name: 'forecastMetric',
  description: `Prédit une métrique business future.
    Exemples: "Prévois le CA des 3 prochains mois", "Combien vais-je gagner ce trimestre ?"`,

  input_schema: {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: ['ca', 'clients', 'rdv'],
        description: 'Métrique à prédire'
      },
      months: {
        type: 'number',
        description: 'Nombre de mois à prévoir (1-6)',
        default: 3
      },
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['metric', 'tenant_id']
  }
};

export async function forecastMetric({ metric, months, tenant_id }) {
  try {
    if (metric === 'ca') {
      const forecast = await forecastRevenue(tenant_id, months || 3);
      const totalPredicted = forecast.forecasts.reduce((sum, f) =>
        sum + parseFloat(f.predicted_ca), 0
      );

      return {
        success: true,
        forecast: forecast.forecasts,
        total: totalPredicted.toFixed(2),
        growth_rate: forecast.growth_rate,
        avg_monthly: forecast.avg_monthly,
        historique: forecast.historique.slice(-6),
        message: `Prévision CA sur ${months || 3} mois : ${totalPredicted.toFixed(2)}€ (croissance ${forecast.growth_rate}%)`
      };
    }

    return { success: false, error: 'Métrique non supportée. Utilisez: ca' };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur forecastMetric:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TOOL BUSINESS : Segment Clients
 * Segmente automatiquement les clients
 */
export const segmentClientsTool = {
  name: 'segmentClients',
  description: `Segmente automatiquement les clients.
    Exemples: "Quels sont mes meilleurs clients ?", "Segmente ma base clients"`,

  input_schema: {
    type: 'object',
    properties: {
      tenant_id: {
        type: 'string',
        description: 'ID du tenant'
      }
    },
    required: ['tenant_id']
  }
};

export async function segmentClients({ tenant_id }) {
  try {
    const clusters = await clusterClients(tenant_id);

    // Formater résumé textuel
    const summary = clusters.segments
      .filter(s => s.count > 0)
      .map(s => `${s.name}: ${s.count} clients (${s.percentage}%)`)
      .join(', ');

    return {
      success: true,
      segments: clusters.segments,
      recommendations: clusters.recommendations,
      message: `${clusters.segments.filter(s => s.count > 0).length} segments identifiés: ${summary}`
    };
  } catch (error) {
    console.error('[BUSINESS TOOL] Erreur segmentClients:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// EXPORT TOOLS LIST
// ============================================

// Tools Pro (disponibles Pro et Business)
export const adminProToolsList = [
  executeAdvancedQueryTool,
  createAutomationTool,
  scheduleTaskTool,
  analyzePatternTool
];

// Tools Business uniquement
export const adminBusinessToolsList = [
  predictTrendTool,
  suggestActionTool,
  autoOptimizeTool,
  detectAnomalyTool,
  forecastMetricTool,
  segmentClientsTool
];

export const adminProToolsExecutors = {
  executeAdvancedQuery,
  createAutomation,
  scheduleTask,
  analyzePattern
};

export const adminBusinessToolsExecutors = {
  predictTrend,
  suggestAction,
  autoOptimize,
  detectAnomaly,
  forecastMetric,
  segmentClients
};

/**
 * Retourne les tools disponibles selon le plan
 */
export function getToolsForPlan(plan) {
  const tools = [...adminProToolsList];

  if (plan === 'business') {
    tools.push(...adminBusinessToolsList);
  }

  return tools;
}

/**
 * Retourne les executeurs disponibles selon le plan
 */
export function getExecutorsForPlan(plan) {
  const executors = { ...adminProToolsExecutors };

  if (plan === 'business') {
    Object.assign(executors, adminBusinessToolsExecutors);
  }

  return executors;
}

export default {
  // Pro tools
  tools: adminProToolsList,
  executors: adminProToolsExecutors,
  executeAdvancedQueryTool,
  createAutomationTool,
  scheduleTaskTool,
  analyzePatternTool,
  executeAdvancedQuery,
  createAutomation,
  scheduleTask,
  analyzePattern,

  // Business tools
  businessTools: adminBusinessToolsList,
  businessExecutors: adminBusinessToolsExecutors,
  predictTrendTool,
  suggestActionTool,
  autoOptimizeTool,
  detectAnomalyTool,
  forecastMetricTool,
  segmentClientsTool,
  predictTrend,
  suggestAction,
  autoOptimize,
  detectAnomaly,
  forecastMetric,
  segmentClients,

  // Helpers
  getToolsForPlan,
  getExecutorsForPlan
};
