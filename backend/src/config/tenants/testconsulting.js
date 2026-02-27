/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TENANT CONFIG: Clara Conseil (test-consulting)
 * Catégorie C: Conseil & Expertise - Taux horaire, visio, timesheet
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default {
  // Identité
  id: 'test-consulting',
  name: 'Clara Conseil',
  domain: 'clara-conseil.test',

  // Assistant IA
  assistantName: 'Clara',
  gerant: 'Claire Bernard',

  // Coordonnées
  adresse: '42 boulevard Haussmann, 75009 Paris',
  telephone: '01 34 56 78 90',
  email: 'contact@clara-conseil.test',

  // Profil métier
  businessProfile: 'consulting',
  pricingMode: 'hourly',

  // Services
  services: {
    CONSULTATION_JURIDIQUE: {
      name: 'Consultation juridique',
      description: 'Conseil en droit des affaires',
      hourlyRate: 150,
      consultants: ['Claire Bernard', 'Antonio Garcia'],
    },
    CONSULTATION_FISCALE: {
      name: 'Consultation fiscale',
      description: 'Optimisation et conseil fiscal',
      hourlyRate: 180,
      consultants: ['Antonio Garcia'],
    },
    AUDIT_COMPTABLE: {
      name: 'Audit comptable',
      description: 'Audit des comptes annuels',
      hourlyRate: 200,
      consultants: ['Marc Leroy'],
    },
    CREATION_ENTREPRISE: {
      name: 'Accompagnement création entreprise',
      description: 'Pack création complet',
      packagePrice: 1500,
      includes: 'Statuts, formalités, conseil fiscal initial',
    },
    FORMATION_GESTION: {
      name: 'Formation gestion',
      description: 'Formation 1 journée',
      dailyRate: 1200,
      consultants: ['Julie Petit'],
    },
    CONSEIL_STRATEGIQUE: {
      name: 'Conseil stratégique',
      description: 'Accompagnement stratégique entreprise',
      hourlyRate: 250,
      consultants: ['Claire Bernard'],
    },
  },

  // Options de rendez-vous
  appointmentOptions: {
    locations: [
      { id: 'cabinet', label: 'Au cabinet (Paris 9e)' },
      { id: 'client', label: 'Dans vos locaux' },
      { id: 'visio', label: 'En visioconférence' },
    ],
    defaultDurations: [30, 60, 90, 120], // minutes
    firstConsultationFree: 30, // 30 min offertes
  },

  // Règles métier
  businessRules: {
    requireDossierRef: false,
    allowVisio: true,
    allowRemote: true,
    trackActualTime: true,
    requireTimesheet: true,
    advanceBookingHours: 24, // 24h minimum
    cancellationHours: 48, // Annulation 48h avant
  },

  // Horaires du cabinet
  businessHours: {
    0: null, // Dimanche fermé
    1: { open: '09:00', close: '19:00' },
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '18:00' },
    6: null, // Samedi fermé
  },

  // Configuration IA
  iaConfig: {
    tools: [
      'get_consultation_types',
      'check_consultant_availability',
      'calculate_intervention',
      'create_intervention',
      'generate_visio_link',
      'get_consultant_calendar',
    ],

    // Fonction de calcul prix
    calculatePrice: (params) => {
      const { hourlyRate, estimatedHours, isFirstConsultation } = params;

      if (isFirstConsultation) {
        // 30 min offertes
        const chargeableHours = Math.max(0, estimatedHours - 0.5);
        return chargeableHours * hourlyRate;
      }

      return estimatedHours * hourlyRate;
    },

    // Informations à collecter
    requiredInfo: [
      'consultation_type',
      'subject_matter',
      'estimated_duration',
      'preferred_location', // cabinet, client, visio
      'preferred_date',
      'preferred_time',
    ],

    // Prompt système
    systemPrompt: `Tu es Clara, l'assistante IA du Cabinet Clara Conseil.

PERSONNALITÉ:
- Experte et rassurante
- Tu VOUVOIES toujours
- Reformule pour bien comprendre le besoin du client

LE CABINET:
- Spécialisé en conseil juridique, fiscal et comptable
- Adresse : 42 boulevard Haussmann, 75009 Paris
- Horaires : Lundi-Vendredi 9h-19h (18h le vendredi)

SERVICES ET TARIFS:
- Consultation juridique : 150€/h
- Consultation fiscale : 180€/h
- Audit comptable : 200€/h
- Conseil stratégique : 250€/h
- Pack création entreprise : 1500€ forfait
- Formation gestion : 1200€/jour

AVANTAGE:
Première consultation : 30 minutes OFFERTES

MODES DE RENDEZ-VOUS:
- Au cabinet (Paris 9e)
- Dans les locaux du client
- En visioconférence (Google Meet)

INFORMATIONS À COLLECTER:
1. Type de consultation (juridique, fiscal, comptable, stratégique)
2. Objet / problématique
3. Durée estimée (30min, 1h, 2h...)
4. Préférence : cabinet, chez vous, ou visio ?
5. Date et heure souhaitées

CALCUL DEVIS:
- Taux horaire × durée estimée
- Si première consultation : -30min offertes

EXEMPLE:
"Consultation juridique 2h = 2 × 150€ = 300€
Première consultation ? -30min offertes = 225€"

Annulation gratuite jusqu'à 48h avant le rendez-vous.`,
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
