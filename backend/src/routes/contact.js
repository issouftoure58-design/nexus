/**
 * Route formulaire de contact NEXUS
 * Envoie les messages via Resend
 */

import express from 'express';
import { Resend } from 'resend';

const router = express.Router();

// Configuration Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_CONFIGURED = !!RESEND_API_KEY;

let resend = null;
if (EMAIL_CONFIGURED) {
  resend = new Resend(RESEND_API_KEY);
  console.log('[Contact] Resend configuré');
}

// Email de destination (configurable via env)
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@nexus-ai.fr';

/**
 * POST /api/contact
 * Envoie un email de contact
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, business, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Nom, email et message sont requis'
      });
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Adresse email invalide'
      });
    }

    // Log pour debug
    console.log('[Contact] Nouveau message de:', name, email);

    // Si Resend n'est pas configuré, simuler l'envoi
    if (!EMAIL_CONFIGURED || !resend) {
      console.log('[Contact] Resend non configuré - simulation envoi');
      console.log('[Contact] To:', CONTACT_EMAIL);
      console.log('[Contact] From:', email);
      console.log('[Contact] Message:', message);

      return res.json({
        success: true,
        message: 'Message reçu (mode test)',
        simulated: true
      });
    }

    // Envoyer email via Resend
    const emailData = await resend.emails.send({
      from: 'NEXUS Contact <onboarding@resend.dev>', // Domaine test Resend
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[NEXUS Contact] Message de ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .field { margin-bottom: 16px; }
            .label { font-weight: 600; color: #374151; margin-bottom: 4px; }
            .value { color: #111827; }
            .message { background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
            .footer { padding: 16px; color: #6b7280; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">Nouveau message de contact</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Nom</div>
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:${email}">${email}</a></div>
              </div>
              ${phone ? `
              <div class="field">
                <div class="label">Téléphone</div>
                <div class="value"><a href="tel:${phone}">${phone}</a></div>
              </div>
              ` : ''}
              ${business ? `
              <div class="field">
                <div class="label">Type d'activité</div>
                <div class="value">${business}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="label">Message</div>
                <div class="message">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <div class="footer">
              Envoyé depuis le formulaire de contact NEXUS<br>
              ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Contact] Email envoyé:', emailData.id);

    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      id: emailData.id
    });

  } catch (error) {
    console.error('[Contact] Erreur:', error);

    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi du message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
