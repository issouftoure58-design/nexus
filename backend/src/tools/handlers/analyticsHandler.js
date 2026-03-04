/**
 * Analytics Handler — KPI, Predictions, Anomalies, Evolution, Rapport, Comparaison
 * Tools: analytics_kpi, analytics_predictions, analytics_anomalies,
 *        analytics_evolution, analytics_rapport, analytics_comparaison
 *
 * Utilise analyticsService via dynamic import
 */

import logger from '../../config/logger.js';

// ═══════════════════════════════════════════════════════════════
// analytics_kpi — KPI principaux sur une periode
// ═══════════════════════════════════════════════════════════════
async function analytics_kpi(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');
  const { debut, fin } = toolInput;

  const now = new Date();
  const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateFin = fin || now.toISOString().split('T')[0];

  logger.debug(`[ANALYTICS] KPI - ${dateDebut} a ${dateFin} - tenant: ${tenantId}`);

  const kpi = await analyticsService.getKPI(tenantId, dateDebut, dateFin);
  logger.debug(`[ANALYTICS] KPI Result: CA=${kpi.caTotal}, RDV=${kpi.rdvTotal}, Confirmes=${kpi.rdvConfirmes}`);

  return {
    success: true,
    ...kpi
  };
}

// ═══════════════════════════════════════════════════════════════
// analytics_predictions — Predictions IA
// ═══════════════════════════════════════════════════════════════
async function analytics_predictions(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');

  logger.debug(`[ANALYTICS] Predictions - tenant: ${tenantId}`);

  const predictions = await analyticsService.getPredictions(tenantId);

  return {
    success: true,
    ...predictions
  };
}

// ═══════════════════════════════════════════════════════════════
// analytics_anomalies — Detection d'anomalies
// ═══════════════════════════════════════════════════════════════
async function analytics_anomalies(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');

  logger.debug(`[ANALYTICS] Anomalies - tenant: ${tenantId}`);

  const anomalies = await analyticsService.getAnomalies(tenantId);

  return {
    success: true,
    ...anomalies
  };
}

// ═══════════════════════════════════════════════════════════════
// analytics_evolution — Evolution temporelle avec granularite
// ═══════════════════════════════════════════════════════════════
async function analytics_evolution(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');
  const { debut, fin, granularite } = toolInput;

  const now = new Date();
  const dateDebut = debut || new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
  const dateFin = fin || new Date().toISOString().split('T')[0];

  logger.debug(`[ANALYTICS] Evolution - ${dateDebut} a ${dateFin}, ${granularite || 'jour'} - tenant: ${tenantId}`);

  const result = await analyticsService.getEvolution(tenantId, dateDebut, dateFin, granularite || 'jour');

  return {
    success: true,
    ...result,
    granularite: granularite || 'jour'
  };
}

// ═══════════════════════════════════════════════════════════════
// analytics_rapport — Rapport complet sur une periode
// ═══════════════════════════════════════════════════════════════
async function analytics_rapport(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');
  const { debut, fin } = toolInput;

  const now = new Date();
  const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateFin = fin || now.toISOString().split('T')[0];

  logger.debug(`[ANALYTICS] Rapport complet - ${dateDebut} a ${dateFin} - tenant: ${tenantId}`);

  const rapport = await analyticsService.getRapportComplet(tenantId, dateDebut, dateFin);

  return {
    success: true,
    ...rapport
  };
}

// ═══════════════════════════════════════════════════════════════
// analytics_comparaison — Comparer deux periodes
// ═══════════════════════════════════════════════════════════════
async function analytics_comparaison(toolInput, tenantId) {
  const { analyticsService } = await import('../../services/analyticsService.js');
  const { debut1, fin1, debut2, fin2 } = toolInput;

  if (!debut1 || !fin1 || !debut2 || !fin2) {
    return {
      success: false,
      error: 'Parametres requis: debut1, fin1, debut2, fin2'
    };
  }

  logger.debug(`[ANALYTICS] Comparaison - ${debut1}/${fin1} vs ${debut2}/${fin2} - tenant: ${tenantId}`);

  const [kpi1, kpi2] = await Promise.all([
    analyticsService.getKPI(tenantId, debut1, fin1),
    analyticsService.getKPI(tenantId, debut2, fin2)
  ]);

  const diffCA = parseFloat(kpi2.revenus.ca_total_euros) - parseFloat(kpi1.revenus.ca_total_euros);
  const diffRDV = kpi2.rdv.confirmes - kpi1.rdv.confirmes;

  return {
    success: true,
    periode_1: { debut: debut1, fin: fin1, ...kpi1 },
    periode_2: { debut: debut2, fin: fin2, ...kpi2 },
    differences: {
      ca_euros: diffCA.toFixed(2),
      ca_pourcent: parseFloat(kpi1.revenus.ca_total_euros) > 0
        ? ((diffCA / parseFloat(kpi1.revenus.ca_total_euros)) * 100).toFixed(1)
        : '0',
      rdv: diffRDV
    }
  };
}

export const analyticsHandlers = {
  analytics_kpi,
  get_kpi: analytics_kpi,
  analytics_predictions,
  analytics_anomalies,
  analytics_evolution,
  analytics_rapport,
  analytics_comparaison
};
