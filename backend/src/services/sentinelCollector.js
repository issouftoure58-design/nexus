/**
 * SENTINEL Collector
 * Collecte quotidienne des metriques business pour clients Business
 *
 * Fonctionne via cron job chaque nuit a 00:30
 * Calcule KPIs et snapshots pour dashboard analytics
 */

import { supabase } from '../config/supabase.js';
import { sendSMS } from './smsService.js';
import { PRICING as P } from '../config/pricing.js';

// Prix unitaires (EUR) — source unique : config/pricing.js
const PRICING = {
  AI_INPUT_PER_1M: P.anthropic.sonnet.input,
  AI_OUTPUT_PER_1M: P.anthropic.sonnet.output,
  USD_TO_EUR: 1, // Plus de conversion — tout est déjà en EUR

  SMS_FR: P.twilio.sms_outbound_fr,
  SMS_INTL: 0.12,
  VOICE_PER_MIN: P.twilio.voice_per_minute,

  EMAIL_PER_1K: P.email.per_email * 1000,

  STORAGE_PER_GB: 0.021,
};

class SentinelCollector {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Collecte snapshot quotidien pour un tenant
   */
  async collectDailySnapshot(tenantId, dateStr) {
    console.log(`[SENTINEL] Collecting snapshot for ${tenantId} on ${dateStr}`);

    const startOfDay = new Date(dateStr + 'T00:00:00Z');
    const endOfDay = new Date(dateStr + 'T23:59:59Z');

    try {
      // 1. CLIENTS
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, created_at')
        .eq('tenant_id', tenantId);

      const totalClients = allClients?.length || 0;
      const newClients = allClients?.filter(c =>
        new Date(c.created_at) >= startOfDay &&
        new Date(c.created_at) <= endOfDay
      ).length || 0;

      // Clients actifs (avec RDV dans les 30 derniers jours)
      const thirtyDaysAgo = new Date(startOfDay);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activeClientIds } = await supabase
        .from('reservations')
        .select('client_id')
        .eq('tenant_id', tenantId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      const activeClients = new Set(activeClientIds?.map(r => r.client_id) || []).size;

      // 2. RESERVATIONS DU JOUR
      const { data: reservations } = await supabase
        .from('reservations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('date', dateStr);

      const totalReservations = reservations?.length || 0;
      const confirmed = reservations?.filter(r => r.statut === 'confirme').length || 0;
      const cancelled = reservations?.filter(r => r.statut === 'annule').length || 0;
      const completed = reservations?.filter(r => r.statut === 'termine').length || 0;
      const pending = reservations?.filter(r => r.statut === 'en_attente' || r.statut === 'demande').length || 0;
      const noShows = reservations?.filter(r => r.statut === 'no_show').length || 0;

      // 3. REVENUS — source de verite: factures (pas reservations)
      // Les factures ont date_facture = date du paiement (pas date de reservation)
      const { data: factures } = await supabase
        .from('factures')
        .select('montant_ttc, statut')
        .eq('tenant_id', tenantId)
        .eq('date_facture', dateStr)
        .eq('type', 'facture');

      const facturesDuJour = factures || [];
      const revenueTotalCts = facturesDuJour.reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
      const revenuePaidCts = facturesDuJour
        .filter(f => f.statut === 'payee')
        .reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
      const revenueTotal = Math.round(revenueTotalCts) / 100; // centimes → euros
      const revenuePaid = Math.round(revenuePaidCts) / 100;
      const revenuePending = Math.round((revenueTotalCts - revenuePaidCts)) / 100;
      const nbFactures = facturesDuJour.length || totalReservations;
      const averageBasket = nbFactures > 0 ? Math.round(revenueTotalCts / nbFactures) / 100 : 0;

      // 4. TAUX
      const noShowRate = totalReservations > 0 ? (noShows / totalReservations) * 100 : 0;
      const cancellationRate = totalReservations > 0 ? (cancelled / totalReservations) * 100 : 0;
      const completionRate = (confirmed + completed) > 0 ? (completed / (confirmed + completed)) * 100 : 0;

      // 5. USAGE MODULES CRM
      const { count: crmActions } = await supabase
        .from('crm_activities')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      // 6. USAGE MARKETING
      const { count: marketingEmails } = await supabase
        .from('marketing_emails')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      // 7. USAGE IA (conversations)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, messages_count')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      const aiConversations = conversations?.length || 0;
      const aiMessages = conversations?.reduce((sum, c) => sum + (c.messages_count || 0), 0) || 0;

      // 8. SMS ENVOYES
      const { count: smsSent } = await supabase
        .from('sms_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      // 9. TOP SERVICES
      const serviceStats = {};
      reservations?.forEach(r => {
        const serviceName = r.service_nom || 'Autre';
        serviceStats[serviceName] = (serviceStats[serviceName] || 0) + 1;
      });
      const topServices = Object.entries(serviceStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // 10. UPSERT SNAPSHOT
      const { error } = await supabase
        .from('sentinel_daily_snapshots')
        .upsert({
          tenant_id: tenantId,
          date: dateStr,
          total_clients: totalClients,
          new_clients: newClients,
          active_clients: activeClients,
          total_reservations: totalReservations,
          reservations_confirmed: confirmed,
          reservations_cancelled: cancelled,
          reservations_completed: completed,
          reservations_pending: pending,
          no_show_count: noShows,
          revenue_total: revenueTotal,
          revenue_paid: revenuePaid,
          revenue_pending: revenuePending,
          average_basket: averageBasket,
          no_show_rate: noShowRate,
          cancellation_rate: cancellationRate,
          completion_rate: completionRate,
          crm_actions: crmActions || 0,
          marketing_emails_sent: marketingEmails || 0,
          ai_conversations: aiConversations,
          ai_messages_count: aiMessages,
          sms_sent: smsSent || 0,
          top_services: topServices
        }, { onConflict: 'tenant_id,date' });

      if (error) {
        console.error(`[SENTINEL] Snapshot error for ${tenantId}:`, error);
      } else {
        console.log(`[SENTINEL] Snapshot saved for ${tenantId}: ${totalReservations} RDV, ${revenuePaid}€`);
      }

      return { success: !error };

    } catch (error) {
      console.error(`[SENTINEL] Error collecting snapshot for ${tenantId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Collecte couts quotidiens pour un tenant
   */
  async collectDailyCosts(tenantId, dateStr) {
    console.log(`[SENTINEL] Collecting costs for ${tenantId} on ${dateStr}`);

    const startOfDay = new Date(dateStr + 'T00:00:00Z');
    const endOfDay = new Date(dateStr + 'T23:59:59Z');

    try {
      // 1. COUTS IA (tokens Anthropic)
      const { data: aiLogs } = await supabase
        .from('ai_usage_logs')
        .select('input_tokens, output_tokens')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      const aiTokensInput = aiLogs?.reduce((sum, l) => sum + (l.input_tokens || 0), 0) || 0;
      const aiTokensOutput = aiLogs?.reduce((sum, l) => sum + (l.output_tokens || 0), 0) || 0;

      const aiCostUsd = (aiTokensInput / 1000000) * PRICING.AI_INPUT_PER_1M +
                        (aiTokensOutput / 1000000) * PRICING.AI_OUTPUT_PER_1M;
      const aiCostEur = aiCostUsd * PRICING.USD_TO_EUR;

      // 2. COUTS SMS
      const { data: smsLogs } = await supabase
        .from('sms_logs')
        .select('id, destination')
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      const smsSent = smsLogs?.length || 0;
      const smsCostEur = smsSent * PRICING.SMS_FR; // Approximation France

      // 3. COUTS VOIX
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('duration_seconds')
        .eq('tenant_id', tenantId)
        .gte('started_at', startOfDay.toISOString())
        .lte('started_at', endOfDay.toISOString());

      const voiceCalls = callLogs?.length || 0;
      const voiceMinutes = callLogs?.reduce((sum, c) => sum + Math.ceil((c.duration_seconds || 0) / 60), 0) || 0;
      const voiceCostEur = voiceMinutes * PRICING.VOICE_PER_MIN;

      // 4. COUTS EMAIL
      const { count: emailsSent } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      const emailCostEur = ((emailsSent || 0) / 1000) * PRICING.EMAIL_PER_1K * PRICING.USD_TO_EUR;

      // 5. TOTAL
      const totalCostEur = aiCostEur + smsCostEur + voiceCostEur + emailCostEur;

      // 6. COMPARAISON HIER
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayCost } = await supabase
        .from('sentinel_daily_costs')
        .select('total_cost_eur')
        .eq('tenant_id', tenantId)
        .eq('date', yesterdayStr)
        .single();

      const costVsYesterday = yesterdayCost?.total_cost_eur > 0
        ? ((totalCostEur - yesterdayCost.total_cost_eur) / yesterdayCost.total_cost_eur) * 100
        : 0;

      // 7. UPSERT COSTS
      const { error } = await supabase
        .from('sentinel_daily_costs')
        .upsert({
          tenant_id: tenantId,
          date: dateStr,
          ai_tokens_input: aiTokensInput,
          ai_tokens_output: aiTokensOutput,
          ai_cost_eur: Math.round(aiCostEur * 100) / 100,
          sms_sent: smsSent,
          sms_cost_eur: Math.round(smsCostEur * 100) / 100,
          voice_calls: voiceCalls,
          voice_minutes: voiceMinutes,
          voice_cost_eur: Math.round(voiceCostEur * 100) / 100,
          emails_sent: emailsSent || 0,
          emails_cost_eur: Math.round(emailCostEur * 100) / 100,
          total_cost_eur: Math.round(totalCostEur * 100) / 100,
          cost_vs_yesterday_percent: Math.round(costVsYesterday * 10) / 10
        }, { onConflict: 'tenant_id,date' });

      if (error) {
        console.error(`[SENTINEL] Costs error for ${tenantId}:`, error);
      } else {
        console.log(`[SENTINEL] Costs saved for ${tenantId}: ${totalCostEur.toFixed(2)}€`);
      }

      return { success: !error, totalCost: totalCostEur };

    } catch (error) {
      console.error(`[SENTINEL] Error collecting costs for ${tenantId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifie alertes et notifie si seuils depasses
   */
  async checkAlerts(tenantId, dateStr) {
    try {
      // Recuperer snapshot et goals
      const { data: snapshot } = await supabase
        .from('sentinel_daily_snapshots')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('date', dateStr)
        .single();

      const { data: costs } = await supabase
        .from('sentinel_daily_costs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('date', dateStr)
        .single();

      const { data: goals } = await supabase
        .from('sentinel_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (!goals || !goals.notify_alerts) return;

      const alerts = [];

      // Check no-show rate
      if (snapshot?.no_show_rate > goals.alert_no_show_rate_threshold) {
        alerts.push({
          type: 'warning',
          title: 'Taux de no-show eleve',
          message: `Votre taux de no-show est de ${snapshot.no_show_rate.toFixed(1)}% (seuil: ${goals.alert_no_show_rate_threshold}%)`
        });
      }

      // Check cancellation rate
      if (snapshot?.cancellation_rate > goals.alert_cancellation_rate_threshold) {
        alerts.push({
          type: 'warning',
          title: 'Taux annulation eleve',
          message: `Votre taux d'annulation est de ${snapshot.cancellation_rate.toFixed(1)}%`
        });
      }

      // Check daily cost
      if (costs?.total_cost_eur > goals.alert_cost_daily_threshold) {
        alerts.push({
          type: 'warning',
          title: 'Couts journaliers eleves',
          message: `Vos couts du jour sont de ${costs.total_cost_eur.toFixed(2)}€ (seuil: ${goals.alert_cost_daily_threshold}€)`
        });
      }

      // Check low bookings
      if (snapshot?.total_reservations < goals.alert_low_booking_threshold) {
        alerts.push({
          type: 'info',
          title: 'Peu de reservations',
          message: `Seulement ${snapshot.total_reservations} RDV aujourd'hui`
        });
      }

      // Envoyer notifications aux admins du tenant
      for (const alert of alerts) {
        console.log(`[SENTINEL ALERT] ${tenantId}: ${alert.title}`);

        // Persister l'alerte en base
        await supabase.from('sentinel_alerts').insert({
          tenant_id: tenantId,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          date: dateStr,
        }).catch(() => {});

        // Notifier le premier admin par SMS si numéro disponible
        try {
          const { data: admin } = await supabase
            .from('admin_users')
            .select('telephone')
            .eq('tenant_id', tenantId)
            .eq('role', 'owner')
            .limit(1)
            .single();

          if (admin?.telephone) {
            await sendSMS(
              admin.telephone,
              `[NEXUS Sentinel] ${alert.title}\n${alert.message}`,
              tenantId
            );
          }
        } catch (_) { /* non-blocking */ }
      }

      return alerts;

    } catch (error) {
      console.error(`[SENTINEL] Alert check error:`, error);
      return [];
    }
  }

  /**
   * Recupere tenants Business actifs
   */
  async getBusinessTenants() {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name, plan')
      .eq('statut', 'actif')
      .in('plan', ['business', 'enterprise']);

    return tenants || [];
  }

  /**
   * Execute collecte quotidienne pour tous tenants Business
   */
  async runDailyCollection(dateStr = null) {
    if (this.isRunning) {
      console.log('[SENTINEL] Collection already running, skipping');
      return;
    }

    this.isRunning = true;

    // Date par defaut = hier
    if (!dateStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      dateStr = yesterday.toISOString().split('T')[0];
    }

    console.log(`[SENTINEL] Starting daily collection for ${dateStr}`);

    try {
      const tenants = await this.getBusinessTenants();
      console.log(`[SENTINEL] Found ${tenants.length} Business tenants`);

      for (const tenant of tenants) {
        await this.collectDailySnapshot(tenant.id, dateStr);
        await this.collectDailyCosts(tenant.id, dateStr);
        await this.checkAlerts(tenant.id, dateStr);

        // Petit delai entre tenants pour ne pas surcharger
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[SENTINEL] Daily collection completed for ${dateStr}`);

    } catch (error) {
      console.error('[SENTINEL] Daily collection failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Collecte en temps reel (pour dashboard live)
   */
  async collectRealtime(tenantId) {
    const today = new Date().toISOString().split('T')[0];
    await this.collectDailySnapshot(tenantId, today);
    await this.collectDailyCosts(tenantId, today);
    return { collected: true, date: today };
  }

  /**
   * Backfill : rattraper les jours manquants entre deux dates
   * @param {string} fromDate - Date de début (YYYY-MM-DD)
   * @param {string} toDate - Date de fin (YYYY-MM-DD)
   * @returns {object} { success, daysProcessed, errors }
   */
  async backfill(fromDate, toDate) {
    console.log(`[SENTINEL] Backfill: ${fromDate} → ${toDate}`);

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { success: false, error: 'Dates invalides' };
    }

    const tenants = await this.getBusinessTenants();
    if (tenants.length === 0) {
      return { success: false, error: 'Aucun tenant Business actif' };
    }

    let daysProcessed = 0;
    let errors = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      console.log(`[SENTINEL] Backfill jour: ${dateStr}`);

      for (const tenant of tenants) {
        try {
          await this.collectDailySnapshot(tenant.id, dateStr);
          await this.collectDailyCosts(tenant.id, dateStr);
        } catch (err) {
          console.error(`[SENTINEL] Backfill error ${tenant.id} ${dateStr}:`, err.message);
          errors++;
        }
      }

      daysProcessed++;
      current.setDate(current.getDate() + 1);

      // Pause entre chaque jour pour ne pas surcharger
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[SENTINEL] Backfill terminé: ${daysProcessed} jours, ${errors} erreurs`);
    return { success: true, daysProcessed, errors, tenants: tenants.length };
  }

  /**
   * Détecte les trous dans les snapshots et lance un backfill automatique
   */
  async autoBackfillGaps() {
    try {
      const tenants = await this.getBusinessTenants();
      if (tenants.length === 0) return { filled: 0 };

      // Vérifier le dernier snapshot pour le premier tenant
      const { data: lastSnapshot } = await supabase
        .from('sentinel_daily_snapshots')
        .select('date')
        .eq('tenant_id', tenants[0].id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!lastSnapshot) return { filled: 0 };

      const lastDate = new Date(lastSnapshot.date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Si le dernier snapshot est plus vieux qu'hier, backfill
      const diffDays = Math.floor((yesterday - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        const fromDate = new Date(lastDate);
        fromDate.setDate(fromDate.getDate() + 1);
        const fromStr = fromDate.toISOString().split('T')[0];

        console.log(`[SENTINEL] Gap détecté: ${diffDays} jour(s) manquants (${fromStr} → ${yesterdayStr})`);
        return this.backfill(fromStr, yesterdayStr);
      }

      return { filled: 0 };
    } catch (err) {
      console.error('[SENTINEL] autoBackfillGaps error:', err.message);
      return { filled: 0, error: err.message };
    }
  }
}

// Instance singleton
export const sentinelCollector = new SentinelCollector();

export default sentinelCollector;
