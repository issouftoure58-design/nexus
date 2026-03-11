/**
 * Email Service
 * Wrapper pour l'envoi d'emails via Resend
 */

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
let resend = null;

if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

// En dev/test sans domaine verifie, Resend exige onboarding@resend.dev
// En production avec domaine verifie, utiliser EMAIL_FROM=NEXUS <noreply@votredomaine.com>
const DEFAULT_FROM = process.env.EMAIL_FROM || 'NEXUS <onboarding@resend.dev>';

/**
 * Envoie un email avec bonnes pratiques deliverability
 * @param {Object} options - Options de l'email
 * @param {string} options.to - Destinataire
 * @param {string} options.subject - Sujet
 * @param {string} options.html - Contenu HTML
 * @param {string} options.from - Expediteur (optionnel)
 * @param {string} options.replyTo - Reply-To (optionnel)
 * @param {Object} options.headers - Headers additionnels (optionnel)
 * @param {string[]} options.tags - Tags Resend pour analytics (optionnel)
 * @param {Array} options.attachments - Pieces jointes [{ filename, content: Buffer }] (optionnel)
 */
export async function sendEmail({ to, subject, html, from, replyTo, headers, tags, attachments }) {
  if (!resend) {
    console.log('[EMAIL] Resend non configure (RESEND_API_KEY manquante)');
    console.log(`[EMAIL] Email simule vers ${to}: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const emailData = {
      from: from || DEFAULT_FROM,
      to,
      subject,
      html,
      reply_to: replyTo || undefined,
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@nexus-ai-saas.com?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'NEXUS-SaaS',
        ...headers,
      },
      tags: tags?.map(t => ({ name: t, value: 'true' })) || undefined,
    };
    if (attachments?.length) emailData.attachments = attachments;

    const result = await resend.emails.send(emailData);

    console.log(`[EMAIL] Email envoye a ${to}: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('[EMAIL] Erreur envoi:', error.message);
    return { success: false, error: error.message };
  }
}

export default { sendEmail };
