/**
 * Suggestions IA automatiques - Business Plan
 * Genere des suggestions basees sur le contexte metier
 */

import { supabase } from '../config/supabase.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

/**
 * Genere suggestions IA basees sur contexte
 */
export async function generateSuggestions(tenant_id, context) {
  try {
    const { anomalies, metrics, predictions } = context;

    // Construire prompt pour Claude
    const prompt = `Tu es un consultant business qui analyse les donnees d'une entreprise de services (salon de coiffure, beaute, etc.).

METRIQUES ACTUELLES:
- CA quotidien : ${metrics.ca_daily?.value || 0}EUR (${metrics.ca_daily?.variation >= 0 ? '+' : ''}${metrics.ca_daily?.variation || 0}% vs J-7)
- Taux remplissage agenda : ${metrics.taux_remplissage?.value || 0}%
- Taux annulation : ${metrics.taux_annulation?.value || 0}%
- Note satisfaction : ${metrics.satisfaction?.value || 'N/A'}/5

ANOMALIES DETECTEES:
${anomalies && anomalies.length > 0 ? anomalies.map(a => `- ${a.message}`).join('\n') : 'Aucune anomalie detectee'}

PREDICTIONS:
- CA mois prochain : ${predictions?.ca_next_month || 'N/A'}EUR (tendance ${predictions?.trend || 'stable'})

Genere exactement 3 actions concretes et actionnables pour ameliorer la situation.
Reponds UNIQUEMENT avec un JSON valide, sans texte avant ou apres.
Format: [{"action": "...", "description": "...", "priority": "high|medium|low", "impact": "..."}]`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;

    // Parser JSON
    try {
      // Extraire le JSON de la reponse
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        return suggestions;
      }
    } catch (parseError) {
      console.error('[SUGGESTIONS] Erreur parsing JSON:', parseError);
    }

    // Fallback : suggestions statiques basees sur le contexte
    return generateFallbackSuggestions(context);
  } catch (error) {
    console.error('[SUGGESTIONS] Erreur generation suggestions:', error);

    // Fallback : suggestions statiques
    return generateFallbackSuggestions(context);
  }
}

/**
 * Genere des suggestions statiques en fallback
 */
function generateFallbackSuggestions(context) {
  const { anomalies, metrics } = context;
  const suggestions = [];

  // Analyser anomalies pour suggestions ciblees
  const hasLowCA = anomalies?.some(a => a.metric === 'ca_daily');
  const hasLowRemplissage = anomalies?.some(a => a.metric === 'taux_remplissage');
  const hasHighAnnulation = anomalies?.some(a => a.metric === 'taux_annulation');
  const hasLowSatisfaction = anomalies?.some(a => a.metric === 'satisfaction');

  if (hasLowCA || metrics?.ca_daily?.variation < -10) {
    suggestions.push({
      action: 'Lancer campagne promo',
      description: 'Creer une offre -15% valable 48h pour les nouveaux RDV',
      priority: 'high',
      impact: 'Augmentation CA immediate de 10-20%'
    });
  }

  if (hasLowRemplissage || metrics?.taux_remplissage?.value < 60) {
    suggestions.push({
      action: 'Publier disponibilites',
      description: 'Story Instagram/Facebook avec creneaux disponibles cette semaine',
      priority: 'high',
      impact: 'Remplir 2-3 creneaux supplementaires'
    });
  }

  if (hasHighAnnulation || metrics?.taux_annulation?.value > 15) {
    suggestions.push({
      action: 'Renforcer rappels RDV',
      description: 'Activer SMS rappel 24h avant + demander confirmation',
      priority: 'medium',
      impact: 'Reduire annulations de 30-50%'
    });
  }

  if (hasLowSatisfaction) {
    suggestions.push({
      action: 'Contacter clients mecontents',
      description: 'Appeler les clients avec avis < 3 etoiles pour comprendre et rectifier',
      priority: 'high',
      impact: 'Ameliorer note et fidelisation'
    });
  }

  // Suggestions par defaut si pas assez
  if (suggestions.length < 3) {
    const defaults = [
      {
        action: 'Relancer clients inactifs',
        description: 'Envoyer SMS aux clients sans RDV depuis 60 jours',
        priority: 'medium',
        impact: 'Reactiver 10-15% des clients dormants'
      },
      {
        action: 'Poster sur reseaux sociaux',
        description: 'Partager photos de realisations recentes avec hashtags locaux',
        priority: 'medium',
        impact: 'Augmenter visibilite et nouveaux contacts'
      },
      {
        action: 'Proposer parrainage',
        description: 'Offrir -10EUR pour chaque nouveau client parraine',
        priority: 'low',
        impact: 'Acquisition nouveaux clients via bouche-a-oreille'
      }
    ];

    for (const def of defaults) {
      if (suggestions.length >= 3) break;
      if (!suggestions.find(s => s.action === def.action)) {
        suggestions.push(def);
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Genere suggestions pour optimisation d'un processus specifique
 */
export async function generateOptimizationSuggestions(tenant_id, process) {
  const optimizations = {
    planning: {
      title: 'Optimisation Planning',
      suggestions: [
        {
          action: 'Regrouper RDV similaires',
          description: 'Planifier services similaires consecutivement pour minimiser temps de preparation',
          priority: 'medium',
          impact: 'Gain de 15-20 min/jour'
        },
        {
          action: 'Creneaux premium',
          description: 'Identifier et proposer en priorite les creneaux les plus demandes',
          priority: 'medium',
          impact: 'Meilleur taux de conversion'
        },
        {
          action: 'Buffer entre RDV',
          description: 'Ajouter 10min entre RDV pour eviter retards en cascade',
          priority: 'low',
          impact: 'Meilleure experience client'
        }
      ]
    },
    pricing: {
      title: 'Optimisation Tarifs',
      suggestions: [
        {
          action: 'Tarif dynamique creux',
          description: 'Offrir -10% sur creneaux peu demandes (mardi matin, etc.)',
          priority: 'medium',
          impact: 'Remplir creneaux vides'
        },
        {
          action: 'Pack fidelite',
          description: 'Proposer abonnement 5 RDV avec -15%',
          priority: 'medium',
          impact: 'Fidelisation et CA recurrent'
        },
        {
          action: 'Tarif premium week-end',
          description: 'Majoration +10% samedi apres-midi (forte demande)',
          priority: 'low',
          impact: 'Augmentation marge sur creneaux prisés'
        }
      ]
    },
    stock: {
      title: 'Optimisation Stock',
      suggestions: [
        {
          action: 'Seuils automatiques',
          description: 'Configurer alertes stock basees sur consommation moyenne',
          priority: 'high',
          impact: 'Zero rupture de stock'
        },
        {
          action: 'Commande groupee',
          description: 'Regrouper commandes fournisseur pour economiser frais livraison',
          priority: 'medium',
          impact: 'Economie 5-10% sur achats'
        },
        {
          action: 'Rotation stock',
          description: 'Utiliser produits proches peremption en priorite',
          priority: 'low',
          impact: 'Reduire pertes produits'
        }
      ]
    },
    marketing: {
      title: 'Optimisation Marketing',
      suggestions: [
        {
          action: 'Ciblage segments VIP',
          description: 'Campagnes exclusives pour clients haut panier',
          priority: 'high',
          impact: 'ROI marketing x3'
        },
        {
          action: 'Timing publications',
          description: 'Poster sur reseaux sociaux aux heures de pointe (12h, 19h)',
          priority: 'medium',
          impact: 'Engagement +50%'
        },
        {
          action: 'A/B test messages',
          description: 'Tester 2 versions SMS/email pour optimiser taux ouverture',
          priority: 'medium',
          impact: 'Meilleur taux conversion'
        }
      ]
    }
  };

  const result = optimizations[process];
  if (!result) {
    return {
      title: 'Optimisation',
      suggestions: [{
        action: 'Processus non reconnu',
        description: 'Processus disponibles: planning, pricing, stock, marketing',
        priority: 'low',
        impact: 'N/A'
      }]
    };
  }

  return result;
}

/**
 * Sauvegarde suggestions en base
 */
export async function saveSuggestions(tenant_id, context, suggestions) {
  try {
    const { error } = await supabase
      .from('intelligence_suggestions')
      .insert({
        tenant_id,
        context: JSON.stringify(context),
        suggestions
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[SUGGESTIONS] Erreur save:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marque une suggestion comme appliquee
 */
export async function markSuggestionApplied(suggestion_id, tenant_id) {
  try {
    const { error } = await supabase
      .from('intelligence_suggestions')
      .update({
        applied: true,
        applied_at: new Date().toISOString()
      })
      .eq('id', suggestion_id)
      .eq('tenant_id', tenant_id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[SUGGESTIONS] Erreur markApplied:', error);
    return { success: false, error: error.message };
  }
}

export default {
  generateSuggestions,
  generateOptimizationSuggestions,
  saveSuggestions,
  markSuggestionApplied
};
