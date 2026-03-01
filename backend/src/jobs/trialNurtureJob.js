/**
 * Trial Nurture Job - Emails d'engagement pendant la periode d'essai
 *
 * Envoie des emails automatiques aux nouveaux tenants pour les guider:
 * - J3: Premier check-in, tips pour bien demarrer
 * - J7: Rappel des fonctionnalites, invitation a activer les modules
 * - J14: Dernier rappel avant fin du trial (si trial de 14j)
 */

import { supabase } from '../config/supabase.js';
import { sendTrialNurtureEmail } from '../services/tenantEmailService.js';

/**
 * Configuration des emails de nurturing
 */
const NURTURE_SCHEDULE = [
  {
    day: 3,
    subject: 'Premiers pas avec NEXUS - Conseils pour bien demarrer',
    templateId: 'trial_day_3',
    type: 'onboarding_tips'
  },
  {
    day: 7,
    subject: 'NEXUS - Avez-vous explore toutes les fonctionnalites ?',
    templateId: 'trial_day_7',
    type: 'feature_discovery'
  },
  {
    day: 10,
    subject: 'Plus que 4 jours pour profiter de votre essai NEXUS',
    templateId: 'trial_day_10',
    type: 'urgency_reminder'
  }
];

/**
 * Recupere les tenants en trial qui doivent recevoir un email de nurturing
 *
 * @param {number} daysSinceStart - Nombre de jours depuis le debut du trial
 * @returns {Promise<Array>} Liste des tenants
 */
async function getTrialTenantsForDay(daysSinceStart) {
  // Calculer la date de creation cible (il y a X jours)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysSinceStart);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // Tenants crees ce jour-la et toujours en essai
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`
      id,
      nom,
      email,
      statut,
      created_at,
      essai_fin,
      admin_users(id, email, nom, prenom)
    `)
    .eq('statut', 'essai')
    .gte('created_at', `${targetDateStr}T00:00:00Z`)
    .lt('created_at', `${targetDateStr}T23:59:59Z`);

  if (error) {
    console.error(`[TrialNurture] Erreur query J${daysSinceStart}:`, error.message);
    return [];
  }

  console.log(`[TrialNurture] J${daysSinceStart}: ${tenants?.length || 0} tenant(s) trouve(s)`);
  return tenants || [];
}

/**
 * Verifie si un email de nurturing a deja ete envoye pour ce tenant/type
 *
 * @param {string} tenantId
 * @param {string} emailType
 * @returns {Promise<boolean>}
 */
async function hasAlreadySentEmail(tenantId, emailType) {
  const { data, error } = await supabase
    .from('tenant_email_log')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email_type', emailType)
    .limit(1)
    .single();

  // Si erreur PGRST116 (no rows), pas encore envoye
  if (error && error.code === 'PGRST116') {
    return false;
  }

  return !!data;
}

/**
 * Enregistre qu'un email de nurturing a ete envoye
 *
 * @param {string} tenantId
 * @param {string} emailType
 * @param {string} recipientEmail
 */
async function logEmailSent(tenantId, emailType, recipientEmail) {
  try {
    await supabase.from('tenant_email_log').insert({
      tenant_id: tenantId,
      email_type: emailType,
      recipient_email: recipientEmail,
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[TrialNurture] Erreur log email:`, error.message);
  }
}

/**
 * Calcule les statistiques d'usage du tenant pour personnaliser l'email
 *
 * @param {string} tenantId
 * @returns {Promise<Object>} Stats d'usage
 */
async function getTenantUsageStats(tenantId) {
  const [
    { count: clientsCount },
    { count: reservationsCount },
    { count: servicesCount }
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  ]);

  return {
    clients: clientsCount || 0,
    reservations: reservationsCount || 0,
    services: servicesCount || 0,
    hasSetup: (servicesCount || 0) > 0,
    isActive: (reservationsCount || 0) > 0 || (clientsCount || 0) > 5
  };
}

/**
 * Genere le contenu de l'email de nurturing selon le jour
 *
 * @param {number} day - Jour du trial (3, 7, 10)
 * @param {Object} tenant - Donnees du tenant
 * @param {Object} stats - Stats d'usage
 * @returns {Object} Contenu de l'email
 */
function generateNurtureContent(day, tenant, stats) {
  const adminName = tenant.admin_users?.[0]?.prenom || 'Utilisateur';

  switch (day) {
    case 3:
      return {
        subject: `${adminName}, premiers pas avec NEXUS - Nos conseils`,
        preheader: 'Decouvrez comment tirer le meilleur de votre essai',
        greeting: `Bonjour ${adminName} !`,
        intro: stats.hasSetup
          ? `Super, vous avez deja configure ${stats.services} service(s) ! Voici quelques conseils pour aller plus loin.`
          : `Vous avez cree votre compte NEXUS il y a 3 jours. Il est temps de configurer vos premiers services !`,
        tips: [
          {
            title: 'Configurez vos services',
            description: 'Ajoutez vos prestations avec leurs prix et durees pour permettre les reservations.',
            link: '/admin/services',
            cta: 'Ajouter un service'
          },
          {
            title: 'Testez Halimah',
            description: 'Notre agent IA peut repondre a vos clients 24/7. Essayez-la dans le chat !',
            link: '/admin/chat',
            cta: 'Parler a Halimah'
          },
          {
            title: 'Invitez votre equipe',
            description: 'Ajoutez des collaborateurs pour gerer ensemble votre activite.',
            link: '/admin/parametres',
            cta: 'Gerer mon equipe'
          }
        ],
        footer: 'Besoin d\'aide ? Repondez simplement a cet email.'
      };

    case 7:
      return {
        subject: `Mi-parcours de votre essai NEXUS - ${adminName}`,
        preheader: stats.isActive
          ? 'Vous etes sur la bonne voie !'
          : 'Il reste encore tant a decouvrir',
        greeting: `Bonjour ${adminName} !`,
        intro: stats.isActive
          ? `Felicitations ! Vous avez deja ${stats.clients} client(s) et ${stats.reservations} reservation(s). Votre business commence a tourner sur NEXUS !`
          : `Une semaine s'est ecoulee depuis votre inscription. Avez-vous eu le temps d'explorer NEXUS ?`,
        tips: stats.isActive
          ? [
              {
                title: 'Activez WhatsApp IA',
                description: 'Permettez a vos clients de prendre RDV directement via WhatsApp.',
                link: '/admin/modules',
                cta: 'Voir les modules'
              },
              {
                title: 'Configurez les rappels automatiques',
                description: 'Reduisez les no-shows avec des SMS de rappel 24h avant.',
                link: '/admin/parametres',
                cta: 'Configurer'
              }
            ]
          : [
              {
                title: 'Faites une demo guidee',
                description: 'Reservez 15 minutes avec notre equipe pour une prise en main rapide.',
                link: 'https://calendly.com/nexus-demo',
                cta: 'Reserver un creneau'
              },
              {
                title: 'Regardez nos tutoriels',
                description: 'Des videos courtes pour maitriser chaque fonctionnalite.',
                link: '/admin/aide',
                cta: 'Voir les tutoriels'
              }
            ],
        stats: {
          clients: stats.clients,
          reservations: stats.reservations,
          services: stats.services
        },
        footer: 'Des questions ? Notre equipe est la pour vous aider.'
      };

    case 10:
      return {
        subject: `Plus que 4 jours d'essai - ${adminName}`,
        preheader: 'Ne perdez pas votre configuration',
        greeting: `Bonjour ${adminName} !`,
        intro: `Votre essai NEXUS se termine dans 4 jours. Voici un recapitulatif de ce que vous avez accompli.`,
        recap: {
          services: stats.services,
          clients: stats.clients,
          reservations: stats.reservations
        },
        warning: stats.isActive
          ? 'Tout ce travail sera perdu si vous ne passez pas a un abonnement.'
          : 'Il n\'est pas trop tard pour tester NEXUS a fond !',
        cta: {
          title: 'Choisir mon abonnement',
          description: 'Gardez toutes vos donnees et continuez a utiliser NEXUS.',
          link: '/admin/subscription',
          buttonText: 'Voir les plans'
        },
        alternative: 'Si vous avez des questions ou besoin de plus de temps, repondez a cet email.',
        footer: 'L\'equipe NEXUS'
      };

    default:
      return null;
  }
}

/**
 * Job principal: Envoie les emails de nurturing pour chaque jour configure
 */
export async function runTrialNurtureJob() {
  console.log(`\n[TrialNurture] 📧 Debut job - ${new Date().toLocaleString('fr-FR')}`);

  const results = {
    sent: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  for (const schedule of NURTURE_SCHEDULE) {
    console.log(`[TrialNurture] Traitement J${schedule.day}...`);

    const tenants = await getTrialTenantsForDay(schedule.day);

    for (const tenant of tenants) {
      try {
        // Verifier si email deja envoye
        const alreadySent = await hasAlreadySentEmail(tenant.id, schedule.templateId);
        if (alreadySent) {
          console.log(`[TrialNurture] ${tenant.nom}: J${schedule.day} deja envoye, skip`);
          results.skipped++;
          continue;
        }

        // Recuperer les stats d'usage
        const stats = await getTenantUsageStats(tenant.id);

        // Generer le contenu personnalise
        const content = generateNurtureContent(schedule.day, tenant, stats);
        if (!content) {
          console.error(`[TrialNurture] Pas de contenu pour J${schedule.day}`);
          results.errors++;
          continue;
        }

        // Determiner l'email destinataire
        const recipientEmail = tenant.admin_users?.[0]?.email || tenant.email;
        if (!recipientEmail) {
          console.log(`[TrialNurture] ${tenant.nom}: pas d'email, skip`);
          results.skipped++;
          continue;
        }

        // Envoyer l'email
        const result = await sendTrialNurtureEmail({
          to: recipientEmail,
          subject: content.subject,
          content,
          tenantId: tenant.id,
          templateId: schedule.templateId
        });

        if (result.success) {
          await logEmailSent(tenant.id, schedule.templateId, recipientEmail);
          results.sent++;
          results.details.push({
            tenant_id: tenant.id,
            tenant_name: tenant.nom,
            day: schedule.day,
            email: recipientEmail,
            status: 'sent'
          });
          console.log(`[TrialNurture] ✅ J${schedule.day} envoye a ${tenant.nom} (${recipientEmail})`);
        } else {
          results.errors++;
          results.details.push({
            tenant_id: tenant.id,
            tenant_name: tenant.nom,
            day: schedule.day,
            status: 'error',
            error: result.error
          });
          console.error(`[TrialNurture] ❌ Erreur J${schedule.day} ${tenant.nom}:`, result.error);
        }

      } catch (error) {
        results.errors++;
        console.error(`[TrialNurture] ❌ Exception ${tenant.nom}:`, error.message);
      }
    }
  }

  console.log(`[TrialNurture] 📧 Fin job: ${results.sent} envoyes, ${results.skipped} skippes, ${results.errors} erreurs`);
  return results;
}

export default {
  runTrialNurtureJob,
  NURTURE_SCHEDULE
};
