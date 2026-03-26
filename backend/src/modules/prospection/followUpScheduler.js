/**
 * Follow-Up Scheduler + Automatisation Prospection
 * - Relances automatiques J+3, J+7, J+14 (toutes les 30min)
 * - Scrape automatique Google Places (lundi 7h)
 * - Recherche emails automatique (lundi 8h)
 * - Lancement campagnes actives (tous les jours 9h)
 */

import { getPendingFollowUps, getCampaignById, getProspectById, getSettings, getCampaigns } from './prospectionService.js';
import { sendFollowUpEmail } from './prospectionEmailSender.js';
import { scrapeProspects, scrapeEmailsBatch } from './prospectScraperService.js';
import { executeCampaign } from './prospectionEmailSender.js';

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

/**
 * Scrape automatique — parcourt les secteurs et villes actifs dans les settings
 * Appele par le scheduler le lundi a 7h
 */
export async function autoScrapeProspects() {
  try {
    const settings = await getSettings();
    if (settings.global_pause) {
      console.log('[AUTO-SCRAPE] Pause globale, scrape ignore');
      return { skipped: true };
    }

    const sectors = settings.active_sectors || [];
    const cities = settings.active_cities || [];

    console.log(`[AUTO-SCRAPE] Lancement: ${sectors.length} secteurs x ${cities.length} villes`);

    const results = { total_found: 0, total_inserted: 0, errors: 0 };

    for (const sector of sectors) {
      for (const city of cities) {
        try {
          const result = await scrapeProspects(sector, city, { maxResults: 60 });
          results.total_found += result.found;
          results.total_inserted += result.inserted;
        } catch (err) {
          console.error(`[AUTO-SCRAPE] Erreur ${sector}/${city}:`, err.message);
          results.errors++;
        }
      }
    }

    console.log(`[AUTO-SCRAPE] Termine: ${results.total_inserted} nouveaux prospects sur ${results.total_found} trouves`);
    return results;
  } catch (err) {
    console.error('[AUTO-SCRAPE] Erreur globale:', err.message);
    return { error: err.message };
  }
}

/**
 * Recherche emails automatique — visite les sites web des prospects sans email
 * Appele par le scheduler le lundi a 8h
 */
export async function autoScrapeEmails() {
  try {
    const settings = await getSettings();
    if (settings.global_pause) {
      console.log('[AUTO-EMAILS] Pause globale, scrape emails ignore');
      return { skipped: true };
    }

    console.log('[AUTO-EMAILS] Recherche emails sur sites web...');
    const result = await scrapeEmailsBatch({ limit: 100 });
    console.log(`[AUTO-EMAILS] Termine: ${result.found} emails trouves sur ${result.total} sites visites`);
    return result;
  } catch (err) {
    console.error('[AUTO-EMAILS] Erreur globale:', err.message);
    return { error: err.message };
  }
}

/**
 * Lance les campagnes actives — envoie les emails du jour
 * Appele par le scheduler tous les jours a 9h
 */
export async function autoRunCampaigns() {
  try {
    const settings = await getSettings();
    if (settings.global_pause) {
      console.log('[AUTO-CAMPAIGN] Pause globale, envois ignores');
      return { skipped: true };
    }

    const campaigns = await getCampaigns({ status: 'active' });
    if (campaigns.length === 0) {
      console.log('[AUTO-CAMPAIGN] Aucune campagne active');
      return { campaigns: 0 };
    }

    console.log(`[AUTO-CAMPAIGN] ${campaigns.length} campagne(s) active(s) a traiter`);

    const results = { campaigns: campaigns.length, total_sent: 0, total_failed: 0 };

    for (const campaign of campaigns) {
      try {
        const result = await executeCampaign(campaign.id);
        results.total_sent += result.sent;
        results.total_failed += result.failed;
      } catch (err) {
        console.error(`[AUTO-CAMPAIGN] Erreur campagne ${campaign.name}:`, err.message);
        results.total_failed++;
      }
    }

    console.log(`[AUTO-CAMPAIGN] Termine: ${results.total_sent} emails envoyes, ${results.total_failed} echecs`);
    return results;
  } catch (err) {
    console.error('[AUTO-CAMPAIGN] Erreur globale:', err.message);
    return { error: err.message };
  }
}

export default { processFollowUps, autoScrapeProspects, autoScrapeEmails, autoRunCampaigns };
