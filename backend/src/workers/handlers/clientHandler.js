import { TaskTypes } from '../../services/taskQueue.js';
import { supabase } from '../../config/supabase.js';
import { getBusinessInfoSync } from '../../services/tenantBusinessService.js';

/**
 * Handler pour les tâches liées aux clients
 */
export async function handleClientTask(job) {
  const { type, data, tenantId } = job.data;

  console.log(`[CLIENT] 👤 Traitement tâche ${type}`);

  switch (type) {
    case TaskTypes.SEND_REMINDER:
      return await sendReminder(data, tenantId);

    case TaskTypes.FOLLOWUP_CLIENT:
      return await followupClient(data, tenantId);

    case TaskTypes.BIRTHDAY_WISH:
      return await sendBirthdayWish(data, tenantId);

    default:
      throw new Error(`Handler client inconnu: ${type}`);
  }
}

/**
 * Envoie un rappel de RDV
 */
async function sendReminder(data, tenantId) {
  if (!tenantId) {
    console.error('[CLIENT] ❌ sendReminder requires tenantId');
    return { sent: false, error: 'tenant_id requis' };
  }

  const { clientId, bookingId, channel, customMessage } = data;

  console.log(`[CLIENT] 📱 Envoi rappel RDV ${bookingId} (tenant: ${tenantId})...`);

  try {
    // Récupérer les infos du RDV
    const { data: booking, error: bookingError } = await supabase
      .from('rendezvous')
      .select(`
        *,
        clients (nom, prenom, telephone, email)
      `)
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('[CLIENT] RDV non trouvé:', bookingError);
      return { sent: false, error: 'RDV non trouvé' };
    }

    const client = booking.clients;
    const message = customMessage || formatReminderMessage(booking, client, tenantId);

    // TODO: Envoyer via WhatsApp, SMS ou Email selon le canal
    console.log(`[CLIENT] 📩 Message préparé pour ${client.prenom} ${client.nom}:`);
    console.log(`[CLIENT]    Canal: ${channel || 'whatsapp'}`);
    console.log(`[CLIENT]    Tel: ${client.telephone}`);

    // Marquer le rappel comme envoyé (si on avait un champ pour ça)
    // await supabase.from('rendezvous').update({ reminder_sent: true }).eq('id', bookingId);

    return {
      sent: true,
      channel: channel || 'whatsapp',
      recipient: {
        name: `${client.prenom} ${client.nom}`,
        phone: client.telephone
      },
      booking: {
        id: bookingId,
        date: booking.date,
        heure: booking.heure,
        service: booking.service_nom
      },
      message: message,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CLIENT] ❌ Erreur envoi rappel:', error);
    return { sent: false, error: error.message };
  }
}

/**
 * Formate le message de rappel
 */
function formatReminderMessage(booking, client, tenantId) {
  let nom = 'notre équipe';
  try {
    const info = getBusinessInfoSync(tenantId);
    nom = info.nom || nom;
  } catch (e) { /* fallback */ }

  return `Bonjour ${client.prenom},\n\n` +
    `Rappel de ${nom} !\n\n` +
    `Je vous rappelle votre rendez-vous :\n` +
    `📅 ${formatDate(booking.date)} à ${booking.heure}\n` +
    `💇 ${booking.service_nom}\n\n` +
    `À très bientôt ! ✨`;
}

/**
 * Relance un client inactif
 */
async function followupClient(data, tenantId) {
  if (!tenantId) {
    console.error('[CLIENT] ❌ followupClient requires tenantId');
    return { followed: false, error: 'tenant_id requis' };
  }

  const { clientId, daysSinceLastVisit, customMessage } = data;

  console.log(`[CLIENT] 📞 Relance client ${clientId} (tenant: ${tenantId})...`);

  try {
    // Récupérer les infos du client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('[CLIENT] Client non trouvé:', clientError);
      return { followed: false, error: 'Client non trouvé' };
    }

    // Récupérer le dernier RDV
    const { data: lastBooking } = await supabase
      .from('rendezvous')
      .select('*')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const message = customMessage || formatFollowupMessage(client, lastBooking, tenantId);

    console.log(`[CLIENT] 📩 Message de relance pour ${client.prenom}:`);
    console.log(`[CLIENT]    Dernier RDV: ${lastBooking?.date || 'Inconnu'}`);

    return {
      followed: true,
      client: {
        id: clientId,
        name: `${client.prenom} ${client.nom}`,
        phone: client.telephone
      },
      lastVisit: lastBooking?.date,
      daysSinceLastVisit,
      message: message,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CLIENT] ❌ Erreur relance:', error);
    return { followed: false, error: error.message };
  }
}

/**
 * Formate le message de relance
 */
function formatFollowupMessage(client, lastBooking, tenantId) {
  let nom = 'notre établissement';
  try {
    const info = getBusinessInfoSync(tenantId);
    nom = info.nom || nom;
  } catch (e) { /* fallback */ }

  const service = lastBooking?.service_nom || 'votre dernière prestation';
  return `Bonjour ${client.prenom},\n\n` +
    `Comment allez-vous ? C'est ${nom} 💕\n\n` +
    `Cela fait un moment depuis ${service}. ` +
    `Un petit entretien serait peut-être le bienvenu ?\n\n` +
    `N'hésitez pas à nous contacter pour prendre rendez-vous ! 📱\n\n` +
    `À bientôt ! ✨`;
}

/**
 * Envoie un message d'anniversaire
 */
async function sendBirthdayWish(data, tenantId) {
  if (!tenantId) {
    console.error('[CLIENT] ❌ sendBirthdayWish requires tenantId');
    return { wished: false, error: 'tenant_id requis' };
  }

  const { clientId, checkAll } = data;

  console.log(`[CLIENT] 🎂 Vérification anniversaires (tenant: ${tenantId})...`);

  try {
    // Si checkAll, on vérifie tous les clients dont c'est l'anniversaire aujourd'hui
    if (checkAll) {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Note: Nécessite un champ date_naissance dans la table clients
      // Pour l'instant, on retourne juste une liste vide
      console.log('[CLIENT] ℹ️ Vérification des anniversaires du jour');

      return {
        wished: true,
        checked: true,
        birthdaysToday: [],
        note: 'Champ date_naissance requis dans la table clients'
      };
    }

    // Sinon, on envoie pour un client spécifique
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return { wished: false, error: 'Client non trouvé' };
    }

    let nomBusiness = 'notre établissement';
    try {
      const info = getBusinessInfoSync(tenantId);
      nomBusiness = info.nom || nomBusiness;
    } catch (e) { /* fallback */ }

    const message = `Joyeux anniversaire ${client.prenom} ! 🎂🎉\n\n` +
      `Toute l'équipe de ${nomBusiness} vous souhaite une merveilleuse journée !\n\n` +
      `Pour l'occasion, profitez de -10% sur votre prochaine prestation 💝\n\n` +
      `À très bientôt ! ✨`;

    return {
      wished: true,
      client: {
        id: clientId,
        name: `${client.prenom} ${client.nom}`
      },
      message: message,
      discountOffered: true,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CLIENT] ❌ Erreur anniversaire:', error);
    return { wished: false, error: error.message };
  }
}

/**
 * Formate une date en français
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('fr-FR', options);
}
