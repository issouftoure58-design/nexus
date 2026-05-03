/**
 * Templates de messages WhatsApp - Multi-tenant
 * Messages concis, chaleureux et professionnels
 *
 * V3: Support multi-business (hotel, restaurant, salon, commerce, security)
 *     Terminologie adaptee : "sejour" pour hotel, "reservation" pour restaurant, etc.
 */

import { getBusinessInfoSync } from '../services/tenantBusinessService.js';
import logger from '../config/logger.js';

/**
 * V2 - Récupère les infos du tenant pour les templates
 */
function getTenantInfo(tenantId) {
  if (!tenantId) {
    logger.warn('getTenantInfo appelé sans tenantId', { tag: 'WHATSAPP_TEMPLATES' });
    return { nom: 'Notre établissement', gerant: 'le responsable', businessProfile: 'service', urlCompte: '', urlAvis: '' };
  }
  try {
    const info = getBusinessInfoSync(tenantId);
    return {
      nom: info.nom || 'Notre établissement',
      gerant: info.gerant || 'le responsable',
      businessProfile: info.businessType || 'service',
      urlCompte: info.urls?.frontend ? `${info.urls.frontend}/compte` : '',
      urlAvis: info.urls?.frontend ? `${info.urls.frontend}/avis` : '',
    };
  } catch (e) {
    return {
      nom: 'NEXUS',
      gerant: 'L\'equipe',
      businessProfile: 'generic',
      urlCompte: '',
      urlAvis: '',
    };
  }
}

/**
 * Termes adaptes au type de business
 */
function getTerms(businessProfile) {
  const terms = {
    hotel:     { rdv: 'séjour', action: 'réserver à nouveau', emoji: '🏨', confirmed: 'Séjour confirmé' },
    restaurant:{ rdv: 'réservation', action: 'réserver à nouveau', emoji: '🍽️', confirmed: 'Réservation confirmée' },
    commerce:  { rdv: 'commande', action: 'commander à nouveau', emoji: '📦', confirmed: 'Commande confirmée' },
    security:  { rdv: 'mission', action: 'planifier une mission', emoji: '🛡️', confirmed: 'Mission confirmée' },
  };
  return terms[businessProfile] || { rdv: 'rendez-vous', action: 'reprendre RDV', emoji: '💇‍♀️', confirmed: 'Réservation confirmée' };
}

/**
 * Formate une date en français (ex: "samedi 24 janvier")
 */
function formatDateFr(dateStr) {
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const date = new Date(dateStr + 'T12:00:00');
  return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]}`;
}

/**
 * Formate la durée en texte (ex: "2h30" ou "1h")
 */
function formatDuree(minutes) {
  const heures = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${heures}h`;
  }
  return `${heures}h${mins.toString().padStart(2, '0')}`;
}

/**
 * Récupère le prénom ou nom du client
 */
function getPrenom(rdv) {
  return rdv.client_prenom || rdv.client_nom?.split(' ')[0] || 'Client';
}

/**
 * Message de confirmation de réservation
 * Adapte par business type (hotel: check-in/out, sejour ; salon: RDV ; etc.)
 */
export function confirmationReservation(rdv, acompte = 0, tenantId = null) {
  const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);
  const isHotel = tenant.businessProfile === 'hotel';

  let message;

  if (isHotel) {
    // Hotel : check-in / check-out / nuits / chambre
    const checkinDate = formatDateFr(rdv.date_arrivee || rdv.date);
    const checkinHour = rdv.heure || rdv.heure_arrivee || '14:00';
    const checkoutDate = rdv.date_depart ? formatDateFr(rdv.date_depart) : '';
    const checkoutHour = rdv.heure_fin || '11:00';
    const nuits = rdv.nb_nuitees ? `${rdv.nb_nuitees} nuit${rdv.nb_nuitees > 1 ? 's' : ''}` : '';

    message = `✅ ${terms.confirmed} !

🏨 ${tenant.nom}
📅 Check-in : ${checkinDate} à ${checkinHour}`;
    if (checkoutDate) {
      message += `\n📅 Check-out : ${checkoutDate} à ${checkoutHour}`;
    }
    if (nuits) {
      message += `\n🌙 Durée : ${nuits}`;
    }
    if (rdv.nb_personnes) {
      message += `\n👥 ${rdv.nb_personnes} personne${rdv.nb_personnes > 1 ? 's' : ''}`;
    }
    if (rdv.service_nom) {
      message += `\n🛏️ ${rdv.service_nom}`;
    }
    message += `\n💰 Total : ${total}€`;
  } else {
    // Salon, restaurant, commerce, security, etc.
    const dateFr = formatDateFr(rdv.date);
    const duree = rdv.duree_minutes ? formatDuree(rdv.duree_minutes) : '';

    message = `✅ ${terms.confirmed} !

📅 ${dateFr} à ${rdv.heure}
📍 ${rdv.adresse_client || rdv.adresse_formatee || ''}
${terms.emoji} ${rdv.service_nom}${duree ? ` (${duree})` : ''}
💰 Total : ${total}€`;
  }

  if (acompte > 0) {
    const reste = total - acompte;
    message += `\n\nAcompte réglé : ${acompte}€`;
    if (reste > 0) {
      message += `\nReste à payer : ${reste}€ (espèces/virement/PayPal)`;
    }
  }

  message += `

🔗 Créez votre compte : ${tenant.urlCompte}
⭐ Laissez un avis après votre ${terms.rdv} : ${tenant.urlAvis}

À bientôt ! ✨
${tenant.gerant}`;

  return message;
}

/**
 * Rappel J-1 (la veille)
 * Hotel : rappel check-in + documents / Salon : cheveux propres
 */
export function rappelJ1(rdv, acompte = 0, tenantId = null) {
  const prenom = getPrenom(rdv);
  const dateFr = formatDateFr(rdv.date);
  const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);
  const isHotel = tenant.businessProfile === 'hotel';

  const prixLine = acompte > 0
    ? `💰 Reste : ${total - acompte}€`
    : `💰 Total : ${total}€`;

  if (isHotel) {
    const checkinHour = rdv.heure || rdv.heure_arrivee || '14:00';
    return `Bonjour ${prenom} ! 👋

Rappel : votre arrivée est demain !

🏨 ${tenant.nom}
📅 Check-in : ${dateFr} à ${checkinHour}
${prixLine}

N'oubliez pas :
• Pièce d'identité en cours de validité
• Confirmation de réservation
${rdv.nb_personnes ? `• ${rdv.nb_personnes} personne${rdv.nb_personnes > 1 ? 's' : ''} attendue${rdv.nb_personnes > 1 ? 's' : ''}` : ''}

Si besoin de modifier votre séjour, contactez-nous vite !

À demain ! ✨
${tenant.gerant}`;
  }

  const duree = rdv.duree_minutes ? formatDuree(rdv.duree_minutes) : '';

  // Conseils adaptes par business type
  const conseilsMap = {
    restaurant: `• Merci de prévenir en cas de retard\n• Allergies ? Signalez-les à l'avance`,
    commerce: `• Préparez votre moyen de paiement\n• Vérifiez l'adresse de retrait`,
    security: `• Documents de mission à préparer\n• Tenue réglementaire obligatoire`,
  };
  const defaultConseils = `• Cheveux propres et démêlés si possible\n• Prévoir environ ${duree}`;

  return `Bonjour ${prenom} ! 👋

Petit rappel pour demain :
📅 ${dateFr} à ${rdv.heure}
📍 ${rdv.adresse_client || rdv.adresse_formatee || ''}
${prixLine}

N'oubliez pas :
${conseilsMap[tenant.businessProfile] || defaultConseils}

Si besoin d'annuler, prévenez-moi vite !

À demain ! ✨
${tenant.gerant}`;
}

/**
 * Message d'annulation
 */
export function annulation(rdv, montantRembourse = 0, tenantId = null) {
  const prenom = getPrenom(rdv);
  const dateFr = formatDateFr(rdv.date);
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);
  const isHotel = tenant.businessProfile === 'hotel';

  const dateLabel = isHotel && rdv.date_depart
    ? `du ${dateFr} au ${formatDateFr(rdv.date_depart)}`
    : `du ${dateFr} à ${rdv.heure}`;

  let message = `Bonjour ${prenom},

Votre ${terms.rdv} ${dateLabel} a été annulé(e).
`;

  if (montantRembourse > 0) {
    message += `
Remboursement : ${montantRembourse}€
Vous serez remboursé(e) sous 3-5 jours.`;
  } else {
    message += `
Acompte retenu : 10€
(Annulation > 24h après réservation)`;
  }

  message += `

N'hésitez pas à ${terms.action} ! 😊
${tenant.gerant}`;

  return message;
}

/**
 * Message de modification
 */
export function modificationRdv(ancienRdv, nouveauRdv, tenantId = null) {
  const prenom = getPrenom(nouveauRdv);
  const ancienneDateFr = formatDateFr(ancienRdv.date);
  const nouvelleDateFr = formatDateFr(nouveauRdv.date);
  const total = nouveauRdv.total || (nouveauRdv.prix_service + (nouveauRdv.frais_deplacement || 0));
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);
  const isHotel = tenant.businessProfile === 'hotel';

  if (isHotel) {
    const oldCheckout = ancienRdv.date_depart ? ` → ${formatDateFr(ancienRdv.date_depart)}` : '';
    const newCheckout = nouveauRdv.date_depart ? ` → ${formatDateFr(nouveauRdv.date_depart)}` : '';
    return `Bonjour ${prenom} ! 📅

Votre séjour a été modifié :

❌ Ancien : ${ancienneDateFr}${oldCheckout}
✅ Nouveau : ${nouvelleDateFr}${newCheckout}

🏨 ${tenant.nom}
💰 Total : ${total}€

À bientôt ! ✨
${tenant.gerant}`;
  }

  return `Bonjour ${prenom} ! 📅

Votre ${terms.rdv} a été modifié(e) :

❌ Ancien : ${ancienneDateFr} à ${ancienRdv.heure}
✅ Nouveau : ${nouvelleDateFr} à ${nouveauRdv.heure}

📍 ${nouveauRdv.adresse_client || nouveauRdv.adresse_formatee || ''}
💰 Total : ${total}€

À bientôt ! ✨
${tenant.gerant}`;
}

/**
 * Message de remerciement après prestation
 */
export function remerciement(rdv, tenantId = null) {
  const prenom = getPrenom(rdv);
  const tenant = getTenantInfo(tenantId);

  const bp = tenant.businessProfile || 'beauty';
  const actionsMap = {
    restaurant: '• Réserver à nouveau 📅\n• Laisser un avis en ligne ⭐\n• Recommander à vos proches 💕',
    commerce: '• Passer une nouvelle commande 📦\n• Laisser un avis en ligne ⭐\n• Recommander à vos proches 💕',
    hotel: '• Réserver à nouveau 📅\n• Partager votre expérience ⭐\n• Recommander à vos proches 💕',
    security: '• Nous recontacter pour une mission 📋\n• Laisser un avis en ligne ⭐\n• Recommander à vos partenaires 🤝',
  };
  const defaultActions = '• Reprendre RDV 📅\n• Laisser un avis en ligne ⭐\n• Recommander à vos proches 💕';

  return `Bonjour ${prenom} ! 💜

Merci d'avoir fait confiance à ${tenant.nom} !

J'espère que vous êtes ravi(e). ✨

N'hésitez pas à :
${actionsMap[bp] || defaultActions}

À bientôt !
${tenant.gerant}`;
}

/**
 * Demande d'avis après prestation
 */
export function demandeAvis(rdv, lienAvis = null, tenantId = null) {
  const prenom = getPrenom(rdv);
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);
  const urlAvis = lienAvis || tenant.urlAvis;

  return `Bonjour ${prenom} ! 🌟

Comment s'est passé votre ${terms.rdv} ?

Votre avis compte beaucoup !
Notez votre expérience :

${urlAvis}

Merci ! 💜
${tenant.gerant}`;
}

/**
 * Message de rappel de paiement
 */
export function rappelPaiement(rdv, paymentUrl, minutesRestantes = 15, tenantId = null) {
  const dateFr = formatDateFr(rdv.date);
  const total = rdv.total || (rdv.prix_service + (rdv.frais_deplacement || 0));
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);

  return `⏰ Rappel : votre ${terms.rdv} n'est pas encore confirmé(e) !

📅 ${dateFr} à ${rdv.heure}
💰 Total : ${total}€

👉 ${paymentUrl}

⚠️ Lien expire dans ${minutesRestantes} min

${tenant.gerant}`;
}

/**
 * Message d'expiration du lien de paiement
 */
export function expirationPaiement(rdv, tenantId = null) {
  const dateFr = formatDateFr(rdv.date);
  const tenant = getTenantInfo(tenantId);
  const terms = getTerms(tenant.businessProfile);

  return `⏰ Votre lien de paiement a expiré.

Le créneau ${dateFr} à ${rdv.heure} n'est plus réservé.

Pour ${terms.action}, envoyez "Bonjour" ! 😊
${tenant.gerant}`;
}

// Export par défaut
export default {
  confirmationReservation,
  rappelJ1,
  annulation,
  modificationRdv,
  remerciement,
  demandeAvis,
  rappelPaiement,
  expirationPaiement,
  // Utilitaires
  formatDateFr,
  formatDuree,
};
