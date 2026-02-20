/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   RFM SEGMENTATION SERVICE                                                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   Analyse RFM (Recency, Frequency, Monetary) pour segmentation clients        ║
 * ║   Basé sur les meilleures pratiques industrie beauté/bien-être                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Sources:
 * - https://www.passteam.io/customer-segmentation-in-a-beauty-salon
 * - https://www.putler.com/rfm-analysis/
 * - https://clevertap.com/blog/rfm-analysis/
 */

import { supabase } from '../config/supabase.js';

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION RFM
// ════════════════════════════════════════════════════════════════════

// Seuils de scoring (adaptés aux salons de coiffure)
const RFM_CONFIG = {
  // Recency: jours depuis dernière visite
  recency: {
    5: 14,    // Très récent: < 14 jours
    4: 30,    // Récent: 14-30 jours
    3: 60,    // Moyen: 30-60 jours
    2: 90,    // Ancien: 60-90 jours
    1: Infinity  // Très ancien: > 90 jours
  },
  // Frequency: nombre de visites sur 12 mois
  frequency: {
    5: 12,    // Très fréquent: 12+ visites/an (1/mois)
    4: 6,     // Fréquent: 6-11 visites/an
    3: 4,     // Régulier: 4-5 visites/an
    2: 2,     // Occasionnel: 2-3 visites/an
    1: 0      // Rare: 0-1 visite/an
  },
  // Monetary: CA total en euros
  monetary: {
    5: 500,   // VIP: > 500€
    4: 300,   // Premium: 300-500€
    3: 150,   // Standard: 150-300€
    2: 50,    // Basique: 50-150€
    1: 0      // Faible: < 50€
  }
};

// Définition des 11 segments RFM standards
const RFM_SEGMENTS = {
  champions: {
    nom: 'Champions',
    description: 'Vos meilleurs clients - visitent souvent et dépensent beaucoup',
    couleur: '#f59e0b', // Amber
    icone: 'crown',
    condition: (r, f, m) => r >= 4 && f >= 4 && m >= 4,
    action: 'Récompensez-les ! Programme VIP, avant-premières, cadeaux',
    priority: 1
  },
  loyal: {
    nom: 'Fidèles',
    description: 'Clients réguliers avec bon panier moyen',
    couleur: '#10b981', // Green
    icone: 'heart',
    condition: (r, f, m) => r >= 3 && f >= 3 && m >= 3 && !(r >= 4 && f >= 4 && m >= 4),
    action: 'Up-sell services premium, demandez des avis Google',
    priority: 2
  },
  potential_loyal: {
    nom: 'Potentiels fidèles',
    description: 'Clients récents avec potentiel de fidélisation',
    couleur: '#3b82f6', // Blue
    icone: 'trending-up',
    condition: (r, f, m) => r >= 4 && (f === 2 || f === 3) && m >= 2,
    action: 'Offrez une carte fidélité, proposez un forfait',
    priority: 3
  },
  new_customers: {
    nom: 'Nouveaux clients',
    description: 'Première visite récente - à convertir en réguliers',
    couleur: '#8b5cf6', // Purple
    icone: 'sparkles',
    condition: (r, f, m) => r >= 4 && f === 1,
    action: 'SMS de bienvenue, offre -15% sur 2ème visite',
    priority: 4
  },
  promising: {
    nom: 'Prometteurs',
    description: 'Nouveaux clients avec bon potentiel',
    couleur: '#06b6d4', // Cyan
    icone: 'star',
    condition: (r, f, m) => r === 3 && f <= 2 && m >= 2,
    action: 'Créez de l\'engagement, présentez vos services',
    priority: 5
  },
  need_attention: {
    nom: 'À surveiller',
    description: 'Bons clients dont l\'engagement baisse',
    couleur: '#f97316', // Orange
    icone: 'alert-triangle',
    condition: (r, f, m) => r === 3 && f >= 3 && m >= 3,
    action: 'Offre limitée dans le temps, rappel personnalisé',
    priority: 6
  },
  about_to_sleep: {
    nom: 'Endormis',
    description: 'N\'ont pas visité depuis un moment',
    couleur: '#64748b', // Slate
    icone: 'moon',
    condition: (r, f, m) => r === 2 && f <= 2,
    action: 'Offre de réactivation -20%, nouveautés',
    priority: 7
  },
  at_risk: {
    nom: 'À risque',
    description: 'Étaient de bons clients, risquent de partir',
    couleur: '#ef4444', // Red
    icone: 'alert-circle',
    condition: (r, f, m) => r === 2 && f >= 3,
    action: 'Win-back urgent ! Appel + offre personnalisée',
    priority: 8
  },
  cant_lose: {
    nom: 'À ne pas perdre',
    description: 'VIP inactifs - action immédiate requise',
    couleur: '#dc2626', // Red dark
    icone: 'heart-crack',
    condition: (r, f, m) => r <= 2 && f >= 4 && m >= 4,
    action: 'Appel personnel de la gérante, offre exceptionnelle',
    priority: 9
  },
  hibernating: {
    nom: 'Hibernants',
    description: 'Très inactifs depuis longtemps',
    couleur: '#9ca3af', // Gray
    icone: 'snowflake',
    condition: (r, f, m) => r === 1 && f <= 2 && m <= 2,
    action: 'Dernière chance : offre agressive ou archiver',
    priority: 10
  },
  lost: {
    nom: 'Perdus',
    description: 'Clients partis, peu de chances de retour',
    couleur: '#6b7280', // Gray dark
    icone: 'user-x',
    condition: (r, f, m) => r === 1 && (f >= 3 || m >= 3),
    action: 'Réduire les dépenses marketing sur ce segment',
    priority: 11
  }
};

// ════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL RFM
// ════════════════════════════════════════════════════════════════════

/**
 * Calcule le score R (Recency) basé sur la dernière visite
 */
function calculateRecencyScore(lastVisitDate) {
  if (!lastVisitDate) return 1; // Jamais venu = score 1

  const daysSinceVisit = Math.floor(
    (new Date() - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24)
  );

  for (const [score, threshold] of Object.entries(RFM_CONFIG.recency).sort((a, b) => b[0] - a[0])) {
    if (daysSinceVisit <= threshold) {
      return parseInt(score);
    }
  }
  return 1;
}

/**
 * Calcule le score F (Frequency) basé sur le nombre de visites
 */
function calculateFrequencyScore(visitCount) {
  const count = visitCount || 0;

  for (const [score, threshold] of Object.entries(RFM_CONFIG.frequency).sort((a, b) => b[0] - a[0])) {
    if (count >= threshold) {
      return parseInt(score);
    }
  }
  return 1;
}

/**
 * Calcule le score M (Monetary) basé sur le CA total
 */
function calculateMonetaryScore(totalSpent) {
  const spent = totalSpent || 0;

  for (const [score, threshold] of Object.entries(RFM_CONFIG.monetary).sort((a, b) => b[0] - a[0])) {
    if (spent >= threshold) {
      return parseInt(score);
    }
  }
  return 1;
}

/**
 * Détermine le segment RFM basé sur les scores R, F, M
 */
function determineSegment(r, f, m) {
  for (const [key, segment] of Object.entries(RFM_SEGMENTS)) {
    if (segment.condition(r, f, m)) {
      return { key, ...segment };
    }
  }
  // Fallback
  return { key: 'hibernating', ...RFM_SEGMENTS.hibernating };
}

/**
 * Calcule le score RFM complet pour un client
 */
function calculateClientRFM(client, reservations) {
  // Filtrer les réservations terminées/confirmées
  const validReservations = reservations.filter(r =>
    ['termine', 'confirme'].includes(r.statut)
  );

  // Trouver la dernière visite
  const lastVisit = validReservations
    .map(r => new Date(r.date))
    .sort((a, b) => b - a)[0];

  // Compter les visites (12 derniers mois)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const visitsLastYear = validReservations.filter(r =>
    new Date(r.date) >= oneYearAgo
  ).length;

  // CA total
  const totalSpent = validReservations.reduce((sum, r) =>
    sum + (r.prix_total || 0), 0
  ) / 100; // Convertir centimes en euros

  // Calculer les scores
  const recency = calculateRecencyScore(lastVisit);
  const frequency = calculateFrequencyScore(visitsLastYear);
  const monetary = calculateMonetaryScore(totalSpent);

  // Déterminer le segment
  const segment = determineSegment(recency, frequency, monetary);

  return {
    client_id: client.id,
    client_nom: `${client.prenom || ''} ${client.nom || ''}`.trim(),
    client_email: client.email,
    client_telephone: client.telephone,

    // Scores RFM
    recency_score: recency,
    frequency_score: frequency,
    monetary_score: monetary,
    rfm_score: `${recency}${frequency}${monetary}`,

    // Métriques brutes
    days_since_last_visit: lastVisit
      ? Math.floor((new Date() - lastVisit) / (1000 * 60 * 60 * 24))
      : null,
    visits_last_year: visitsLastYear,
    total_spent_euros: totalSpent.toFixed(2),

    // Segment
    segment_key: segment.key,
    segment_nom: segment.nom,
    segment_description: segment.description,
    segment_couleur: segment.couleur,
    segment_action: segment.action
  };
}

// ════════════════════════════════════════════════════════════════════
// API PUBLIQUE
// ════════════════════════════════════════════════════════════════════

/**
 * Analyse RFM complète pour un tenant
 * @param {string} tenantId - ID du tenant
 * @returns {object} Analyse RFM avec segments et stats
 */
export async function analyzeRFM(tenantId) {
  try {
    // 1. Récupérer tous les clients du tenant
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, telephone')
      .eq('tenant_id', tenantId);

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      return { success: true, segments: {}, clients: [], stats: { total: 0 } };
    }

    // 2. Récupérer toutes les réservations du tenant
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, client_id, date, statut, prix_total')
      .eq('tenant_id', tenantId)
      .in('statut', ['termine', 'confirme']);

    if (resError) throw resError;

    // 3. Calculer RFM pour chaque client
    const clientsRFM = clients.map(client => {
      const clientReservations = (reservations || []).filter(r => r.client_id === client.id);
      return calculateClientRFM(client, clientReservations);
    });

    // 4. Grouper par segment
    const segmentGroups = {};
    for (const [key, segment] of Object.entries(RFM_SEGMENTS)) {
      segmentGroups[key] = {
        ...segment,
        clients: clientsRFM.filter(c => c.segment_key === key),
        count: 0,
        total_ca: 0
      };
    }

    // Calculer les stats par segment
    for (const client of clientsRFM) {
      if (segmentGroups[client.segment_key]) {
        segmentGroups[client.segment_key].count++;
        segmentGroups[client.segment_key].total_ca += parseFloat(client.total_spent_euros);
      }
    }

    // 5. Stats globales
    const stats = {
      total_clients: clients.length,
      clients_with_visits: clientsRFM.filter(c => c.visits_last_year > 0).length,
      total_ca: clientsRFM.reduce((sum, c) => sum + parseFloat(c.total_spent_euros), 0).toFixed(2),
      avg_rfm_score: (clientsRFM.reduce((sum, c) =>
        sum + (c.recency_score + c.frequency_score + c.monetary_score), 0
      ) / (clients.length * 3)).toFixed(2)
    };

    return {
      success: true,
      segments: segmentGroups,
      clients: clientsRFM,
      stats,
      config: RFM_CONFIG
    };

  } catch (error) {
    console.error('[RFM] Erreur analyse:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les clients d'un segment RFM spécifique
 */
export async function getSegmentClients(tenantId, segmentKey) {
  const analysis = await analyzeRFM(tenantId);
  if (!analysis.success) return analysis;

  const segment = analysis.segments[segmentKey];
  if (!segment) {
    return { success: false, error: 'Segment non trouvé' };
  }

  return {
    success: true,
    segment: {
      key: segmentKey,
      nom: segment.nom,
      description: segment.description,
      couleur: segment.couleur,
      action: segment.action
    },
    clients: segment.clients,
    count: segment.count,
    total_ca: segment.total_ca.toFixed(2)
  };
}

/**
 * Crée/met à jour les segments RFM automatiques pour un tenant
 */
export async function syncRFMSegments(tenantId) {
  try {
    const analysis = await analyzeRFM(tenantId);
    if (!analysis.success) return analysis;

    const results = [];

    for (const [key, segment] of Object.entries(analysis.segments)) {
      if (segment.count === 0) continue; // Skip empty segments

      // Upsert le segment
      const { data: segmentData, error: segError } = await supabase
        .from('segments')
        .upsert({
          tenant_id: tenantId,
          nom: `[RFM] ${segment.nom}`,
          description: segment.description,
          couleur: segment.couleur,
          icone: segment.icone,
          type: 'dynamique',
          criteres: { rfm_segment: key },
          nb_clients: segment.count,
          actif: true
        }, {
          onConflict: 'tenant_id,nom',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (segError) {
        console.error(`[RFM] Erreur sync segment ${key}:`, segError);
        continue;
      }

      // Mettre à jour les clients du segment
      if (segmentData && segment.clients.length > 0) {
        // Supprimer les anciens clients auto
        await supabase
          .from('segment_clients')
          .delete()
          .eq('segment_id', segmentData.id)
          .eq('source', 'auto');

        // Ajouter les nouveaux
        const inserts = segment.clients.map(c => ({
          segment_id: segmentData.id,
          client_id: c.client_id,
          tenant_id: tenantId,
          source: 'auto'
        }));

        await supabase
          .from('segment_clients')
          .upsert(inserts, { onConflict: 'segment_id,client_id', ignoreDuplicates: true });
      }

      results.push({ segment: segment.nom, count: segment.count });
    }

    return { success: true, synced: results };

  } catch (error) {
    console.error('[RFM] Erreur sync:', error);
    return { success: false, error: error.message };
  }
}

export { RFM_SEGMENTS, RFM_CONFIG };
