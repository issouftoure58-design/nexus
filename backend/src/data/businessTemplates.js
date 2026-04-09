/**
 * NEXUS Business Templates
 *
 * Templates de configuration automatique par type de métier.
 * Quand un client choisit son métier, NEXUS pré-configure:
 * - Services par défaut
 * - Horaires typiques
 * - Configuration IA (ton, messages, quick replies)
 * - Modules recommandés
 * - Plan suggéré
 *
 * Dernière mise à jour: 2026-03-09
 * Sources: recherches web par secteur (Doctolib, Zenchef, TheFork, iDGarages, etc.)
 */

export const BUSINESS_TEMPLATES = {
  // ============================================
  // SALON DE COIFFURE
  // ============================================
  salon_coiffure: {
    id: 'salon_coiffure',
    name: 'Salon de coiffure',
    icon: 'scissors',
    emoji: '✂️',
    description: 'Coiffeurs, barbiers, salons de beauté capillaire',

    defaultServices: [
      { name: 'Coupe homme', duration: 30, price: 28, category: 'coupe' },
      { name: 'Coupe femme', duration: 45, price: 42, category: 'coupe' },
      { name: 'Coupe enfant (-12 ans)', duration: 20, price: 18, category: 'coupe' },
      { name: 'Brushing', duration: 30, price: 28, category: 'coiffage' },
      { name: 'Coupe + Brushing', duration: 60, price: 58, category: 'coupe' },
      { name: 'Coloration', duration: 90, price: 65, category: 'couleur' },
      { name: 'Coupe + Coloration', duration: 105, price: 90, category: 'couleur' },
      { name: 'Mèches / Balayage', duration: 120, price: 85, category: 'couleur' },
      { name: 'Lissage brésilien', duration: 180, price: 150, category: 'soin' },
      { name: 'Soin profond', duration: 30, price: 25, category: 'soin' },
      { name: 'Barbe', duration: 20, price: 15, category: 'barbe' },
      { name: 'Coupe + Barbe', duration: 45, price: 38, category: 'barbe' },
    ],

    defaultHours: {
      monday: null, // Fermé le lundi (tradition coiffeurs)
      tuesday: { open: '09:00', close: '19:00' },
      wednesday: { open: '09:00', close: '19:00' },
      thursday: { open: '09:00', close: '19:00' },
      friday: { open: '09:00', close: '19:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: null,
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour et bienvenue chez {business_name} ! Je suis l'assistant virtuel du salon. Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant vocal du salon de coiffure {business_name}. Soyez chaleureux, professionnel et à l'écoute. Proposez des créneaux de rendez-vous et donnez les tarifs quand on vous les demande. Si le client demande un coiffeur en particulier, notez sa préférence. Proposez les services combinés (coupe + coloration, coupe + barbe) quand c'est pertinent.",
        tone: 'friendly_professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'humain', 'responsable', 'réclamation'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue chez {business_name}. Comment puis-je vous aider aujourd'hui ?",
        personality: "Vous êtes l'assistant WhatsApp du salon {business_name}. Soyez chaleureux et efficace. Utilisez des emojis avec modération. Aidez les clients à prendre RDV ou à obtenir des informations. Proposez les combinés (coupe + couleur) si le client hésite.",
        tone: 'friendly_professional',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Voir les tarifs', 'Horaires', 'Nous trouver'],
      },
      channel_web: {
        greeting: "Bonjour ! Je suis l'assistant virtuel de {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant web du salon de coiffure. Aidez les visiteurs à découvrir les services et à prendre rendez-vous.",
        tone: 'friendly_professional',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['reservations', 'whatsapp', 'seo', 'marketing'],
    suggestedPlan: 'business',
  },

  // ============================================
  // INSTITUT DE BEAUTÉ
  // ============================================
  institut_beaute: {
    id: 'institut_beaute',
    name: 'Institut de beauté',
    icon: 'sparkles',
    emoji: '💅',
    description: 'Esthétique, soins, manucure, spa',

    defaultServices: [
      { name: 'Manucure simple', duration: 30, price: 25, category: 'ongles' },
      { name: 'Manucure semi-permanent', duration: 45, price: 38, category: 'ongles' },
      { name: 'Pose complète gel', duration: 90, price: 55, category: 'ongles' },
      { name: 'Pédicure', duration: 45, price: 35, category: 'ongles' },
      { name: 'Épilation sourcils', duration: 15, price: 12, category: 'epilation' },
      { name: 'Épilation maillot', duration: 20, price: 22, category: 'epilation' },
      { name: 'Épilation jambes complètes', duration: 30, price: 28, category: 'epilation' },
      { name: 'Soin visage classique', duration: 50, price: 55, category: 'soin' },
      { name: 'Soin visage premium anti-âge', duration: 75, price: 79, category: 'soin' },
      { name: 'Massage relaxant', duration: 60, price: 65, category: 'massage' },
      { name: 'Massage dos/nuque', duration: 30, price: 38, category: 'massage' },
      { name: 'Extension cils', duration: 90, price: 80, category: 'cils' },
      { name: 'Forfait 5 massages (1h)', duration: 60, price: 290, category: 'forfait' },
      { name: 'Forfait soin visage x5', duration: 50, price: 245, category: 'forfait' },
    ],

    defaultHours: {
      monday: { open: '10:00', close: '19:00' },
      tuesday: { open: '10:00', close: '19:00' },
      wednesday: { open: '10:00', close: '19:00' },
      thursday: { open: '10:00', close: '20:00' }, // Nocturne
      friday: { open: '10:00', close: '19:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: null,
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour et bienvenue à l'institut {business_name} ! Je suis votre assistante virtuelle. Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistante de l'institut de beauté {business_name}. Soyez douce, professionnelle et à l'écoute. Mettez en avant le bien-être et la détente. Proposez les forfaits pour les clientes régulières (forfait 5 massages, cure visage). Précisez qu'un temps de préparation de 15 min est prévu entre chaque soin pour garantir un moment de détente optimal.",
        tone: 'warm_professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'esthéticienne', 'conseil personnalisé'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue à l'institut {business_name}. Comment puis-je vous aider ?",
        personality: "Assistante WhatsApp de l'institut de beauté. Soyez chaleureuse et professionnelle. Proposez les soins adaptés aux besoins des clientes. Mentionnez les forfaits et offres du moment.",
        tone: 'warm_professional',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Nos soins', 'Forfaits', 'Offres du moment'],
      },
      channel_web: {
        greeting: "Bienvenue ! Je suis là pour vous guider vers le soin parfait.",
        personality: "Assistant web de l'institut. Guidez les visiteurs vers les soins adaptés. Mettez en avant les forfaits pour fidéliser.",
        tone: 'warm_professional',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['reservations', 'whatsapp', 'marketing', 'seo'],
    suggestedPlan: 'business',
  },

  // ============================================
  // RESTAURANT
  // ============================================
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    icon: 'utensils',
    emoji: '🍽️',
    description: 'Restaurants, brasseries, bistrots',

    // Restaurant = réservation de TABLE (couverts), pas de prestation avec prix.
    // Le client réserve une table, mange, paie l'addition sur place.
    // Durée = 0 car un repas n'a pas de durée fixe (75 min midi, 120-150 min soir).
    // Le système gère la rotation par service (midi/soir), pas par créneau horaire.
    defaultServices: [
      { name: 'Table 1-2 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 3-4 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 5-6 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 7-8 couverts', duration: 0, price: 0, category: 'groupe' },
      { name: 'Grande table 9-12 couverts', duration: 0, price: 0, category: 'groupe' },
      { name: 'Privatisation salle (sur devis)', duration: 0, price: 0, category: 'evenement' },
      { name: 'Privatisation terrasse (sur devis)', duration: 0, price: 0, category: 'evenement' },
    ],

    defaultHours: {
      monday: null, // Souvent fermé le lundi
      tuesday: {
        lunch: { open: '12:00', close: '14:30' },
        dinner: { open: '19:00', close: '22:30' }
      },
      wednesday: {
        lunch: { open: '12:00', close: '14:30' },
        dinner: { open: '19:00', close: '22:30' }
      },
      thursday: {
        lunch: { open: '12:00', close: '14:30' },
        dinner: { open: '19:00', close: '22:30' }
      },
      friday: {
        lunch: { open: '12:00', close: '14:30' },
        dinner: { open: '19:00', close: '23:00' }
      },
      saturday: {
        lunch: { open: '12:00', close: '14:30' },
        dinner: { open: '19:00', close: '23:00' }
      },
      sunday: {
        lunch: { open: '12:00', close: '15:00' },
        dinner: null
      },
    },

    // Métadonnées spécifiques restaurant
    sectorConfig: {
      bookingUnit: 'couverts', // Réservation par nombre de personnes, pas par durée
      serviceTypes: ['midi', 'soir'],
      zones: ['salle', 'terrasse', 'salon_prive', 'bar'],
      avgDuration: { midi: 75, soir: 120 }, // Durée moyenne par service en minutes
      rotationsPerService: { midi: 2, soir: 1 }, // Nombre de services par table
      noShowPolicy: 'Confirmation SMS 24h avant. Table libérée après 15 min de retard sans contact.',
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour ! Restaurant {business_name}, comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du restaurant {business_name}. Soyez accueillant et efficace. Pour les réservations, demandez dans cet ordre : la date souhaitée, le service (midi ou soir), le nombre de couverts, et le nom. Si le client a une préférence (terrasse, salle, salon privé), notez-la. Précisez les horaires des services (midi 12h-14h30, soir 19h-22h30, 23h ven-sam). Informez sur le menu du jour et les suggestions du chef si demandé. Pour les groupes de plus de 8 personnes, proposez de transférer vers le responsable. Ne mentionnez jamais de prix de prestation — le client paie l'addition sur place après son repas. Pour les allergies alimentaires, notez-les soigneusement et transmettez en cuisine.",
        tone: 'warm_welcoming',
        canBook: true,
        canQuote: false,
        canTransfer: true,
        transferKeywords: ['parler au chef', 'allergies', 'menu spécial', 'réclamation', 'privatisation', 'groupe', 'événement'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue au restaurant {business_name}. Souhaitez-vous réserver une table ?",
        personality: "Assistant WhatsApp du restaurant. Aidez à réserver une table en demandant : date, service (midi ou soir), nombre de couverts, et nom. Notez les préférences (terrasse, intérieur). Ne mentionnez jamais de prix — le client paie l'addition sur place. Pour les allergies, notez et transmettez.",
        tone: 'warm_welcoming',
        canBook: true,
        canQuote: false,
        quickReplies: ['Réserver une table', 'Menu du jour', 'Horaires des services', 'Nous trouver'],
      },
      channel_web: {
        greeting: "Bienvenue au restaurant {business_name} ! Souhaitez-vous réserver une table ?",
        personality: "Assistant web du restaurant. Facilitez les réservations de table. Demandez la date, le service (midi ou soir), le nombre de couverts et les préférences (terrasse, salle). Ne mentionnez jamais de prix.",
        tone: 'warm_welcoming',
        canBook: true,
        canQuote: false,
      },
    },

    recommendedModules: ['reservations', 'telephone', 'whatsapp', 'marketing'],
    suggestedPlan: 'business',
  },

  // ============================================
  // CABINET MÉDICAL
  // ============================================
  medical: {
    id: 'medical',
    name: 'Cabinet médical',
    icon: 'stethoscope',
    emoji: '🏥',
    description: 'Médecins, dentistes, kinés, spécialistes',

    // Prix secteur 1 convention 2026 (maj janvier 2026)
    // Le praticien ajuste ses tarifs dans ses paramètres selon son secteur
    defaultServices: [
      { name: 'Consultation générale', duration: 20, price: 30, category: 'consultation' },
      { name: 'Consultation spécialisée', duration: 30, price: 50, category: 'consultation' },
      { name: 'Consultation de suivi', duration: 15, price: 30, category: 'suivi' },
      { name: 'Première consultation', duration: 45, price: 50, category: 'consultation' },
      { name: 'Consultation longue (+80 ans)', duration: 40, price: 60, category: 'consultation' },
      { name: 'Acte technique', duration: 30, price: 0, category: 'acte' }, // Prix variable selon acte
      { name: 'Téléconsultation', duration: 20, price: 30, category: 'teleconsultation' },
    ],

    defaultHours: {
      monday: {
        morning: { open: '08:30', close: '12:30' },
        afternoon: { open: '14:00', close: '18:00' }
      },
      tuesday: {
        morning: { open: '08:30', close: '12:30' },
        afternoon: { open: '14:00', close: '18:00' }
      },
      wednesday: {
        morning: { open: '08:30', close: '12:30' },
        afternoon: null // Souvent fermé l'après-midi
      },
      thursday: {
        morning: { open: '08:30', close: '12:30' },
        afternoon: { open: '14:00', close: '18:00' }
      },
      friday: {
        morning: { open: '08:30', close: '12:30' },
        afternoon: { open: '14:00', close: '17:00' }
      },
      saturday: null,
      sunday: null,
    },

    sectorConfig: {
      secteur: 1, // Secteur 1 par défaut (tarifs conventionnés), modifiable en paramètres
      urgencySlots: 2, // Créneaux urgence réservés par jour
      teleconsultationEnabled: true,
      noMedicalAdvice: true, // IA ne donne JAMAIS de conseil médical
      emergencyNumber: '15', // SAMU
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Cabinet du Docteur {owner_name}, bonjour. Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du cabinet médical du Dr {owner_name}. Soyez professionnel, rassurant et efficace. Proposez des rendez-vous en demandant : le motif (consultation, suivi, renouvellement d'ordonnance), si c'est un nouveau patient, et les disponibilités souhaitées. Ne donnez JAMAIS de conseil médical, de diagnostic ou d'avis sur un traitement. Ne suggérez jamais de médicament. En cas d'urgence médicale, orientez immédiatement vers le 15 (SAMU) ou le 112. Pour les demandes d'ordonnance ou de résultats, transférez au secrétariat.",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
        canTransfer: true,
        transferKeywords: ['urgence', 'parler au médecin', 'résultats', 'ordonnance', 'certificat'],
        emergencyMessage: "Si c'est une urgence médicale, veuillez appeler le 15 (SAMU) ou le 112 immédiatement.",
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Cabinet du Dr {owner_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp du cabinet médical. Soyez professionnel et efficace. Aidez à prendre RDV en demandant le motif et les disponibilités. Ne donnez JAMAIS de conseil médical. Orientez vers le 15 en cas d'urgence. Pour les renouvellements d'ordonnance, demandez le nom du patient et transférez au secrétariat.",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
        quickReplies: ['Prendre RDV', 'Horaires', 'Renouvellement ordonnance', 'Urgence'],
      },
      channel_web: {
        greeting: "Bienvenue au cabinet du Dr {owner_name}. Comment puis-je vous aider ?",
        personality: "Assistant web du cabinet médical. Facilitez la prise de RDV. Ne donnez jamais de conseil médical. Orientez vers le 15 en cas d'urgence.",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
      },
    },

    recommendedModules: ['reservations', 'telephone'],
    suggestedPlan: 'basic',
    specialNotes: [
      'Tarifs secteur 1 convention 2026 (30€ consultation générale)',
      'Ajustez les tarifs selon votre secteur (1 ou 2) dans Paramètres',
      'Conformité RGPD santé renforcée',
      'Pas de conseil médical par IA',
      'Redirection urgences vers 15 (SAMU) / 112',
    ],
  },

  // ============================================
  // GARAGE / CARROSSERIE
  // ============================================
  garage: {
    id: 'garage',
    name: 'Garage automobile',
    icon: 'car',
    emoji: '🚗',
    description: 'Garages, carrosseries, centres auto',

    // Prix main d'oeuvre moyenne France 2025-2026 : 70-100€/h
    // Les réparations complexes sont sur devis (prix 0€)
    defaultServices: [
      { name: 'Vidange + filtre', duration: 45, price: 85, category: 'entretien' },
      { name: 'Révision complète', duration: 120, price: 180, category: 'entretien' },
      { name: 'Contrôle technique', duration: 45, price: 78, category: 'controle' },
      { name: 'Contre-visite', duration: 30, price: 25, category: 'controle' },
      { name: 'Diagnostic électronique', duration: 60, price: 65, category: 'diagnostic' },
      { name: 'Changement plaquettes freins', duration: 60, price: 0, category: 'reparation' }, // Sur devis (pièces variables)
      { name: 'Changement pneus (x4)', duration: 60, price: 40, category: 'pneumatique' },
      { name: 'Géométrie / Parallélisme', duration: 45, price: 70, category: 'pneumatique' },
      { name: 'Climatisation (recharge)', duration: 45, price: 90, category: 'entretien' },
      { name: 'Réparation (sur devis)', duration: 60, price: 0, category: 'reparation' },
    ],

    defaultHours: {
      monday: { open: '08:00', close: '12:00', afternoon: { open: '14:00', close: '18:00' } },
      tuesday: { open: '08:00', close: '12:00', afternoon: { open: '14:00', close: '18:00' } },
      wednesday: { open: '08:00', close: '12:00', afternoon: { open: '14:00', close: '18:00' } },
      thursday: { open: '08:00', close: '12:00', afternoon: { open: '14:00', close: '18:00' } },
      friday: { open: '08:00', close: '12:00', afternoon: { open: '14:00', close: '18:00' } },
      saturday: { open: '08:00', close: '12:00' },
      sunday: null,
    },

    sectorConfig: {
      requiresVehicleInfo: true, // Toujours demander marque/modèle/année
      devisRequired: true, // Devis obligatoire pour réparations
      courtesyCarAvailable: false, // À configurer par le garage
      workflow: 'diagnostic_first', // diagnostic → devis → validation client → intervention
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Garage {business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du garage {business_name}. Soyez professionnel et direct. Pour toute prise de RDV, demandez systématiquement : la marque, le modèle et l'année du véhicule, puis le motif (entretien, réparation, contrôle technique). Pour les réparations, expliquez qu'un diagnostic sera effectué et qu'un devis sera établi avant toute intervention. Précisez les tarifs pour les prestations à prix fixe (vidange, pneus, contrôle technique). Pour les pannes ou dépannages urgents, proposez de transférer au mécanicien.",
        tone: 'professional_direct',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['devis complexe', 'parler au mécanicien', 'panne', 'dépannage', 'accident'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Garage {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp du garage. Aidez à prendre RDV en demandant le véhicule (marque/modèle/année) et le motif. Donnez les tarifs pour les prestations courantes. Pour les réparations : diagnostic d'abord, puis devis.",
        tone: 'professional_direct',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Devis réparation', 'Tarifs entretien', 'Horaires'],
      },
      channel_web: {
        greeting: "Bienvenue au garage {business_name} ! Comment puis-je vous aider ?",
        personality: "Assistant web du garage. Facilitez les prises de RDV en demandant le véhicule et le motif. Orientez vers un devis pour les réparations.",
        tone: 'professional_direct',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['reservations', 'telephone', 'whatsapp'],
    suggestedPlan: 'business',
  },

  // ============================================
  // COMMERCE / BOUTIQUE
  // ============================================
  commerce: {
    id: 'commerce',
    name: 'Commerce / Boutique',
    icon: 'store',
    emoji: '🏪',
    description: 'Boutiques, magasins, commerces de détail',

    defaultServices: [
      { name: 'Conseil personnalisé en boutique', duration: 30, price: 0, category: 'service' },
      { name: 'Personal shopping', duration: 60, price: 0, category: 'service' },
      { name: 'Retrait commande (Click & Collect)', duration: 10, price: 0, category: 'retrait' },
      { name: 'SAV / Échange / Retour', duration: 15, price: 0, category: 'sav' },
      { name: 'Atelier / Démonstration produit', duration: 45, price: 0, category: 'evenement' },
    ],

    defaultHours: {
      monday: { open: '10:00', close: '19:00' },
      tuesday: { open: '10:00', close: '19:00' },
      wednesday: { open: '10:00', close: '19:00' },
      thursday: { open: '10:00', close: '19:00' },
      friday: { open: '10:00', close: '19:00' },
      saturday: { open: '10:00', close: '19:00' },
      sunday: null,
    },

    sectorConfig: {
      bookingOptional: true, // Le commerce ne nécessite pas forcément de RDV
      clickAndCollect: true,
      loyaltyProgram: true,
      stockManagement: true,
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour ! {business_name}, comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de la boutique {business_name}. Soyez aimable et serviable. Renseignez sur les horaires d'ouverture, la disponibilité des produits et les services proposés. Informez sur les options de Click & Collect. Si le client cherche un produit spécifique, proposez de vérifier la disponibilité et de le réserver. Pour les retours et échanges, expliquez la politique du magasin.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['produit spécifique', 'commande', 'réclamation', 'retour'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue chez {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp de la boutique. Renseignez sur les produits, horaires et services. Proposez le Click & Collect pour les commandes. Informez sur le programme fidélité.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
        quickReplies: ['Horaires', 'Disponibilité produit', 'Click & Collect', 'Programme fidélité'],
      },
      channel_web: {
        greeting: "Bienvenue chez {business_name} ! Comment puis-je vous aider ?",
        personality: "Assistant web de la boutique. Guidez les visiteurs vers les produits et services. Proposez le Click & Collect.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
      },
    },

    recommendedModules: ['whatsapp', 'stock', 'marketing'],
    suggestedPlan: 'basic',
  },

  // ============================================
  // ARTISAN (Plombier, Électricien, etc.)
  // ============================================
  artisan: {
    id: 'artisan',
    name: 'Artisan / Dépannage',
    icon: 'wrench',
    emoji: '🔧',
    description: 'Plombiers, électriciens, serruriers, chauffagistes',

    // Tarifs moyens France 2025-2026
    // Main d'oeuvre : plombier 40-70€/h, électricien 40-65€/h
    // Déplacement inclus dans un rayon de 15-20 km
    defaultServices: [
      { name: 'Déplacement + diagnostic', duration: 60, price: 55, category: 'diagnostic' },
      { name: 'Intervention courante (1h)', duration: 60, price: 65, category: 'intervention' },
      { name: 'Intervention demi-journée', duration: 240, price: 250, category: 'intervention' },
      { name: 'Urgence jour (lun-sam 8h-20h)', duration: 90, price: 95, category: 'urgence' },
      { name: 'Urgence nuit/dimanche/férié', duration: 90, price: 150, category: 'urgence' },
      { name: 'Devis gratuit sur place', duration: 45, price: 0, category: 'devis' },
      { name: 'Entretien annuel (chaudière, clim)', duration: 90, price: 120, category: 'entretien' },
    ],

    defaultHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '12:00' },
      sunday: null, // Urgences sur demande
    },

    sectorConfig: {
      travelRadius: 20, // Rayon de déplacement inclus en km
      travelFeePerKm: 0.65, // Frais au-delà du rayon (€/km)
      devisRequired: true, // Devis obligatoire > 150€ TTC
      emergencyAvailable: true, // Urgences 24/7
      workflow: 'diagnostic_first', // diagnostic → devis → validation → intervention
    },

    iaConfig: {
      channel_telephone: {
        greeting: "{business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de {business_name}, artisan professionnel. Soyez rassurant et efficace. Évaluez le type d'intervention nécessaire en posant des questions précises : quel est le problème ? depuis quand ? y a-t-il un danger immédiat ? Distinguez les urgences (fuite d'eau active, panne électrique dangereuse, porte bloquée) des interventions planifiables. Pour les urgences réelles, proposez une intervention rapide en précisant le tarif urgence. Pour les autres, proposez un RDV et expliquez qu'un devis sera établi sur place. Précisez que le déplacement est inclus dans un rayon de 20 km.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['urgence grave', 'parler à l\'artisan', 'devis complexe', 'sinistre'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! {business_name} à votre service. Quel est votre besoin ?",
        personality: "Assistant WhatsApp de l'artisan. Évaluez rapidement le besoin (urgence ou planifié). Proposez RDV ou devis. Pour les urgences, indiquez les tarifs. Précisez le rayon de déplacement inclus.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        quickReplies: ['Urgence', 'Demander un devis', 'Prendre RDV', 'Tarifs'],
      },
      channel_web: {
        greeting: "Bienvenue ! Décrivez votre besoin, je vous aide.",
        personality: "Assistant web de l'artisan. Qualifiez les demandes : urgence ou intervention planifiée. Collectez les informations (adresse, type de problème, accès) pour préparer le devis.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['telephone', 'whatsapp', 'marketing'],
    suggestedPlan: 'business',
  },

  // ============================================
  // HÔTEL / HÉBERGEMENT
  // ============================================
  hotel: {
    id: 'hotel',
    name: 'Hôtel / Hébergement',
    icon: 'hotel',
    emoji: '🏨',
    description: 'Hôtels, chambres d\'hôtes, gîtes, appart-hôtels',

    // Prix indicatifs hôtel 3 étoiles France hors Paris (2025-2026)
    // Durée = 0 car l'hôtel fonctionne en nuitées (check-in/check-out), pas en créneaux horaires
    defaultServices: [
      { name: 'Chambre Simple', duration: 0, price: 80, category: 'chambre' },
      { name: 'Chambre Double', duration: 0, price: 120, category: 'chambre' },
      { name: 'Chambre Twin', duration: 0, price: 120, category: 'chambre' },
      { name: 'Chambre Familiale', duration: 0, price: 160, category: 'chambre' },
      { name: 'Suite Junior', duration: 0, price: 180, category: 'suite' },
      { name: 'Suite Prestige', duration: 0, price: 280, category: 'suite' },
      { name: 'Petit-déjeuner', duration: 0, price: 15, category: 'restauration' },
      { name: 'Demi-pension', duration: 0, price: 35, category: 'restauration' },
      { name: 'Pension complète', duration: 0, price: 55, category: 'restauration' },
      { name: 'Late check-out (14h)', duration: 0, price: 30, category: 'option' },
      { name: 'Early check-in (10h)', duration: 0, price: 25, category: 'option' },
      { name: 'Parking', duration: 0, price: 15, category: 'option' },
      { name: 'Lit bébé', duration: 0, price: 0, category: 'option' },
      { name: 'Transfert aéroport/gare', duration: 0, price: 40, category: 'option' },
    ],

    defaultHours: {
      monday: { open: '00:00', close: '23:59' },
      tuesday: { open: '00:00', close: '23:59' },
      wednesday: { open: '00:00', close: '23:59' },
      thursday: { open: '00:00', close: '23:59' },
      friday: { open: '00:00', close: '23:59' },
      saturday: { open: '00:00', close: '23:59' },
      sunday: { open: '00:00', close: '23:59' },
    },

    sectorConfig: {
      bookingUnit: 'nuitees', // Réservation par dates (check-in/check-out), pas par créneau
      checkInTime: '15:00',
      checkOutTime: '11:00',
      seasonalPricing: true, // Tarifs saisonniers activés
      roomStatuses: ['disponible', 'occupee', 'en_nettoyage', 'hors_service'],
      cancellationPolicy: 'Annulation gratuite 48h avant. Après : 1ère nuit facturée.',
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Hôtel {business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes le concierge virtuel de l'hôtel {business_name}. Soyez élégant, accueillant et attentionné. Pour les réservations, demandez dans cet ordre : les dates de séjour (arrivée et départ), le nombre de personnes (adultes et enfants), le type de chambre souhaité. Informez sur les tarifs par nuit, les services inclus et les options disponibles (petit-déjeuner à 15€/pers, parking à 15€/jour, late check-out à 30€). Précisez les horaires : check-in à 15h, check-out à 11h. Pour les demandes spéciales (lit bébé, chambre PMR, vue, étage élevé), notez-les soigneusement. Pour les groupes, séminaires ou événements, transférez à la réception. Les tarifs peuvent varier selon la saison.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à la réception', 'réclamation', 'groupe', 'événement', 'séminaire', 'demande spéciale'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue à l'hôtel {business_name}. Comment puis-je vous aider ?",
        personality: "Concierge virtuel WhatsApp de l'hôtel {business_name}. Soyez chaleureux et efficace. Aidez à réserver en demandant dates de séjour, nombre de personnes et préférences. Informez sur les disponibilités, tarifs et options. Check-in 15h, check-out 11h.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
        quickReplies: ['Réserver une chambre', 'Disponibilités', 'Tarifs', 'Services & options'],
      },
      channel_web: {
        greeting: "Bienvenue à l'hôtel {business_name} ! Puis-je vous aider à réserver votre séjour ?",
        personality: "Concierge virtuel de l'hôtel. Guidez les visiteurs vers la réservation en demandant dates de séjour, nombre de personnes et préférences. Informez sur les tarifs et services.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['reservations', 'telephone', 'whatsapp', 'comptabilite'],
    suggestedPlan: 'business',
  },

  // ============================================
  // SÉCURITÉ / MISE À DISPOSITION
  // ============================================
  security: {
    id: 'security',
    name: 'Sécurité / Mise à disposition',
    icon: 'shield',
    emoji: '🛡️',
    description: 'Sécurité privée, gardiennage, intérim, nettoyage industriel',

    defaultServices: [
      { name: 'Agent de sécurité (journée)', duration: 480, price: 250, category: 'gardiennage' },
      { name: 'Agent de sécurité (nuit)', duration: 600, price: 320, category: 'gardiennage' },
      { name: 'Ronde de surveillance', duration: 120, price: 80, category: 'ronde' },
      { name: 'Sécurité événementielle (agent/jour)', duration: 600, price: 280, category: 'evenement' },
      { name: 'Protection rapprochée (VIP)', duration: 480, price: 500, category: 'protection' },
      { name: 'Audit de sécurité / Diagnostic', duration: 120, price: 0, category: 'devis' },
    ],

    defaultHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '13:00' },
      sunday: null,
    },

    sectorConfig: {
      multiSite: true,
      staffAllocation: true,
      devisRequired: true,
      planningMultiDay: true,
      cnapsRequired: true,
    },

    iaConfig: {
      channel_telephone: {
        greeting: "{business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de {business_name}, société de sécurité privée. Soyez professionnel et rassurant. Qualifiez le besoin du client : type de prestation (gardiennage, événementiel, protection, ronde), lieu(x), durée, nombre d'agents requis. Proposez un devis ou un rendez-vous avec un commercial. Pour les demandes urgentes (sécurisation immédiate d'un site), proposez une intervention rapide.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['urgence', 'devis complexe', 'contrat', 'parler au responsable'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! {business_name} à votre service. Quel est votre besoin en sécurité ?",
        personality: "Assistant WhatsApp de la société de sécurité. Qualifiez rapidement le besoin (gardiennage, événement, protection). Collectez les informations clés (site, dates, nombre d'agents). Proposez devis ou RDV commercial.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        quickReplies: ['Demander un devis', 'Gardiennage', 'Événementiel', 'Nous contacter'],
      },
      channel_web: {
        greeting: "Bienvenue chez {business_name} ! Décrivez votre besoin en sécurité.",
        personality: "Assistant web de la société de sécurité. Qualifiez les demandes et orientez vers un devis ou un rendez-vous commercial.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['telephone', 'whatsapp', 'marketing'],
    suggestedPlan: 'business',
  },

  // ============================================
  // AUTRE / GÉNÉRIQUE
  // ============================================
  autre: {
    id: 'autre',
    name: 'Autre activité',
    icon: 'building',
    emoji: '🏢',
    description: 'Toute autre activité professionnelle',

    defaultServices: [
      { name: 'Consultation / Rendez-vous', duration: 30, price: 0, category: 'rdv' },
      { name: 'Devis gratuit', duration: 30, price: 0, category: 'devis' },
      { name: 'Prestation standard', duration: 60, price: 0, category: 'prestation' },
    ],

    defaultHours: {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: null,
      sunday: null,
    },

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour ! {business_name}, comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de {business_name}. Soyez professionnel et serviable. Répondez aux questions sur les services, les horaires et les tarifs. Aidez à prendre rendez-vous.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'responsable'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue chez {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp professionnel. Aidez les clients à obtenir des informations et à prendre rendez-vous.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Nos services', 'Horaires', 'Nous contacter'],
      },
      channel_web: {
        greeting: "Bienvenue ! Comment puis-je vous aider ?",
        personality: "Assistant web professionnel. Guidez les visiteurs vers les services et la prise de rendez-vous.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['whatsapp'],
    suggestedPlan: 'basic',
  },
};

// ============================================
// PLANS NEXUS — Modèle 2026 (voir memory/business-model-2026.md)
// ============================================
export const NEXUS_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Freemium à vie — pour découvrir NEXUS',
    includes: [
      'Dashboard & 30 réservations/mois',
      '20 factures/mois (avec watermark)',
      '50 clients max',
      'Support communautaire',
    ],
    modules: ['base', 'reservations'],
    maxIaModules: 0, // IA bloquée en Free
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 29,
    description: 'Tout débloqué + 500 crédits IA inclus/mois',
    popular: true,
    includes: [
      'Tout illimité (clients, factures, RDV)',
      '500 crédits IA inclus/mois (valeur 7,50€)',
      'IA Web, WhatsApp & Téléphone (via crédits)',
      'Comptabilité, CRM, Stock, Marketing',
      'Analytics & SEO',
      'Support email',
    ],
    modules: ['base', 'reservations', 'comptabilite', 'stock', 'whatsapp', 'telephone', 'crm', 'marketing', 'analytics', 'seo'],
    maxIaModules: -1,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 149,
    description: 'Multi-sites + 10 000 crédits IA inclus/mois',
    includes: [
      'Tout Basic +',
      'Multi-sites illimités',
      'White-label & API',
      'SSO & Account manager dédié',
      '10 000 crédits IA inclus/mois (valeur 150€)',
    ],
    modules: ['base', 'reservations', 'rh_avance', 'comptabilite', 'stock', 'marketing', 'analytics', 'seo', 'sentinel', 'whatsapp', 'telephone', 'api', 'multi_site', 'whitelabel'],
    maxIaModules: -1,
  },
  // ⚠️ DEPRECATED — alias retro-compat
  starter: { id: 'free', name: 'Free', price: 0, modules: ['base', 'reservations'], maxIaModules: 0 },
  pro: { id: 'basic', name: 'Basic', price: 29, popular: true, modules: ['base', 'reservations', 'comptabilite', 'stock', 'whatsapp', 'telephone'], maxIaModules: -1 },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Récupère un template par son ID
 */
export function getBusinessTemplate(businessType) {
  return BUSINESS_TEMPLATES[businessType] || BUSINESS_TEMPLATES.autre;
}

/**
 * Récupère tous les templates (pour affichage dans onboarding)
 */
export function getAllBusinessTemplates() {
  return Object.values(BUSINESS_TEMPLATES);
}

/**
 * Récupère un plan par son ID
 */
export function getPlan(planId) {
  return NEXUS_PLANS[planId] || NEXUS_PLANS.free;
}

/**
 * Remplace les variables dans les textes IA
 * {business_name} -> Nom du business
 * {owner_name} -> Nom du propriétaire
 */
export function processIaText(text, variables) {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * Génère la configuration IA complète pour un tenant
 */
export function generateIaConfig(businessType, businessName, ownerName) {
  const template = getBusinessTemplate(businessType);
  const variables = { business_name: businessName, owner_name: ownerName };

  const iaConfigs = {};

  for (const [channel, config] of Object.entries(template.iaConfig)) {
    iaConfigs[channel] = {
      ...config,
      greeting: processIaText(config.greeting, variables),
      personality: processIaText(config.personality, variables),
    };
  }

  return iaConfigs;
}

// ============================================
// TEMPLATE → BUSINESS PROFILE MAPPING
// ============================================
export const TEMPLATE_TO_PROFILE = {
  salon_coiffure: 'salon',
  institut_beaute: 'salon',
  restaurant: 'restaurant',
  medical: 'service',
  garage: 'service',
  artisan: 'service_domicile',
  hotel: 'hotel',
  commerce: 'commerce',
  security: 'security',
  autre: 'service',
};

// Professions qui overrident le template → profile mapping
// Quand la profession indique clairement un type different du template
export const PROFESSION_TO_PROFILE = {
  coach_sportif: 'service_domicile',
  photographe: 'service',
  formation: 'service',
  consultant: 'service',
  avocat: 'service',
  comptable: 'service',
  agent_immobilier: 'service',
  architecte: 'service',
  assurance: 'service',
  agence_web: 'service',
  evenementiel: 'service',
};

// ============================================
// PROFESSIONS DETAILLEES → TEMPLATE MAPPING
// Chaque métier concret pointe vers son template technique
// ============================================
export const PROFESSIONS = [
  // --- Beauté & Coiffure ---
  { id: 'coiffeur', label: 'Coiffeur / Coiffeuse', emoji: '✂️', description: 'Salon de coiffure, coupes, colorations', template: 'salon_coiffure', category: 'beaute' },
  { id: 'barbier', label: 'Barbier / Barber Shop', emoji: '💈', description: 'Taille de barbe, rasage, soins homme', template: 'salon_coiffure', category: 'beaute' },
  { id: 'estheticienne', label: 'Esthéticienne', emoji: '💅', description: 'Soins visage, épilation, manucure', template: 'institut_beaute', category: 'beaute' },
  { id: 'prothesiste_ongulaire', label: 'Prothésiste ongulaire', emoji: '💅', description: 'Pose de gel, résine, nail art', template: 'institut_beaute', category: 'beaute' },
  { id: 'maquilleuse', label: 'Maquilleuse', emoji: '💄', description: 'Maquillage événementiel, mariées', template: 'institut_beaute', category: 'beaute' },
  { id: 'spa', label: 'Spa / Centre bien-être', emoji: '🧖', description: 'Massages, hammam, sauna', template: 'institut_beaute', category: 'beaute' },
  { id: 'tatoueur', label: 'Tatoueur / Pierceur', emoji: '🎨', description: 'Tatouages, piercings, dermographie', template: 'institut_beaute', category: 'beaute' },

  // --- Santé & Médical ---
  { id: 'medecin', label: 'Médecin généraliste', emoji: '🩺', description: 'Consultations médicales', template: 'medical', category: 'sante' },
  { id: 'dentiste', label: 'Dentiste', emoji: '🦷', description: 'Soins dentaires, orthodontie', template: 'medical', category: 'sante' },
  { id: 'kinesitherapeute', label: 'Kinésithérapeute', emoji: '💪', description: 'Rééducation, massages thérapeutiques', template: 'medical', category: 'sante' },
  { id: 'osteopathe', label: 'Ostéopathe', emoji: '🦴', description: 'Manipulations, douleurs articulaires', template: 'medical', category: 'sante' },
  { id: 'psychologue', label: 'Psychologue / Psy', emoji: '🧠', description: 'Consultations, thérapies', template: 'medical', category: 'sante' },
  { id: 'dermatologue', label: 'Dermatologue', emoji: '🔬', description: 'Soins de la peau, laser', template: 'medical', category: 'sante' },
  { id: 'ophtalmologue', label: 'Ophtalmologue', emoji: '👁️', description: 'Examens de vue, chirurgie', template: 'medical', category: 'sante' },
  { id: 'veterinaire', label: 'Vétérinaire', emoji: '🐾', description: 'Soins animaux, vaccination', template: 'medical', category: 'sante' },
  { id: 'infirmier', label: 'Infirmier(e)', emoji: '💉', description: 'Soins, injections, pansements', template: 'medical', category: 'sante' },
  { id: 'podologue', label: 'Podologue / Pédicure', emoji: '🦶', description: 'Soins des pieds, semelles', template: 'medical', category: 'sante' },
  { id: 'orthophoniste', label: 'Orthophoniste', emoji: '🗣️', description: 'Rééducation du langage', template: 'medical', category: 'sante' },
  { id: 'sage_femme', label: 'Sage-femme', emoji: '👶', description: 'Suivi grossesse, préparation', template: 'medical', category: 'sante' },
  { id: 'dieteticien', label: 'Diététicien(ne)', emoji: '🥗', description: 'Bilans nutritionnels, régimes', template: 'medical', category: 'sante' },
  { id: 'naturopathe', label: 'Naturopathe', emoji: '🌿', description: 'Médecine naturelle, phytothérapie', template: 'medical', category: 'sante' },
  { id: 'sophrologue', label: 'Sophrologue', emoji: '🧘', description: 'Relaxation, gestion du stress', template: 'medical', category: 'sante' },
  { id: 'chiropracteur', label: 'Chiropracteur', emoji: '🦴', description: 'Ajustements vertébraux', template: 'medical', category: 'sante' },

  // --- Restauration ---
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️', description: 'Restaurant traditionnel, gastronomique', template: 'restaurant', category: 'restauration' },
  { id: 'pizzeria', label: 'Pizzeria', emoji: '🍕', description: 'Pizza, cuisine italienne', template: 'restaurant', category: 'restauration' },
  { id: 'brasserie', label: 'Brasserie / Bistrot', emoji: '🍺', description: 'Cuisine de brasserie, plats du jour', template: 'restaurant', category: 'restauration' },
  { id: 'fast_food', label: 'Fast-food / Snack', emoji: '🍔', description: 'Restauration rapide', template: 'commerce', category: 'restauration' },
  { id: 'food_truck', label: 'Food truck', emoji: '🚚', description: 'Cuisine ambulante, street food', template: 'commerce', category: 'restauration' },
  { id: 'bar', label: 'Bar / Lounge', emoji: '🍸', description: 'Cocktails, soirées, tapas', template: 'restaurant', category: 'restauration' },
  { id: 'cafe', label: 'Café / Salon de thé', emoji: '☕', description: 'Boissons chaudes, pâtisseries', template: 'restaurant', category: 'restauration' },
  { id: 'traiteur', label: 'Traiteur', emoji: '🥘', description: 'Événements, buffets, plateaux-repas', template: 'commerce', category: 'restauration' },
  { id: 'boulangerie', label: 'Boulangerie / Pâtisserie', emoji: '🥐', description: 'Pain, viennoiseries, gâteaux', template: 'commerce', category: 'restauration' },
  { id: 'sushi', label: 'Restaurant japonais / Sushi', emoji: '🍣', description: 'Sushi, ramen, cuisine japonaise', template: 'restaurant', category: 'restauration' },

  // --- Hébergement ---
  { id: 'hotel', label: 'Hôtel', emoji: '🏨', description: 'Chambres, suites, séminaires', template: 'hotel', category: 'hebergement' },
  { id: 'chambre_hotes', label: 'Chambre d\'hôtes / B&B', emoji: '🏡', description: 'Accueil chaleureux, petit-déjeuner', template: 'hotel', category: 'hebergement' },
  { id: 'gite', label: 'Gîte / Location saisonnière', emoji: '🏠', description: 'Location courte durée, vacances', template: 'hotel', category: 'hebergement' },
  { id: 'auberge', label: 'Auberge / Hostel', emoji: '🛏️', description: 'Hébergement économique, dortoirs', template: 'hotel', category: 'hebergement' },
  { id: 'camping', label: 'Camping / Glamping', emoji: '⛺', description: 'Emplacements, mobil-homes', template: 'hotel', category: 'hebergement' },

  // --- Automobile & Mécanique ---
  { id: 'garage', label: 'Garage automobile', emoji: '🔧', description: 'Réparation, entretien, vidange', template: 'garage', category: 'automobile' },
  { id: 'carrossier', label: 'Carrossier', emoji: '🚗', description: 'Réparation carrosserie, peinture', template: 'garage', category: 'automobile' },
  { id: 'controle_technique', label: 'Contrôle technique', emoji: '✅', description: 'Contrôle réglementaire véhicules', template: 'garage', category: 'automobile' },
  { id: 'mecanicien_moto', label: 'Mécanicien moto / 2 roues', emoji: '🏍️', description: 'Réparation motos, scooters', template: 'garage', category: 'automobile' },
  { id: 'lavage_auto', label: 'Station de lavage', emoji: '🧽', description: 'Lavage, detailing, polissage', template: 'garage', category: 'automobile' },
  { id: 'auto_ecole', label: 'Auto-école', emoji: '🚘', description: 'Permis de conduire, leçons', template: 'autre', category: 'automobile' },

  // --- Commerce ---
  { id: 'boutique_vetements', label: 'Boutique de vêtements', emoji: '👗', description: 'Prêt-à-porter, mode', template: 'commerce', category: 'commerce' },
  { id: 'fleuriste', label: 'Fleuriste', emoji: '💐', description: 'Bouquets, compositions florales', template: 'commerce', category: 'commerce' },
  { id: 'bijouterie', label: 'Bijouterie / Horlogerie', emoji: '💍', description: 'Bijoux, montres, réparation', template: 'commerce', category: 'commerce' },
  { id: 'librairie', label: 'Librairie / Papeterie', emoji: '📚', description: 'Livres, fournitures', template: 'commerce', category: 'commerce' },
  { id: 'epicerie', label: 'Épicerie fine / Bio', emoji: '🛒', description: 'Produits locaux, bio, gourmet', template: 'commerce', category: 'commerce' },
  { id: 'opticien', label: 'Opticien', emoji: '👓', description: 'Lunettes, lentilles, examens', template: 'commerce', category: 'commerce' },
  { id: 'magasin_sport', label: 'Magasin de sport', emoji: '⚽', description: 'Équipements sportifs', template: 'commerce', category: 'commerce' },
  { id: 'animalerie', label: 'Animalerie', emoji: '🐶', description: 'Animaux, accessoires, alimentation', template: 'commerce', category: 'commerce' },
  { id: 'cave_vin', label: 'Cave à vin', emoji: '🍷', description: 'Vins, spiritueux, dégustations', template: 'commerce', category: 'commerce' },
  { id: 'pharmacie', label: 'Pharmacie / Parapharmacie', emoji: '💊', description: 'Médicaments, cosmétiques, conseil', template: 'commerce', category: 'commerce' },

  // --- Services à domicile & Artisanat ---
  { id: 'plombier', label: 'Plombier', emoji: '🔧', description: 'Plomberie, chauffage, dépannage', template: 'artisan', category: 'services' },
  { id: 'electricien', label: 'Électricien', emoji: '⚡', description: 'Installation, dépannage électrique', template: 'artisan', category: 'services' },
  { id: 'serrurier', label: 'Serrurier', emoji: '🔑', description: 'Ouverture de portes, serrures', template: 'artisan', category: 'services' },
  { id: 'peintre', label: 'Peintre en bâtiment', emoji: '🎨', description: 'Peinture intérieure/extérieure', template: 'artisan', category: 'services' },
  { id: 'jardinier', label: 'Jardinier / Paysagiste', emoji: '🌳', description: 'Entretien jardins, aménagement', template: 'artisan', category: 'services' },
  { id: 'livreur', label: 'Livreur / Coursier', emoji: '📦', description: 'Livraison, transport de colis', template: 'artisan', category: 'services' },
  { id: 'demenageur', label: 'Déménageur', emoji: '🚛', description: 'Déménagement, transport meubles', template: 'artisan', category: 'services' },
  { id: 'nettoyage', label: 'Nettoyage / Ménage', emoji: '🧹', description: 'Ménage, entretien locaux', template: 'artisan', category: 'services' },
  { id: 'reparateur_info', label: 'Réparateur informatique', emoji: '💻', description: 'Dépannage PC, réseaux', template: 'artisan', category: 'services' },
  { id: 'coach_sportif', label: 'Coach sportif', emoji: '🏋️', description: 'Coaching personnel, remise en forme', template: 'artisan', category: 'services' },
  { id: 'photographe', label: 'Photographe / Vidéaste', emoji: '📸', description: 'Shooting, événements, vidéo', template: 'artisan', category: 'services' },
  { id: 'prof_particulier', label: 'Professeur particulier', emoji: '📖', description: 'Cours à domicile, soutien scolaire', template: 'artisan', category: 'services' },
  { id: 'pet_sitter', label: 'Pet-sitter / Dog-walker', emoji: '🐕', description: 'Garde d\'animaux, promenades', template: 'artisan', category: 'services' },
  { id: 'aide_domicile', label: 'Aide à domicile', emoji: '🏠', description: 'Assistance personnes âgées', template: 'artisan', category: 'services' },
  { id: 'couturier', label: 'Couturier / Retouches', emoji: '🧵', description: 'Retouches vêtements, couture', template: 'artisan', category: 'services' },
  { id: 'menuisier', label: 'Menuisier / Ébéniste', emoji: '🪚', description: 'Meubles sur mesure, réparations bois', template: 'artisan', category: 'services' },
  { id: 'vitrier', label: 'Vitrier / Miroitier', emoji: '🪟', description: 'Vitrerie, double vitrage', template: 'artisan', category: 'services' },
  { id: 'climatisation', label: 'Climatisation / Chauffage', emoji: '❄️', description: 'Installation, entretien clim/chauffage', template: 'artisan', category: 'services' },

  // --- Sport & Loisirs ---
  { id: 'salle_sport', label: 'Salle de sport / Fitness', emoji: '🏋️', description: 'Abonnements, cours collectifs', template: 'autre', category: 'sport' },
  { id: 'yoga', label: 'Studio yoga / Pilates', emoji: '🧘', description: 'Cours de yoga, méditation', template: 'autre', category: 'sport' },
  { id: 'danse', label: 'École de danse', emoji: '💃', description: 'Cours de danse, stages', template: 'autre', category: 'sport' },
  { id: 'arts_martiaux', label: 'Arts martiaux / Boxe', emoji: '🥋', description: 'Karaté, judo, boxe, MMA', template: 'autre', category: 'sport' },
  { id: 'equitation', label: 'Centre équestre', emoji: '🐴', description: 'Cours d\'équitation, balades', template: 'autre', category: 'sport' },

  // --- Conseil & Services pro ---
  { id: 'consultant', label: 'Consultant / Coach', emoji: '💼', description: 'Conseil en entreprise, coaching', template: 'autre', category: 'conseil' },
  { id: 'avocat', label: 'Avocat / Cabinet juridique', emoji: '⚖️', description: 'Droit, contentieux, conseil juridique', template: 'autre', category: 'conseil' },
  { id: 'comptable', label: 'Expert-comptable', emoji: '📊', description: 'Comptabilité, fiscalité, paie', template: 'autre', category: 'conseil' },
  { id: 'agent_immobilier', label: 'Agent immobilier', emoji: '🏢', description: 'Vente, location, gestion locative', template: 'autre', category: 'conseil' },
  { id: 'architecte', label: 'Architecte / Designer', emoji: '📐', description: 'Plans, décoration, aménagement', template: 'autre', category: 'conseil' },
  { id: 'assurance', label: 'Courtier en assurance', emoji: '🛡️', description: 'Assurances, mutuelles, prévoyance', template: 'autre', category: 'conseil' },
  { id: 'agence_web', label: 'Agence web / Freelance IT', emoji: '🖥️', description: 'Sites web, applications, SEO', template: 'autre', category: 'conseil' },
  { id: 'formation', label: 'Organisme de formation', emoji: '🎓', description: 'Formations professionnelles, CPF', template: 'autre', category: 'conseil' },
  { id: 'evenementiel', label: 'Événementiel / Wedding planner', emoji: '🎉', description: 'Organisation d\'événements, mariages', template: 'autre', category: 'conseil' },

  // --- Sécurité & Mise à disposition ---
  { id: 'securite_privee', label: 'Sécurité privée', emoji: '🛡️', description: 'Gardiennage, surveillance, agents de sécurité', template: 'security', category: 'securite' },
  { id: 'interim', label: 'Agence d\'intérim', emoji: '👥', description: 'Mise à disposition de personnel temporaire', template: 'security', category: 'securite' },
  { id: 'gardiennage', label: 'Gardiennage / Vigile', emoji: '🔒', description: 'Surveillance de sites, rondes, accueil', template: 'security', category: 'securite' },
  { id: 'nettoyage_industriel', label: 'Nettoyage industriel', emoji: '🏭', description: 'Nettoyage de locaux professionnels, chantiers', template: 'security', category: 'securite' },
  { id: 'protection_rapprochee', label: 'Protection rapprochée', emoji: '🕶️', description: 'Bodyguard, escorte, protection VIP', template: 'security', category: 'securite' },
  { id: 'securite_evenementielle', label: 'Sécurité événementielle', emoji: '🎪', description: 'Concerts, festivals, événements sportifs', template: 'security', category: 'securite' },

  // --- Autre ---
  { id: 'autre', label: 'Autre activité', emoji: '🏪', description: 'Mon activité n\'est pas listée', template: 'autre', category: 'autre' },
];

// Catégories pour le groupement dans le signup
export const PROFESSION_CATEGORIES = {
  beaute: { label: 'Beauté & Coiffure', emoji: '💇' },
  sante: { label: 'Santé & Médical', emoji: '🩺' },
  restauration: { label: 'Restauration', emoji: '🍽️' },
  hebergement: { label: 'Hébergement', emoji: '🏨' },
  automobile: { label: 'Automobile', emoji: '🚗' },
  commerce: { label: 'Commerce', emoji: '🛍️' },
  services: { label: 'Services & Artisanat', emoji: '🔧' },
  sport: { label: 'Sport & Loisirs', emoji: '⚽' },
  conseil: { label: 'Conseil & Services pro', emoji: '💼' },
  securite: { label: 'Sécurité & Mise à disposition', emoji: '🛡️' },
  autre: { label: 'Autre', emoji: '🏪' },
};

/**
 * Trouve le template correspondant à un métier
 */
export function getTemplateForProfession(professionId) {
  const profession = PROFESSIONS.find(p => p.id === professionId);
  return profession ? profession.template : 'autre';
}

export default BUSINESS_TEMPLATES;
