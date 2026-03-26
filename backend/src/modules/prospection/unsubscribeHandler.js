/**
 * Unsubscribe Handler
 * Gere la desinscription des prospects (conformite RGPD)
 * Route publique — pas d'authentification requise
 */

import jwt from 'jsonwebtoken';
import { updateProspect } from './prospectionService.js';
import { supabase } from '../../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-prospection-unsubscribe';
const TENANT_ID = 'nexus-internal';

/**
 * Verifie le token et desinscrit le prospect
 * @returns {Object} { success, prospectName }
 */
export async function handleUnsubscribe(token) {
  if (!token) throw new Error('Token manquant');

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Lien de desinscription invalide ou expire');
  }

  if (decoded.type !== 'unsubscribe' || !decoded.prospectId) {
    throw new Error('Token invalide');
  }

  // Mettre a jour le prospect
  const prospect = await updateProspect(decoded.prospectId, {
    status: 'unsubscribed',
  });

  // Annuler toutes les relances en attente pour ce prospect
  await supabase
    .from('prospection_emails')
    .update({ follow_up_scheduled_at: null, status: 'queued' })
    .eq('tenant_id', TENANT_ID)
    .eq('prospect_id', decoded.prospectId)
    .not('follow_up_scheduled_at', 'is', null)
    .in('status', ['queued', 'sent', 'delivered']);

  console.log(`[UNSUBSCRIBE] Prospect ${prospect.name} (ID: ${decoded.prospectId}) desinscrit`);

  return { success: true, prospectName: prospect.name };
}

/**
 * Genere la page HTML de confirmation de desinscription
 */
export function getUnsubscribeConfirmationPage(prospectName) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desinscription confirmee - NEXUS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 20px; margin-bottom: 12px; color: #f1f5f9; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
    .name { color: #22d3ee; font-weight: 600; }
    .footer { margin-top: 30px; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Desinscription confirmee</h1>
    <p>
      <span class="name">${escapeHtml(prospectName || 'Votre adresse')}</span>
      a ete retiree de notre liste de diffusion.
    </p>
    <p style="margin-top: 12px;">
      Vous ne recevrez plus d'emails de notre part.
    </p>
    <div class="footer">
      NEXUS Business Solutions — nexussentinelai@yahoo.com
    </div>
  </div>
</body>
</html>`;
}

/**
 * Page d'erreur pour token invalide
 */
export function getUnsubscribeErrorPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erreur - NEXUS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 20px; margin-bottom: 12px; color: #f87171; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
    .footer { margin-top: 30px; font-size: 11px; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10007;</div>
    <h1>Lien invalide</h1>
    <p>${escapeHtml(errorMessage || 'Ce lien de desinscription est invalide ou expire.')}</p>
    <p style="margin-top: 12px;">
      Pour vous desinscrire, contactez-nous a nexussentinelai@yahoo.com
    </p>
    <div class="footer">
      NEXUS Business Solutions
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default { handleUnsubscribe, getUnsubscribeConfirmationPage, getUnsubscribeErrorPage };
