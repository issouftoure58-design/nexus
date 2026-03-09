/**
 * Service de fidélité — gestion des points clients
 * Pattern: fonctions pures, tenant_id premier paramètre
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

const DEFAULT_CONFIG = {
  enabled: true,
  points_per_euro: 1.0,
  signup_bonus: 50,
  validity_days: 730,
  min_redeem: 100,
  redeem_ratio: 0.10
};

/**
 * Récupère la config fidélité du tenant (ou defaults)
 */
export async function getConfig(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data } = await supabase
    .from('loyalty_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  return data || { ...DEFAULT_CONFIG, tenant_id: tenantId };
}

/**
 * Met à jour la config fidélité du tenant (upsert)
 */
export async function updateConfig(tenantId, config) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('loyalty_config')
    .upsert({
      tenant_id: tenantId,
      ...config,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (error) {
    logger.error('Erreur update loyalty config', { error: error.message, tenantId });
    throw error;
  }

  return data;
}

/**
 * Récupère le solde de points d'un client
 */
export async function getClientPoints(tenantId, clientId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: client } = await supabase
    .from('clients')
    .select('loyalty_points, total_spent')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .single();

  return {
    points: client?.loyalty_points || 0,
    total_spent: client?.total_spent || 0
  };
}

/**
 * Ajoute des points sur une transaction (réservation terminée)
 */
export async function earnPoints(tenantId, clientId, amount, refType, refId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');

  const config = await getConfig(tenantId);
  if (!config.enabled) return null;

  const points = Math.floor(amount * config.points_per_euro);
  if (points <= 0) return null;

  // Récupérer le solde actuel
  const { points: currentPoints } = await getClientPoints(tenantId, clientId);
  const newBalance = currentPoints + points;

  // Créer la transaction
  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      type: 'earn',
      points,
      balance_after: newBalance,
      reference_type: refType || 'reservation',
      reference_id: refId ? String(refId) : null
    })
    .select()
    .single();

  if (error) {
    logger.error('Erreur earn points', { error: error.message, tenantId, clientId });
    throw error;
  }

  // Mettre à jour le solde client
  await supabase
    .from('clients')
    .update({ loyalty_points: newBalance })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  logger.info(`[LOYALTY] +${points} pts client ${clientId}`, { tenantId, refType, refId });
  return transaction;
}

/**
 * Utiliser des points (remboursement/réduction)
 */
export async function redeemPoints(tenantId, clientId, points) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');
  if (!points || points <= 0) throw new Error('Points invalides');

  const config = await getConfig(tenantId);
  if (!config.enabled) throw new Error('Programme fidélité désactivé');

  const { points: currentPoints } = await getClientPoints(tenantId, clientId);
  if (currentPoints < points) throw new Error('Solde insuffisant');
  if (points < config.min_redeem) throw new Error(`Minimum ${config.min_redeem} points requis`);

  const newBalance = currentPoints - points;
  const discountValue = points * config.redeem_ratio;

  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      type: 'redeem',
      points: -points,
      balance_after: newBalance,
      reason: `Remise de ${discountValue.toFixed(2)}€`
    })
    .select()
    .single();

  if (error) {
    logger.error('Erreur redeem points', { error: error.message, tenantId, clientId });
    throw error;
  }

  await supabase
    .from('clients')
    .update({ loyalty_points: newBalance })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  logger.info(`[LOYALTY] -${points} pts (redeem) client ${clientId}, remise ${discountValue}€`, { tenantId });
  return { transaction, discount_value: discountValue };
}

/**
 * Ajustement manuel par un admin
 */
export async function adjustPoints(tenantId, clientId, points, adminId, reason) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');
  if (points === undefined || points === 0) throw new Error('Points invalides');
  if (!reason) throw new Error('Raison obligatoire');

  const { points: currentPoints } = await getClientPoints(tenantId, clientId);
  const newBalance = currentPoints + points;
  if (newBalance < 0) throw new Error('Le solde ne peut pas être négatif');

  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      type: 'adjust',
      points,
      balance_after: newBalance,
      admin_id: adminId,
      reason
    })
    .select()
    .single();

  if (error) {
    logger.error('Erreur adjust points', { error: error.message, tenantId, clientId });
    throw error;
  }

  await supabase
    .from('clients')
    .update({ loyalty_points: newBalance })
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  logger.info(`[LOYALTY] Ajustement ${points > 0 ? '+' : ''}${points} pts client ${clientId} par admin ${adminId}`, { tenantId, reason });
  return transaction;
}

/**
 * Historique des transactions d'un client
 */
export async function getTransactionHistory(tenantId, clientId, page = 1, limit = 20) {
  if (!tenantId) throw new Error('tenant_id requis');

  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('loyalty_transactions')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Erreur transaction history', { error: error.message, tenantId });
    throw error;
  }

  return { transactions: data || [], total: count || 0, page, limit };
}

/**
 * Leaderboard — top clients par points
 */
export async function getLeaderboard(tenantId, limit = 20) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('clients')
    .select('id, nom, prenom, email, loyalty_points, total_spent')
    .eq('tenant_id', tenantId)
    .gt('loyalty_points', 0)
    .order('loyalty_points', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Erreur leaderboard', { error: error.message, tenantId });
    throw error;
  }

  return data || [];
}

/**
 * Statistiques globales fidélité
 */
export async function getStats(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Total points en circulation
  const { data: clients } = await supabase
    .from('clients')
    .select('loyalty_points')
    .eq('tenant_id', tenantId)
    .gt('loyalty_points', 0);

  const totalPoints = clients?.reduce((sum, c) => sum + (c.loyalty_points || 0), 0) || 0;
  const activeMembers = clients?.length || 0;

  // Transactions récentes (30 jours)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentTx } = await supabase
    .from('loyalty_transactions')
    .select('type, points')
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo);

  const earned30d = recentTx?.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.points, 0) || 0;
  const redeemed30d = recentTx?.filter(t => t.type === 'redeem').reduce((sum, t) => sum + Math.abs(t.points), 0) || 0;

  return {
    total_points_circulation: totalPoints,
    active_members: activeMembers,
    earned_30d: earned30d,
    redeemed_30d: redeemed30d
  };
}
