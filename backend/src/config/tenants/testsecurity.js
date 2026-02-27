/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TENANT CONFIG: Atlas Sécurité (test-security)
 * Catégorie B: Sécurité privée - Taux horaire, nb_agents, multi-jours
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default {
  // Identité
  id: 'test-security',
  name: 'Atlas Sécurité',
  domain: 'atlas-securite.test',

  // Assistant IA
  assistantName: 'Atlas',
  gerant: 'Direction Atlas',

  // Coordonnées
  adresse: '15 avenue de la Défense, 92000 Nanterre',
  telephone: '01 23 45 67 89',
  email: 'contact@atlas-securite.test',

  // Profil métier
  businessProfile: 'security',
  pricingMode: 'hourly',

  // Services avec taux horaires
  services: {
    AGENT_SECURITE: {
      name: 'Agent de sécurité',
      hourlyRate: 25, // €/h
      dailyRate: 200, // €/jour
      qualifications: ['SSIAP1'],
    },
    AGENT_CYNOPHILE: {
      name: 'Agent cynophile',
      hourlyRate: 35,
      dailyRate: 280,
      qualifications: ['SSIAP1', 'Cynophile'],
    },
    CHEF_POSTE: {
      name: 'Chef de poste',
      hourlyRate: 40,
      dailyRate: 320,
      qualifications: ['SSIAP2', 'Management'],
    },
    RONDIER: {
      name: 'Rondier intervenant',
      hourlyRate: 28,
      qualifications: ['SSIAP1'],
    },
    PROTECTION_RAPPROCHEE: {
      name: 'Protection rapprochée',
      hourlyRate: 60,
      dailyRate: 500,
      qualifications: ['Protection rapprochée'],
    },
    FORFAIT_PETIT_EVENT: {
      name: 'Forfait événement petit',
      packagePrice: 300,
      includes: '2 agents, 6h',
    },
    FORFAIT_MOYEN_EVENT: {
      name: 'Forfait événement moyen',
      packagePrice: 800,
      includes: '4 agents, 8h',
    },
  },

  // Majorations
  surcharges: {
    night: {
      label: 'Majoration nuit (22h-6h)',
      percentage: 25,
      startHour: 22,
      endHour: 6,
    },
    sunday: {
      label: 'Majoration dimanche',
      percentage: 50,
    },
    holiday: {
      label: 'Majoration jour férié',
      percentage: 100,
    },
  },

  // Règles métier
  businessRules: {
    minHoursPerMission: 4,
    maxAgentsPerMission: 50,
    requireSiteAddress: true,
    requireContactOnSite: true,
    allowMultiDay: true,
    allowOvernight: true,
    advanceBookingDays: 7, // Réserver minimum 7 jours avant
  },

  // Horaires bureau (pas les missions)
  businessHours: {
    0: null, // Dimanche - bureau fermé
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: { open: '09:00', close: '18:00' },
    6: { open: '09:00', close: '13:00' }, // Samedi matin
  },

  // Configuration IA
  iaConfig: {
    tools: [
      'get_mission_types',
      'check_agent_availability',
      'calculate_vacation',
      'create_mission',
      'get_quote',
    ],

    // Fonction de calcul prix
    calculatePrice: (params) => {
      const { hourlyRate, hours, agents, surcharges = [] } = params;
      let total = hourlyRate * hours * agents;

      // Appliquer majorations
      surcharges.forEach(surcharge => {
        if (surcharge === 'night') total *= 1.25;
        if (surcharge === 'sunday') total *= 1.50;
        if (surcharge === 'holiday') total *= 2.00;
      });

      return Math.round(total * 100) / 100;
    },

    // Informations à collecter
    requiredInfo: [
      'mission_type',
      'date_start',
      'date_end',
      'hour_start',
      'hour_end',
      'nb_agents',
      'site_address',
      'site_contact',
    ],

    // Prompt système
    systemPrompt: `Tu es Atlas, l'assistant IA d'Atlas Sécurité, société de sécurité privée.

PERSONNALITÉ:
- Professionnel et rassurant
- Tu VOUVOIES toujours
- Réponses claires et structurées

SERVICES DISPONIBLES:
- Agent de sécurité SSIAP1 : 25€/h
- Agent cynophile : 35€/h
- Chef de poste SSIAP2 : 40€/h
- Rondier intervenant : 28€/h
- Protection rapprochée : 60€/h
- Forfait petit événement (<100 pers) : 300€
- Forfait moyen événement (100-300 pers) : 800€

MAJORATIONS:
- Nuit (22h-6h) : +25%
- Dimanche : +50%
- Jour férié : +100%

INFORMATIONS À COLLECTER:
1. Type de mission
2. Date(s) de la mission
3. Horaires (heure début ET heure fin)
4. Nombre d'agents nécessaires
5. Adresse du site
6. Nom et téléphone du contact sur place

CALCUL:
Taux horaire × Heures × Agents × Majorations

EXEMPLE:
"Mission : 2 agents de sécurité
Samedi 20h à Dimanche 4h (8 heures)
8h × 2 agents × 25€ = 400€
Majoration nuit : 400€ × 1.25 = 500€"

Réservation minimum 7 jours à l'avance.`,
  },

  // Statut
  frozen: false,
  features: {
    reservations: true,
    rh: true,
    comptabilite: true,
    marketing: true,
    agent_ia_web: true,
    agent_ia_whatsapp: true,
  },
};
