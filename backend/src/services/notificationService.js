/**
 * Service de notifications - Email & WhatsApp
 * Multi-tenant : supporte plusieurs entreprises
 *
 * Envoie les notifications aux clients via Email ET WhatsApp
 */

import { Resend } from 'resend';
import { sendWhatsAppNotification } from './whatsappService.js';
import { sendSMS } from './smsService.js';
import { consume as consumeCredits } from './creditsService.js';
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

  const rawGerante = tc.gerante;
  const signataire = (rawGerante && rawGerante !== 'undefined') ? rawGerante : 'L\'équipe';

  return {
    salonName: tc.name,
    signataire,
    adresse: tc.adresse,
    telephone: tc.telephone,
    domain: tc.domain,
    businessProfile: tc.business_profile || null,
    concept: tc.concept || null,
  };
}

/**
 * Labels adaptes au business type du tenant
 */
function getBusinessLabels(businessProfile) {
  const bp = businessProfile || 'generic';
  const labels = {
    salon: { rdv: 'rendez-vous', sejour: 'rendez-vous', serviceLabel: 'Service', lieu: 'chez', accueil: 'Nous avons hate de vous accueillir !' },
    service_domicile: { rdv: 'rendez-vous', sejour: 'rendez-vous', serviceLabel: 'Prestation', lieu: 'chez vous', accueil: 'Nous avons hate de vous retrouver !' },
    restaurant: { rdv: 'reservation', sejour: 'reservation', serviceLabel: 'Formule', lieu: 'au restaurant', accueil: 'Nous avons hate de vous accueillir !' },
    hotel: { rdv: 'sejour', sejour: 'sejour', serviceLabel: 'Chambre', lieu: 'dans notre etablissement', accueil: 'Nous avons hate de vous accueillir !' },
    commerce: { rdv: 'commande', sejour: 'commande', serviceLabel: 'Article', lieu: 'chez', accueil: 'Votre commande sera prete a temps !' },
    security: { rdv: 'mission', sejour: 'mission', serviceLabel: 'Mission', lieu: 'sur site', accueil: 'Notre equipe sera prete.' },
    service: { rdv: 'rendez-vous', sejour: 'rendez-vous', serviceLabel: 'Prestation', lieu: 'chez', accueil: 'A bientot !' },
  };
  return labels[bp] || labels.salon;
}

/**
 * Construit un bloc HTML detaille adapte au business type.
 * Hotel: check-in → check-out + prestations (chambre + extras)
 * Autre: date/heure + service unique
 */
function buildDetailsHtml(rdv, t, labels) {
  const isHotel = t.businessProfile === 'hotel';
  const items = [];

  if (isHotel && (rdv.date_depart || rdv.date_arrivee)) {
    const checkinDate = rdv.date_arrivee || rdv.date;
    const checkinHour = rdv.heure || rdv.heure_arrivee || '14:00';
    const checkoutDate = rdv.date_depart || rdv.date;
    const checkoutHour = rdv.heure_fin || '11:00';
    items.push(`<li><strong>Check-in :</strong> ${checkinDate} a ${checkinHour}</li>`);
    items.push(`<li><strong>Check-out :</strong> ${checkoutDate} a ${checkoutHour}</li>`);
    if (rdv.nb_nuitees) {
      items.push(`<li><strong>Duree :</strong> ${rdv.nb_nuitees} nuit${rdv.nb_nuitees > 1 ? 's' : ''}</li>`);
    }
    if (rdv.nb_personnes) {
      items.push(`<li><strong>Personnes :</strong> ${rdv.nb_personnes}</li>`);
    }
  } else {
    items.push(`<li><strong>Date :</strong> ${rdv.date} a ${rdv.heure}</li>`);
  }

  // Prestations : liste multi-items (chambre + extras) si dispo, sinon service unique
  if (Array.isArray(rdv.services) && rdv.services.length > 0) {
    const presta = rdv.services.map(s => {
      const qty = s.quantite && s.quantite > 1 ? ` x${s.quantite}` : '';
      const prix = s.prix_total ? ` — ${s.prix_total}€` : '';
      return `<li>${s.service_nom}${qty}${prix}</li>`;
    }).join('');
    items.push(`<li><strong>${isHotel ? 'Prestations' : labels.serviceLabel} :</strong><ul style="margin:6px 0 0;">${presta}</ul></li>`);
  } else if (rdv.service_nom) {
    items.push(`<li><strong>${labels.serviceLabel} :</strong> ${rdv.service_nom}</li>`);
  }

  // Adresse : hotel = adresse etablissement, autre = adresse client (si service a domicile) ou adresse etablissement
  const adresse = isHotel
    ? (t.adresse || '')
    : (rdv.adresse_client || rdv.adresse_formatee || t.adresse || '');
  if (adresse) {
    items.push(`<li><strong>Adresse :</strong> ${adresse}</li>`);
  }

  return items.join('\n          ');
}

// ============= CONFIGURATION EMAIL AVEC RESEND =============

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'NEXUS <noreply@nexus-ai-saas.com>';
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
export async function sendConfirmation(rdv, acompte = 0, tenantId = null) {
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
      const reste = acompte > 0 ? total - acompte : 0;

      const acompteHtml = acompte > 0
        ? `<li><strong>Acompte réglé :</strong> ${acompte}€</li>
          ${reste > 0 ? `<li><strong>Reste à payer :</strong> ${reste}€</li>` : ''}`
        : '';

      // Template adaptatif selon business type (hotel: check-in/out + extras, autre: date+service)
      const labels = getBusinessLabels(t.businessProfile);
      const detailsHtml = buildDetailsHtml(rdv, t, labels);
      const titre = t.businessProfile === 'hotel' ? 'Sejour confirme !' : 'Reservation confirmee !';
      const introText = `Votre ${labels.sejour} ${labels.lieu} ${t.salonName} est confirme :`;
      const avisText = `Laissez un avis apres votre ${labels.sejour}`;

      const emailHtml = `
        <h2>${titre}</h2>
        <p>Bonjour ${clientNom},</p>
        <p>${introText}</p>
        <ul>
          ${detailsHtml}
          <li><strong>Total :</strong> ${total}€</li>
          ${acompteHtml}
        </ul>
        <p style="margin-top: 20px;">
          <a href="https://${t.domain}/compte" style="color: #8B5CF6; text-decoration: none;">Creer votre compte client</a><br>
          <a href="https://${t.domain}/avis" style="color: #8B5CF6; text-decoration: none;">${avisText}</a>
        </p>
        <p>${labels.accueil}<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Confirmation de votre ${labels.sejour} - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email confirmation envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email confirmation — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur envoi email confirmation:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp (simultané, pas de cascade)
  if (clientPhone) {
    try {
      const whatsappMessage = confirmationReservation(rdv, acompte, tenantId);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);
      if (results.whatsapp.success) {
        consumeCredits(tenantId, 'whatsapp_notification', {
          description: `Notification confirmation WhatsApp — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction WA failed: ${err.message}`));
      }
      console.log(`[Notification] WhatsApp confirmation envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp confirmation:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. SMS (envoi simultané — plus de cascade, payé par crédits du tenant)
  if (clientPhone) {
    try {
      const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
      const lieuText = rdv.adresse_client || t.adresse;
      const smsMessage = `${t.salonName}\nVotre RDV est confirmé !\n\n${rdv.date} à ${rdv.heure}\n${rdv.service_nom}\n${total}€\n\n${lieuText}\n\nÀ bientôt !\n${t.signataire} - ${t.telephone}`;

      results.sms = await sendSMS(clientPhone, smsMessage, tenantId, { essential: true });
      if (results.sms.success) {
        consumeCredits(tenantId, 'sms_notification', {
          description: `SMS confirmation — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction SMS failed: ${err.message}`));
      }
      console.log(`[Notification] SMS confirmation envoyé à ${clientPhone}:`, results.sms.success ? 'OK' : results.sms.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi SMS:', error.message);
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
      // Template adaptatif (hotel: check-in/out + prestations, autre: date + service)
      const labels = getBusinessLabels(t.businessProfile);
      const detailsHtml = buildDetailsHtml(rdv, t, labels);
      const isHotel = t.businessProfile === 'hotel';
      const titre = isHotel ? 'Rappel : votre arrivee demain !' : 'Rappel : votre RDV demain !';
      const introText = isHotel
        ? `Un petit rappel pour votre ${labels.sejour} qui commence demain :`
        : 'Un petit rappel pour votre rendez-vous de demain :';

      const emailHtml = `
        <h2>${titre}</h2>
        <p>Bonjour ${clientNom},</p>
        <p>${introText}</p>
        <ul>
          ${detailsHtml}
          ${reste > 0 ? `<li><strong>Reste a payer :</strong> ${reste}€</li>` : ''}
        </ul>
        <p>Si vous devez annuler, prevenez-nous rapidement.</p>
        <p>A demain !<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Rappel : votre RDV demain - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email rappel J-1 envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email rappel J-1 — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur envoi email rappel:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp (simultané)
  if (clientPhone) {
    try {
      const whatsappMessage = rappelJ1(rdv, acompte, tenantId);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);
      if (results.whatsapp.success) {
        consumeCredits(tenantId, 'whatsapp_notification', {
          description: `Notification rappel J-1 WhatsApp — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction WA failed: ${err.message}`));
      }
      console.log(`[Notification] WhatsApp rappel J-1 envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp rappel:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. SMS (simultané — payé par crédits du tenant)
  if (clientPhone) {
    try {
      const lieuText = rdv.adresse_client || rdv.adresse_formatee || t.adresse;
      const smsMessage = `${t.salonName}\nRappel: RDV demain!\n\n${rdv.date} à ${rdv.heure}\n${rdv.service_nom}\nReste à payer: ${reste}€\n\n${lieuText}\n\nÀ demain!\n${t.signataire} - ${t.telephone}`;

      results.sms = await sendSMS(clientPhone, smsMessage, tenantId, { essential: true });
      if (results.sms.success) {
        consumeCredits(tenantId, 'sms_notification', {
          description: `SMS rappel J-1 — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction SMS failed: ${err.message}`));
      }
      console.log(`[Notification] SMS rappel J-1 envoyé à ${clientPhone}:`, results.sms.success ? 'OK' : results.sms.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi SMS rappel:', error.message);
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
    sms: { success: false, error: 'Non envoyé' },
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

      const labels = getBusinessLabels(t.businessProfile);
      const isHotel = t.businessProfile === 'hotel';
      const dateAnnule = isHotel && rdv.date_arrivee
        ? `du ${rdv.date_arrivee}${rdv.date_depart ? ` au ${rdv.date_depart}` : ''}`
        : `du ${rdv.date} a ${rdv.heure}`;

      const emailHtml = `
        <h2>Annulation de votre ${labels.sejour}</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Votre ${labels.sejour} ${dateAnnule} a ete annule.</p>
        ${remboursementHtml}
        <p>N'hesitez pas a revenir quand vous le souhaitez !</p>
        <p>A bientot,<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Annulation de votre ${labels.sejour} - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email annulation envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email annulation — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur envoi email annulation:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp (simultané)
  if (clientPhone) {
    try {
      const whatsappMessage = annulation(rdv, montantRembourse);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);
      if (results.whatsapp.success) {
        consumeCredits(tenantId, 'whatsapp_notification', {
          description: `Notification annulation WhatsApp — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction WA failed: ${err.message}`));
      }
      console.log(`[Notification] WhatsApp annulation envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp annulation:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. SMS (simultané — payé par crédits du tenant)
  if (clientPhone) {
    try {
      const labels = getBusinessLabels(t.businessProfile);
      const smsMessage = `${t.salonName}\nVotre ${labels.sejour} a été annulé.${montantRembourse > 0 ? `\nRemboursement: ${montantRembourse}€` : ''}\n\nÀ bientôt !\n${t.signataire}`;
      results.sms = await sendSMS(clientPhone, smsMessage, tenantId, { essential: true });
      if (results.sms?.success) {
        consumeCredits(tenantId, 'sms_notification', {
          description: `SMS annulation — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction SMS failed: ${err.message}`));
      }
    } catch (error) {
      logger.warn(`[Notification] Erreur envoi SMS annulation: ${error.message}`);
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
      const labels = getBusinessLabels(t.businessProfile);
      const isHotel = t.businessProfile === 'hotel';
      const detailsHtml = buildDetailsHtml(nouveauRdv, t, labels);
      const ancienLabel = isHotel && ancienRdv.date_arrivee
        ? `du ${ancienRdv.date_arrivee}${ancienRdv.date_depart ? ` au ${ancienRdv.date_depart}` : ''}`
        : `${ancienRdv.date} a ${ancienRdv.heure}`;
      const nouveauLabel = isHotel && nouveauRdv.date_arrivee
        ? `du ${nouveauRdv.date_arrivee}${nouveauRdv.date_depart ? ` au ${nouveauRdv.date_depart}` : ''}`
        : `${nouveauRdv.date} a ${nouveauRdv.heure}`;

      const emailHtml = `
        <h2>Modification de votre ${labels.sejour}</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Votre ${labels.sejour} a ete modifie :</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; background: #ffe6e6;">
              <strong>Ancien :</strong> ${ancienLabel}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #e6ffe6;">
              <strong>Nouveau :</strong> ${nouveauLabel}
            </td>
          </tr>
        </table>
        <ul>
          ${detailsHtml}
          <li><strong>Total :</strong> ${total}€</li>
        </ul>
        <p>A bientot !<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Modification de votre ${labels.sejour} - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email modification envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email modification — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur envoi email modification:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. Envoyer WhatsApp (simultané)
  if (clientPhone) {
    try {
      const whatsappMessage = modificationRdv(ancienRdv, nouveauRdv, tenantId);
      results.whatsapp = await sendWhatsAppNotification(clientPhone, whatsappMessage, tenantId);
      if (results.whatsapp.success) {
        consumeCredits(tenantId, 'whatsapp_notification', {
          description: `Notification modification WhatsApp — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction WA failed: ${err.message}`));
      }
      console.log(`[Notification] WhatsApp modification envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi WhatsApp modification:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. SMS (simultané — payé par crédits du tenant)
  if (clientPhone) {
    try {
      const total = nouveauRdv.total || (nouveauRdv.prix_service + (nouveauRdv.frais_deplacement || 0));
      const smsMessage = `${t.salonName}\nVotre RDV a été modifié !\n\n${nouveauRdv.date} à ${nouveauRdv.heure}\n${nouveauRdv.service_nom}\n${total}€\n\nÀ bientôt !\n${t.signataire}`;
      results.sms = await sendSMS(clientPhone, smsMessage, tenantId, { essential: true });
      if (results.sms.success) {
        consumeCredits(tenantId, 'sms_notification', {
          description: `SMS modification — ${clientPhone}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction SMS failed: ${err.message}`));
      }
      console.log(`[Notification] SMS modification envoyé à ${clientPhone}:`, results.sms.success ? 'OK' : results.sms.error);
    } catch (error) {
      console.error('[Notification] Erreur envoi SMS modification:', error.message);
      results.sms = { success: false, error: error.message };
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
      // Adapter le message selon le business type
      const bp = t.businessProfile || 'generic';
      const thankMsg = {
        salon: `Nous esperons que vous etes satisfait(e) de votre prestation.`,
        service_domicile: `Nous esperons que vous etes satisfait(e) de votre prestation.`,
        restaurant: `Nous esperons que vous avez passe un excellent moment.`,
        commerce: `Nous esperons que votre commande vous a donne satisfaction.`,
        hotel: `Nous esperons que votre sejour s'est bien passe.`,
        security: `Nous esperons que notre prestation a ete a la hauteur de vos attentes.`,
      };
      const actions = {
        salon: [
          'Reprendre rendez-vous',
          'Laisser un avis en ligne',
          'Recommander a vos proches',
        ],
        service_domicile: [
          'Reprendre rendez-vous',
          'Laisser un avis en ligne',
          'Recommander a vos proches',
        ],
        restaurant: [
          'Reserver a nouveau',
          'Laisser un avis en ligne',
          'Recommander a vos proches',
        ],
        commerce: [
          'Passer une nouvelle commande',
          'Laisser un avis en ligne',
          'Recommander a vos proches',
        ],
        hotel: [
          'Reserver a nouveau',
          'Partager votre experience en ligne',
          'Recommander a vos proches',
        ],
        security: [
          'Nous recontacter pour une future mission',
          'Laisser un avis en ligne',
          'Recommander a vos partenaires',
        ],
      };
      const defaultActions = [
        'Reprendre rendez-vous',
        'Laisser un avis en ligne',
        'Recommander a vos proches',
      ];
      const msgBody = thankMsg[bp] || `Nous esperons que vous etes satisfait(e) de votre visite.`;
      const actionList = actions[bp] || defaultActions;

      const emailHtml = `
        <h2>Merci pour votre visite ! 💜</h2>
        <p>Bonjour ${clientNom},</p>
        <p>Merci d'avoir fait confiance à ${t.salonName} !</p>
        <p>${msgBody}</p>
        <p>N'hésitez pas à :</p>
        <ul>
          ${actionList.map(a => `<li>${a}</li>`).join('\n          ')}
        </ul>
        <p>A tres bientot !<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Merci pour votre visite ! - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email remerciement envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email remerciement — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
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
        <p>Votre avis nous aide à nous améliorer et aide d'autres clients a nous decouvrir.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${finalLienAvis}" style="background: #8B5CF6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Donner mon avis
          </a>
        </p>
        <p>Merci beaucoup !<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        clientEmail,
        `Votre avis compte ! - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email demande avis envoyé à ${clientEmail}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email demande avis — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
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
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${t.concept || ''}</p>
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
            <p>À bientôt !<br>${t.signataire} - ${t.salonName}</p>
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
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email statut ${action} — ${clientEmail}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur email changement statut:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. WhatsApp
  if (clientPhone) {
    try {
      const message = `Bonjour ${clientNom},\n\nVotre rendez-vous du ${rdv.date} à ${rdv.heure} a été ${statutLabel}.\n\nÀ bientôt !\n${t.signataire} - ${t.salonName}`;
      results.whatsapp = await sendWhatsAppNotification(clientPhone, message, tenantId);

      console.log(`[Notification] WhatsApp changement statut (${action}) envoyé à ${clientPhone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur WhatsApp changement statut:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  return results;
}

// ============= DEMANDE D'ACOMPTE =============

/**
 * Envoie une demande d'acompte au client (Email → WhatsApp → SMS cascade)
 * Inclut le montant et le lien de paiement du tenant
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} phone - Telephone du client
 * @param {Object} details - { montant, total, lien, service, date, heure, clientNom }
 * @param {string|null} email - Email du client (optionnel)
 * @returns {Promise<{email: Object, whatsapp: Object, sms: Object}>}
 */
export async function sendDepositRequest(tenantId, phone, details, email = null) {
  const results = {
    email: { success: false, error: 'Non envoye' },
    whatsapp: { success: false, error: 'Non envoye' },
    sms: { success: false, error: 'Non envoye' },
  };

  const t = resolveTenant(tenantId);
  const { montant, total, lien, service, date, heure, clientNom } = details;
  const nom = clientNom || 'Client';

  // 1. Email
  if (email) {
    try {
      const emailHtml = `
        <h2>Acompte requis pour votre reservation</h2>
        <p>Bonjour ${nom},</p>
        <p>Pour confirmer votre rendez-vous chez <strong>${t.salonName}</strong>, un acompte est requis :</p>
        <ul>
          <li><strong>Date :</strong> ${date} a ${heure}</li>
          <li><strong>Service :</strong> ${service}</li>
          <li><strong>Total :</strong> ${total}\u20AC</li>
          <li><strong>Acompte a regler :</strong> ${montant}\u20AC</li>
        </ul>
        ${lien ? `<p style="margin-top: 20px;"><a href="${lien}" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Regler l'acompte</a></p>` : ''}
        <p style="color: #666; font-size: 14px;">Votre rendez-vous sera confirme des reception du paiement.</p>
        <p>A bientot !<br>${t.signataire} - ${t.salonName}</p>
      `;

      results.email = await sendEmail(
        email,
        `Acompte requis - ${t.salonName}`,
        emailHtml
      );

      console.log(`[Notification] Email acompte envoye a ${email}:`, results.email.success ? 'OK' : results.email.error);
      if (results.email.success) {
        consumeCredits(tenantId, 'email_notification', {
          description: `Email acompte — ${email}`,
        }).catch(err => logger.warn(`[Notification] Credit deduction email failed: ${err.message}`));
      }
    } catch (error) {
      console.error('[Notification] Erreur envoi email acompte:', error.message);
      results.email = { success: false, error: error.message };
    }
  }

  // 2. WhatsApp
  if (phone) {
    try {
      const waMessage = `Bonjour ${nom},\n\nPour confirmer votre RDV du ${date} a ${heure} (${service}, ${total}\u20AC), merci de regler l'acompte de ${montant}\u20AC.\n\n${lien ? `Lien de paiement : ${lien}\n\n` : ''}Votre RDV sera confirme des reception.\n\nA bientot !\n${t.signataire} - ${t.salonName}`;
      results.whatsapp = await sendWhatsAppNotification(phone, waMessage, tenantId);

      console.log(`[Notification] WhatsApp acompte envoye a ${phone}:`, results.whatsapp.success ? 'OK' : results.whatsapp.error);
    } catch (error) {
      console.error('[Notification] Erreur WhatsApp acompte:', error.message);
      results.whatsapp = { success: false, error: error.message };
    }
  }

  // 3. SMS TOUJOURS envoye pour les acomptes (le client a besoin du lien de paiement par SMS)
  if (phone) {
    try {
      const smsMessage = `${t.salonName}\nAcompte requis : ${montant}\u20AC\n\nRDV ${date} a ${heure}\n${service} - ${total}\u20AC\n\n${lien ? `Payer ici : ${lien}\n\n` : ''}Confirmation apres paiement.\n${t.telephone}`;

      results.sms = await sendSMS(phone, smsMessage, tenantId, { essential: true });
      console.log(`[Notification] SMS acompte envoye a ${phone}:`, results.sms.success ? 'OK' : results.sms.error);
    } catch (error) {
      console.error('[Notification] Erreur SMS acompte:', error.message);
      results.sms = { success: false, error: error.message };
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
  sendDepositRequest,
  getNotificationServicesStatus,
};
