/**
 * Service de parrainage / referral
 * Sprint 4.3 — Programme parrainage et affiliation
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_EXPIRY_DAYS = 90;
const REWARD_AMOUNT_CENTS = 5000; // 50€ de credit par parrainage reussi

/**
 * Genere un code de parrainage unique pour un tenant
 */
export async function generateReferralCode(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Verifier si le tenant a deja un code
  const { data: tenant } = await supabase
    .from('tenants')
    .select('referral_code')
    .eq('id', tenantId)
    .single();

  if (tenant?.referral_code) {
    return tenant.referral_code;
  }

  // Generer un code unique
  let code;
  let unique = false;
  while (!unique) {
    code = `NXS-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, REFERRAL_CODE_LENGTH)}`;
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referral_code', code)
      .single();
    if (!existing) unique = true;
  }

  // Sauvegarder le code sur le tenant
  await supabase
    .from('tenants')
    .update({ referral_code: code })
    .eq('id', tenantId);

  return code;
}

/**
 * Cree une invitation de parrainage
 */
export async function createReferral(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const code = await generateReferralCode(tenantId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFERRAL_EXPIRY_DAYS);

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_tenant_id: tenantId,
      referral_code: code,
      status: 'pending',
      reward_type: 'credit',
      reward_amount: REWARD_AMOUNT_CENTS,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) {
    // Le code existe deja probablement, retourner l'existant
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return existing;
    }
    logger.error('Erreur creation referral', { error: error.message, tenantId });
    throw error;
  }

  return data;
}

/**
 * Applique un code de parrainage lors de l'inscription d'un nouveau tenant
 */
export async function applyReferralCode(referredTenantId, referralCode) {
  if (!referredTenantId || !referralCode) return null;

  // Trouver le referral actif avec ce code
  const { data: referral, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referral_code', referralCode)
    .eq('status', 'pending')
    .single();

  if (error || !referral) {
    logger.warn('Code parrainage invalide ou expire', { referralCode });
    return null;
  }

  // Verifier expiration
  if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
    await supabase.from('referrals').update({ status: 'expired' }).eq('id', referral.id);
    return null;
  }

  // Empecher auto-parrainage
  if (referral.referrer_tenant_id === referredTenantId) {
    return null;
  }

  // Marquer le referral comme complete
  const { data: updated, error: updateError } = await supabase
    .from('referrals')
    .update({
      referred_tenant_id: referredTenantId,
      status: 'completed'
    })
    .eq('id', referral.id)
    .select()
    .single();

  if (updateError) {
    logger.error('Erreur application referral', { error: updateError.message });
    return null;
  }

  // Marquer le filleul
  await supabase
    .from('tenants')
    .update({ referred_by: referral.referrer_tenant_id })
    .eq('id', referredTenantId);

  logger.info('Parrainage applique', {
    referrer: referral.referrer_tenant_id,
    referred: referredTenantId,
    code: referralCode
  });

  return updated;
}

/**
 * Distribue les recompenses de parrainage
 * Appele apres le premier paiement du filleul
 */
export async function rewardReferral(referredTenantId) {
  if (!referredTenantId) return null;

  const { data: referral, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_tenant_id', referredTenantId)
    .eq('status', 'completed')
    .single();

  if (error || !referral) return null;

  // Marquer comme recompense
  const { error: updateError } = await supabase
    .from('referrals')
    .update({
      status: 'rewarded',
      reward_applied_at: new Date().toISOString()
    })
    .eq('id', referral.id);

  if (updateError) {
    logger.error('Erreur reward referral', { error: updateError.message });
    return null;
  }

  logger.info('Recompense parrainage distribuee', {
    referrer: referral.referrer_tenant_id,
    referred: referredTenantId,
    reward: `${referral.reward_amount / 100}€`
  });

  return referral;
}

/**
 * Statistiques de parrainage pour un tenant
 */
export async function getReferralStats(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: referrals, error } = await supabase
    .from('referrals')
    .select('status, reward_amount')
    .eq('referrer_tenant_id', tenantId);

  if (error) {
    logger.error('Erreur stats referral', { error: error.message, tenantId });
    return { total: 0, completed: 0, rewarded: 0, total_earned: 0 };
  }

  const stats = {
    total: referrals?.length || 0,
    pending: referrals?.filter(r => r.status === 'pending').length || 0,
    completed: referrals?.filter(r => r.status === 'completed').length || 0,
    rewarded: referrals?.filter(r => r.status === 'rewarded').length || 0,
    total_earned: referrals?.filter(r => r.status === 'rewarded').reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0
  };

  return stats;
}

/**
 * Liste les parrainages d'un tenant
 */
export async function listReferrals(tenantId, page = 1, limit = 20) {
  if (!tenantId) throw new Error('tenant_id requis');

  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('referrals')
    .select('id, referral_code, referred_tenant_id, status, reward_type, reward_amount, reward_applied_at, expires_at, created_at', { count: 'exact' })
    .eq('referrer_tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Erreur liste referrals', { error: error.message, tenantId });
    throw error;
  }

  return { referrals: data || [], total: count || 0, page, limit };
}
