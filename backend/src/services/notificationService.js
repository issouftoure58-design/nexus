/**
 * Service de notifications - Email & WhatsApp
 * Multi-tenant : supporte plusieurs entreprises
 *
 * Envoie les notifications aux clients via Email ET WhatsApp
 */

import { Resend } from 'resend';
import { sendWhatsAppNotification } from './whatsappService.js';
import logger from '../config/logger.js';
import {
  confirmationReservation,
  rappelJ1,
  annulation,
  modificationRdv,
  remerciement,
  demandeAvis,
} from '../utils/whatsappTemplates.js';
import { getTenantConfig } from '../config/tenants/index.js';

// Helper : résoudre la config tenant
// 🔒 TENANT ISOLATION: tenantId est OBLIGATOIRE
function resolveTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: resolveTenant requires explicit tenantId');
  }
  const tc = getTenantConfig(tenantId);
  if (!tc) {
    throw new Error(`TENANT_NOT_FOUND: ${tenantId}`);
  }
  return {
    salonName: tc.name,
    gerante: tc.gerante,
    adresse: tc.adresse,
    telephone: tc.telephone,
    domain: tc.domain,
  };
}

// ============= CONFIGURATION EMAIL AVEC RESEND =============

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Fat\'s Hair-Afro <onboarding@resend.dev>';
const EMAIL_CONFIGURED = !!RESEND_API_KEY;

let resend = null;
if (EMAIL_CONFIGURED) {
  resend = new Resend(RESEND_API_KEY);
  logger.info('Email configuré avec Resend', { tag: 'NotificationService' });
} else {
  logger.warn('RESEND_API_KEY manquante - emails désactivés', { tag: 'NotificationService' });
}

// ============= FONCTION EMAIL AVEC RESEND =============

/**
 * Envoie un email via Resend
 * @param {string} to - Adresse email destinataire
 * @param {string} subject - Sujet
 * @param {string} html - Contenu HTML
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail(to, subject, html) {
  if (!EMAIL_CONFIGURED || !resend) {
    console.log(`[Email] ⚠️ Email non configuré - To: ${to}, Subject: ${subject}`);
    return { success: false, error: 'RESEND_API_KEY non configurée', simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[Email] ❌ Erreur Resend:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] ✅ Email envoyé à ${to}: ${subject} (ID: ${data.id})`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`[Email] ❌ Exception:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============= FONCTIONS DE NOTIFICATION =============

/**
 * Envoie une confirmation de réservation (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous
 * @param {number} acompte - Montant de l'acompte payé (défaut: 10€)
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendConfirmation(rdv, acompte = 10, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
    sms: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = rdv.client_telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.client_nom || 'Client';

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
      const reste = total - acompte;

      const emailHtml = `
        <h2>Réservation confirmée !</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Votre rendez-vous chez ${t.salonName} est confirmé :</p>
        <ul>
          <li><strong>Date :</strong> ${rdv.date} à ${rdv.heure}</li>
          <li><strong>Service :</strong> ${rdv.service_nom}</li>
          <li><strong>Adresse :</strong> ${rdv.adresse_client || rdv.adresse_formatee}</li>
          <li><strong>Total :</strong> ${total}€</li>
          <li><strong>Acompte réglé :</strong> ${acompte}€</li>
          ${reste > 0 ? `<li><strong>Reste à payer :</strong> ${reste}€</li>` : ''}
        </ul>
        <p style="margin-top: 20px;">
          <a href="https://${t.domain}/compte" style="color: #8B5CF6; text-decoration: none;">🔗 Créer votre compte client</a><br>
          <a href="https://${t.domain}/avis" style="color: #8B5CF6; text-decoration: none;">⭐ Laissez un avis après votre RDV</a>
        </p>
        <p>À bientôt !<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Confirmation de votre réservation - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email confirmation envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email confirmation:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp (ne bloque pas si erreur)
  if (clientPhone) {
    try {
      const whatsappMessage = confirmationReservation(rdv, acompte);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp confirmation envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp confirmation:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. Envoyer SMS via Twilio
  if (clientPhone) {
    try {
      const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
      const lieuText = rdv.adresse_client || t.adresse;

      const smsMessage = `${t.salonName}
Votre RDV est confirmé !

${rdv.date} à ${rdv.heure}
${rdv.service_nom}
${total}€

${lieuText}

À bientôt !
${t.gerante} - ${t.telephone}`;

      // Import dynamique Twilio
      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Formater le numéro
      let formattedPhone = clientPhone.replace(/\s/g, '').replace(/\./g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+33' + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+33' + formattedPhone;
      }

      const smsResult = await twilioClient.messages.create({
        body: smsMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      results.sms = { success: true, sid: smsResult.sid };
      console.log(`[Notification] ✅ SMS confirmation envoyé à ${formattedPhone} (SID: ${smsResult.sid})`);
    } catch (error) {
      console.error('[Notification] ❌ Erreur envoi SMS:', error.message);
      results.sms = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie un rappel J-1 (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous
 * @param {number} acompte - Montant de l'acompte déjà payé
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendRappelJ1(rdv, acompte = 10, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
    sms: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = rdv.client_telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.client_nom || 'Client';
  const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
  const reste = total - acompte;

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      const emailHtml = `
        <h2>Rappel : votre RDV demain !</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Un petit rappel pour votre rendez-vous de demain :</p>
        <ul>
          <li><strong>Date :</strong> ${rdv.date} à ${rdv.heure}</li>
          <li><strong>Service :</strong> ${rdv.service_nom}</li>
          <li><strong>Adresse :</strong> ${rdv.adresse_client || rdv.adresse_formatee}</li>
          <li><strong>Reste à payer :</strong> ${reste}€</li>
        </ul>
        <p><strong>Conseils :</strong></p>
        <ul>
          <li>Cheveux propres et démêlés si possible</li>
          <li>Prévoir environ ${Math.floor(rdv.duree_minutes / 60)}h${rdv.duree_minutes % 60 || ''}</li>
        </ul>
        <p>Si vous devez annuler, prévenez-nous rapidement.</p>
        <p>À demain !<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Rappel : votre RDV demain - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email rappel J-1 envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email rappel:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp
  if (clientPhone) {
    try {
      const whatsappMessage = rappelJ1(rdv, acompte);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp rappel J-1 envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp rappel:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. Envoyer SMS via Twilio
  if (clientPhone && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const lieuText = rdv.adresse_client || rdv.adresse_formatee || t.adresse;

      const smsMessage = `${t.salonName}
Rappel: RDV demain!

${rdv.date} à ${rdv.heure}
${rdv.service_nom}
Reste à payer: ${reste}€

${lieuText}

À demain!
${t.gerante} - ${t.telephone}`;

      // Import dynamique Twilio
      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Formater le numéro
      let formattedPhone = clientPhone.replace(/\s/g, '').replace(/\./g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+33' + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+33' + formattedPhone;
      }

      const smsResult = await twilioClient.messages.create({
        body: smsMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });

      results.sms = { success: true, sid: smsResult.sid };
      console.log(`[Notification] ✅ SMS rappel J-1 envoyé à ${formattedPhone} (SID: ${smsResult.sid})`);
    } catch (error) {
      console.error('[Notification] ❌ Erreur envoi SMS rappel:', error.message);
      results.sms = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie une notification d'annulation (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous
 * @param {number} montantRembourse - Montant remboursé (0 si acompte retenu)
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendAnnulation(rdv, montantRembourse = 0, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = rdv.client_telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.client_nom || 'Client';

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      let remboursementHtml = '';
      if (montantRembourse > 0) {
        remboursementHtml = `
          <p><strong>Remboursement :</strong> ${montantRembourse}€</p>
          <p>Vous serez remboursé(e) sous 3 à 5 jours ouvrés.</p>
        `;
      } else {
        remboursementHtml = `
          <p><strong>Acompte retenu :</strong> 10€</p>
          <p><em>(Annulation effectuée plus de 24h après la réservation)</em></p>
        `;
      }

      const emailHtml = `
        <h2>Annulation de votre rendez-vous</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Votre rendez-vous du ${rdv.date} à ${rdv.heure} a été annulé.</p>
        ${remboursementHtml}
        <p>N'hésitez pas à reprendre rendez-vous quand vous le souhaitez !</p>
        <p>À bientôt,<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Annulation de votre rendez-vous - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email annulation envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email annulation:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp
  if (clientPhone) {
    try {
      const whatsappMessage = annulation(rdv, montantRembourse);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp annulation envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp annulation:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie une notification de modification (Email + WhatsApp)
 *
 * @param {Object} ancienRdv - Ancien rendez-vous
 * @param {Object} nouveauRdv - Nouveau rendez-vous
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendModification(ancienRdv, nouveauRdv, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = nouveauRdv.client_telephone || nouveauRdv.telephone;
  const clientEmail = nouveauRdv.client_email || nouveauRdv.email;
  const clientNom = nouveauRdv.client_prenom || nouveauRdv.client_nom || 'Client';
  const total = nouveauRdv.total || (nouveauRdv.prix_service + (nouveauRdv.frais_deplacement || 0));

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      const emailHtml = `
        <h2>Modification de votre rendez-vous</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Votre rendez-vous a été modifié :</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; background: #ffe6e6;">
              <strong>Ancien :</strong> ${ancienRdv.date} à ${ancienRdv.heure}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #e6ffe6;">
              <strong>Nouveau :</strong> ${nouveauRdv.date} à ${nouveauRdv.heure}
            </td>
          </tr>
        </table>
        <ul>
          <li><strong>Service :</strong> ${nouveauRdv.service_nom}</li>
          <li><strong>Adresse :</strong> ${nouveauRdv.adresse_client || nouveauRdv.adresse_formatee}</li>
          <li><strong>Total :</strong> ${total}€</li>
        </ul>
        <p>À bientôt !<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Modification de votre rendez-vous - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email modification envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email modification:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp
  if (clientPhone) {
    try {
      const whatsappMessage = modificationRdv(ancienRdv, nouveauRdv);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp modification envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp modification:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie un remerciement après prestation (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendRemerciement(rdv, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = rdv.client_telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.client_nom || 'Client';

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      const emailHtml = `
        <h2>Merci pour votre visite ! 💜</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Merci d'avoir fait confiance à ${t.salonName} !</p>
        <p>J'espère que vous êtes ravie de votre coiffure.</p>
        <p>N'hésitez pas à :</p>
        <ul>
          <li>Reprendre rendez-vous</li>
          <li>Partager une photo de votre coiffure</li>
          <li>Recommander à vos proches</li>
        </ul>
        <p>À très bientôt !<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Merci pour votre visite ! - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email remerciement envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email remerciement:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp
  if (clientPhone) {
    try {
      const whatsappMessage = remerciement(rdv);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp remerciement envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp remerciement:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie une demande d'avis (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous
 * @param {string} lienAvis - URL du formulaire d'avis
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendDemandeAvis(rdv, lienAvis = null, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const finalLienAvis = lienAvis || `https://${t.domain}/avis`;
  const clientPhone = rdv.client_telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.client_nom || 'Client';

  // 1. Envoyer Email
  if (clientEmail) {
    try {
      const emailHtml = `
        <h2>Votre avis compte ! 🌟</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Comment s'est passé votre rendez-vous chez ${t.salonName} ?</p>
        <p>Votre avis nous aide à nous améliorer et aide d'autres clientes à nous découvrir.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${finalLienAvis}" style="background: #8B5CF6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Donner mon avis
          </a>
        </p>
        <p>Merci beaucoup !<br>${t.gerante} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Votre avis compte ! - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email demande avis envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi email demande avis:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp
  if (clientPhone) {
    try {
      const whatsappMessage = demandeAvis(rdv, lienAvis);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);

      console.log(`[Notification] WhatsApp demande avis envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp demande avis:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

/**
 * Envoie une notification de changement de statut RDV (Email + WhatsApp)
 *
 * @param {Object} rdv - Données du rendez-vous (avec clients joint)
 * @param {string} action - Action effectuée: 'confirmer', 'annuler', 'terminer', 'deplacer'
 * @returns {Promise<{email: Object, whatsapp: Object}>}
 */
export async function sendStatusChange(rdv, action, tenantId = null) {
  const results = {
    email: { success: false, error: 'Non envoyé' },
    whatsapp: { success: false, error: 'Non envoyé' },
  };

  const t = resolveTenant(tenantId);
  const clientPhone = rdv.client_telephone || rdv.clients?.telephone || rdv.telephone;
  const clientEmail = rdv.client_email || rdv.clients?.email || rdv.email;
  const clientNom = rdv.client_prenom || rdv.clients?.prenom || rdv.clients?.nom || rdv.client_nom || 'Client';

  const actionLabels = {
    confirmer: 'confirmé',
    annuler: 'annulé',
    terminer: 'terminé',
    deplacer: 'déplacé'
  };

  const statutLabel = actionLabels[action] || action;

  // 1. Email
  if (clientEmail) {
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${t.salonName}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Coiffure Afro à Domicile</p>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1a1a1a;">Rendez-vous ${statutLabel}</h2>
            <p style="color: #4a4a4a; line-height: 1.6;">
              Bonjour ${clientNom},<br>
              Votre rendez-vous a été <strong>${statutLabel}</strong>.
            </p>
            <ul style="color: #4a4a4a;">
              <li><strong>Date :</strong> ${rdv.date} à ${rdv.heure}</li>
              <li><strong>Service :</strong> ${rdv.service_nom || 'Non précisé'}</li>
              <li><strong>Statut :</strong> ${statutLabel}</li>
            </ul>
            ${action === 'annuler' ? "<p>N'hésitez pas à reprendre rendez-vous quand vous le souhaitez !</p>" : ''}
            ${action === 'confirmer' ? '<p>Nous avons hâte de vous accueillir !</p>' : ''}
            ${action === 'deplacer' ? `<p>Nouvelle date : <strong>${rdv.date} à ${rdv.heure}</strong></p>` : ''}
            <p>À bientôt !<br>${t.gerante} - ${t.salonName}</p>
          </div>
          <div style="padding: 15px; background: #f3f0ff; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 12px 12px;">
            <p style="margin: 0;">${t.salonName} - ${t.adresse}</p>
            <p style="margin: 5px 0 0 0;">📞 ${t.telephone}</p>
          </div>
        </div>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Rendez-vous ${statutLabel} - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email changement statut (${action}) envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
    } catch (error) {
      console.error('[Notification] Erreur email changement statut:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. WhatsApp
  if (clientPhone) {
    try {
      const message = `Bonjour ${clientNom},\n\nVotre rendez-vous du ${rdv.date} à ${rdv.heure} a été ${statutLabel}.\n\nÀ bientôt !\n${t.gerante} - ${t.salonName}`;
      results.whatsapp = await sendWhatsAppNotification(clientPhone, message, tenantId);

      console.log(`[Notification] WhatsApp changement statut (${action}) envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur WhatsApp changement statut:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

// ============= FONCTIONS UTILITAIRES =============

/**
 * Vérifie le statut des services de notification
 * @returns {Object} État de configuration
 */
export function getNotificationServicesStatus() {
  return {
    email: {
      configured: EMAIL_CONFIGURED,
      from: EMAIL_FROM,
    },
    whatsapp: {
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    },
  };
}

// Export par défaut
export default {
  sendConfirmation,
  sendRappelJ1,
  sendAnnulation,
  sendModification,
  sendRemerciement,
  sendDemandeAvis,
  sendStatusChange,
  getNotificationServicesStatus,
};
