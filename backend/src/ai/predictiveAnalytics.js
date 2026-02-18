/**
 * Predictive Analytics - Business Plan
 * Prévisions CA, tendances clients, clustering automatique
 *
 * IMPORTANT: Les prix sont stockés en CENTIMES dans la DB
 * Toutes les valeurs monétaires retournées sont en EUROS
 */

import { supabase } from '../config/supabase.js';

// Constantes pour la segmentation
const SEGMENT_RULES = {
  VIP_MIN_RDV: 10,
  VIP_MIN_CA: 500, // en euros
  ACTIF_MAX_DAYS: 60,
  A_RISQUE_MAX_DAYS: 120,
  CHAMPION_MIN_FREQ: 10,
  CHAMPION_MIN_CA: 500, // en euros
  LOYAL_MIN_FREQ: 5,
  LOYAL_MAX_RECENCY: 90,
  NOUVEAU_MAX_FREQ: 3,
  NOUVEAU_MAX_RECENCY: 60,
  HIBERNANT_MIN_RECENCY: 180
};

// Descriptions des segments pour l'UI
const SEGMENT_DESCRIPTIONS = {
  champions: {
    label: 'Champions',
    description: 'Clients fidèles à haute valeur avec activité récente',
    criteria: `≥${SEGMENT_RULES.CHAMPION_MIN_FREQ} RDV ET ≥${SEGMENT_RULES.CHAMPION_MIN_CA}€ CA ET visite <60 jours`,
    color: '#10B981',
    icon: 'trophy'
  },
  loyaux: {
    label: 'Loyaux',
    description: 'Clients réguliers avec bonne fréquence de visite',
    criteria: `≥${SEGMENT_RULES.LOYAL_MIN_FREQ} RDV ET visite <${SEGMENT_RULES.LOYAL_MAX_RECENCY} jours`,
    color: '#3B82F6',
    icon: 'heart'
  },
  potentiel: {
    label: 'Potentiel',
    description: 'Clients avec marge de progression',
    criteria: 'Entre 3-4 RDV OU visite 60-90 jours',
    color: '#8B5CF6',
    icon: 'trending-up'
  },
  nouveaux: {
    label: 'Nouveaux',
    description: 'Clients récents à fidéliser',
    criteria: `<${SEGMENT_RULES.NOUVEAU_MAX_FREQ} RDV ET visite <${SEGMENT_RULES.NOUVEAU_MAX_RECENCY} jours`,
    color: '#F59E0B',
    icon: 'user-plus'
  },
  a_risque: {
    label: 'À risque',
    description: 'Anciens bons clients en perte de contact',
    criteria: `≥${SEGMENT_RULES.LOYAL_MIN_FREQ} RDV ET visite 90-180 jours`,
    color: '#EF4444',
    icon: 'alert-triangle'
  },
  hibernants: {
    label: 'Hibernants',
    description: 'Clients inactifs depuis longtemps',
    criteria: `Visite ≥${SEGMENT_RULES.HIBERNANT_MIN_RECENCY} jours`,
    color: '#6B7280',
    icon: 'moon'
  }
};

/**
 * Calcule les jours depuis la dernière visite d'un client
 * Utilise les RDV passés (pas futurs) pour déterminer l'activité
 */
function calculateDaysSinceLastVisit(reservations) {
  if (!reservations || reservations.length === 0) return 999;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Filtrer les RDV passés et les trier par date décroissante
  const pastRdvs = reservations
    .filter(r => new Date(r.date) <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pastRdvs.length === 0) return 999;

  const lastVisitDate = new Date(pastRdvs[0].date);
  const diffTime = today - lastVisitDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Prévision CA sur 3 mois
 * Utilise moyenne mobile pondérée basée sur les réservations
 */
export async function forecastRevenue(tenant_id, months = 3) {
  try {
    const historique = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Utiliser les réservations terminées pour le CA
      const { data } = await supabase
        .from('reservations')
        .select('prix_total')
        .eq('tenant_id', tenant_id)
        .in('statut', ['termine', 'confirme'])
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      // Convertir centimes en euros
      const ca = data?.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0) / 100 || 0;

      historique.push({
        month: monthStart.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        ca: Math.round(ca * 100) / 100
      });
    }

    // Moyenne mobile pondérée (plus de poids aux mois récents)
    const weights = [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
    let weightedSum = 0;
    let weightsSum = 0;

    historique.forEach((h, i) => {
      weightedSum += h.ca * weights[i];
      weightsSum += weights[i];
    });

    const avgWeighted = weightedSum / weightsSum;

    // Tendance (croissance ou décroissance)
    const last3Months = historique.slice(-3).reduce((sum, h) => sum + h.ca, 0) / 3;
    const previous3Months = historique.slice(-6, -3).reduce((sum, h) => sum + h.ca, 0) / 3;

    let growthRate = 0;
    if (previous3Months > 0) {
      growthRate = (last3Months - previous3Months) / previous3Months;
    } else if (last3Months > 0) {
      // Si pas de données précédentes, estimer une croissance modérée
      growthRate = 0.05; // 5% par défaut
    }

    // Plafonner le taux de croissance à ±50% pour éviter les projections irréalistes
    const MAX_GROWTH_RATE = 0.5;
    const clampedGrowthRate = Math.max(-MAX_GROWTH_RATE, Math.min(MAX_GROWTH_RATE, growthRate));

    // Base pour les prévisions: moyenne des 3 derniers mois (plus réaliste)
    const forecastBase = last3Months > 0 ? last3Months : avgWeighted;

    // Prévisions
    const forecasts = [];
    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const forecastValue = forecastBase * Math.pow(1 + clampedGrowthRate, i);

      forecasts.push({
        month: forecastMonth.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        predicted_ca: Math.max(0, forecastValue).toFixed(2),
        confidence: calculateForecastConfidence(historique, i)
      });
    }

    return {
      historique,
      forecasts,
      growth_rate: (clampedGrowthRate * 100).toFixed(2),
      raw_growth_rate: (growthRate * 100).toFixed(2),
      avg_monthly: avgWeighted.toFixed(2),
      forecast_base: forecastBase.toFixed(2)
    };
  } catch (error) {
    console.error('[Analytics] Erreur forecast revenue:', error);
    throw error;
  }
}

/**
 * Calcule confiance prévision
 */
function calculateForecastConfidence(historique, monthsAhead) {
  const baseConfidence = 85;
  const decayRate = 10;

  const values = historique.map(h => h.ca);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  let confidence = baseConfidence - (monthsAhead * decayRate);

  if (cv > 0.3) confidence -= 15;
  else if (cv > 0.15) confidence -= 5;

  return Math.max(30, Math.min(95, Math.round(confidence)));
}

/**
 * Analyse tendances clients (RFM simplifié)
 */
export async function analyzeClientTrends(tenant_id) {
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id,
        prenom,
        nom,
        email,
        created_at,
        reservations(id, prix_total, date, statut)
      `)
      .eq('tenant_id', tenant_id);

    const trends = {
      nouveaux_30j: 0,
      actifs: 0,
      a_risque: 0,
      perdus: 0,
      vip: 0,
      segments: []
    };

    const now = Date.now();
    const day30 = 30 * 24 * 60 * 60 * 1000;

    clients?.forEach(client => {
      const rdvs = client.reservations || [];
      const nbRdv = rdvs.length;
      // Convertir centimes en euros
      const caTotal = rdvs.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0) / 100;

      const createdAt = new Date(client.created_at).getTime();

      // Calculer jours depuis dernière visite à partir des RDV
      const daysSinceLastVisit = calculateDaysSinceLastVisit(rdvs);

      // Nouveaux (< 30 jours)
      if (now - createdAt < day30) {
        trends.nouveaux_30j++;
      }

      // VIP (10+ RDV ou 500€+)
      if (nbRdv >= SEGMENT_RULES.VIP_MIN_RDV || caTotal >= SEGMENT_RULES.VIP_MIN_CA) {
        trends.vip++;
      }

      // Actifs (visite < 60j)
      if (daysSinceLastVisit < SEGMENT_RULES.ACTIF_MAX_DAYS) {
        trends.actifs++;
      }
      // À risque (60-120j)
      else if (daysSinceLastVisit < SEGMENT_RULES.A_RISQUE_MAX_DAYS) {
        trends.a_risque++;
      }
      // Perdus (>120j)
      else {
        trends.perdus++;
      }
    });

    // Évolution par mois (3 derniers mois)
    const evolution = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 0);

      const clientsCeMois = clients?.filter(c => {
        const created = new Date(c.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length || 0;

      evolution.push({
        month: monthStart.toLocaleDateString('fr-FR', { month: 'short' }),
        nouveaux: clientsCeMois
      });
    }

    return {
      ...trends,
      total: clients?.length || 0,
      evolution,
      // Ajouter les définitions des segments
      segment_definitions: {
        vip: `≥${SEGMENT_RULES.VIP_MIN_RDV} RDV ou ≥${SEGMENT_RULES.VIP_MIN_CA}€ CA total`,
        actifs: `Dernière visite < ${SEGMENT_RULES.ACTIF_MAX_DAYS} jours`,
        a_risque: `Dernière visite entre ${SEGMENT_RULES.ACTIF_MAX_DAYS}-${SEGMENT_RULES.A_RISQUE_MAX_DAYS} jours`,
        perdus: `Dernière visite > ${SEGMENT_RULES.A_RISQUE_MAX_DAYS} jours`,
        nouveaux_30j: 'Client créé dans les 30 derniers jours'
      }
    };
  } catch (error) {
    console.error('[Analytics] Erreur analyse trends:', error);
    throw error;
  }
}

/**
 * Clustering clients automatique (RFM)
 * Retourne les segments avec détails des clients
 */
export async function clusterClients(tenant_id) {
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id,
        prenom,
        nom,
        email,
        telephone,
        reservations(prix_total, date, statut)
      `)
      .eq('tenant_id', tenant_id);

    // Calculer features pour chaque client
    const features = clients?.map(c => {
      const rdvs = c.reservations || [];
      const nbRdv = rdvs.length;
      // Convertir centimes en euros
      const caTotal = rdvs.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0) / 100;

      // Calculer récence à partir des RDV passés
      const daysSinceLastVisit = calculateDaysSinceLastVisit(rdvs);

      return {
        id: c.id,
        nom: `${c.prenom} ${c.nom}`,
        email: c.email,
        telephone: c.telephone,
        frequency: nbRdv,
        monetary: Math.round(caTotal * 100) / 100, // en euros
        recency: daysSinceLastVisit
      };
    }) || [];

    // Segmentation basée sur règles RFM
    const segments = {
      champions: [],
      loyaux: [],
      potentiel: [],
      nouveaux: [],
      a_risque: [],
      hibernants: []
    };

    features.forEach(f => {
      // Champions: haute fréquence, haute valeur, récent
      if (f.frequency >= SEGMENT_RULES.CHAMPION_MIN_FREQ &&
          f.monetary >= SEGMENT_RULES.CHAMPION_MIN_CA &&
          f.recency < SEGMENT_RULES.ACTIF_MAX_DAYS) {
        segments.champions.push(f);
      }
      // Loyaux: haute fréquence, récent
      else if (f.frequency >= SEGMENT_RULES.LOYAL_MIN_FREQ &&
               f.recency < SEGMENT_RULES.LOYAL_MAX_RECENCY) {
        segments.loyaux.push(f);
      }
      // Nouveaux: peu de RDV, récent
      else if (f.frequency < SEGMENT_RULES.NOUVEAU_MAX_FREQ &&
               f.recency < SEGMENT_RULES.NOUVEAU_MAX_RECENCY) {
        segments.nouveaux.push(f);
      }
      // À risque: anciens bons clients
      else if (f.frequency >= SEGMENT_RULES.LOYAL_MIN_FREQ &&
               f.recency >= SEGMENT_RULES.LOYAL_MAX_RECENCY &&
               f.recency < SEGMENT_RULES.HIBERNANT_MIN_RECENCY) {
        segments.a_risque.push(f);
      }
      // Hibernants: très anciens
      else if (f.recency >= SEGMENT_RULES.HIBERNANT_MIN_RECENCY) {
        segments.hibernants.push(f);
      }
      // Potentiel: tous les autres
      else {
        segments.potentiel.push(f);
      }
    });

    // Stats par segment avec détails
    const segmentsStats = Object.entries(segments).map(([name, clientsList]) => ({
      name,
      ...SEGMENT_DESCRIPTIONS[name],
      count: clientsList.length,
      percentage: features.length > 0 ? ((clientsList.length / features.length) * 100).toFixed(1) : '0',
      avg_value: clientsList.length > 0
        ? (clientsList.reduce((sum, c) => sum + c.monetary, 0) / clientsList.length).toFixed(2)
        : '0',
      total_value: clientsList.reduce((sum, c) => sum + c.monetary, 0).toFixed(2),
      // Inclure la liste des clients pour le détail
      clients: clientsList.map(c => ({
        id: c.id,
        nom: c.nom,
        email: c.email,
        telephone: c.telephone,
        nb_rdv: c.frequency,
        ca_total: c.monetary,
        jours_depuis_visite: c.recency
      }))
    }));

    return {
      segments: segmentsStats,
      recommendations: generateSegmentRecommendations(segmentsStats),
      total_clients: features.length,
      segment_rules: SEGMENT_RULES
    };
  } catch (error) {
    console.error('[Analytics] Erreur clustering:', error);
    throw error;
  }
}

/**
 * Recommandations par segment avec actions exécutables
 */
function generateSegmentRecommendations(segmentsStats) {
  const recommendations = [];

  segmentsStats.forEach(seg => {
    if (seg.name === 'champions' && seg.count > 0) {
      recommendations.push({
        segment: 'Champions',
        segment_key: 'champions',
        action: 'Programme VIP',
        action_type: 'vip_program',
        description: `Créer programme fidélité exclusif pour ${seg.count} champions`,
        priority: 'low',
        clients_count: seg.count,
        potential_impact: 'Rétention des meilleurs clients'
      });
    }

    if (seg.name === 'a_risque' && seg.count > 0) {
      recommendations.push({
        segment: 'À risque',
        segment_key: 'a_risque',
        action: 'Campagne réactivation',
        action_type: 'reactivation_campaign',
        description: `Offre -20% pour ${seg.count} clients à risque`,
        priority: 'high',
        clients_count: seg.count,
        potential_impact: `Récupérer ${(seg.count * 0.3).toFixed(0)} clients potentiels`
      });
    }

    if (seg.name === 'nouveaux' && seg.count > 0) {
      recommendations.push({
        segment: 'Nouveaux',
        segment_key: 'nouveaux',
        action: 'Parcours onboarding',
        action_type: 'onboarding',
        description: `Email de bienvenue + bon 2ème visite pour ${seg.count} nouveaux`,
        priority: 'medium',
        clients_count: seg.count,
        potential_impact: 'Fidélisation des nouveaux clients'
      });
    }

    if (seg.name === 'hibernants' && seg.count > 0) {
      recommendations.push({
        segment: 'Hibernants',
        segment_key: 'hibernants',
        action: 'Campagne win-back',
        action_type: 'winback_campaign',
        description: `Relancer ${seg.count} clients inactifs avec offre spéciale`,
        priority: 'medium',
        clients_count: seg.count,
        potential_impact: `Réactiver ${(seg.count * 0.15).toFixed(0)} clients potentiels`
      });
    }

    if (seg.name === 'loyaux' && seg.count > 0) {
      recommendations.push({
        segment: 'Loyaux',
        segment_key: 'loyaux',
        action: 'Upgrade VIP',
        action_type: 'vip_upgrade',
        description: `Proposer services premium à ${seg.count} clients fidèles`,
        priority: 'medium',
        clients_count: seg.count,
        potential_impact: 'Augmentation panier moyen'
      });
    }

    if (seg.name === 'potentiel' && seg.count > 0) {
      recommendations.push({
        segment: 'Potentiel',
        segment_key: 'potentiel',
        action: 'Incitation fréquence',
        action_type: 'frequency_boost',
        description: `Offre "3ème visite offerte" pour ${seg.count} clients à potentiel`,
        priority: 'medium',
        clients_count: seg.count,
        potential_impact: 'Augmentation fréquence de visite'
      });
    }
  });

  // Trier par priorité
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Détection patterns
 */
export async function detectPatterns(tenant_id) {
  try {
    const patterns = [];

    // Récupérer les RDV avec heure
    const { data: rdvs } = await supabase
      .from('reservations')
      .select('date, heure, prix_total, service_nom')
      .eq('tenant_id', tenant_id)
      .neq('statut', 'annule')
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (!rdvs || rdvs.length === 0) {
      return [{
        type: 'info',
        title: 'Données insuffisantes',
        description: 'Pas assez de RDV sur les 3 derniers mois pour détecter des patterns',
        recommendation: 'Continuer à collecter des données'
      }];
    }

    // Pattern 1: Jour de la semaine le plus rentable
    const byDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const countDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    rdvs.forEach(r => {
      const day = new Date(r.date).getDay();
      // Convertir centimes en euros
      byDay[day] += (parseFloat(r.prix_total) || 0) / 100;
      countDay[day]++;
    });

    const avgByDay = Object.entries(byDay).map(([day, total]) => ({
      day: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][parseInt(day)],
      avg: countDay[day] > 0 ? (total / countDay[day]).toFixed(2) : '0',
      count: countDay[day],
      total: total.toFixed(2)
    }));

    const bestDay = avgByDay.reduce((best, curr) =>
      parseFloat(curr.avg) > parseFloat(best.avg) ? curr : best
    );

    if (bestDay && bestDay.count > 0) {
      patterns.push({
        type: 'temporal',
        title: 'Jour le plus rentable',
        description: `${bestDay.day} génère en moyenne ${bestDay.avg}€ par RDV (${bestDay.count} RDV, ${bestDay.total}€ total)`,
        recommendation: `Augmenter capacité le ${bestDay.day}`,
        data: avgByDay
      });
    }

    // Pattern 2: Service star
    const byService = {};
    rdvs.forEach(r => {
      const serviceName = r.service_nom || 'Autre';
      if (!byService[serviceName]) {
        byService[serviceName] = { count: 0, revenue: 0 };
      }
      byService[serviceName].count++;
      // Convertir centimes en euros
      byService[serviceName].revenue += (parseFloat(r.prix_total) || 0) / 100;
    });

    const sortedServices = Object.entries(byService)
      .sort((a, b) => b[1].revenue - a[1].revenue);

    const topService = sortedServices[0];

    if (topService) {
      patterns.push({
        type: 'service',
        title: 'Service le plus rentable',
        description: `${topService[0]}: ${topService[1].count} RDV, ${topService[1].revenue.toFixed(2)}€`,
        recommendation: 'Promouvoir ce service en priorité',
        data: sortedServices.slice(0, 5).map(([name, stats]) => ({
          name,
          count: stats.count,
          revenue: stats.revenue.toFixed(2)
        }))
      });
    }

    // Pattern 3: Heure de pointe (utiliser le champ heure)
    const byHour = {};
    rdvs.forEach(r => {
      if (r.heure) {
        const hour = parseInt(r.heure.split(':')[0]);
        if (!byHour[hour]) byHour[hour] = { count: 0, revenue: 0 };
        byHour[hour].count++;
        byHour[hour].revenue += (parseFloat(r.prix_total) || 0) / 100;
      }
    });

    const sortedHours = Object.entries(byHour)
      .sort((a, b) => b[1].count - a[1].count);

    const peakHour = sortedHours[0];

    if (peakHour) {
      patterns.push({
        type: 'temporal',
        title: 'Heure de pointe',
        description: `${peakHour[0]}h-${parseInt(peakHour[0]) + 1}h: ${peakHour[1].count} RDV (${peakHour[1].revenue.toFixed(2)}€)`,
        recommendation: 'Optimiser planning autour de ce créneau',
        data: sortedHours.slice(0, 5).map(([hour, stats]) => ({
          hour: `${hour}h`,
          count: stats.count,
          revenue: stats.revenue.toFixed(2)
        }))
      });
    }

    // Pattern 4: Panier moyen
    const totalRevenue = rdvs.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0) / 100;
    const avgTicket = rdvs.length > 0 ? (totalRevenue / rdvs.length) : 0;

    patterns.push({
      type: 'financial',
      title: 'Panier moyen',
      description: `${avgTicket.toFixed(2)}€ par RDV sur les 3 derniers mois (${rdvs.length} RDV, ${totalRevenue.toFixed(2)}€ total)`,
      recommendation: avgTicket < 50
        ? 'Proposer des services complémentaires pour augmenter le panier'
        : 'Maintenir qualité de service',
      data: {
        avg_ticket: avgTicket.toFixed(2),
        total_rdv: rdvs.length,
        total_revenue: totalRevenue.toFixed(2)
      }
    });

    return patterns;
  } catch (error) {
    console.error('[Analytics] Erreur detect patterns:', error);
    return [];
  }
}

export default {
  forecastRevenue,
  analyzeClientTrends,
  clusterClients,
  detectPatterns,
  SEGMENT_DESCRIPTIONS,
  SEGMENT_RULES
};
