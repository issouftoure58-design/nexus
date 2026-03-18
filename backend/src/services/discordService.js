/**
 * Discord Service — Invitation automatique après signature contrat
 *
 * Env:
 *   DISCORD_BOT_TOKEN — Token du bot Discord
 */

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

function isConfigured() {
  return !!DISCORD_BOT_TOKEN;
}

/**
 * Crée un lien d'invitation pour un channel/serveur
 * @param {string} channelId — ID du channel Discord
 * @param {object} options
 * @param {number} options.max_age — Durée en secondes (0 = permanent, défaut: 7 jours)
 * @param {number} options.max_uses — Nombre max d'utilisations (0 = illimité, défaut: 1)
 * @param {boolean} options.unique — Créer une invitation unique (défaut: true)
 */
export async function createInvite(channelId, options = {}) {
  if (!channelId) throw new Error('channelId requis');

  if (!isConfigured()) {
    console.log(`[DISCORD] Invitation simulée pour channel ${channelId}`);
    return {
      simulated: true,
      url: `https://discord.gg/simulated-${Date.now()}`,
      code: `sim-${Date.now()}`,
    };
  }

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/invites`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_age: options.max_age ?? 604800,
      max_uses: options.max_uses ?? 1,
      unique: options.unique ?? true,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Discord API ${res.status}: ${error}`);
  }

  const data = await res.json();
  return {
    url: `https://discord.gg/${data.code}`,
    code: data.code,
    expires_at: data.max_age > 0
      ? new Date(Date.now() + data.max_age * 1000).toISOString()
      : null,
  };
}

/**
 * Envoie un DM à un utilisateur Discord
 * @param {string} userId — ID utilisateur Discord
 * @param {string} message — Contenu du message
 */
export async function sendDM(userId, message) {
  if (!userId) throw new Error('userId requis');

  if (!isConfigured()) {
    console.log(`[DISCORD] DM simulé → ${userId}: ${message.substring(0, 50)}...`);
    return { simulated: true };
  }

  // Créer le DM channel
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!channelRes.ok) {
    throw new Error(`Discord DM channel creation failed: ${channelRes.status}`);
  }

  const channel = await channelRes.json();

  // Envoyer le message
  const msgRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message }),
  });

  if (!msgRes.ok) {
    throw new Error(`Discord message send failed: ${msgRes.status}`);
  }

  return { success: true, channelId: channel.id };
}

/**
 * Envoie une invitation Discord par email via le workflow engine
 * Utilisé comme action de workflow : génère le lien et l'envoie par email
 * @param {string} tenantId
 * @param {string} email — Email du destinataire
 * @param {string} channelId — ID channel Discord
 * @param {string} recipientName — Nom du destinataire
 */
export async function sendInviteByEmail(tenantId, email, channelId, recipientName) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!email) throw new Error('email requis');
  if (!channelId) throw new Error('channelId requis');

  const invite = await createInvite(channelId);

  // Utiliser le service email existant
  const { sendEmail } = await import('./emailService.js');

  await sendEmail({
    to: email,
    subject: 'Votre invitation Discord',
    html: `
      <p>Bonjour ${recipientName || ''},</p>
      <p>Bienvenue ! Rejoignez notre communauté Discord pour échanger avec les autres membres.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${invite.url}" style="background: #5865F2; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Rejoindre le Discord
        </a>
      </p>
      <p>Ce lien est personnel et à usage unique.</p>
      <p>À bientôt !</p>
    `,
  });

  console.log(`[DISCORD] Invitation envoyée à ${email} (channel: ${channelId})`);
  return { invite_url: invite.url, email, success: true };
}

export default {
  isConfigured,
  createInvite,
  sendDM,
  sendInviteByEmail,
};
