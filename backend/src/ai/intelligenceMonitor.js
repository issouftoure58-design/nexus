/**
 * Intelligence Monitor - Surveillance automatique Business
 * Plan BUSINESS Feature
 *
 * Surveille les metriques, detecte les anomalies, suggere des actions
 */

import { supabase } from '../config/supabase.js';

/**
 * Metriques surveillees
 */
export const METRICS = {
  CA_DAILY: 'ca_daily',
  TAUX_REMPLISSAGE: 'taux_remplissage',
  TAUX_ANNULATION: 'taux_annulation',
  DELAI_REPONSE: 'delai_reponse',
  STOCK_BAS: 'stock_bas',
  SATISFACTION: 'satisfaction'
};

/**
 * Seuils d'alerte par metrique
 */
const THRESHOLDS = {
  [METRICS.CA_DAILY]: { warning: -15, alert: -30 }, // variation %
  [METRICS.TAUX_REMPLISSAGE]: { warning: 50, alert: 30 }, // % minimum
  [METRICS.TAUX_ANNULATION]: { warning: 15, alert: 25 }, // % maximum
  [METRICS.SATISFACTION]: { warning: 3.5, alert: 3.0 } // note minimum
};

/**
 * Collecte metrique CA quotidien
 */
export async function collectCADaily(tenant_id) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // CA aujourd'hui
    const { data: facturesAujourdhui, error } = await supabase
      .from('factures')
      .select('montant_ttc')
      .eq('tenant_id', tenant_id)
      .eq('statut', 'payee')
      .gte('date_paiement', today.toISOString());

    if (error) throw error;

    const caToday = (facturesAujourdhui || []).reduce(
      (sum, f) => sum + parseFloat(f.montant_ttc || 0), 0
    );

    // CA J-7 pour comparaison
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekEnd = new Date(lastWeek);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 1);

    const { data: facturesJ7 } = await supabase
      .from('factures')
      .select('montant_ttc')
      .eq('tenant_id', tenant_id)
      .eq('statut', 'payee')
      .gte('date_paiement', lastWeek.toISOString())
      .lt('date_paiement', lastWeekEnd.toISOString());

    const caJ7 = (facturesJ7 || []).reduce(
      (sum, f) => sum + parseFloat(f.montant_ttc || 0), 0
    );

    const variation = caJ7 > 0 ? ((caToday - caJ7) / caJ7 * 100) : 0;

    return {
      metric: METRICS.CA_DAILY,
      value: caToday,
      previous: caJ7,
      variation: parseFloat(variation.toFixed(2)),
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur collectCADaily:', error);
    return null;
  }
}

/**
 * Collecte taux de remplissage agenda
 */
export async function collectTauxRemplissage(tenant_id) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Creneaux disponibles (simplification: 8 creneaux par jour)
    const creneauxTotal = 8;

    // RDV aujourd'hui (non annules)
    const { count, error } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .gte('date', today.toISOString().split('T')[0])
      .lt('date', tomorrow.toISOString().split('T')[0])
      .neq('statut', 'annule');

    if (error) throw error;

    const tauxRemplissage = (count / creneauxTotal * 100);

    return {
      metric: METRICS.TAUX_REMPLISSAGE,
      value: parseFloat(tauxRemplissage.toFixed(2)),
      creneaux_pris: count || 0,
      creneaux_total: creneauxTotal,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur collectTauxRemplissage:', error);
    return null;
  }
}

/**
 * Collecte taux d'annulation (30 derniers jours)
 */
export async function collectTauxAnnulation(tenant_id) {
  try {
    const date30j = new Date();
    date30j.setDate(date30j.getDate() - 30);

    const { data: rdvs, error } = await supabase
      .from('reservations')
      .select('statut')
      .eq('tenant_id', tenant_id)
      .gte('date', date30j.toISOString().split('T')[0]);

    if (error) throw error;

    const total = rdvs?.length || 0;
    const annules = rdvs?.filter(r => r.statut === 'annule').length || 0;
    const tauxAnnulation = total > 0 ? (annules / total * 100) : 0;

    return {
      metric: METRICS.TAUX_ANNULATION,
      value: parseFloat(tauxAnnulation.toFixed(2)),
      annules,
      total,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur collectTauxAnnulation:', error);
    return null;
  }
}

/**
 * Collecte note satisfaction moyenne
 */
export async function collectSatisfaction(tenant_id) {
  try {
    const date30j = new Date();
    date30j.setDate(date30j.getDate() - 30);

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('tenant_id', tenant_id)
      .gte('created_at', date30j.toISOString());

    if (error) throw error;

    const total = reviews?.length || 0;
    const moyenne = total > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total
      : 0;

    return {
      metric: METRICS.SATISFACTION,
      value: parseFloat(moyenne.toFixed(2)),
      nb_avis: total,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur collectSatisfaction:', error);
    return null;
  }
}

/**
 * Collecte alertes stock bas
 */
export async function collectStockBas(tenant_id) {
  try {
    const { data: alertes, error } = await supabase
      .from('alertes_stock')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('resolue', false);

    if (error) throw error;

    const ruptures = (alertes || []).filter(a => a.type_alerte === 'stock_zero').length;
    const stockBas = (alertes || []).filter(a => a.type_alerte === 'stock_bas').length;

    return {
      metric: METRICS.STOCK_BAS,
      value: (alertes || []).length,
      ruptures,
      stock_bas: stockBas,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur collectStockBas:', error);
    return null;
  }
}

/**
 * Detecte anomalies dans les metriques
 */
export function detectAnomaly(metricData) {
  if (!metricData) return [];

  const { metric, value, variation } = metricData;
  const anomalies = [];

  switch (metric) {
    case METRICS.CA_DAILY:
      if (variation < THRESHOLDS[metric].alert) {
        anomalies.push({
          type: 'alert',
          metric,
          message: `CA en forte baisse de ${Math.abs(variation)}% vs J-7`,
          severity: 'high',
          suggestion: 'Lancer une campagne promo urgente ou contacter clients VIP'
        });
      } else if (variation < THRESHOLDS[metric].warning) {
        anomalies.push({
          type: 'warning',
          metric,
          message: `CA en baisse de ${Math.abs(variation)}% vs J-7`,
          severity: 'medium',
          suggestion: 'Relancer clients inactifs ou poster sur reseaux sociaux'
        });
      }
      break;

    case METRICS.TAUX_REMPLISSAGE:
      if (value < THRESHOLDS[metric].alert) {
        anomalies.push({
          type: 'alert',
          metric,
          message: `Taux de remplissage critique : ${value}%`,
          severity: 'high',
          suggestion: 'Publier disponibilites sur Instagram/Facebook immediatement'
        });
      } else if (value < THRESHOLDS[metric].warning) {
        anomalies.push({
          type: 'warning',
          metric,
          message: `Taux de remplissage faible : ${value}%`,
          severity: 'medium',
          suggestion: 'Envoyer SMS promo aux clients reguliers'
        });
      }
      break;

    case METRICS.TAUX_ANNULATION:
      if (value > THRESHOLDS[metric].alert) {
        anomalies.push({
          type: 'alert',
          metric,
          message: `Taux d'annulation tres eleve : ${value}%`,
          severity: 'high',
          suggestion: 'Mettre en place acompte obligatoire et SMS rappel 24h'
        });
      } else if (value > THRESHOLDS[metric].warning) {
        anomalies.push({
          type: 'warning',
          metric,
          message: `Taux d'annulation eleve : ${value}%`,
          severity: 'medium',
          suggestion: 'Envoyer SMS de rappel 24h avant chaque RDV'
        });
      }
      break;

    case METRICS.SATISFACTION:
      if (value > 0 && value < THRESHOLDS[metric].alert) {
        anomalies.push({
          type: 'alert',
          metric,
          message: `Note de satisfaction faible : ${value}/5`,
          severity: 'high',
          suggestion: 'Analyser avis negatifs et contacter clients mecontents'
        });
      } else if (value > 0 && value < THRESHOLDS[metric].warning) {
        anomalies.push({
          type: 'warning',
          metric,
          message: `Note de satisfaction en baisse : ${value}/5`,
          severity: 'medium',
          suggestion: 'Demander feedback aux clients recents'
        });
      }
      break;

    case METRICS.STOCK_BAS:
      if (metricData.ruptures > 0) {
        anomalies.push({
          type: 'alert',
          metric,
          message: `${metricData.ruptures} produit(s) en rupture de stock`,
          severity: 'high',
          suggestion: 'Commander immediatement les produits manquants'
        });
      } else if (value > 3) {
        anomalies.push({
          type: 'warning',
          metric,
          message: `${value} produit(s) avec stock bas`,
          severity: 'medium',
          suggestion: 'Planifier reapprovisionnement cette semaine'
        });
      }
      break;
  }

  return anomalies;
}

/**
 * Job principal de monitoring (execute toutes les heures)
 */
export async function jobIntelligenceMonitoring() {
  console.log('[INTELLIGENCE] Demarrage monitoring...');

  try {
    // Recuperer tous les tenants Business
    const { data: tenants, error: errTenants } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('plan_id', 'business');

    if (errTenants) {
      console.error('[INTELLIGENCE] Erreur recuperation tenants:', errTenants);
      return { success: false, error: errTenants.message };
    }

    let totalAnomalies = 0;

    for (const tenant of tenants || []) {
      const tenant_id = tenant.id;

      // Collecter toutes les metriques
      const [caData, remplissageData, annulationData, satisfactionData, stockData] = await Promise.all([
        collectCADaily(tenant_id),
        collectTauxRemplissage(tenant_id),
        collectTauxAnnulation(tenant_id),
        collectSatisfaction(tenant_id),
        collectStockBas(tenant_id)
      ]);

      // Detecter anomalies
      const allAnomalies = [
        ...detectAnomaly(caData),
        ...detectAnomaly(remplissageData),
        ...detectAnomaly(annulationData),
        ...detectAnomaly(satisfactionData),
        ...detectAnomaly(stockData)
      ];

      // Enregistrer anomalies en base
      if (allAnomalies.length > 0) {
        const { error: errInsert } = await supabase
          .from('intelligence_alertes')
          .insert(
            allAnomalies.map(a => ({
              tenant_id,
              type: a.type,
              metric: a.metric,
              message: a.message,
              severity: a.severity,
              suggestion: a.suggestion,
              statut: 'active'
            }))
          );

        if (errInsert) {
          console.error(`[INTELLIGENCE] Erreur insert alertes pour ${tenant_id}:`, errInsert);
        } else {
          totalAnomalies += allAnomalies.length;
          console.log(`[INTELLIGENCE] ${allAnomalies.length} anomalie(s) detectee(s) pour ${tenant.name || tenant_id}`);
        }
      }

      // Enregistrer metriques dans historique (optionnel)
      await saveMetricsHistory(tenant_id, {
        ca_daily: caData,
        taux_remplissage: remplissageData,
        taux_annulation: annulationData,
        satisfaction: satisfactionData,
        stock_bas: stockData
      });
    }

    console.log(`[INTELLIGENCE] Monitoring termine - ${totalAnomalies} anomalie(s) total`);
    return { success: true, anomalies: totalAnomalies };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur job monitoring:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sauvegarde l'historique des metriques
 */
async function saveMetricsHistory(tenant_id, metrics) {
  try {
    const { error } = await supabase
      .from('intelligence_metrics_history')
      .insert({
        tenant_id,
        metrics: metrics,
        created_at: new Date().toISOString()
      });

    if (error && !error.message.includes('does not exist')) {
      console.error('[INTELLIGENCE] Erreur save metrics history:', error);
    }
  } catch (e) {
    // Table peut ne pas exister, ignorer silencieusement
  }
}

/**
 * Recupere les alertes actives pour un tenant
 */
export async function getActiveAlertes(tenant_id) {
  try {
    const { data, error } = await supabase
      .from('intelligence_alertes')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('statut', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur getActiveAlertes:', error);
    return [];
  }
}

/**
 * Marque une alerte comme resolue
 */
export async function resolveAlerte(alerte_id, tenant_id) {
  try {
    const { error } = await supabase
      .from('intelligence_alertes')
      .update({ statut: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', alerte_id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur resolveAlerte:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ignore une alerte
 */
export async function ignoreAlerte(alerte_id, tenant_id) {
  try {
    const { error } = await supabase
      .from('intelligence_alertes')
      .update({ statut: 'ignored', ignored_at: new Date().toISOString() })
      .eq('id', alerte_id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[INTELLIGENCE] Erreur ignoreAlerte:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupere le dashboard metriques pour un tenant
 */
export async function getMetricsDashboard(tenant_id) {
  const [caData, remplissageData, annulationData, satisfactionData, stockData] = await Promise.all([
    collectCADaily(tenant_id),
    collectTauxRemplissage(tenant_id),
    collectTauxAnnulation(tenant_id),
    collectSatisfaction(tenant_id),
    collectStockBas(tenant_id)
  ]);

  const alertes = await getActiveAlertes(tenant_id);

  return {
    metrics: {
      ca_daily: caData,
      taux_remplissage: remplissageData,
      taux_annulation: annulationData,
      satisfaction: satisfactionData,
      stock_bas: stockData
    },
    alertes,
    timestamp: new Date()
  };
}

export default {
  METRICS,
  collectCADaily,
  collectTauxRemplissage,
  collectTauxAnnulation,
  collectSatisfaction,
  collectStockBas,
  detectAnomaly,
  jobIntelligenceMonitoring,
  getActiveAlertes,
  resolveAlerte,
  ignoreAlerte,
  getMetricsDashboard
};
