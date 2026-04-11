/**
 * Credit Alert Service
 * Envoie des emails d'alerte quand les crédits IA atteignent des seuils critiques.
 *
 * Seuils : 50% consommés (info), 80% (alerte), 100% (urgent)
 * Anti-spam : 1 email par seuil par mois (table credit_alerts_sent)
 *
 * @module creditAlertService
 */

import { sendEmail } from './emailService.js';
import { supabase } from '../config/supabase.js';
import { getBalance } from './creditsService.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const APP_NAME = 'NEXUS';
const APP_URL = process.env.APP_URL || 'https://app.nexus-ai-saas.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'contact@nexus-ai-saas.com';

const BRAND = {
  primary: '#06b6d4',
  secondary: '#3b82f6',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1e293b',
  light: '#f8fafc',
};

// Seuils d'alerte (% consommés)
const THRESHOLDS = [
  { percent: 50, level: 'info',    color: BRAND.primary, emoji: 'ℹ️', subject: 'Il vous reste 50% de crédits IA' },
  { percent: 80, level: 'warning', color: BRAND.warning, emoji: '⚠️', subject: 'Plus que 20% de crédits IA !' },
  { percent: 100, level: 'urgent', color: BRAND.danger,  emoji: '🔴', subject: 'Crédits IA épuisés — IA désactivée' },
];

// ============================================================================
// HELPERS
// ============================================================================

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Récupère l'email et le nom de l'owner du tenant
 */
async function getTenantOwner(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, plan')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  const { data: admin } = await supabase
    .from('admin_users')
    .select('email, nom')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .single();

  if (!admin?.email) return null;

  return { tenant, admin };
}

/**
 * Vérifie si une alerte a déjà été envoyée ce mois-ci pour ce seuil
 */
async function wasAlertSent(tenantId, threshold) {
  const month = getCurrentMonth();

  const { data } = await supabase
    .from('credit_alerts_sent')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('threshold', threshold)
    .eq('month', month)
    .maybeSingle();

  return !!data;
}

/**
 * Enregistre qu'une alerte a été envoyée
 */
async function markAlertSent(tenantId, threshold) {
  const month = getCurrentMonth();

  await supabase
    .from('credit_alerts_sent')
    .upsert({
      tenant_id: tenantId,
      threshold,
      month,
      sent_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,threshold,month' });
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function buildAlertEmail({ adminName, tenantName, balance, monthlyIncluded, percentUsed, threshold }) {
  const remaining = Math.max(0, balance);
  const used = monthlyIncluded - remaining;
  const config = THRESHOLDS.find(t => t.percent === threshold);

  const barWidth = Math.min(100, percentUsed);
  const barColor = config.color;

  // Contenu spécifique par seuil
  let message = '';
  let ctaText = '';
  let ctaUrl = `${APP_URL}/usage`;

  if (threshold === 50) {
    message = `
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Vous avez utilisé <strong>${used}</strong> crédits sur <strong>${monthlyIncluded}</strong> ce mois-ci.
        Il vous en reste <strong>${remaining}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Pas de panique — c'est juste une notification pour vous permettre d'anticiper.
        Si votre activité augmente, vous pouvez acheter un <strong>Pack 1000 crédits à 15€</strong> à tout moment.
      </p>
    `;
    ctaText = 'Voir ma consommation';
  } else if (threshold === 80) {
    message = `
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        <strong>Attention</strong> — il ne vous reste plus que <strong>${remaining} crédits IA</strong> ce mois-ci.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Si vos crédits tombent à zéro, l'IA (téléphone, WhatsApp, chat) sera temporairement désactivée
        jusqu'au rechargement ou le début du mois prochain.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        <strong>Rechargez maintenant</strong> pour ne pas interrompre le service pour vos clients.
      </p>
    `;
    ctaText = 'Recharger mes crédits';
    ctaUrl = `${APP_URL}/subscription`;
  } else {
    message = `
      <p style="color: ${BRAND.danger}; font-size: 18px; font-weight: 600; line-height: 1.6;">
        Vos crédits IA sont épuisés.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        L'IA NEXUS est désactivée pour votre compte : les appels téléphoniques, WhatsApp et le chat web
        ne sont plus pris en charge automatiquement. <strong>Vos clients n'obtiendront plus de réponse IA.</strong>
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Deux options :
      </p>
      <ul style="color: #475569; font-size: 16px; line-height: 1.8;">
        <li><strong>Recharger immédiatement</strong> — Pack 1000 crédits à 15€</li>
        <li><strong>Attendre le 1er du mois</strong> — vos crédits inclus seront réinitialisés</li>
      </ul>
    `;
    ctaText = 'Recharger maintenant';
    ctaUrl = `${APP_URL}/subscription`;
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.light}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">${config.emoji} ${remaining} crédits IA restants sur ${monthlyIncluded}</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BRAND.light};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary}); border-radius: 16px; display: inline-block; text-align: center; line-height: 60px;">
                <span style="color: white; font-size: 28px; font-weight: bold;">N</span>
              </div>
              <h1 style="margin: 15px 0 0; color: ${BRAND.dark}; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: ${BRAND.dark}; font-size: 20px; margin: 0 0 20px;">
                      ${config.emoji} ${config.subject}
                    </h2>

                    <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">
                      ${adminName ? `Bonjour ${adminName},` : 'Bonjour,'}
                      voici l'état de vos crédits IA pour <strong>${tenantName}</strong>.
                    </p>

                    <!-- Barre de progression -->
                    <div style="background: #e2e8f0; border-radius: 8px; height: 12px; margin: 0 0 8px; overflow: hidden;">
                      <div style="background: ${barColor}; height: 100%; width: ${barWidth}%; border-radius: 8px;"></div>
                    </div>
                    <p style="color: #64748b; font-size: 13px; margin: 0 0 24px; text-align: right;">
                      <strong>${used}</strong> / ${monthlyIncluded} crédits utilisés (${Math.round(percentUsed)}%)
                    </p>

                    ${message}

                    <!-- CTA -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                      <tr>
                        <td align="center">
                          <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.secondary}); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                            ${ctaText}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 30px; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 10px;">
                ${APP_NAME} — La plateforme tout-en-un pour votre business
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                <a href="${APP_URL}" style="color: ${BRAND.primary}; text-decoration: none;">Mon compte</a>
                &nbsp;•&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color: ${BRAND.primary}; text-decoration: none;">Support</a>
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
// MAIN — CHECK & ALERT
// ============================================================================

/**
 * Vérifie les seuils de crédits et envoie les alertes si nécessaire.
 * Appelé après chaque trackUsage() — fire-and-forget.
 *
 * @param {string} tenantId
 */
export async function checkAndAlert(tenantId) {
  try {
    const balance = await getBalance(tenantId);

    // Pas de crédits inclus = Free plan (IA bloquée, pas d'alerte)
    if (!balance.monthly_included || balance.monthly_included === 0) return;

    const used = balance.monthly_included - balance.balance;
    const percentUsed = (used / balance.monthly_included) * 100;

    // Parcourir les seuils du plus haut au plus bas
    for (const threshold of [...THRESHOLDS].reverse()) {
      if (percentUsed >= threshold.percent) {
        // Vérifier si déjà envoyée ce mois
        const alreadySent = await wasAlertSent(tenantId, threshold.percent);
        if (alreadySent) return; // Déjà notifié pour ce seuil (et les inférieurs aussi forcément)

        // Récupérer l'email du owner
        const ownerInfo = await getTenantOwner(tenantId);
        if (!ownerInfo?.admin?.email) {
          console.warn(`[CREDIT ALERT] Pas d'email owner pour tenant ${tenantId}`);
          return;
        }

        const { tenant, admin } = ownerInfo;
        const config = THRESHOLDS.find(t => t.percent === threshold.percent);

        // Envoyer l'email
        const html = buildAlertEmail({
          adminName: admin.nom,
          tenantName: tenant.name,
          balance: balance.balance,
          monthlyIncluded: balance.monthly_included,
          percentUsed,
          threshold: threshold.percent,
        });

        const result = await sendEmail({
          to: admin.email,
          subject: `${config.emoji} ${config.subject}`,
          html,
          tags: ['credit-alert', `threshold-${threshold.percent}`],
        });

        if (result.success) {
          await markAlertSent(tenantId, threshold.percent);
          console.log(`[CREDIT ALERT] ${threshold.level.toUpperCase()} envoyé à ${admin.email} (tenant: ${tenantId}, seuil: ${threshold.percent}%)`);
        }

        return; // On envoie seulement l'alerte du seuil le plus élevé atteint
      }
    }
  } catch (error) {
    // Fire-and-forget : ne jamais bloquer le flow principal
    console.error(`[CREDIT ALERT] Erreur pour tenant ${tenantId}:`, error.message);
  }
}

export default { checkAndAlert };
