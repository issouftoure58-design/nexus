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

/**
 * Envoie un email
 * @param {Object} options - Options de l'email
 * @param {string} options.to - Destinataire
 * @param {string} options.subject - Sujet
 * @param {string} options.html - Contenu HTML
 * @param {string} options.from - Expediteur (optionnel)
 */
export async function sendEmail({ to, subject, html, from }) {
  if (!resend) {
    console.log('[EMAIL] Resend non configure (RESEND_API_KEY manquante)');
    console.log(`[EMAIL] Email simule vers ${to}: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const result = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || 'NEXUS <noreply@nexus-saas.com>',
      to,
      subject,
      html
    });

    console.log(`[EMAIL] Email envoye a ${to}: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('[EMAIL] Erreur envoi:', error.message);
    return { success: false, error: error.message };
  }
}

export default { sendEmail };
