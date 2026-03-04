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

const DEFAULT_FROM = process.env.EMAIL_FROM || 'NEXUS <noreply@nexus-saas.com>';

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
 */
export async function sendEmail({ to, subject, html, from, replyTo, headers, tags }) {
  if (!resend) {
    console.log('[EMAIL] Resend non configure (RESEND_API_KEY manquante)');
    console.log(`[EMAIL] Email simule vers ${to}: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const result = await resend.emails.send({
      from: from || DEFAULT_FROM,
      to,
      subject,
      html,
      reply_to: replyTo || undefined,
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@nexus-saas.com?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'NEXUS-SaaS',
        ...headers,
      },
      tags: tags?.map(t => ({ name: t, value: 'true' })) || undefined,
    });

    console.log(`[EMAIL] Email envoye a ${to}: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('[EMAIL] Erreur envoi:', error.message);
    return { success: false, error: error.message };
  }
}

export default { sendEmail };
