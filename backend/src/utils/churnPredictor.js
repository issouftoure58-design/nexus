/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   CHURN PREDICTOR - Algorithme prédiction risque churn            ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   ML basique sans librairie externe                               ║
 * ║   Score 0-100 : Faible (0-30), Moyen (31-60), Élevé (61-100)     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../config/supabase.js';

/**
 * Calcule le score de risque churn pour un client
 *
 * Facteurs de risque :
 * - Dernière visite > 180 jours : +50 points
 * - Dernière visite > 90 jours : +40 points
 * - Dernière visite > 60 jours : +25 points
 * - Dernière visite > 30 jours : +10 points
 * - Aucune visite enregistrée : +30 points
 * - Aucun RDV : +30 points
 * - Nb RDV < 3 : +20 points
 * - CA total < 50€ : +20 points
 * - CA total < 100€ : +15 points
 * - Trend CA décroissant : +30 points
 *
 * @param {number|string} clientId - ID du client
 * @param {string} tenantId - ID du tenant
 * @returns {Object} { score, risque, raisons, couleur }
 */
export async function calculerScoreChurn(clientId, tenantId) {
  try {
    let score = 0;
    const aujourdhui = new Date();
    const raisons = [];

    // Récupérer infos client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return { score: 0, risque: 'inconnu', raisons: ['Client non trouvé'], couleur: '#9CA3AF' };
    }

    // ═══════════════════════════════════════════════════════════
    // FACTEUR 1 : Dernière visite
    // ═══════════════════════════════════════════════════════════
    if (client.derniere_visite) {
      const derniereVisite = new Date(client.derniere_visite);
      const joursDepuis = Math.floor((aujourdhui - derniereVisite) / (1000 * 60 * 60 * 24));

      if (joursDepuis > 180) {
        score += 50;
        raisons.push(`Aucune visite depuis ${joursDepuis} jours`);
      } else if (joursDepuis > 90) {
        score += 40;
        raisons.push(`Dernière visite il y a ${joursDepuis} jours`);
      } else if (joursDepuis > 60) {
        score += 25;
        raisons.push(`Inactif depuis ${joursDepuis} jours`);
      } else if (joursDepuis > 30) {
        score += 10;
        raisons.push(`Pas vu depuis ${joursDepuis} jours`);
      }
    } else {
      score += 30;
      raisons.push('Aucune visite enregistrée');
    }

    // ═══════════════════════════════════════════════════════════
    // FACTEUR 2 : Nombre de RDV
    // ═══════════════════════════════════════════════════════════
    const nbRdv = client.nb_rdv_total || 0;
    if (nbRdv === 0) {
      score += 30;
      raisons.push('Aucun RDV effectué');
    } else if (nbRdv < 3) {
      score += 20;
      raisons.push(`Peu de RDV (${nbRdv})`);
    }

    // ═══════════════════════════════════════════════════════════
    // FACTEUR 3 : CA total
    // ═══════════════════════════════════════════════════════════
    const caTotal = parseFloat(client.ca_total) || 0;
    if (caTotal < 50) {
      score += 20;
      raisons.push('CA très faible (< 50€)');
    } else if (caTotal < 100) {
      score += 15;
      raisons.push('CA faible (< 100€)');
    }

    // ═══════════════════════════════════════════════════════════
    // FACTEUR 4 : Trend CA (comparer 3 derniers mois vs 3 précédents)
    // ═══════════════════════════════════════════════════════════
    try {
      const date6mois = new Date(aujourdhui.getTime() - 180 * 24 * 60 * 60 * 1000);

      const { data: rdvRecents } = await supabase
        .from('rendez_vous')
        .select('prix, date_rdv')
        .eq('client_id', clientId)
        .gte('date_rdv', date6mois.toISOString().split('T')[0])
        .order('date_rdv', { ascending: false });

      if (rdvRecents && rdvRecents.length >= 4) {
        const moitie = Math.floor(rdvRecents.length / 2);
        const rdv3DerniersMois = rdvRecents.slice(0, moitie);
        const rdv3MoisPrecedents = rdvRecents.slice(moitie);

        const caRecent = rdv3DerniersMois.reduce((sum, r) => sum + (parseFloat(r.prix) || 0), 0);
        const caPrecedent = rdv3MoisPrecedents.reduce((sum, r) => sum + (parseFloat(r.prix) || 0), 0);

        if (caPrecedent > 0 && caRecent < caPrecedent * 0.7) {
          score += 30;
          raisons.push('CA en baisse significative (-30%)');
        }
      }
    } catch (e) {
      // Ignorer erreur trend - pas critique
    }

    // ═══════════════════════════════════════════════════════════
    // RÉSULTAT FINAL
    // ═══════════════════════════════════════════════════════════

    // Plafonner à 100
    score = Math.min(score, 100);

    // Déterminer niveau risque
    let risque = 'faible';
    let couleur = '#10B981'; // Vert

    if (score > 60) {
      risque = 'eleve';
      couleur = '#EF4444'; // Rouge
    } else if (score > 30) {
      risque = 'moyen';
      couleur = '#F59E0B'; // Orange
    }

    return {
      score,
      risque,
      raisons,
      couleur,
    };
  } catch (error) {
    console.error('[CHURN] Erreur calcul churn:', error);
    return { score: 0, risque: 'erreur', raisons: ['Erreur calcul'], couleur: '#9CA3AF' };
  }
}

/**
 * Calcule le score d'engagement pour un client
 *
 * Facteurs positifs :
 * - Points par RDV (5 pts/RDV, max 50)
 * - Points par CA (10-30 pts selon tranches)
 * - Points fidélité (20 pts si visite < 30j)
 *
 * @param {number|string} clientId - ID du client
 * @param {string} tenantId - ID du tenant
 * @returns {number} Score 0-100
 */
export async function calculerScoreEngagement(clientId, tenantId) {
  try {
    let score = 0;

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !client) return 0;

    // ═══════════════════════════════════════════════════════════
    // Points par nombre de RDV (max 50 points)
    // ═══════════════════════════════════════════════════════════
    const nbRdv = client.nb_rdv_total || 0;
    score += Math.min(nbRdv * 5, 50);

    // ═══════════════════════════════════════════════════════════
    // Points par CA (max 30 points)
    // ═══════════════════════════════════════════════════════════
    const caTotal = parseFloat(client.ca_total) || 0;
    if (caTotal > 1000) {
      score += 30;
    } else if (caTotal > 500) {
      score += 20;
    } else if (caTotal > 200) {
      score += 15;
    } else if (caTotal > 100) {
      score += 10;
    }

    // ═══════════════════════════════════════════════════════════
    // Points fidélité (max 20 points)
    // ═══════════════════════════════════════════════════════════
    if (client.derniere_visite) {
      const joursDepuis = Math.floor(
        (new Date() - new Date(client.derniere_visite)) / (1000 * 60 * 60 * 24)
      );
      if (joursDepuis <= 30) {
        score += 20;
      } else if (joursDepuis <= 60) {
        score += 10;
      } else if (joursDepuis <= 90) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  } catch (error) {
    console.error('[ENGAGEMENT] Erreur calcul engagement:', error);
    return 0;
  }
}

/**
 * Récupère tous les clients à risque de churn
 *
 * @param {string} tenantId - ID du tenant
 * @param {number} seuilMin - Score minimum (défaut 31 = risque moyen+)
 * @param {number} limit - Nombre max de résultats
 * @returns {Array} Liste de clients avec leur score churn
 */
export async function getClientsAtRisk(tenantId, seuilMin = 31, limit = 20) {
  try {
    // Récupérer tous les clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, telephone, ca_total, nb_rdv_total, derniere_visite')
      .eq('tenant_id', tenantId);

    if (error || !clients) {
      return [];
    }

    // Calculer churn pour chaque client
    const predictions = await Promise.all(
      clients.map(async (client) => {
        const churn = await calculerScoreChurn(client.id, tenantId);
        return {
          ...client,
          churn,
        };
      })
    );

    // Filtrer et trier par score décroissant
    const atRisk = predictions
      .filter(p => p.churn.score >= seuilMin)
      .sort((a, b) => b.churn.score - a.churn.score)
      .slice(0, limit);

    return atRisk;
  } catch (error) {
    console.error('[CHURN] Erreur clients at-risk:', error);
    return [];
  }
}

export default {
  calculerScoreChurn,
  calculerScoreEngagement,
  getClientsAtRisk,
};
