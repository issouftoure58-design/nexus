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

const DEFAULT_FROM = process.env.EMAIL_FROM || 'NEXUS <noreply@nexus-ai-saas.com>';

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

/**
 * Template HTML pour l'email de verification au signup.
 * Lien cliquable, valide 24h.
 *
 * @param {string} verificationUrl - URL complete avec token
 * @returns {string} HTML
 */
export function templateEmailVerification(verificationUrl) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">NEXUS</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Verifiez votre adresse email</h2>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
            Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et continuer la creation de votre compte NEXUS.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${verificationUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Verifier mon email
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#71717a;font-size:13px;">Ou copiez ce lien dans votre navigateur :</p>
          <p style="margin:0 0 24px;color:#6366f1;font-size:13px;word-break:break-all;">${verificationUrl}</p>
          <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">Ce lien est valide 24 heures. Si vous n'avez pas demande cette verification, ignorez cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export default { sendEmail, templateEmailVerification };
