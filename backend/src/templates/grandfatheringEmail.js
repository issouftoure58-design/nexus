/**
 * Email template — Annonce migration pricing 2026 + grandfathering
 * (révision 9 avril 2026 : Business 149€ + 10 000 crédits, pack unique 15€/1000cr)
 *
 * Envoyé aux tenants existants pour leur expliquer :
 *   • Le nouveau modèle Free / Basic 29€ / Business 149€ + crédits IA
 *   • Qu'ils sont grandfathered (conservent leur plan actuel & son prix)
 *   • Comment basculer s'ils le souhaitent
 *
 * Variables attendues :
 *   • firstName  — prénom du contact principal (fallback "")
 *   • tenantName — nom du tenant
 *   • currentPlan — 'starter' | 'pro' | 'business' (legacy)
 *   • currentPrice — prix mensuel actuel en € (99 / 249 / 499)
 *   • billingPortalUrl — URL Stripe billing portal du tenant
 *   • dashboardUrl — URL admin du tenant
 */

const PLAN_LABELS = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business (legacy)',
};

const NEW_PLAN_EQUIVALENT = {
  starter: { name: 'Basic', price: 29, savings: 70 },   // 99→29 = -70€/mois
  pro: { name: 'Basic', price: 29, savings: 220 },      // 249→29 = -220€/mois
  business: { name: 'Business', price: 149, savings: 350 }, // 499→149 = -350€/mois
};

export function buildGrandfatheringEmail({ firstName = '', tenantName, currentPlan, currentPrice, billingPortalUrl, dashboardUrl }) {
  const greeting = firstName ? `Bonjour ${firstName},` : `Bonjour,`;
  const planLabel = PLAN_LABELS[currentPlan] || currentPlan;
  const equivalent = NEW_PLAN_EQUIVALENT[currentPlan] || NEW_PLAN_EQUIVALENT.pro;

  const subject = `${tenantName} — Nouveau modèle de prix NEXUS 2026 (votre plan reste inchangé)`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">NEXUS évolue en 2026</h1>
          <p style="margin:8px 0 0;color:#e0f2fe;font-size:14px;">Nouveau modèle de prix — votre plan reste inchangé</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${greeting}</p>

          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
            Nous avons le plaisir de vous annoncer le <strong>nouveau modèle de prix NEXUS 2026</strong>,
            conçu pour être plus simple, plus juste et accessible à tous les types d'entreprises.
          </p>

          <!-- Box grandfathering -->
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0 0 8px;font-size:14px;color:#065f46;font-weight:700;">✓ VOTRE PLAN EST PROTÉGÉ</p>
            <p style="margin:0;font-size:14px;color:#047857;line-height:1.5;">
              En tant que client historique, vous conservez votre plan <strong>${planLabel} à ${currentPrice}€/mois</strong>.
              Aucun changement automatique, aucune action requise.
            </p>
          </div>

          <h2 style="margin:32px 0 12px;font-size:18px;color:#111827;">Le nouveau modèle 2026 — en bref</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;border-collapse:collapse;">
            <tr>
              <td style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;width:33%;vertical-align:top;">
                <strong style="color:#6b7280;font-size:13px;">FREE</strong><br>
                <span style="font-size:20px;font-weight:700;color:#111827;">0€</span><br>
                <span style="font-size:12px;color:#6b7280;line-height:1.4;">10 RDV/mois<br>10 factures (avec watermark)<br>30 clients max</span>
              </td>
              <td style="padding:12px;border:1px solid #06b6d4;border-radius:6px;width:33%;vertical-align:top;background:#f0fdff;">
                <strong style="color:#0891b2;font-size:13px;">BASIC ★</strong><br>
                <span style="font-size:20px;font-weight:700;color:#0891b2;">29€</span><span style="font-size:13px;color:#6b7280;">/mois</span><br>
                <span style="font-size:12px;color:#0e7490;line-height:1.4;">Tout illimité<br>1 000 crédits IA inclus/mois<br>Pack 15€/1 000 cr additionnel</span>
              </td>
              <td style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;width:33%;vertical-align:top;">
                <strong style="color:#7c3aed;font-size:13px;">BUSINESS</strong><br>
                <span style="font-size:20px;font-weight:700;color:#7c3aed;">149€</span><span style="font-size:13px;color:#6b7280;">/mois</span><br>
                <span style="font-size:12px;color:#6b7280;line-height:1.4;">Multi-sites, white-label<br>API, SSO<br>10 000 crédits IA inclus (valeur 150€)</span>
              </td>
            </tr>
          </table>

          <h2 style="margin:32px 0 12px;font-size:18px;color:#111827;">Les crédits IA — pay-as-you-go</h2>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">
            Toutes les fonctions IA (WhatsApp, téléphone, chat web, marketing, SEO) consomment des crédits universels.
            Vous payez uniquement ce que vous utilisez :
          </p>
          <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;line-height:1.7;color:#4b5563;">
            <li><strong>1 message WhatsApp IA</strong> = 1 crédit</li>
            <li><strong>1 conversation chat web</strong> = 5 crédits</li>
            <li><strong>1 minute appel téléphone IA</strong> = 8 crédits</li>
            <li><strong>1 article SEO complet</strong> = 50 crédits</li>
          </ul>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
            Chaque plan payant inclut déjà des crédits : <strong>Basic 1 000 crédits/mois</strong> · <strong>Business 10 000 crédits/mois</strong>.
            Pour aller plus loin, un pack additionnel unique : <strong>Pack 1000 — 15€ → 1 000 crédits</strong> (simple et transparent, au taux base).
          </p>

          <!-- Box bascule volontaire -->
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:700;">💡 Vous pouvez basculer si vous le souhaitez</p>
            <p style="margin:0 0 12px;font-size:13px;color:#78350f;line-height:1.5;">
              Plan <strong>${equivalent.name} 2026 = ${equivalent.price}€/mois</strong>${equivalent.savings > 0 ? ` (économie potentielle de ~${equivalent.savings}€/mois selon votre usage IA)` : ''}.
              La bascule est volontaire et réversible — depuis votre tableau de bord.
            </p>
            <a href="${billingPortalUrl}" style="display:inline-block;padding:10px 20px;background:#f59e0b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Gérer mon abonnement</a>
          </div>

          <h2 style="margin:32px 0 12px;font-size:18px;color:#111827;">Et après ?</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
            Vous n'avez rien à faire. Votre plan ${planLabel} reste actif et facturé comme aujourd'hui.
            Si vous avez des questions ou souhaitez explorer le nouveau modèle, notre équipe est là.
          </p>

          <p style="margin:32px 0 0;text-align:center;">
            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;background:#06b6d4;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Accéder à mon dashboard</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
            Une question ? Répondez à cet email ou écrivez à <a href="mailto:contact@nexus-ai-saas.com" style="color:#06b6d4;text-decoration:none;">contact@nexus-ai-saas.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            © ${new Date().getFullYear()} NEXUS — Plateforme SaaS pour PME<br>
            Vous recevez cet email parce que vous êtes client NEXUS.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${greeting}

Nous avons le plaisir de vous annoncer le NOUVEAU MODELE DE PRIX NEXUS 2026.

VOTRE PLAN EST PROTEGE
En tant que client historique, vous conservez votre plan ${planLabel} a ${currentPrice}€/mois.
Aucun changement automatique, aucune action requise.

LE NOUVEAU MODELE 2026
- FREE (0€/mois) : 10 RDV/mois, 10 factures (watermark), 30 clients max
- BASIC (29€/mois) : Tout illimite + 1 000 credits IA inclus/mois (valeur 15€)
- BUSINESS (149€/mois) : Multi-sites, white-label, API, SSO + 10 000 credits IA inclus/mois (valeur 150€)

LES CREDITS IA
- 1 message WhatsApp IA = 1 credit
- 1 conversation chat web = 5 credits
- 1 minute appel telephone IA = 8 credits
- 1 article SEO complet = 50 credits

Pack additionnel unique : Pack 1000 - 15€ pour 1 000 credits (taux base, sans bonus).

VOUS POUVEZ BASCULER SI VOUS LE SOUHAITEZ
Plan ${equivalent.name} 2026 = ${equivalent.price}€/mois${equivalent.savings > 0 ? ` (economie potentielle ~${equivalent.savings}€/mois)` : ''}.
Bascule volontaire et reversible : ${billingPortalUrl}

Acceder a mon dashboard : ${dashboardUrl}

Une question ? contact@nexus-ai-saas.com

L'equipe NEXUS`;

  return { subject, html, text };
}

export default { buildGrandfatheringEmail };
