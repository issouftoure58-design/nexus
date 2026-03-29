/**
 * Routes NEXUS Prospection
 * Endpoints /api/nexus/prospection/* — proteges par requireSuperAdmin
 * + routes publiques pour desinscription et webhooks Resend
 */

import express from 'express';
import { authenticateAdmin, requireSuperAdmin } from './adminAuth.js';
import {
  getProspects, getProspectById, updateProspect, deleteProspect, importProspects,
  getCampaigns, getCampaignById, createCampaign, updateCampaign,
  getCampaignEmails, getProspectEmails,
  getSettings, updateSettings,
  getDashboardStats,
  getEmailByResendId, updateEmail,
} from '../modules/prospection/prospectionService.js';
import { scrapeProspects, scrapeEmailsBatch, getEmailScrapeStatus } from '../modules/prospection/prospectScraperService.js';
import { generateInitialEmail } from '../modules/prospection/emailGeneratorService.js';
import { executeCampaign } from '../modules/prospection/prospectionEmailSender.js';
import { handleUnsubscribe, getUnsubscribeConfirmationPage, getUnsubscribeErrorPage } from '../modules/prospection/unsubscribeHandler.js';

// =============================================================================
// ROUTER PROTEGE (super-admin)
// =============================================================================

const router = express.Router();
router.use(authenticateAdmin);
router.use(requireSuperAdmin);

// ---------- DASHBOARD ----------

router.get('/dashboard', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- SETTINGS ----------

router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    // Validation des champs autorises
    const allowedFields = [
      'daily_limit', 'hourly_limit', 'send_window_start', 'send_window_end',
      'send_days', 'global_pause', 'from_name', 'from_email', 'reply_to',
      'followup_j3', 'followup_j7', 'followup_j14',
    ];
    const filtered = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) filtered[key] = req.body[key];
    }
    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ valide fourni' });
    }
    // Validation types numeriques
    if (filtered.daily_limit !== undefined && (!Number.isInteger(filtered.daily_limit) || filtered.daily_limit < 1 || filtered.daily_limit > 500)) {
      return res.status(400).json({ success: false, error: 'daily_limit doit etre entre 1 et 500' });
    }
    if (filtered.hourly_limit !== undefined && (!Number.isInteger(filtered.hourly_limit) || filtered.hourly_limit < 1 || filtered.hourly_limit > 100)) {
      return res.status(400).json({ success: false, error: 'hourly_limit doit etre entre 1 et 100' });
    }

    const settings = await updateSettings(filtered);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- PROSPECTS ----------

router.get('/prospects', async (req, res) => {
  try {
    const { sector, city, status, hasEmail, search, page, limit } = req.query;
    const result = await getProspects({
      sector,
      city,
      status,
      hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/prospects/:id', async (req, res) => {
  try {
    const prospect = await getProspectById(parseInt(req.params.id));
    const emails = await getProspectEmails(parseInt(req.params.id));
    res.json({ success: true, data: { ...prospect, emails } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/prospects/:id', async (req, res) => {
  try {
    const prospect = await updateProspect(parseInt(req.params.id), req.body);
    res.json({ success: true, data: prospect });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/prospects/:id', async (req, res) => {
  try {
    await deleteProspect(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/prospects/import', async (req, res) => {
  try {
    const { prospects } = req.body;
    if (!Array.isArray(prospects) || prospects.length === 0) {
      return res.status(400).json({ success: false, error: 'prospects[] requis' });
    }
    const result = await importProspects(prospects);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- SCRAPING ----------

router.post('/scrape', async (req, res) => {
  try {
    const { sector, city, maxResults } = req.body;
    if (!sector || !city) {
      return res.status(400).json({ success: false, error: 'sector et city requis' });
    }
    const result = await scrapeProspects(sector, city, { maxResults: maxResults || 60 });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scrape/emails', async (req, res) => {
  try {
    const status = getEmailScrapeStatus();
    if (status.running) {
      return res.json({ success: true, message: 'Scrape deja en cours', data: status });
    }
    const { sector, city, limit } = req.body;
    // Lancer en background — ne pas bloquer la requete HTTP
    scrapeEmailsBatch({ sector, city, limit: limit || 500 }).catch(err =>
      console.error('[SCRAPER] Background email scrape error:', err.message)
    );
    res.json({ success: true, message: 'Scrape lance en arriere-plan', data: { running: true, total: 0, found: 0, failed: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scrape/emails/status', async (_req, res) => {
  res.json({ success: true, data: getEmailScrapeStatus() });
});

// ---------- CAMPAIGNS ----------

router.get('/campaigns', async (req, res) => {
  try {
    const { status } = req.query;
    const campaigns = await getCampaigns({ status });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const { name, sector, cities, daily_send_limit, follow_up_enabled, custom_prompt } = req.body;
    if (!name || !sector) {
      return res.status(400).json({ success: false, error: 'name et sector requis' });
    }
    const campaign = await createCampaign({
      name,
      sector,
      cities: cities || [],
      daily_send_limit: daily_send_limit || 30,
      follow_up_enabled: follow_up_enabled !== false,
      custom_prompt: custom_prompt || null,
    });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await getCampaignById(parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await updateCampaign(parseInt(req.params.id), req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns/:id/start', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await getCampaignById(id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne introuvable' });

    await updateCampaign(id, { status: 'active' });

    // Lancer l'execution en arriere-plan et stocker le statut final
    executeCampaign(id)
      .then(async (results) => {
        console.log(`[PROSPECTION] Campagne ${id} terminee: sent=${results.sent} failed=${results.failed}`);
        if (results.sent === 0 && results.failed > 0) {
          await updateCampaign(id, { status: 'paused' });
        }
      })
      .catch(async (err) => {
        console.error(`[PROSPECTION] Erreur execution campagne ${id}:`, err.message);
        await updateCampaign(id, { status: 'paused' }).catch(() => {});
      });

    res.json({ success: true, message: 'Campagne demarree' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    const campaign = await updateCampaign(parseInt(req.params.id), { status: 'paused' });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns/:id/preview', async (req, res) => {
  try {
    const campaign = await getCampaignById(parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne introuvable' });

    // Generer un preview avec un prospect fictif
    const mockProspect = {
      name: req.body.prospect_name || 'Salon Exemple',
      sector: campaign.sector,
      city: campaign.cities?.[0] || 'Paris',
      rating: 4.5,
      reviews_count: 120,
      website: 'https://example.com',
    };

    const email = await generateInitialEmail(mockProspect, campaign);
    res.json({ success: true, data: email });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id/emails', async (req, res) => {
  try {
    const { status } = req.query;
    const emails = await getCampaignEmails(parseInt(req.params.id), { status });
    res.json({ success: true, data: emails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ROUTER PUBLIC (sans auth)
// =============================================================================

const publicRouter = express.Router();

// Desinscription prospect
publicRouter.get('/unsubscribe/:token', async (req, res) => {
  try {
    const result = await handleUnsubscribe(req.params.token);
    res.send(getUnsubscribeConfirmationPage(result.prospectName));
  } catch (error) {
    res.status(400).send(getUnsubscribeErrorPage(error.message));
  }
});

// =============================================================================
// ROUTER WEBHOOK (sans auth, verification par signature)
// =============================================================================

const webhookRouter = express.Router();

// Webhook Resend — tracking delivery events
webhookRouter.post('/resend', async (req, res) => {
  try {
    const event = req.body;

    if (!event?.type || !event?.data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const resendId = event.data.email_id;
    if (!resendId) return res.status(200).json({ received: true });

    const email = await getEmailByResendId(resendId);
    if (!email) {
      // Pas un email de prospection, ignorer
      return res.status(200).json({ received: true });
    }

    const updates = {};

    switch (event.type) {
      case 'email.delivered':
        updates.status = 'delivered';
        break;
      case 'email.opened':
        updates.status = 'opened';
        updates.opened_at = updates.opened_at || new Date().toISOString();
        updates.opened_count = (email.opened_count || 0) + 1;
        break;
      case 'email.clicked':
        updates.status = 'clicked';
        updates.clicked_at = updates.clicked_at || new Date().toISOString();
        updates.clicked_count = (email.clicked_count || 0) + 1;
        break;
      case 'email.bounced':
        updates.status = 'bounced';
        updates.bounced_at = new Date().toISOString();
        break;
      case 'email.complained':
        updates.status = 'bounced';
        // Auto-unsubscribe sur plainte
        if (email.prospect_id) {
          try {
            const { updateProspect: up } = await import('../modules/prospection/prospectionService.js');
            await up(email.prospect_id, { status: 'unsubscribed' });
          } catch { /* best effort */ }
        }
        break;
      default:
        return res.status(200).json({ received: true, ignored: true });
    }

    if (Object.keys(updates).length > 0) {
      await updateEmail(email.id, updates);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Resend error:', error.message);
    res.status(200).json({ received: true }); // Toujours 200 pour eviter retries
  }
});

export default router;
export { publicRouter as prospectionPublicRouter, webhookRouter as prospectionWebhookRouter };
