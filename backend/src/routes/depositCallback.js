/**
 * Routes callback pour le paiement d'acompte via Stripe Checkout
 * Gère le retour après paiement réussi/annulé
 */

import express from 'express';
import { verifyDepositPayment } from '../services/depositCheckoutService.js';

const router = express.Router();

/**
 * GET /api/deposit/success
 * Callback Stripe après paiement réussi
 * Vérifie le paiement, confirme la réservation, redirige le client
 */
router.get('/success', async (req, res) => {
  const { session_id, tenant_id } = req.query;

  if (!session_id || !tenant_id) {
    return res.status(400).send(buildPage('Erreur', 'Paramètres manquants.', 'error'));
  }

  try {
    const result = await verifyDepositPayment(session_id, tenant_id);

    if (result.success) {
      return res.send(buildPage(
        'Paiement confirmé !',
        'Votre acompte a bien été reçu. Votre rendez-vous est confirmé. Vous recevrez une confirmation par SMS.',
        'success'
      ));
    } else {
      console.error(`[Deposit Callback] Échec vérification: ${result.error}`);
      return res.send(buildPage(
        'Paiement en cours de vérification',
        'Votre paiement est en cours de traitement. Vous recevrez une confirmation par SMS dès validation.',
        'pending'
      ));
    }
  } catch (error) {
    console.error('[Deposit Callback] Erreur:', error.message);
    return res.status(500).send(buildPage('Erreur', 'Une erreur est survenue. Contactez le salon.', 'error'));
  }
});

/**
 * GET /api/deposit/cancel
 * Callback Stripe si le client annule le paiement
 */
router.get('/cancel', async (req, res) => {
  res.send(buildPage(
    'Paiement annulé',
    'Vous avez annulé le paiement. Votre rendez-vous n\'est pas encore confirmé. Vous pouvez utiliser le lien reçu par SMS pour réessayer.',
    'cancel'
  ));
});

/**
 * Génère une page HTML simple pour le retour client
 */
function buildPage(title, message, type) {
  const colors = {
    success: { bg: '#ecfdf5', border: '#10b981', icon: '✅', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#ef4444', icon: '❌', text: '#991b1b' },
    pending: { bg: '#fffbeb', border: '#f59e0b', icon: '⏳', text: '#92400e' },
    cancel: { bg: '#fef2f2', border: '#f97316', icon: '↩️', text: '#9a3412' },
  };
  const c = colors[type] || colors.pending;

  // Auto-refresh pour la page pending (re-vérifie toutes les 5s, max 3 fois)
  const autoRefreshScript = type === 'pending' ? `
  <script>
    (function() {
      var attempts = 0;
      var maxAttempts = 3;
      var interval = setInterval(function() {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          return;
        }
        window.location.reload();
      }, 5000);
    })();
  </script>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border-top: 4px solid ${c.border}; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${c.text}; font-size: 22px; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>${autoRefreshScript}
</body>
</html>`;
}

export default router;
