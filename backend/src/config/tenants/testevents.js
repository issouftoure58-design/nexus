/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TENANT CONFIG: Emma Events (test-events)
 * Catégorie D: Événementiel - Forfait, options, nb_participants, devis
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default {
  // Identité
  id: 'test-events',
  name: 'Emma Events',
  domain: 'emma-events.test',

  // Assistant IA
  assistantName: 'Emma',
  gerant: 'Emma Moreau',

  // Coordonnées
  adresse: '28 rue du Faubourg Saint-Honoré, 75008 Paris',
  telephone: '01 45 67 89 01',
  email: 'contact@emma-events.test',

  // Profil métier
  businessProfile: 'events',
  pricingMode: 'package',

  // Services - Formules mariage
  services: {
    // Mariages
    MARIAGE_ESSENTIEL: {
      name: 'Mariage Essentiel',
      description: 'Coordination jour J uniquement',
      packagePrice: 1500,
      includes: [
        'Coordination le jour J',
        'Réunion préparatoire',
        'Planning détaillé',
      ],
      minGuests: 20,
      maxGuests: 100,
    },
    MARIAGE_SERENITE: {
      name: 'Mariage Sérénité',
      description: 'Organisation partielle (3 mois avant)',
      packagePrice: 3500,
      includes: [
        'Tout Essentiel +',
        'Sélection prestataires',
        'Négociation contrats',
        'Accompagnement essayages',
      ],
      minGuests: 30,
      maxGuests: 200,
    },
    MARIAGE_PRESTIGE: {
      name: 'Mariage Prestige',
      description: 'Organisation complète de A à Z',
      packagePrice: 6000,
      includes: [
        'Tout Sérénité +',
        'Recherche lieu',
        'Design & décoration',
        'Gestion budget complète',
        'Répétition générale',
      ],
      minGuests: 50,
      maxGuests: 500,
    },

    // Corporate
    SEMINAIRE: {
      name: 'Séminaire entreprise',
      description: 'Organisation séminaire (par jour)',
      dailyRate: 800,
      minParticipants: 10,
      maxParticipants: 200,
    },
    SOIREE_CORPORATE: {
      name: 'Soirée entreprise',
      description: 'Organisation soirée corporate',
      packagePrice: 2500,
      minParticipants: 30,
      maxParticipants: 300,
    },

    // Options
    OPTION_DJ: {
      name: 'Option DJ',
      description: 'DJ professionnel (5h)',
      packagePrice: 600,
      isOption: true,
    },
    OPTION_PHOTO: {
      name: 'Option Photographe',
      description: 'Photographe + album 50 photos',
      packagePrice: 1200,
      isOption: true,
    },
    OPTION_VIDEO: {
      name: 'Option Vidéaste',
      description: 'Film de l\'événement',
      packagePrice: 1800,
      isOption: true,
    },
    OPTION_DECO_FLORALE: {
      name: 'Option Décoration florale',
      description: 'Décoration florale complète',
      packagePrice: 800,
      isOption: true,
    },
    OPTION_TRAITEUR: {
      name: 'Option Traiteur',
      description: 'Menu gastronomique par personne',
      pricePerPerson: 85,
      isOption: true,
      isPerPerson: true,
    },
  },

  // Types d'événements
  eventTypes: [
    'mariage',
    'anniversaire',
    'bapteme',
    'communion',
    'bar_mitzvah',
    'seminaire',
    'soiree_entreprise',
    'lancement_produit',
    'gala',
    'autre',
  ],

  // Règles métier
  businessRules: {
    requireDevis: true,
    devisValidityDays: 30,
    depositPercentage: 30, // Acompte 30%
    finalPaymentDays: 15, // Solde 15 jours avant
    allowMultiDay: true,
    minAdvanceBookingDays: 30, // Réserver minimum 1 mois avant
    maxAdvanceBookingMonths: 24, // Jusqu'à 2 ans à l'avance
  },

  // Horaires bureau
  businessHours: {
    0: null, // Dimanche fermé
    1: { open: '10:00', close: '19:00' },
    2: { open: '10:00', close: '19:00' },
    3: { open: '10:00', close: '19:00' },
    4: { open: '10:00', close: '19:00' },
    5: { open: '10:00', close: '18:00' },
    6: { open: '10:00', close: '17:00' }, // Samedi (sur RDV)
  },

  // Configuration IA
  iaConfig: {
    tools: [
      'get_event_packages',
      'get_options',
      'calculate_quote',
      'check_date_availability',
      'create_event',
      'send_quote',
      'schedule_meeting',
    ],

    // Fonction de calcul devis
    calculateQuote: (params) => {
      const { packagePrice, options = [], nbGuests, traiteurPerPerson } = params;

      let total = packagePrice;

      // Ajouter options
      options.forEach(opt => {
        if (opt.isPerPerson && nbGuests) {
          total += opt.pricePerPerson * nbGuests;
        } else {
          total += opt.packagePrice || 0;
        }
      });

      return {
        subtotal: total,
        deposit: Math.round(total * 0.30), // 30% acompte
        balance: Math.round(total * 0.70),
        total,
      };
    },

    // Informations à collecter
    requiredInfo: [
      'event_type',
      'event_date',
      'nb_guests',
      'budget_range', // optionnel mais utile
      'venue_status', // déjà trouvé ou à chercher
      'selected_options',
    ],

    // Prompt système
    systemPrompt: `Tu es Emma, l'assistante IA d'Emma Events, agence de wedding & event planning.

PERSONNALITÉ:
- Créative et enthousiaste
- Tu VOUVOIES mais ton chaleureux
- Fais rêver le client ! Chaque événement est unique.

L'AGENCE:
Emma Events - Créatrice d'émotions depuis 2015
Adresse : 28 rue du Faubourg Saint-Honoré, 75008 Paris
Horaires : Lun-Ven 10h-19h, Samedi sur RDV

═══════════════════════════════════════
FORMULES MARIAGE
═══════════════════════════════════════

🌸 ESSENTIEL - 1 500€
Coordination jour J uniquement
• Réunion préparatoire
• Planning détaillé
• Coordination le jour J

🌺 SÉRÉNITÉ - 3 500€
Organisation partielle (3 mois avant)
• Tout Essentiel +
• Sélection prestataires
• Négociation contrats
• Accompagnement essayages

🌹 PRESTIGE - 6 000€
Organisation complète de A à Z
• Tout Sérénité +
• Recherche du lieu
• Design & décoration
• Gestion budget complète
• Répétition générale

═══════════════════════════════════════
ÉVÉNEMENTS CORPORATE
═══════════════════════════════════════

📊 Séminaire : 800€/jour
🎉 Soirée entreprise : 2 500€

═══════════════════════════════════════
OPTIONS
═══════════════════════════════════════

🎵 DJ (5h) : 600€
📸 Photographe + album : 1 200€
🎬 Vidéaste : 1 800€
💐 Décoration florale : 800€
🍽️ Traiteur : 85€/personne

═══════════════════════════════════════
PROCESSUS
═══════════════════════════════════════

1. Recueillir les envies du client
2. Proposer une formule adaptée
3. Suggérer des options pertinentes
4. Calculer le devis
5. Proposer un RDV de présentation GRATUIT

QUESTIONS À POSER:
• Quel type d'événement ?
• Quelle date envisagez-vous ?
• Combien d'invités ?
• Avez-vous déjà un lieu ?
• Quelles sont vos envies particulières ?

CALCUL DEVIS:
Formule + Options + (Traiteur × invités)

EXEMPLE:
"Mariage Prestige : 6 000€
+ DJ : 600€
+ Photo : 1 200€
+ Traiteur 80 pers : 6 800€
= TOTAL : 14 600€

Acompte 30% : 4 380€
Solde 15 jours avant : 10 220€"

IMPORTANT:
- Acompte 30% à la signature
- Solde 15 jours avant l'événement
- Devis valable 30 jours

Propose toujours un rendez-vous découverte GRATUIT !`,
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
