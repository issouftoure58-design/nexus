/**
 * Service de Mémoire pour Halimah Pro
 * Permet à Halimah de se souvenir des conversations et des faits importants
 */

import { supabase } from '../config/supabase.js';

// ============================================================
// === GESTION DES MESSAGES (HISTORIQUE) ===
// ============================================================

/**
 * Sauvegarde un message dans l'historique
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function saveMessage(tenantId, sessionId, role, content, attachments = null, toolCalls = null, metadata = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_memory')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        role,
        content,
        attachments: attachments ? JSON.stringify(attachments) : null,
        tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
        metadata: metadata ? JSON.stringify(metadata) : null
      })
      .select()
      .single();

    if (error) {
      console.error('[MEMORY] Erreur sauvegarde message:', error);
      return null;
    }

    console.log(`[MEMORY] ✅ Message sauvegardé (${role}): ${content.substring(0, 50)}...`);
    return data;
  } catch (err) {
    console.error('[MEMORY] Exception sauvegarde:', err);
    return null;
  }
}

/**
 * Charge l'historique récent des conversations
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function loadHistory(tenantId, sessionId, limit = 50) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_memory')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[MEMORY] Erreur chargement historique:', error);
      return [];
    }

    // Parser les champs JSON
    return data.map(msg => ({
      ...msg,
      attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
      metadata: msg.metadata ? JSON.parse(msg.metadata) : null
    }));
  } catch (err) {
    console.error('[MEMORY] Exception chargement:', err);
    return [];
  }
}

/**
 * Charge tout l'historique (toutes sessions) pour le contexte global
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function loadAllHistory(tenantId, limit = 100) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_memory')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MEMORY] Erreur chargement historique global:', error);
      return [];
    }

    return data;
  } catch (err) {
    console.error('[MEMORY] Exception:', err);
    return [];
  }
}

// ============================================================
// === GESTION DES FAITS (MÉMOIRE LONG TERME) ===
// ============================================================

/**
 * Mémorise un fait important
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function rememberFact(tenantId, category, fact, sourceMessageId = null, confidence = 1.0, expiresAt = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    console.log(`[MEMORY] 💾 Tentative mémorisation: "${fact}" (${category})`);

    // Vérifier si un fait similaire existe déjà
    const { data: existing, error: existingError } = await supabase
      .from('halimah_facts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('fact', fact)
      .eq('is_active', true)
      .single();

    // Si la table n'existe pas, log l'erreur
    if (existingError && existingError.code === '42P01') {
      console.error('[MEMORY] ❌ Table halimah_facts n\'existe pas! Exécutez le SQL dans Supabase.');
      return null;
    }

    if (existing) {
      // Mettre à jour la confiance si le fait existe
      const { data, error } = await supabase
        .from('halimah_facts')
        .update({ confidence: Math.min(1.0, existing.confidence + 0.1) })
        .eq('tenant_id', tenantId)
        .eq('id', existing.id)
        .select()
        .single();

      console.log(`[MEMORY] 🔄 Fait renforcé: ${fact.substring(0, 50)}...`);
      return data;
    }

    // Créer un nouveau fait
    const { data, error } = await supabase
      .from('halimah_facts')
      .insert({
        tenant_id: tenantId,
        category,
        fact,
        source_message_id: sourceMessageId,
        confidence,
        expires_at: expiresAt,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[MEMORY] ❌ Erreur création fait:', error.message, error.code);
      // Vérifier si c'est un problème de table manquante
      if (error.code === '42P01') {
        console.error('[MEMORY] ❌ Table halimah_facts n\'existe pas! Exécutez le SQL dans Supabase.');
      }
      return null;
    }

    console.log(`[MEMORY] ✅ Nouveau fait mémorisé (id: ${data.id}): ${fact.substring(0, 50)}...`);
    return data;
  } catch (err) {
    console.error('[MEMORY] Exception rememberFact:', err);
    return null;
  }
}

/**
 * Recherche des faits pertinents pour une requête
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function recallFacts(tenantId, query, category = null, limit = 10) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    let queryBuilder = supabase
      .from('halimah_facts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('[MEMORY] Erreur recall facts:', error);
      return [];
    }

    // Filtrer par pertinence (recherche simple par mots-clés)
    const queryWords = query.toLowerCase().split(/\s+/);
    const relevantFacts = data.filter(fact => {
      const factWords = fact.fact.toLowerCase();
      return queryWords.some(word => word.length > 2 && factWords.includes(word));
    });

    return relevantFacts.length > 0 ? relevantFacts : data.slice(0, 5);
  } catch (err) {
    console.error('[MEMORY] Exception recallFacts:', err);
    return [];
  }
}

/**
 * Récupère tous les faits actifs
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function getAllFacts(tenantId, category = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    let query = supabase
      .from('halimah_facts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MEMORY] Erreur getAllFacts:', error);
      return [];
    }

    return data;
  } catch (err) {
    console.error('[MEMORY] Exception getAllFacts:', err);
    return [];
  }
}

/**
 * Oublie un fait (le désactive)
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function forgetFact(tenantId, factId) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_facts')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .eq('id', factId)
      .select()
      .single();

    if (error) {
      console.error('[MEMORY] Erreur forgetFact:', error);
      return false;
    }

    console.log(`[MEMORY] 🗑️ Fait oublié: ${data.fact.substring(0, 50)}...`);
    return true;
  } catch (err) {
    console.error('[MEMORY] Exception forgetFact:', err);
    return false;
  }
}

/**
 * Oublie un fait par son contenu
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function forgetFactByContent(tenantId, content) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_facts')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .ilike('fact', `%${content}%`)
      .select();

    if (error) {
      console.error('[MEMORY] Erreur forgetFactByContent:', error);
      return 0;
    }

    console.log(`[MEMORY] 🗑️ ${data.length} fait(s) oublié(s) contenant: ${content}`);
    return data.length;
  } catch (err) {
    console.error('[MEMORY] Exception:', err);
    return 0;
  }
}

// ============================================================
// === EXTRACTION AUTOMATIQUE DE FAITS ===
// ============================================================

/**
 * Extrait automatiquement les faits importants d'un échange
 * Utilise des patterns pour détecter les préférences, décisions, etc.
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function extractAndSaveFacts(tenantId, userMessage, assistantResponse, messageId = null) {
  if (!tenantId) throw new Error('tenant_id requis');
  const factsToSave = [];

  // Patterns pour détecter les préférences
  const preferencePatterns = [
    /je préfère\s+(.+)/i,
    /j'aime\s+(.+)/i,
    /je n'aime pas\s+(.+)/i,
    /je déteste\s+(.+)/i,
    /mon jour préféré.+est\s+(.+)/i,
    /je veux\s+(.+)/i,
    /je souhaite\s+(.+)/i
  ];

  // Patterns pour détecter les décisions
  const decisionPatterns = [
    /on a décidé de\s+(.+)/i,
    /c'est décidé[\s:,]+(.+)/i,
    /ok pour\s+(.+)/i,
    /va pour\s+(.+)/i,
    /je choisis\s+(.+)/i
  ];

  // Patterns pour les informations importantes
  const infoPatterns = [
    /mon numéro.+est\s+(.+)/i,
    /mon email.+est\s+(.+)/i,
    /mon adresse.+est\s+(.+)/i,
    /je m'appelle\s+(.+)/i,
    /mon nom.+est\s+(.+)/i
  ];

  // Chercher dans le message utilisateur
  for (const pattern of preferencePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      factsToSave.push({
        category: 'preference',
        fact: `Admin ${match[0]}`,
        confidence: 0.9
      });
    }
  }

  for (const pattern of decisionPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      factsToSave.push({
        category: 'decision',
        fact: match[0],
        confidence: 0.95
      });
    }
  }

  for (const pattern of infoPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      factsToSave.push({
        category: 'info',
        fact: match[0],
        confidence: 1.0
      });
    }
  }

  // Détecter les demandes de mémorisation explicites
  if (/souviens?-toi|retiens?|mémorise|n'oublie pas/i.test(userMessage)) {
    // Extraire ce qui doit être mémorisé
    const memorizeMatch = userMessage.match(/(?:souviens?-toi|retiens?|mémorise|n'oublie pas)\s+(?:que\s+)?(.+)/i);
    if (memorizeMatch) {
      const factContent = memorizeMatch[1].trim();
      // Déterminer la catégorie intelligemment
      let category = 'info';
      if (/préfère|aime|déteste|favori|adore/i.test(factContent)) {
        category = 'preference';
      } else if (/décid|choisi|ok pour|va pour|on fait/i.test(factContent)) {
        category = 'decision';
      } else if (/rappel|rappelle|n'oublie/i.test(factContent)) {
        category = 'reminder';
      }

      factsToSave.push({
        category,
        fact: factContent,
        confidence: 1.0
      });
      console.log(`[MEMORY] 📝 Demande de mémorisation détectée: "${factContent}" (${category})`);
    }
  }

  // Sauvegarder les faits extraits
  for (const fact of factsToSave) {
    await rememberFact(tenantId, fact.category, fact.fact, messageId, fact.confidence);
  }

  return factsToSave.length;
}

// ============================================================
// === GÉNÉRATION DE CONTEXTE MÉMOIRE ===
// ============================================================

/**
 * Génère un contexte de mémoire à inclure dans le system prompt
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function generateMemoryContext(tenantId, currentQuery) {
  if (!tenantId) throw new Error('tenant_id requis');

  const facts = await recallFacts(tenantId, currentQuery, null, 15);
  const recentHistory = await loadAllHistory(tenantId, 20);

  if (facts.length === 0 && recentHistory.length === 0) {
    return '';
  }

  let context = '\n\n=== MÉMOIRE ===\n';

  if (facts.length > 0) {
    context += '\nFaits mémorisés:\n';
    facts.forEach(fact => {
      const category = fact.category === 'preference' ? '💜 Préférence' :
                       fact.category === 'decision' ? '✅ Décision' :
                       fact.category === 'reminder' ? '⏰ Rappel' : '📝 Info';
      context += `- ${category}: ${fact.fact}\n`;
    });
  }

  if (recentHistory.length > 0) {
    context += '\nConversations récentes (résumé):\n';
    // Prendre les 5 derniers échanges
    const recentExchanges = recentHistory.slice(0, 10);
    recentExchanges.forEach(msg => {
      const role = msg.role === 'user' ? 'Admin' : 'Assistant';
      const shortContent = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
      context += `- ${role}: ${shortContent}\n`;
    });
  }

  context += '\n=== FIN MÉMOIRE ===\n';

  return context;
}

// ============================================================
// === NETTOYAGE ET MAINTENANCE ===
// ============================================================

/**
 * Supprime les messages anciens (plus de 30 jours)
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function cleanOldMessages(tenantId, daysToKeep = 30) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from('halimah_memory')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) {
      console.error('[MEMORY] Erreur nettoyage:', error);
      return 0;
    }

    console.log(`[MEMORY] 🧹 ${data.length} anciens messages supprimés`);
    return data.length;
  } catch (err) {
    console.error('[MEMORY] Exception nettoyage:', err);
    return 0;
  }
}

/**
 * Désactive les faits expirés
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function cleanExpiredFacts(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { data, error } = await supabase
      .from('halimah_facts')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null)
      .select();

    if (error) {
      console.error('[MEMORY] Erreur nettoyage faits expirés:', error);
      return 0;
    }

    if (data.length > 0) {
      console.log(`[MEMORY] 🧹 ${data.length} fait(s) expiré(s) désactivé(s)`);
    }
    return data.length;
  } catch (err) {
    console.error('[MEMORY] Exception:', err);
    return 0;
  }
}

// ============================================================
// === STATISTIQUES ===
// ============================================================

/**
 * Obtient des statistiques sur la mémoire
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function getMemoryStats(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { count: messageCount } = await supabase
      .from('halimah_memory')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { count: factCount } = await supabase
      .from('halimah_facts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const { data: categories } = await supabase
      .from('halimah_facts')
      .select('category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const categoryCounts = {};
    categories?.forEach(c => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    return {
      totalMessages: messageCount || 0,
      totalFacts: factCount || 0,
      factsByCategory: categoryCounts
    };
  } catch (err) {
    console.error('[MEMORY] Exception stats:', err);
    return { totalMessages: 0, totalFacts: 0, factsByCategory: {} };
  }
}

export default {
  // Messages
  saveMessage,
  loadHistory,
  loadAllHistory,

  // Faits
  rememberFact,
  recallFacts,
  getAllFacts,
  forgetFact,
  forgetFactByContent,

  // Auto-extraction
  extractAndSaveFacts,

  // Contexte
  generateMemoryContext,

  // Maintenance
  cleanOldMessages,
  cleanExpiredFacts,

  // Stats
  getMemoryStats
};
