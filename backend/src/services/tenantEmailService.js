/**
 * Tenant Email Service
 * Gestion des notifications email pour le parcours tenant
 * - Trial: alertes expiration, conversion
 * - Billing: factures, échecs paiement
 * - Onboarding: bienvenue, complétion
 */

import { sendEmail } from './emailService.js';
import { supabase } from '../config/supabase.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const APP_NAME = 'NEXUS';
const APP_URL = process.env.APP_URL || 'https://app.nexus-saas.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@nexus-saas.com';

// Couleurs de la marque
const BRAND_COLORS = {
  primary: '#06b6d4', // cyan-500
  secondary: '#3b82f6', // blue-500
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1e293b',
  light: '#f8fafc'
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupère les infos du tenant et de l'admin principal
 */
async function getTenantWithAdmin(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, domain, plan, essai_fin, statut')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  const { data: admin } = await supabase
    .from('admin_users')
    .select('email, nom')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .single();

  return { tenant, admin };
}

/**
 * Calcule les jours restants avant une date
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Formate un prix en euros
 */
function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  });
}

/**
 * Formate une date en français
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Template de base pour tous les emails
 */
function baseTemplate({ title, preheader, content, ctaText, ctaUrl, footer }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { padding: 0; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.light}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BRAND_COLORS.light};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary}); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 28px; font-weight: bold;">N</span>
              </div>
              <h1 style="margin: 15px 0 0; color: ${BRAND_COLORS.dark}; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="padding: 40px;">
                    ${content}

                    ${ctaText && ctaUrl ? `
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                      <tr>
                        <td align="center">
                          <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary}); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                            ${ctaText}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 30px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">
                ${footer || `${APP_NAME} - La plateforme tout-en-un pour votre business`}
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                <a href="${APP_URL}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">Accéder à mon compte</a>
                &nbsp;•&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ============================================================================
// TRIAL EMAILS
// ============================================================================

/**
 * Email: Bienvenue après inscription
 */
export function templateWelcome({ tenantName, adminName, trialEndDate }) {
  const daysLeft = daysUntil(trialEndDate);

  return baseTemplate({
    title: `Bienvenue sur ${APP_NAME}`,
    preheader: `Votre essai gratuit de ${daysLeft} jours commence maintenant`,
    content: `
      <h2 style="color: ${BRAND_COLORS.dark}; font-size: 22px; margin: 0 0 20px;">
        Bienvenue ${adminName || ''} ! 🎉
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Merci d'avoir choisi <strong>${APP_NAME}</strong> pour gérer <strong>${tenantName}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Votre <strong>essai gratuit de ${daysLeft} jours</strong> est maintenant actif. Vous avez accès à toutes les fonctionnalités pour découvrir la puissance de notre plateforme.
      </p>

      <div style="background: ${BRAND_COLORS.light}; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <h3 style="color: ${BRAND_COLORS.dark}; font-size: 16px; margin: 0 0 15px;">
          🚀 Pour bien démarrer :
        </h3>
        <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Configurez vos services et tarifs</li>
          <li>Personnalisez votre assistant IA</li>
          <li>Importez vos clients existants</li>
          <li>Testez la prise de rendez-vous</li>
        </ul>
      </div>

      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Votre essai se termine le <strong>${formatDate(trialEndDate)}</strong>.
      </p>
    `,
    ctaText: 'Commencer maintenant',
    ctaUrl: `${APP_URL}/`,
    footer: 'Besoin d\'aide ? Notre équipe est là pour vous accompagner.'
  });
}

/**
 * Email: Alerte trial J-7
 */
export function templateTrialWarning7Days({ tenantName, adminName, trialEndDate }) {
  return baseTemplate({
    title: `Plus que 7 jours d'essai`,
    preheader: `Votre essai ${APP_NAME} se termine dans 7 jours`,
    content: `
      <h2 style="color: ${BRAND_COLORS.dark}; font-size: 22px; margin: 0 0 20px;">
        Plus que 7 jours d'essai ⏰
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Votre essai gratuit de <strong>${APP_NAME}</strong> pour <strong>${tenantName}</strong> se termine le <strong>${formatDate(trialEndDate)}</strong>.
      </p>

      <div style="background: linear-gradient(135deg, ${BRAND_COLORS.primary}10, ${BRAND_COLORS.secondary}10); border-left: 4px solid ${BRAND_COLORS.primary}; border-radius: 0 12px 12px 0; padding: 20px; margin: 25px 0;">
        <p style="color: ${BRAND_COLORS.dark}; font-size: 15px; margin: 0; font-weight: 500;">
          💡 Passez à un plan payant pour continuer à utiliser toutes vos fonctionnalités sans interruption.
        </p>
      </div>

      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Vos données et configurations seront conservées lors de l'upgrade.
      </p>
    `,
    ctaText: 'Choisir mon plan',
    ctaUrl: `${APP_URL}/subscription`
  });
}

/**
 * Email: Alerte trial J-3
 */
export function templateTrialWarning3Days({ tenantName, adminName, trialEndDate }) {
  return baseTemplate({
    title: `⚠️ 3 jours restants sur votre essai`,
    preheader: `Votre essai se termine dans 3 jours - Agissez maintenant`,
    content: `
      <h2 style="color: ${BRAND_COLORS.warning}; font-size: 22px; margin: 0 0 20px;">
        ⚠️ Plus que 3 jours !
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Votre essai gratuit pour <strong>${tenantName}</strong> expire dans <strong>3 jours</strong> (${formatDate(trialEndDate)}).
      </p>

      <div style="background: ${BRAND_COLORS.warning}15; border: 1px solid ${BRAND_COLORS.warning}40; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="color: ${BRAND_COLORS.dark}; font-size: 15px; margin: 0;">
          🔒 Après expiration, l'accès à votre compte sera limité. Souscrivez maintenant pour éviter toute interruption.
        </p>
      </div>
    `,
    ctaText: 'Souscrire maintenant',
    ctaUrl: `${APP_URL}/subscription`
  });
}

/**
 * Email: Alerte trial J-1
 */
export function templateTrialWarning1Day({ tenantName, adminName, trialEndDate }) {
  return baseTemplate({
    title: `🚨 Dernier jour d'essai`,
    preheader: `Votre essai expire demain - Action requise`,
    content: `
      <h2 style="color: ${BRAND_COLORS.danger}; font-size: 22px; margin: 0 0 20px;">
        🚨 Dernière chance !
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        C'est le <strong>dernier jour</strong> de votre essai gratuit pour <strong>${tenantName}</strong>.
      </p>

      <div style="background: ${BRAND_COLORS.danger}10; border: 2px solid ${BRAND_COLORS.danger}; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="color: ${BRAND_COLORS.danger}; font-size: 16px; margin: 0; font-weight: 600;">
          ⏰ Votre accès sera suspendu demain si vous ne souscrivez pas.
        </p>
      </div>

      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Toutes vos données seront conservées pendant 30 jours après expiration.
      </p>
    `,
    ctaText: 'Souscrire immédiatement',
    ctaUrl: `${APP_URL}/subscription`
  });
}

/**
 * Email: Trial expiré
 */
export function templateTrialExpired({ tenantName, adminName }) {
  return baseTemplate({
    title: `Votre essai a expiré`,
    preheader: `Réactivez votre compte ${APP_NAME}`,
    content: `
      <h2 style="color: ${BRAND_COLORS.dark}; font-size: 22px; margin: 0 0 20px;">
        Votre essai a expiré 😢
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Votre période d'essai pour <strong>${tenantName}</strong> est maintenant terminée.
      </p>

      <div style="background: ${BRAND_COLORS.light}; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <h3 style="color: ${BRAND_COLORS.dark}; font-size: 16px; margin: 0 0 15px;">
          ✅ Bonne nouvelle :
        </h3>
        <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Toutes vos données sont conservées 30 jours</li>
          <li>Réactivez votre compte en quelques clics</li>
          <li>Reprenez exactement où vous en étiez</li>
        </ul>
      </div>
    `,
    ctaText: 'Réactiver mon compte',
    ctaUrl: `${APP_URL}/subscription`
  });
}

// ============================================================================
// BILLING EMAILS
// ============================================================================

/**
 * Email: Facture payée
 */
export function templateInvoicePaid({ tenantName, adminName, invoiceNumber, amount, planName, invoiceUrl }) {
  return baseTemplate({
    title: `Facture ${invoiceNumber} payée`,
    preheader: `Merci pour votre paiement de ${formatPrice(amount)}`,
    content: `
      <h2 style="color: ${BRAND_COLORS.success}; font-size: 22px; margin: 0 0 20px;">
        Paiement confirmé ✅
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Nous avons bien reçu votre paiement pour <strong>${tenantName}</strong>.
      </p>

      <div style="background: ${BRAND_COLORS.light}; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Facture</td>
            <td style="padding: 8px 0; color: ${BRAND_COLORS.dark}; font-size: 14px; text-align: right; font-weight: 600;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Plan</td>
            <td style="padding: 8px 0; color: ${BRAND_COLORS.dark}; font-size: 14px; text-align: right; font-weight: 600;">${planName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">Montant</td>
            <td style="padding: 8px 0; border-top: 1px solid #e2e8f0; color: ${BRAND_COLORS.success}; font-size: 18px; text-align: right; font-weight: 700;">${formatPrice(amount)}</td>
          </tr>
        </table>
      </div>
    `,
    ctaText: 'Télécharger la facture',
    ctaUrl: invoiceUrl || `${APP_URL}/subscription`,
    footer: 'Cette facture est disponible dans votre espace client.'
  });
}

/**
 * Email: Échec de paiement
 */
export function templatePaymentFailed({ tenantName, adminName, amount, nextRetryDate }) {
  return baseTemplate({
    title: `⚠️ Échec de paiement`,
    preheader: `Action requise : votre paiement de ${formatPrice(amount)} a échoué`,
    content: `
      <h2 style="color: ${BRAND_COLORS.danger}; font-size: 22px; margin: 0 0 20px;">
        Échec de paiement ⚠️
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Nous n'avons pas pu prélever <strong>${formatPrice(amount)}</strong> pour votre abonnement <strong>${tenantName}</strong>.
      </p>

      <div style="background: ${BRAND_COLORS.danger}10; border: 1px solid ${BRAND_COLORS.danger}40; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="color: ${BRAND_COLORS.dark}; font-size: 15px; margin: 0;">
          🔄 Nous réessaierons automatiquement ${nextRetryDate ? `le <strong>${formatDate(nextRetryDate)}</strong>` : 'dans quelques jours'}.
        </p>
      </div>

      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Pour éviter toute interruption de service, veuillez mettre à jour votre moyen de paiement.
      </p>
    `,
    ctaText: 'Mettre à jour ma carte',
    ctaUrl: `${APP_URL}/subscription`
  });
}

/**
 * Email: Abonnement annulé
 */
export function templateSubscriptionCancelled({ tenantName, adminName, endDate }) {
  return baseTemplate({
    title: `Abonnement annulé`,
    preheader: `Votre abonnement prend fin le ${formatDate(endDate)}`,
    content: `
      <h2 style="color: ${BRAND_COLORS.dark}; font-size: 22px; margin: 0 0 20px;">
        Abonnement annulé
      </h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Bonjour ${adminName || ''},
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
        Votre abonnement <strong>${APP_NAME}</strong> pour <strong>${tenantName}</strong> a été annulé.
      </p>

      <div style="background: ${BRAND_COLORS.light}; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="color: ${BRAND_COLORS.dark}; font-size: 15px; margin: 0;">
          📅 Vous conservez l'accès jusqu'au <strong>${formatDate(endDate)}</strong>.
        </p>
      </div>

      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
        Vous pouvez réactiver votre abonnement à tout moment depuis votre espace client.
      </p>
    `,
    ctaText: 'Réactiver mon abonnement',
    ctaUrl: `${APP_URL}/subscription`,
    footer: 'Nous serions ravis de connaître la raison de votre départ pour nous améliorer.'
  });
}

// ============================================================================
// SEND FUNCTIONS
// ============================================================================

/**
 * Envoie un email de bienvenue
 */
export async function sendWelcomeEmail(tenantId) {
  const data = await getTenantWithAdmin(tenantId);
  if (!data?.admin?.email) return { success: false, error: 'No admin email' };

  const html = templateWelcome({
    tenantName: data.tenant.name,
    adminName: data.admin.nom,
    trialEndDate: data.tenant.essai_fin
  });

  return sendEmail({
    to: data.admin.email,
    subject: `Bienvenue sur ${APP_NAME} ! 🚀`,
    html
  });
}

/**
 * Envoie une alerte trial selon les jours restants
 */
export async function sendTrialAlert(tenantId, daysRemaining) {
  const data = await getTenantWithAdmin(tenantId);
  if (!data?.admin?.email) return { success: false, error: 'No admin email' };

  const templates = {
    7: templateTrialWarning7Days,
    3: templateTrialWarning3Days,
    1: templateTrialWarning1Day,
    0: templateTrialExpired
  };

  const subjects = {
    7: `Plus que 7 jours d'essai ${APP_NAME}`,
    3: `⚠️ 3 jours restants sur votre essai ${APP_NAME}`,
    1: `🚨 Dernier jour d'essai ${APP_NAME}`,
    0: `Votre essai ${APP_NAME} a expiré`
  };

  const templateFn = templates[daysRemaining];
  if (!templateFn) return { success: false, error: 'Invalid days remaining' };

  const html = templateFn({
    tenantName: data.tenant.name,
    adminName: data.admin.nom,
    trialEndDate: data.tenant.essai_fin
  });

  return sendEmail({
    to: data.admin.email,
    subject: subjects[daysRemaining],
    html
  });
}

/**
 * Envoie une notification de facture payée
 */
export async function sendInvoicePaidEmail(tenantId, invoiceData) {
  const data = await getTenantWithAdmin(tenantId);
  if (!data?.admin?.email) return { success: false, error: 'No admin email' };

  const html = templateInvoicePaid({
    tenantName: data.tenant.name,
    adminName: data.admin.nom,
    invoiceNumber: invoiceData.number,
    amount: invoiceData.amount,
    planName: invoiceData.planName || data.tenant.plan,
    invoiceUrl: invoiceData.url
  });

  return sendEmail({
    to: data.admin.email,
    subject: `Facture ${invoiceData.number} - Paiement confirmé ✅`,
    html
  });
}

/**
 * Envoie une notification d'échec de paiement
 */
export async function sendPaymentFailedEmail(tenantId, paymentData) {
  const data = await getTenantWithAdmin(tenantId);
  if (!data?.admin?.email) return { success: false, error: 'No admin email' };

  const html = templatePaymentFailed({
    tenantName: data.tenant.name,
    adminName: data.admin.nom,
    amount: paymentData.amount,
    nextRetryDate: paymentData.nextRetryDate
  });

  return sendEmail({
    to: data.admin.email,
    subject: `⚠️ Échec de paiement - Action requise`,
    html
  });
}

/**
 * Envoie une notification d'annulation d'abonnement
 */
export async function sendSubscriptionCancelledEmail(tenantId, endDate) {
  const data = await getTenantWithAdmin(tenantId);
  if (!data?.admin?.email) return { success: false, error: 'No admin email' };

  const html = templateSubscriptionCancelled({
    tenantName: data.tenant.name,
    adminName: data.admin.nom,
    endDate
  });

  return sendEmail({
    to: data.admin.email,
    subject: `Confirmation d'annulation - ${APP_NAME}`,
    html
  });
}

/**
 * Envoie un email de nurturing pendant le trial (J3, J7, J10)
 */
export async function sendTrialNurtureEmail({ to, subject, content, tenantId, templateId }) {
  if (!to) return { success: false, error: 'No recipient email' };

  try {
    // Generer le HTML selon le type de contenu
    let html = '';

    if (content.tips) {
      // Template avec tips (J3, J7)
      const tipsHtml = content.tips.map(tip => `
        <div style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px;">
          <h3 style="margin: 0 0 8px 0; color: ${BRAND_COLORS.dark}; font-size: 16px;">${tip.title}</h3>
          <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">${tip.description}</p>
          <a href="${APP_URL}${tip.link}" style="display: inline-block; padding: 8px 16px; background: ${BRAND_COLORS.primary}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">${tip.cta}</a>
        </div>
      `).join('');

      html = baseTemplate({
        title: content.subject,
        preheader: content.preheader,
        content: `
          <p style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-bottom: 8px;">${content.greeting}</p>
          <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">${content.intro}</p>
          ${tipsHtml}
          ${content.stats ? `
            <div style="margin-top: 24px; padding: 16px; background: linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.secondary}); border-radius: 8px; color: white;">
              <p style="margin: 0 0 8px 0; font-weight: bold;">Votre activite en chiffres</p>
              <p style="margin: 0; font-size: 14px;">${content.stats.clients} clients | ${content.stats.reservations} reservations | ${content.stats.services} services</p>
            </div>
          ` : ''}
        `,
        footer: content.footer
      });
    } else if (content.recap) {
      // Template urgence (J10)
      html = baseTemplate({
        title: content.subject,
        preheader: content.preheader,
        content: `
          <p style="color: ${BRAND_COLORS.dark}; font-size: 18px; margin-bottom: 8px;">${content.greeting}</p>
          <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">${content.intro}</p>
          <div style="margin-bottom: 24px; padding: 20px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: ${BRAND_COLORS.dark};">Recapitulatif de votre essai</p>
            <ul style="margin: 0; padding-left: 20px; color: #64748b;">
              <li>${content.recap.services} service(s) configure(s)</li>
              <li>${content.recap.clients} client(s) ajoute(s)</li>
              <li>${content.recap.reservations} reservation(s) creee(s)</li>
            </ul>
            <p style="margin: 12px 0 0 0; color: ${BRAND_COLORS.warning}; font-weight: bold;">${content.warning}</p>
          </div>
        `,
        ctaText: content.cta.buttonText,
        ctaUrl: `${APP_URL}${content.cta.link}`,
        footer: content.alternative
      });
    }

    const result = await sendEmail({
      to,
      subject,
      html
    });

    return result;

  } catch (error) {
    console.error('[TenantEmail] Erreur nurture email:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendWelcomeEmail,
  sendTrialAlert,
  sendInvoicePaidEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
  sendTrialNurtureEmail
};
