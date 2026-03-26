/**
 * Follow-Up Scheduler
 * Gere les relances automatiques J+3, J+7, J+14
 * S'integre dans le scheduler existant (cron toutes les 30min)
 */

import { getPendingFollowUps, getCampaignById, getProspectById } from './prospectionService.js';
import { sendFollowUpEmail } from './prospectionEmailSender.js';

/**
 * Traite les relances en attente
 * Appele par le scheduler principal toutes les 30min
 */
export async function processFollowUps() {
  try {
    const pendingEmails = await getPendingFollowUps();

    if (pendingEmails.length === 0) {
      return { processed: 0 };
    }

    console.log(`[FOLLOWUP] ${pendingEmails.length} relance(s) a traiter`);

    const results = { processed: 0, sent: 0, failed: 0, skipped: 0 };

    for (const email of pendingEmails) {
      results.processed++;

      try {
        const prospect = await getProspectById(email.prospect_id);
        if (!prospect || prospect.status === 'unsubscribed' || prospect.status === 'converted' || prospect.status === 'lost') {
          results.skipped++;
          continue;
        }

        const campaign = await getCampaignById(email.campaign_id);
        if (!campaign || campaign.status !== 'active') {
          results.skipped++;
          continue;
        }

        const result = await sendFollowUpEmail(email, prospect, campaign);
        if (result.success) {
          results.sent++;
        } else {
          if (result.reason === 'no_more_followups') {
            results.skipped++;
          } else {
            results.failed++;
          }
        }
      } catch (err) {
        console.error(`[FOLLOWUP] Erreur email ${email.id}:`, err.message);
        results.failed++;
      }
    }

    console.log(`[FOLLOWUP] Resultat: sent=${results.sent} failed=${results.failed} skipped=${results.skipped}`);
    return results;
  } catch (err) {
    console.error('[FOLLOWUP] Erreur globale:', err.message);
    return { processed: 0, error: err.message };
  }
}

export default { processFollowUps };
