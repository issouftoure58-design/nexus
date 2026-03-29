/**
 * Prospection Email Sender
 * Envoi d'emails de prospection via Resend avec rate limiting et conformite RGPD
 */

import { sendEmail } from '../../services/emailService.js';
import { getSettings, createEmail, updateEmail, updateCampaign, getCampaignById } from './prospectionService.js';
import { generateInitialEmail, generateFollowUpEmail } from './emailGeneratorService.js';
import { supabase } from '../../config/supabase.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[PROSPECTION] CRITICAL: JWT_SECRET non defini — les tokens de desinscription ne fonctionneront pas');
}

// Rate limiting via DB (persistant — voir canSendNow())

/**
 * Verifie si on peut envoyer maintenant (fenetre horaire + rate limits)
 */
async function canSendNow() {
  const settings = await getSettings();

  if (settings.global_pause) return { allowed: false, reason: 'global_pause' };

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=dim, 1=lun...

  // Fenetre horaire
  if (hour < settings.send_window_start || hour >= settings.send_window_end) {
    return { allowed: false, reason: `hors_fenetre (${settings.send_window_start}h-${settings.send_window_end}h)` };
  }

  // Jours ouvrables (send_days contient 1-5 par defaut)
  if (!settings.send_days.includes(day)) {
    return { allowed: false, reason: 'jour_non_ouvrable' };
  }

  // Rate limits — compter depuis la DB (persistant meme apres redemarrage)
  const todayStr = new Date().toISOString().split('T')[0];
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: sentTodayCount } = await supabase
    .from('prospection_emails')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', 'nexus-internal')
    .gte('sent_at', `${todayStr}T00:00:00Z`)
    .in('status', ['sent', 'delivered', 'opened', 'clicked']);

  if ((sentTodayCount || 0) >= settings.daily_limit) {
    return { allowed: false, reason: `limite_jour (${settings.daily_limit})` };
  }

  const { count: sentThisHourCount } = await supabase
    .from('prospection_emails')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', 'nexus-internal')
    .gte('sent_at', hourAgo)
    .in('status', ['sent', 'delivered', 'opened', 'clicked']);

  if ((sentThisHourCount || 0) >= settings.hourly_limit) {
    return { allowed: false, reason: `limite_heure (${settings.hourly_limit})` };
  }

  return { allowed: true };
}

/**
 * Genere le token de desinscription pour un prospect
 */
function generateUnsubscribeToken(prospectId) {
  return jwt.sign({ prospectId, type: 'unsubscribe' }, JWT_SECRET, { expiresIn: '365d' });
}

/**
 * Genere l'URL de desinscription
 */
function getUnsubscribeUrl(prospectId) {
  const token = generateUnsubscribeToken(prospectId);
  const baseUrl = process.env.BACKEND_URL || 'https://nexus-backend-dev.onrender.com';
  return `${baseUrl}/api/prospection/unsubscribe/${token}`;
}

/**
 * Envoie un email de prospection initial a un prospect
 */
export async function sendProspectionEmail(prospect, campaign) {
  const check = await canSendNow();
  if (!check.allowed) {
    console.log(`[PROSPECTION] Envoi bloque: ${check.reason}`);
    return { success: false, reason: check.reason };
  }

  if (!prospect.email) {
    return { success: false, reason: 'no_email' };
  }

  if (prospect.status === 'unsubscribed') {
    return { success: false, reason: 'unsubscribed' };
  }

  const settings = await getSettings();

  // Generer l'email via IA
  const generated = await generateInitialEmail(prospect, campaign);

  // Remplacer le placeholder unsubscribe
  const unsubscribeUrl = getUnsubscribeUrl(prospect.id);
  const htmlBody = generated.html_body.replace('{{unsubscribe_url}}', unsubscribeUrl);

  // Creer l'enregistrement email en base (queued)
  const emailRecord = await createEmail({
    campaign_id: campaign.id,
    prospect_id: prospect.id,
    email_type: 'initial',
    subject: generated.subject,
    html_body: htmlBody,
    to_address: prospect.email,
    status: 'queued',
  });

  // Delai aleatoire anti-spam (10-30s en prod — non-bloquant dans le batch)
  if (process.env.NODE_ENV === 'production') {
    const delay = randomInt(10 * 1000, 30 * 1000);
    await sleep(delay);
  }

  // Envoyer via Resend
  const result = await sendEmail({
    to: prospect.email,
    subject: generated.subject,
    html: htmlBody,
    from: `${settings.from_name} <${settings.from_email}>`,
    replyTo: settings.reply_to,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Campaign-ID': String(campaign.id),
    },
    tags: ['prospection', `sector-${prospect.sector}`, `campaign-${campaign.id}`],
  });

  if (result.success) {
    // Calculer date de follow-up depuis maintenant (J+3)
    const sentDate = new Date();
    let followUpDate = null;
    if (campaign.follow_up_enabled && settings.followup_j3) {
      followUpDate = new Date(sentDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    }

    await updateEmail(emailRecord.id, {
      status: 'sent',
      resend_id: result.id || null,
      sent_at: sentDate.toISOString(),
      follow_up_scheduled_at: followUpDate,
    });

    // Incrementer compteur campagne
    await updateCampaign(campaign.id, {
      emails_sent: (campaign.emails_sent || 0) + 1,
    });

    console.log(`[PROSPECTION] Email envoye a ${prospect.email} (${prospect.name})`);
    return { success: true, emailId: emailRecord.id, resendId: result.id };
  } else {
    await updateEmail(emailRecord.id, { status: 'bounced', bounced_at: new Date().toISOString() });
    return { success: false, reason: result.error };
  }
}

/**
 * Envoie un email de relance
 */
export async function sendFollowUpEmail(originalEmail, prospect, campaign) {
  const check = await canSendNow();
  if (!check.allowed) return { success: false, reason: check.reason };

  if (prospect.status === 'unsubscribed') return { success: false, reason: 'unsubscribed' };

  // Determiner le type de relance
  let emailType;
  const settings = await getSettings();

  if (originalEmail.email_type === 'initial' && settings.followup_j3) {
    emailType = 'followup_j3';
  } else if (originalEmail.email_type === 'followup_j3' && settings.followup_j7) {
    emailType = 'followup_j7';
  } else if (originalEmail.email_type === 'followup_j7' && settings.followup_j14) {
    emailType = 'followup_j14';
  } else {
    return { success: false, reason: 'no_more_followups' };
  }

  const generated = await generateFollowUpEmail(prospect, emailType, originalEmail.subject);
  const unsubscribeUrl = getUnsubscribeUrl(prospect.id);
  const htmlBody = generated.html_body.replace('{{unsubscribe_url}}', unsubscribeUrl);

  const emailRecord = await createEmail({
    campaign_id: campaign.id,
    prospect_id: prospect.id,
    email_type: emailType,
    subject: generated.subject,
    html_body: htmlBody,
    to_address: prospect.email,
    status: 'queued',
  });

  // Delai anti-spam
  if (process.env.NODE_ENV === 'production') {
    await sleep(randomInt(10 * 1000, 30 * 1000));
  }

  const result = await sendEmail({
    to: prospect.email,
    subject: generated.subject,
    html: htmlBody,
    from: `${settings.from_name} <${settings.from_email}>`,
    replyTo: settings.reply_to,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Campaign-ID': String(campaign.id),
    },
    tags: ['prospection', emailType, `campaign-${campaign.id}`],
  });

  if (result.success) {
    // Calculer prochaine relance depuis la date d'envoi initial (pas Date.now())
    const initialSentAt = originalEmail.sent_at ? new Date(originalEmail.sent_at) : new Date();
    let nextFollowUp = null;
    if (emailType === 'followup_j3' && settings.followup_j7) {
      nextFollowUp = new Date(initialSentAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // J+7 depuis initial
    } else if (emailType === 'followup_j7' && settings.followup_j14) {
      nextFollowUp = new Date(initialSentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // J+14 depuis initial
    }

    await updateEmail(emailRecord.id, {
      status: 'sent',
      resend_id: result.id || null,
      sent_at: new Date().toISOString(),
      follow_up_scheduled_at: nextFollowUp,
    });

    await updateCampaign(campaign.id, {
      emails_sent: (campaign.emails_sent || 0) + 1,
    });

    console.log(`[PROSPECTION] Relance ${emailType} envoyee a ${prospect.email}`);
    return { success: true, emailId: emailRecord.id, emailType };
  } else {
    await updateEmail(emailRecord.id, { status: 'bounced', bounced_at: new Date().toISOString() });
    return { success: false, reason: result.error };
  }
}

/**
 * Lance l'envoi d'une campagne (batch)
 * Envoie aux prospects du secteur/ville qui ont un email et status = 'new'
 */
export async function executeCampaign(campaignId) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) throw new Error('Campagne introuvable');
  if (campaign.status !== 'active') throw new Error('Campagne non active');

  const { getProspects, updateProspect } = await import('./prospectionService.js');

  const results = { sent: 0, failed: 0, skipped: 0 };
  let currentPage = 1;
  let stopSending = false;

  // Parcourir toutes les pages de prospects eligibles
  while (!stopSending) {
    const { data: prospects } = await getProspects({
      sector: campaign.sector,
      hasEmail: true,
      status: 'new',
      page: currentPage,
      limit: 50,
    });

    if (!prospects || prospects.length === 0) break;

    // Filtrer par villes si specifiees
    const filtered = campaign.cities?.length > 0
      ? prospects.filter(p => campaign.cities.some(c => p.city?.toLowerCase().includes(c.toLowerCase())))
      : prospects;

    for (const prospect of filtered) {
      // Verifier limite journaliere campagne
      if (campaign.daily_send_limit && results.sent >= campaign.daily_send_limit) {
        results.skipped++;
        stopSending = true;
        break;
      }

      try {
        const result = await sendProspectionEmail(prospect, campaign);
        if (result.success) {
          results.sent++;
          await updateProspect(prospect.id, { status: 'contacted' });
        } else if (result.reason === 'global_pause' || result.reason?.startsWith('limite') || result.reason?.startsWith('hors_fenetre')) {
          results.skipped++;
          stopSending = true;
          break;
        } else {
          results.failed++;
        }
      } catch (err) {
        console.error(`[PROSPECTION] Erreur envoi ${prospect.name}:`, err.message);
        results.failed++;
      }
    }

    if (prospects.length < 50) break; // Derniere page
    currentPage++;
  }

  // Mettre a jour les stats campagne
  await updateCampaign(campaignId, {
    prospects_count: (campaign.prospects_count || 0) + results.sent,
  });

  console.log(`[PROSPECTION] Campagne ${campaign.name}: sent=${results.sent} failed=${results.failed} skipped=${results.skipped}`);
  return results;
}

export { generateUnsubscribeToken, getUnsubscribeUrl, canSendNow };

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  sendProspectionEmail, sendFollowUpEmail, executeCampaign,
  canSendNow, generateUnsubscribeToken, getUnsubscribeUrl,
};
