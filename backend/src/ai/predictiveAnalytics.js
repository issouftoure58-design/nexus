/**
 * Predictive Analytics - Business Plan
 * Prévisions CA, tendances clients, clustering automatique
 */

import { supabase } from '../config/supabase.js';

/**
 * Prévision CA sur 3 mois
 * Utilise moyenne mobile pondérée
 */
export async function forecastRevenue(tenant_id, months = 3) {
  try {
    // Récupérer CA des 12 derniers mois
    const historique = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const { data } = await supabase
        .from('factures')
        .select('montant_total')
        .eq('tenant_id', tenant_id)
        .eq('statut', 'payee')
        .gte('date_paiement', monthStart.toISOString())
        .lte('date_paiement', monthEnd.toISOString());

      const ca = data?.reduce((sum, f) => sum + parseFloat(f.montant_total || 0), 0) || 0;

      historique.push({
        month: monthStart.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        ca: ca
      });
    }

    // Moyenne mobile pondérée (plus de poids aux mois récents)
    const weights = [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4]; // 12 mois
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

    const growthRate = previous3Months > 0
      ? (last3Months - previous3Months) / previous3Months
      : 0;

    // Prévisions
    const forecasts = [];
    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const forecastValue = avgWeighted * Math.pow(1 + growthRate, i);

      forecasts.push({
        month: forecastMonth.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        predicted_ca: Math.max(0, forecastValue).toFixed(2),
        confidence: calculateForecastConfidence(historique, i)
      });
    }

    return {
      historique,
      forecasts,
      growth_rate: (growthRate * 100).toFixed(2),
      avg_monthly: avgWeighted.toFixed(2)
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
  // Plus on va loin, moins on est confiant
  const baseConfidence = 85;
  const decayRate = 10; // -10% par mois

  // Variabilité des données
  const values = historique.map(h => h.ca);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  // Ajuster confiance selon variabilité
  let confidence = baseConfidence - (monthsAhead * decayRate);

  if (cv > 0.3) confidence -= 15; // Haute variabilité
  else if (cv > 0.15) confidence -= 5; // Variabilité moyenne

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
        derniere_visite,
        rendez_vous(id, prix_total, date)
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
      const rdvs = client.rendez_vous || [];
      const nbRdv = rdvs.length;
      const caTotal = rdvs.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0);

      const createdAt = new Date(client.created_at).getTime();
      const lastVisit = client.derniere_visite ? new Date(client.derniere_visite).getTime() : 0;
      const daysSinceLastVisit = lastVisit ? Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24)) : 999;

      // Nouveaux (< 30 jours)
      if (now - createdAt < day30) {
        trends.nouveaux_30j++;
      }

      // VIP (10+ RDV ou 500€+)
      if (nbRdv >= 10 || caTotal >= 500) {
        trends.vip++;
      }

      // Actifs (visite < 60j)
      if (daysSinceLastVisit < 60) {
        trends.actifs++;
      }
      // À risque (60-120j)
      else if (daysSinceLastVisit < 120) {
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
      evolution
    };
  } catch (error) {
    console.error('[Analytics] Erreur analyse trends:', error);
    throw error;
  }
}

/**
 * Clustering clients automatique (K-means simplifié)
 */
export async function clusterClients(tenant_id) {
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id,
        prenom,
        nom,
        rendez_vous(prix_total, date)
      `)
      .eq('tenant_id', tenant_id);

    // Calculer features pour chaque client
    const features = clients?.map(c => {
      const rdvs = c.rendez_vous || [];
      const nbRdv = rdvs.length;
      const caTotal = rdvs.reduce((sum, r) => sum + (parseFloat(r.prix_total) || 0), 0);

      const lastVisit = rdvs.length > 0
        ? new Date(rdvs[rdvs.length - 1].date)
        : new Date(0);
      const daysSinceLastVisit = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: c.id,
        nom: `${c.prenom} ${c.nom}`,
        frequency: nbRdv, // Fréquence
        monetary: caTotal, // Valeur
        recency: daysSinceLastVisit // Récence
      };
    }) || [];

    // Segmentation simple basée sur règles
    const segments = {
      champions: [],     // Haute freq, haute valeur, récent
      loyaux: [],        // Haute freq, récent
      potentiel: [],     // Basse freq, récent
      a_risque: [],      // Anciens clients de valeur
      hibernants: [],    // Très anciens
      nouveaux: []       // Peu de RDV, récents
    };

    features.forEach(f => {
      if (f.frequency >= 10 && f.monetary >= 500 && f.recency < 60) {
        segments.champions.push(f);
      } else if (f.frequency >= 5 && f.recency < 90) {
        segments.loyaux.push(f);
      } else if (f.frequency < 3 && f.recency < 60) {
        segments.nouveaux.push(f);
      } else if (f.frequency >= 5 && f.recency >= 90 && f.recency < 180) {
        segments.a_risque.push(f);
      } else if (f.recency >= 180) {
        segments.hibernants.push(f);
      } else {
        segments.potentiel.push(f);
      }
    });

    // Stats par segment
    const segmentsStats = Object.entries(segments).map(([name, clients]) => ({
      name,
      count: clients.length,
      percentage: features.length > 0 ? ((clients.length / features.length) * 100).toFixed(1) : '0',
      avg_value: clients.length > 0
        ? (clients.reduce((sum, c) => sum + c.monetary, 0) / clients.length).toFixed(2)
        : '0'
    }));

    return {
      segments: segmentsStats,
      recommendations: generateSegmentRecommendations(segmentsStats)
    };
  } catch (error) {
    console.error('[Analytics] Erreur clustering:', error);
    throw error;
  }
}

/**
 * Recommandations par segment
 */
function generateSegmentRecommendations(segmentsStats) {
  const recommendations = [];

  segmentsStats.forEach(seg => {
    if (seg.name === 'champions' && seg.count > 0) {
      recommendations.push({
        segment: 'Champions',
        action: 'Programme VIP',
        description: `Créer programme fidélité exclusif pour ${seg.count} champions`
      });
    }

    if (seg.name === 'a_risque' && seg.count > 0) {
      recommendations.push({
        segment: 'À risque',
        action: 'Campagne réactivation',
        description: `Offre -20% pour ${seg.count} clients à risque`
      });
    }

    if (seg.name === 'nouveaux' && seg.count > 0) {
      recommendations.push({
        segment: 'Nouveaux',
        action: 'Parcours onboarding',
        description: `Email de bienvenue + bon 2ème visite pour ${seg.count} nouveaux`
      });
    }

    if (seg.name === 'hibernants' && seg.count > 0) {
      recommendations.push({
        segment: 'Hibernants',
        action: 'Campagne win-back',
        description: `Relancer ${seg.count} clients inactifs avec offre spéciale`
      });
    }

    if (seg.name === 'loyaux' && seg.count > 0) {
      recommendations.push({
        segment: 'Loyaux',
        action: 'Upgrade VIP',
        description: `Proposer services premium à ${seg.count} clients fidèles`
      });
    }
  });

  return recommendations;
}

/**
 * Détection patterns anormaux
 */
export async function detectPatterns(tenant_id) {
  try {
    const patterns = [];

    // Pattern 1: Jour de la semaine le plus rentable
    const { data: rdvs } = await supabase
      .from('rendez_vous')
      .select('date, prix_total')
      .eq('tenant_id', tenant_id)
      .neq('statut', 'annule')
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    const byDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const countDay = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    rdvs?.forEach(r => {
      const day = new Date(r.date).getDay();
      byDay[day] += parseFloat(r.prix_total || 0);
      countDay[day]++;
    });

    const avgByDay = Object.entries(byDay).map(([day, total]) => ({
      day: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][parseInt(day)],
      avg: countDay[day] > 0 ? (total / countDay[day]).toFixed(2) : '0',
      count: countDay[day]
    }));

    const bestDay = avgByDay.reduce((best, curr) =>
      parseFloat(curr.avg) > parseFloat(best.avg) ? curr : best
    );

    if (bestDay && bestDay.count > 0) {
      patterns.push({
        type: 'temporal',
        title: 'Jour le plus rentable',
        description: `${bestDay.day} génère en moyenne ${bestDay.avg}€ par RDV`,
        recommendation: `Augmenter capacité le ${bestDay.day}`
      });
    }

    // Pattern 2: Service star
    const { data: services } = await supabase
      .from('rendez_vous')
      .select('service_id, services(nom), prix_total')
      .eq('tenant_id', tenant_id)
      .neq('statut', 'annule')
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    const byService = {};
    services?.forEach(r => {
      const serviceName = r.services?.nom || 'Autre';
      if (!byService[serviceName]) {
        byService[serviceName] = { count: 0, revenue: 0 };
      }
      byService[serviceName].count++;
      byService[serviceName].revenue += parseFloat(r.prix_total || 0);
    });

    const topService = Object.entries(byService)
      .sort((a, b) => b[1].revenue - a[1].revenue)[0];

    if (topService) {
      patterns.push({
        type: 'service',
        title: 'Service le plus rentable',
        description: `${topService[0]}: ${topService[1].count} RDV, ${topService[1].revenue.toFixed(2)}€`,
        recommendation: 'Promouvoir ce service en priorité'
      });
    }

    // Pattern 3: Heure de pointe
    const byHour = {};
    rdvs?.forEach(r => {
      const hour = new Date(r.date).getHours();
      if (!byHour[hour]) byHour[hour] = { count: 0, revenue: 0 };
      byHour[hour].count++;
      byHour[hour].revenue += parseFloat(r.prix_total || 0);
    });

    const peakHour = Object.entries(byHour)
      .sort((a, b) => b[1].count - a[1].count)[0];

    if (peakHour) {
      patterns.push({
        type: 'temporal',
        title: 'Heure de pointe',
        description: `${peakHour[0]}h-${parseInt(peakHour[0]) + 1}h: ${peakHour[1].count} RDV`,
        recommendation: 'Optimiser planning autour de ce créneau'
      });
    }

    // Pattern 4: Panier moyen
    const totalRevenue = rdvs?.reduce((sum, r) => sum + parseFloat(r.prix_total || 0), 0) || 0;
    const avgTicket = rdvs?.length > 0 ? (totalRevenue / rdvs.length).toFixed(2) : '0';

    patterns.push({
      type: 'financial',
      title: 'Panier moyen',
      description: `${avgTicket}€ par RDV sur les 3 derniers mois`,
      recommendation: avgTicket < 50
        ? 'Proposer des services complémentaires'
        : 'Maintenir qualité de service'
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
  detectPatterns
};
