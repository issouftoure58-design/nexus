/**
 * RGPD Deletion Job
 *
 * Execute les demandes de suppression planifiees (scheduled_at < NOW()).
 * Ordre de suppression respecte les FK:
 *   ia_messages -> ia_conversations -> client_consents -> reservations ->
 *   factures -> clients -> admin_users -> branding -> services -> tenant
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Traite les demandes de suppression RGPD en attente
 */
export async function runRgpdDeletionJob() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[RGPD Job] Supabase non configure, skip');
    return;
  }

  try {
    // Trouver les demandes de suppression dont la date est passee
    const { data: requests, error } = await supabase
      .from('rgpd_requests')
      .select('*')
      .eq('type', 'deletion')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());

    if (error) {
      console.error('[RGPD Job] Erreur lecture demandes:', error.message);
      return;
    }

    if (!requests?.length) {
      return; // Aucune demande a traiter
    }

    console.log(`[RGPD Job] ${requests.length} demande(s) de suppression a traiter`);

    for (const request of requests) {
      await processDeletionRequest(supabase, request);
    }
  } catch (err) {
    console.error('[RGPD Job] Erreur globale:', err.message);
  }
}

async function processDeletionRequest(supabase, request) {
  const { tenant_id: tenantId, id: requestId } = request;
  console.log(`[RGPD Job] Traitement suppression tenant ${tenantId} (request ${requestId})`);

  try {
    // Marquer comme en cours
    await supabase
      .from('rgpd_requests')
      .update({ status: 'processing' })
      .eq('id', requestId);

    // 1. ia_messages (via conversations du tenant)
    const { data: conversations } = await supabase
      .from('ia_conversations')
      .select('id')
      .eq('tenant_id', tenantId);

    if (conversations?.length > 0) {
      const convIds = conversations.map(c => c.id);
      await supabase
        .from('ia_messages')
        .delete()
        .in('conversation_id', convIds);
      console.log(`[RGPD Job] ${tenantId}: ia_messages supprimees`);
    }

    // 2. ia_conversations
    await supabase.from('ia_conversations').delete().eq('tenant_id', tenantId);

    // 3. client_consents
    await supabase.from('client_consents').delete().eq('tenant_id', tenantId);

    // 4. reservations
    await supabase.from('reservations').delete().eq('tenant_id', tenantId);

    // 5. factures
    await supabase.from('factures').delete().eq('tenant_id', tenantId);

    // 6. clients
    await supabase.from('clients').delete().eq('tenant_id', tenantId);

    // 7. admin_users
    await supabase.from('admin_users').delete().eq('tenant_id', tenantId);

    // 8. branding
    await supabase.from('branding').delete().eq('tenant_id', tenantId);

    // 9. services
    await supabase.from('services').delete().eq('tenant_id', tenantId);

    // 10. billing_events
    await supabase.from('billing_events').delete().eq('tenant_id', tenantId);

    // 11. stripe_processed_events
    await supabase.from('stripe_processed_events').delete().eq('tenant_id', tenantId);

    // 12. error_logs
    await supabase.from('error_logs').delete().eq('tenant_id', tenantId);

    // 13. Le tenant lui-meme
    await supabase.from('tenants').delete().eq('id', tenantId);

    // Marquer comme complete
    await supabase
      .from('rgpd_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    console.log(`[RGPD Job] Tenant ${tenantId} supprime avec succes`);
  } catch (err) {
    console.error(`[RGPD Job] Erreur suppression tenant ${tenantId}:`, err.message);

    // Marquer comme echoue
    await supabase
      .from('rgpd_requests')
      .update({
        status: 'failed',
        metadata: { error: err.message, failed_at: new Date().toISOString() }
      })
      .eq('id', requestId);
  }
}
