/**
 * Prospection Service
 * CRUD + stats pour prospects, campagnes, emails, settings
 * Toutes les queries filtrent par tenant_id = 'nexus-internal'
 */

import { supabase } from '../../config/supabase.js';

const TENANT_ID = 'nexus-internal';

// =============================================================================
// PROSPECTS
// =============================================================================

export async function getProspects({ sector, city, status, hasEmail, search, page = 1, limit = 50 } = {}) {
  let query = supabase
    .from('prospection_prospects')
    .select('*', { count: 'exact' })
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false });

  if (sector) query = query.eq('sector', sector);
  if (city) query = query.ilike('city', `%${city}%`);
  if (status) query = query.eq('status', status);
  if (hasEmail === true) query = query.not('email', 'is', null);
  if (hasEmail === false) query = query.is('email', null);
  if (search) query = query.ilike('name', `%${search}%`);

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data, total: count, page, limit };
}

export async function getProspectById(id) {
  const { data, error } = await supabase
    .from('prospection_prospects')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProspect(id, updates) {
  const { data, error } = await supabase
    .from('prospection_prospects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProspect(id) {
  const { error } = await supabase
    .from('prospection_prospects')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function upsertProspect(prospect) {
  const { data, error } = await supabase
    .from('prospection_prospects')
    .upsert(
      { ...prospect, tenant_id: TENANT_ID, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,place_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function importProspects(prospects) {
  const rows = prospects.map(p => ({
    ...p,
    tenant_id: TENANT_ID,
    source: p.source || 'import',
    status: 'new',
  }));

  const { data, error } = await supabase
    .from('prospection_prospects')
    .insert(rows)
    .select();

  if (error) throw error;
  return { imported: data.length, data };
}

// =============================================================================
// CAMPAIGNS
// =============================================================================

export async function getCampaigns({ status } = {}) {
  let query = supabase
    .from('prospection_campaigns')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCampaignById(id) {
  const { data, error } = await supabase
    .from('prospection_campaigns')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createCampaign(campaign) {
  const { data, error } = await supabase
    .from('prospection_campaigns')
    .insert({ ...campaign, tenant_id: TENANT_ID })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCampaign(id, updates) {
  const { data, error } = await supabase
    .from('prospection_campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================================================
// EMAILS
// =============================================================================

export async function getCampaignEmails(campaignId, { status } = {}) {
  let query = supabase
    .from('prospection_emails')
    .select('*, prospection_prospects(name, email, sector, city)')
    .eq('tenant_id', TENANT_ID)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createEmail(email) {
  const { data, error } = await supabase
    .from('prospection_emails')
    .insert({ ...email, tenant_id: TENANT_ID })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmail(id, updates) {
  const { data, error } = await supabase
    .from('prospection_emails')
    .update(updates)
    .eq('tenant_id', TENANT_ID)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getEmailByResendId(resendId) {
  const { data, error } = await supabase
    .from('prospection_emails')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('resend_id', resendId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPendingFollowUps() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('prospection_emails')
    .select('*, prospection_prospects(name, email, sector, city, status)')
    .eq('tenant_id', TENANT_ID)
    .not('follow_up_scheduled_at', 'is', null)
    .lte('follow_up_scheduled_at', now)
    .in('status', ['sent', 'delivered'])
    .order('follow_up_scheduled_at', { ascending: true });

  if (error) throw error;

  // Filtrer prospects desinscrits
  return (data || []).filter(e => e.prospection_prospects?.status !== 'unsubscribed');
}

export async function getProspectEmails(prospectId) {
  const { data, error } = await supabase
    .from('prospection_emails')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// =============================================================================
// SETTINGS
// =============================================================================

export async function getSettings() {
  const { data, error } = await supabase
    .from('prospection_settings')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .single();

  if (error && error.code === 'PGRST116') {
    // No settings row yet — insert default
    const { data: newData, error: insertErr } = await supabase
      .from('prospection_settings')
      .insert({ tenant_id: TENANT_ID })
      .select()
      .single();
    if (insertErr) throw insertErr;
    return newData;
  }
  if (error) throw error;
  return data;
}

export async function updateSettings(updates) {
  const { data, error } = await supabase
    .from('prospection_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================================================
// DASHBOARD STATS
// =============================================================================

export async function getDashboardStats() {
  const [prospectsRes, campaignsRes, emailsRes] = await Promise.allSettled([
    supabase.from('prospection_prospects').select('id, status, sector', { count: 'exact' }).eq('tenant_id', TENANT_ID),
    supabase.from('prospection_campaigns').select('*').eq('tenant_id', TENANT_ID),
    supabase.from('prospection_emails').select('id, status, email_type, sent_at, opened_at, clicked_at').eq('tenant_id', TENANT_ID),
  ]);

  const prospects = prospectsRes.status === 'fulfilled' ? prospectsRes.value.data || [] : [];
  const campaigns = campaignsRes.status === 'fulfilled' ? campaignsRes.value.data || [] : [];
  const emails = emailsRes.status === 'fulfilled' ? emailsRes.value.data || [] : [];

  const totalProspects = prospects.length;
  const withEmail = prospects.filter(p => p.status !== 'new').length;
  const totalSent = emails.filter(e => ['sent', 'delivered', 'opened', 'clicked'].includes(e.status)).length;
  const totalOpened = emails.filter(e => ['opened', 'clicked'].includes(e.status) || e.opened_at).length;
  const totalClicked = emails.filter(e => e.status === 'clicked' || e.clicked_at).length;
  const totalResponded = prospects.filter(p => p.status === 'responded').length;
  const totalDemos = prospects.filter(p => p.status === 'demo_scheduled').length;
  const totalConverted = prospects.filter(p => p.status === 'converted').length;

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  // Stats par secteur
  const bySector = {};
  for (const p of prospects) {
    if (!bySector[p.sector]) bySector[p.sector] = 0;
    bySector[p.sector]++;
  }

  // Envois 30 derniers jours
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEmails = emails.filter(e => e.sent_at && new Date(e.sent_at) >= thirtyDaysAgo);

  const dailyStats = {};
  for (const e of recentEmails) {
    const day = e.sent_at.split('T')[0];
    if (!dailyStats[day]) dailyStats[day] = { sent: 0, opened: 0, clicked: 0 };
    dailyStats[day].sent++;
    if (e.opened_at) dailyStats[day].opened++;
    if (e.clicked_at) dailyStats[day].clicked++;
  }

  return {
    totalProspects,
    withEmail,
    totalSent,
    totalOpened,
    totalClicked,
    totalResponded,
    totalDemos,
    totalConverted,
    activeCampaigns,
    openRate,
    clickRate,
    bySector,
    dailyStats,
  };
}

export default {
  getProspects, getProspectById, updateProspect, deleteProspect, upsertProspect, importProspects,
  getCampaigns, getCampaignById, createCampaign, updateCampaign,
  getCampaignEmails, createEmail, updateEmail, getEmailByResendId, getPendingFollowUps, getProspectEmails,
  getSettings, updateSettings,
  getDashboardStats,
};
