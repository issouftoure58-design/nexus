/**
 * Predictions IA - Business Plan
 * Predictions CA, churn clients, tendances
 */

import { supabase } from '../config/supabase.js';

/**
 * Prediction CA mois prochain
 * Utilise regression lineaire simple sur 6 derniers mois
 */
export async function predictCAnextMonth(tenant_id) {
  try {
    // Recuperer CA des 6 derniers mois
    const data = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const { data: factures } = await supabase
        .from('factures')
        .select('montant_total')
        .eq('tenant_id', tenant_id)
        .eq('statut', 'payee')
        .gte('date_paiement', month.toISOString())
        .lt('date_paiement', nextMonth.toISOString());

      const ca = (factures || []).reduce(
        (sum, f) => sum + parseFloat(f.montant_total || 0), 0
      );
      data.push({ month: 5 - i, ca });
    }

    // Regression lineaire simple : y = ax + b
    const n = data.length;
    if (n === 0) {
      return {
        prediction: '0.00',
        trend: 'stable',
        variationPercent: 0,
        confidence: 0,
        historique: []
      };
    }

    const sumX = data.reduce((sum, d) => sum + d.month, 0);
    const sumY = data.reduce((sum, d) => sum + d.ca, 0);
    const sumXY = data.reduce((sum, d) => sum + (d.month * d.ca), 0);
    const sumX2 = data.reduce((sum, d) => sum + (d.month ** 2), 0);

    const denominator = n * sumX2 - sumX ** 2;
    const a = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const b = (sumY - a * sumX) / n;

    // Prediction pour mois 6 (prochain)
    const prediction = a * 6 + b;

    // Tendance
    const avgCA = sumY / n;
    const trend = prediction > avgCA * 1.05 ? 'hausse' : prediction < avgCA * 0.95 ? 'baisse' : 'stable';
    const variationPercent = avgCA > 0 ? ((prediction - avgCA) / avgCA * 100) : 0;

    // Calcul confiance
    const confidence = calculateConfidence(data);

    return {
      prediction: Math.max(0, prediction).toFixed(2),
      trend,
      variationPercent: parseFloat(variationPercent.toFixed(2)),
      confidence,
      historique: data.map((d, i) => ({
        mois: getMonthName(now.getMonth() - 5 + i),
        ca: d.ca.toFixed(2)
      }))
    };
  } catch (error) {
    console.error('[PREDICTIONS] Erreur prediction CA:', error);
    throw error;
  }
}

/**
 * Calcule score de confiance de la prediction
 */
function calculateConfidence(data) {
  if (data.length < 3) return 30; // Pas assez de donnees

  // Variance des donnees
  const caValues = data.map(d => d.ca);
  const mean = caValues.reduce((a, b) => a + b, 0) / caValues.length;

  if (mean === 0) return 30;

  const variance = caValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / caValues.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient de variation
  const cv = stdDev / mean;

  // Confiance inversement proportionnelle a la variabilite
  let confidence = 100;
  if (cv > 0.5) {
    confidence = 40;
  } else if (cv > 0.2) {
    confidence = 50 + ((0.5 - cv) / 0.3) * 30;
  } else {
    confidence = 80 + ((0.2 - cv) / 0.2) * 20;
  }

  return Math.round(Math.min(95, Math.max(30, confidence)));
}

/**
 * Retourne le nom du mois
 */
function getMonthName(monthIndex) {
  const months = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
  ];
  // Gerer les index negatifs
  const normalizedIndex = ((monthIndex % 12) + 12) % 12;
  return months[normalizedIndex];
}

/**
 * Prediction risque churn client
 */
export async function predictClientChurn(tenant_id, client_id) {
  try {
    // Recuperer client avec ses RDV et avis
    const { data: client, error } = await supabase
      .from('clients')
      .select('*, derniere_visite, nb_visites, montant_total_depense')
      .eq('id', client_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !client) {
      return { score: 0, risk: 'unknown', factors: [], recommendation: null };
    }

    // Recuperer RDV du client
    const { data: rdvs } = await supabase
      .from('reservations')
      .select('date, prix_total, statut')
      .eq('client_id', client_id)
      .eq('tenant_id', tenant_id)
      .order('date', { ascending: false });

    // Recuperer avis du client
    const { data: avis } = await supabase
      .from('avis')
      .select('note, created_at')
      .eq('client_id', client_id)
      .eq('tenant_id', tenant_id);

    let score = 0;
    const factors = [];

    // Facteur 1 : Derniere visite (40%)
    const lastVisit = client.derniere_visite ? new Date(client.derniere_visite) : null;
    const daysSinceVisit = lastVisit
      ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceVisit > 180) {
      score += 40;
      factors.push({ name: 'Inactivite 6+ mois', weight: 40, detail: `${daysSinceVisit} jours` });
    } else if (daysSinceVisit > 90) {
      score += 30;
      factors.push({ name: 'Inactivite 3+ mois', weight: 30, detail: `${daysSinceVisit} jours` });
    } else if (daysSinceVisit > 60) {
      score += 15;
      factors.push({ name: 'Inactivite 2+ mois', weight: 15, detail: `${daysSinceVisit} jours` });
    }

    // Facteur 2 : Frequence RDV (30%)
    const rdvCount = rdvs?.length || 0;
    const rdvsPerMonth = rdvCount / 12; // sur 1 an

    if (rdvsPerMonth < 0.5) {
      score += 30;
      factors.push({ name: 'Frequence faible', weight: 30, detail: `${rdvCount} RDV/an` });
    } else if (rdvsPerMonth < 1) {
      score += 15;
      factors.push({ name: 'Frequence moyenne', weight: 15, detail: `${rdvCount} RDV/an` });
    }

    // Facteur 3 : Montant moyen (20%)
    const montantMoyen = rdvCount > 0
      ? (rdvs || []).reduce((sum, r) => sum + parseFloat(r.prix_total || 0), 0) / rdvCount
      : 0;

    if (montantMoyen < 30) {
      score += 20;
      factors.push({ name: 'Panier faible', weight: 20, detail: `${montantMoyen.toFixed(2)}EUR` });
    } else if (montantMoyen < 50) {
      score += 10;
      factors.push({ name: 'Panier moyen', weight: 10, detail: `${montantMoyen.toFixed(2)}EUR` });
    }

    // Facteur 4 : Avis negatifs (10%)
    const avisNegatifs = (avis || []).filter(a => a.note < 3).length;

    if (avisNegatifs > 0) {
      score += 10;
      factors.push({ name: 'Avis negatif', weight: 10, detail: `${avisNegatifs} avis < 3 etoiles` });
    }

    // Niveau de risque
    let risk = 'low';
    if (score >= 70) risk = 'high';
    else if (score >= 40) risk = 'medium';

    return {
      score,
      risk,
      factors,
      client_info: {
        nom: client.nom,
        prenom: client.prenom,
        derniere_visite: client.derniere_visite,
        nb_visites: client.nb_visites || rdvCount
      },
      recommendation: getChurnRecommendation(risk, factors)
    };
  } catch (error) {
    console.error('[PREDICTIONS] Erreur prediction churn:', error);
    return { score: 0, risk: 'unknown', factors: [], recommendation: null };
  }
}

/**
 * Recommandation selon risque churn
 */
function getChurnRecommendation(risk, factors) {
  if (risk === 'high') {
    return {
      action: 'urgent',
      priority: 'high',
      steps: [
        'Appeler personnellement le client',
        'Offrir bon de reduction -20EUR',
        'Proposer nouveau service adapte'
      ]
    };
  } else if (risk === 'medium') {
    return {
      action: 'preventif',
      priority: 'medium',
      steps: [
        'Envoyer SMS personnalise',
        'Offrir bon -10EUR',
        'Newsletter ciblee'
      ]
    };
  } else {
    return {
      action: 'monitoring',
      priority: 'low',
      steps: ['Continuer suivi habituel']
    };
  }
}

/**
 * Prediction RDV semaine prochaine
 */
export async function predictRdvNextWeek(tenant_id) {
  try {
    // Recuperer RDV des 4 dernieres semaines (meme jour)
    const data = [];
    const now = new Date();

    for (let i = 4; i >= 1; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .gte('date', weekStart.toISOString().split('T')[0])
        .lt('date', weekEnd.toISOString().split('T')[0])
        .neq('statut', 'annule');

      data.push({ week: 4 - i, rdv: count || 0 });
    }

    // Moyenne simple
    const avgRdv = data.reduce((sum, d) => sum + d.rdv, 0) / data.length;

    // Tendance (regression simple)
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.week, 0);
    const sumY = data.reduce((sum, d) => sum + d.rdv, 0);
    const sumXY = data.reduce((sum, d) => sum + (d.week * d.rdv), 0);
    const sumX2 = data.reduce((sum, d) => sum + (d.week ** 2), 0);

    const denominator = n * sumX2 - sumX ** 2;
    const a = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    const prediction = Math.round(avgRdv + a);
    const trend = a > 0.5 ? 'hausse' : a < -0.5 ? 'baisse' : 'stable';

    return {
      prediction: Math.max(0, prediction),
      moyenne: Math.round(avgRdv),
      trend,
      historique: data.map((d, i) => ({
        semaine: `S-${4 - i}`,
        rdv: d.rdv
      })),
      confidence: data.every(d => d.rdv > 0) ? 75 : 50
    };
  } catch (error) {
    console.error('[PREDICTIONS] Erreur prediction RDV:', error);
    throw error;
  }
}

/**
 * Analyse clients a risque de churn
 */
export async function analyzeChurnRisk(tenant_id, limit = 10) {
  try {
    // Recuperer clients avec derniere visite > 60 jours
    const date60j = new Date();
    date60j.setDate(date60j.getDate() - 60);

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, nom, prenom, derniere_visite, nb_visites')
      .eq('tenant_id', tenant_id)
      .lt('derniere_visite', date60j.toISOString())
      .order('derniere_visite', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Analyser chaque client
    const analyses = [];
    for (const client of clients || []) {
      const churnAnalysis = await predictClientChurn(tenant_id, client.id);
      analyses.push({
        client_id: client.id,
        client_nom: `${client.prenom} ${client.nom}`,
        ...churnAnalysis
      });
    }

    // Trier par score de risque decroissant
    analyses.sort((a, b) => b.score - a.score);

    return {
      clients_a_risque: analyses.filter(a => a.risk === 'high').length,
      clients_medium: analyses.filter(a => a.risk === 'medium').length,
      analyses
    };
  } catch (error) {
    console.error('[PREDICTIONS] Erreur analyzeChurnRisk:', error);
    return { clients_a_risque: 0, clients_medium: 0, analyses: [] };
  }
}

export default {
  predictCAnextMonth,
  predictClientChurn,
  predictRdvNextWeek,
  analyzeChurnRisk
};
