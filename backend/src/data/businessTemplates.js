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
      { name: 'Coupe homme', duration: 30, price: 25, category: 'coupe' },
      { name: 'Coupe femme', duration: 45, price: 35, category: 'coupe' },
      { name: 'Coupe enfant', duration: 20, price: 15, category: 'coupe' },
      { name: 'Brushing', duration: 30, price: 25, category: 'coiffage' },
      { name: 'Coupe + Brushing', duration: 60, price: 55, category: 'coupe' },
      { name: 'Coloration', duration: 90, price: 65, category: 'couleur' },
      { name: 'Mèches / Balayage', duration: 120, price: 85, category: 'couleur' },
      { name: 'Lissage brésilien', duration: 180, price: 150, category: 'soin' },
      { name: 'Soin profond', duration: 30, price: 25, category: 'soin' },
      { name: 'Barbe', duration: 20, price: 15, category: 'barbe' },
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
        personality: "Vous êtes l'assistant vocal du salon de coiffure {business_name}. Soyez chaleureux, professionnel et à l'écoute. Proposez des créneaux de rendez-vous et donnez les tarifs quand on vous les demande.",
        tone: 'friendly_professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'humain', 'responsable', 'réclamation'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 👋 Bienvenue chez {business_name}. Comment puis-je vous aider aujourd'hui ?",
        personality: "Vous êtes l'assistant WhatsApp du salon {business_name}. Soyez chaleureux et efficace. Utilisez des emojis avec modération. Aidez les clients à prendre RDV ou à obtenir des informations.",
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
      { name: 'Manucure semi-permanent', duration: 45, price: 35, category: 'ongles' },
      { name: 'Pose complète gel', duration: 90, price: 55, category: 'ongles' },
      { name: 'Pédicure', duration: 45, price: 35, category: 'ongles' },
      { name: 'Épilation sourcils', duration: 15, price: 10, category: 'epilation' },
      { name: 'Épilation maillot', duration: 20, price: 20, category: 'epilation' },
      { name: 'Épilation jambes', duration: 30, price: 25, category: 'epilation' },
      { name: 'Soin visage', duration: 60, price: 55, category: 'soin' },
      { name: 'Soin anti-âge', duration: 75, price: 75, category: 'soin' },
      { name: 'Massage relaxant', duration: 60, price: 65, category: 'massage' },
      { name: 'Extension cils', duration: 90, price: 80, category: 'cils' },
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
        personality: "Vous êtes l'assistante de l'institut de beauté {business_name}. Soyez douce, professionnelle et à l'écoute. Mettez en avant le bien-être et la détente.",
        tone: 'warm_professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'esthéticienne', 'conseil personnalisé'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! ✨ Bienvenue à l'institut {business_name}. Comment puis-je vous aider ?",
        personality: "Assistante WhatsApp de l'institut de beauté. Soyez chaleureuse et professionnelle. Proposez les soins adaptés aux besoins des clientes.",
        tone: 'warm_professional',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Nos soins', 'Tarifs', 'Offres du moment'],
      },
      channel_web: {
        greeting: "Bienvenue ! ✨ Je suis là pour vous guider vers le soin parfait.",
        personality: "Assistant web de l'institut. Guidez les visiteurs vers les soins adaptés.",
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

    // Restaurant = réservation de TABLE (créneau + couverts), pas de prestation avec prix.
    // Le client réserve une table, mange, paie l'addition sur place.
    defaultServices: [
      { name: 'Table 1-2 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 3-4 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 5-6 couverts', duration: 0, price: 0, category: 'table' },
      { name: 'Table 7+ couverts (groupe)', duration: 0, price: 0, category: 'groupe' },
      { name: 'Privatisation (sur devis)', duration: 0, price: 0, category: 'evenement' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour ! Restaurant {business_name}, comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du restaurant {business_name}. Soyez accueillant et efficace. Pour les réservations, demandez : le nombre de couverts, la date, le service souhaité (midi ou soir) et le nom. Précisez les horaires des services. Informez sur le menu du jour et les suggestions du chef si demandé. Ne mentionnez jamais de prix de prestation — le client paie l'addition sur place après son repas.",
        tone: 'warm_welcoming',
        canBook: true,
        canQuote: false,
        canTransfer: true,
        transferKeywords: ['parler au chef', 'allergies', 'menu spécial', 'réclamation', 'privatisation'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 🍽️ Bienvenue au restaurant {business_name}. Souhaitez-vous réserver une table ?",
        personality: "Assistant WhatsApp du restaurant. Aidez à réserver une table en demandant : nombre de couverts, date, service (midi ou soir), et nom. Ne mentionnez jamais de prix — le client paie l'addition sur place.",
        tone: 'warm_welcoming',
        canBook: true,
        canQuote: false,
        quickReplies: ['Réserver une table', 'Menu du jour', 'Horaires des services', 'Nous trouver'],
      },
      channel_web: {
        greeting: "Bienvenue au restaurant {business_name} ! Souhaitez-vous réserver une table ?",
        personality: "Assistant web du restaurant. Facilitez les réservations de table. Demandez le nombre de couverts, la date et le service (midi ou soir). Ne mentionnez jamais de prix.",
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

    defaultServices: [
      { name: 'Consultation générale', duration: 20, price: 25, category: 'consultation' },
      { name: 'Consultation spécialisée', duration: 30, price: 50, category: 'consultation' },
      { name: 'Consultation de suivi', duration: 15, price: 25, category: 'suivi' },
      { name: 'Première consultation', duration: 45, price: 50, category: 'consultation' },
      { name: 'Acte technique', duration: 30, price: 0, category: 'acte' }, // Prix variable
      { name: 'Téléconsultation', duration: 15, price: 25, category: 'teleconsultation' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "Cabinet du Docteur {owner_name}, bonjour. Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du cabinet médical du Dr {owner_name}. Soyez professionnel, rassurant et efficace. Proposez des rendez-vous, mais ne donnez JAMAIS de conseil médical. En cas d'urgence, orientez vers le 15 (SAMU).",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
        canTransfer: true,
        transferKeywords: ['urgence', 'parler au médecin', 'résultats', 'ordonnance'],
        emergencyMessage: "Si c'est une urgence médicale, veuillez appeler le 15 (SAMU) immédiatement.",
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Cabinet du Dr {owner_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp du cabinet médical. Soyez professionnel et efficace. Aidez à prendre RDV. Ne donnez JAMAIS de conseil médical. Orientez vers le 15 en cas d'urgence.",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
        quickReplies: ['Prendre RDV', 'Horaires', 'Renouvellement ordonnance', 'Urgence'],
      },
      channel_web: {
        greeting: "Bienvenue au cabinet du Dr {owner_name}. Comment puis-je vous aider ?",
        personality: "Assistant web du cabinet médical. Facilitez la prise de RDV.",
        tone: 'professional_caring',
        canBook: true,
        canQuote: false,
      },
    },

    recommendedModules: ['reservations', 'telephone'],
    suggestedPlan: 'starter',
    specialNotes: [
      'Conformité RGPD santé renforcée',
      'Pas de conseil médical par IA',
      'Redirection urgences vers 15',
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

    defaultServices: [
      { name: 'Révision', duration: 120, price: 150, category: 'entretien' },
      { name: 'Vidange', duration: 45, price: 80, category: 'entretien' },
      { name: 'Contrôle technique', duration: 45, price: 80, category: 'controle' },
      { name: 'Diagnostic', duration: 30, price: 50, category: 'diagnostic' },
      { name: 'Changement pneus', duration: 60, price: 40, category: 'pneumatique' },
      { name: 'Géométrie', duration: 45, price: 70, category: 'pneumatique' },
      { name: 'Freins (devis)', duration: 30, price: 0, category: 'reparation' },
      { name: 'Embrayage (devis)', duration: 30, price: 0, category: 'reparation' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "Garage {business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant du garage {business_name}. Soyez professionnel et direct. Aidez les clients à prendre RDV pour révision, réparation ou diagnostic. Demandez la marque et le modèle du véhicule.",
        tone: 'professional_direct',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['devis complexe', 'parler au mécanicien', 'panne'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 🚗 Garage {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp du garage. Aidez à prendre RDV et donnez les tarifs de base. Demandez toujours le véhicule concerné.",
        tone: 'professional_direct',
        canBook: true,
        canQuote: true,
        quickReplies: ['Prendre RDV', 'Devis réparation', 'Tarifs entretien', 'Horaires'],
      },
      channel_web: {
        greeting: "Bienvenue au garage {business_name} ! Comment puis-je vous aider ?",
        personality: "Assistant web du garage. Facilitez les prises de RDV.",
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
      { name: 'Conseil personnalisé', duration: 30, price: 0, category: 'service' },
      { name: 'Retrait commande', duration: 15, price: 0, category: 'service' },
      { name: 'SAV / Échange', duration: 20, price: 0, category: 'sav' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "Bonjour ! {business_name}, comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de la boutique {business_name}. Soyez aimable et serviable. Renseignez sur les horaires, les produits disponibles et les services.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['produit spécifique', 'commande', 'réclamation'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 🛍️ Bienvenue chez {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp de la boutique. Renseignez sur les produits, horaires et services.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
        quickReplies: ['Horaires', 'Disponibilité produit', 'Click & Collect', 'Nous trouver'],
      },
      channel_web: {
        greeting: "Bienvenue ! Comment puis-je vous aider ?",
        personality: "Assistant web de la boutique. Guidez les visiteurs.",
        tone: 'friendly_helpful',
        canBook: false,
        canQuote: true,
      },
    },

    recommendedModules: ['whatsapp', 'ecommerce', 'marketing'],
    suggestedPlan: 'starter',
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

    defaultServices: [
      { name: 'Déplacement + diagnostic', duration: 60, price: 50, category: 'diagnostic' },
      { name: 'Intervention standard', duration: 120, price: 0, category: 'intervention' },
      { name: 'Urgence (jour)', duration: 90, price: 80, category: 'urgence' },
      { name: 'Urgence (nuit/WE)', duration: 90, price: 120, category: 'urgence' },
      { name: 'Devis gratuit', duration: 45, price: 0, category: 'devis' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "{business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes l'assistant de {business_name}, artisan professionnel. Soyez rassurant et efficace. Évaluez le type d'intervention nécessaire et proposez un RDV ou un devis. En cas d'urgence réelle (fuite d'eau, panne électrique dangereuse), proposez une intervention rapide.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['urgence grave', 'parler à l\'artisan', 'devis complexe'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 🔧 {business_name} à votre service. Quel est votre besoin ?",
        personality: "Assistant WhatsApp de l'artisan. Évaluez rapidement le besoin et proposez RDV ou devis.",
        tone: 'professional_reassuring',
        canBook: true,
        canQuote: true,
        quickReplies: ['Demander un devis', 'Urgence', 'Prendre RDV', 'Tarifs'],
      },
      channel_web: {
        greeting: "Bienvenue ! Décrivez votre besoin, je vous aide.",
        personality: "Assistant web de l'artisan. Qualifiez les demandes.",
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

    defaultServices: [
      { name: 'Chambre Simple', duration: 0, price: 80, category: 'chambre' },
      { name: 'Chambre Double', duration: 0, price: 120, category: 'chambre' },
      { name: 'Chambre Twin', duration: 0, price: 120, category: 'chambre' },
      { name: 'Suite Junior', duration: 0, price: 180, category: 'suite' },
      { name: 'Suite Prestige', duration: 0, price: 280, category: 'suite' },
      { name: 'Petit-déjeuner', duration: 0, price: 15, category: 'restauration' },
      { name: 'Demi-pension', duration: 0, price: 35, category: 'restauration' },
      { name: 'Pension complète', duration: 0, price: 55, category: 'restauration' },
      { name: 'Late check-out (14h)', duration: 0, price: 30, category: 'option' },
      { name: 'Parking', duration: 0, price: 15, category: 'option' },
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

    iaConfig: {
      channel_telephone: {
        greeting: "Hôtel {business_name}, bonjour ! Comment puis-je vous aider ?",
        personality: "Vous êtes le concierge virtuel de l'hôtel {business_name}. Soyez élégant, accueillant et attentionné. Aidez les clients à réserver une chambre en demandant : dates de séjour, nombre de personnes, type de chambre souhaité. Informez sur les tarifs, les services inclus et les options (petit-déjeuner, parking, late check-out). Pour les demandes spéciales (lit bébé, chambre PMR, vue mer), notez-les et transmettez à la réception.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à la réception', 'réclamation', 'groupe', 'événement', 'séminaire', 'demande spéciale'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! 🏨 Bienvenue à l'hôtel {business_name}. Comment puis-je vous aider ?",
        personality: "Concierge virtuel WhatsApp de l'hôtel {business_name}. Soyez chaleureux et efficace. Aidez à réserver en demandant dates, nombre de personnes et préférences. Informez sur les disponibilités et tarifs.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
        quickReplies: ['Réserver une chambre', 'Disponibilités', 'Tarifs', 'Services & options'],
      },
      channel_web: {
        greeting: "Bienvenue à l'hôtel {business_name} ! Puis-je vous aider à réserver votre séjour ?",
        personality: "Concierge virtuel de l'hôtel. Guidez les visiteurs vers la réservation en demandant leurs dates et préférences.",
        tone: 'elegant_welcoming',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['reservations', 'telephone', 'whatsapp', 'comptabilite'],
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

    defaultServices: [],

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
        personality: "Vous êtes l'assistant de {business_name}. Soyez professionnel et serviable. Répondez aux questions et aidez à prendre contact.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
        canTransfer: true,
        transferKeywords: ['parler à quelqu\'un', 'responsable'],
      },
      channel_whatsapp: {
        greeting: "Bonjour ! Bienvenue chez {business_name}. Comment puis-je vous aider ?",
        personality: "Assistant WhatsApp professionnel. Aidez les clients à obtenir des informations.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
        quickReplies: ['Contact', 'Informations', 'Horaires', 'Services'],
      },
      channel_web: {
        greeting: "Bienvenue ! Comment puis-je vous aider ?",
        personality: "Assistant web professionnel.",
        tone: 'professional',
        canBook: true,
        canQuote: true,
      },
    },

    recommendedModules: ['whatsapp'],
    suggestedPlan: 'starter',
  },
};

// ============================================
// PLANS NEXUS
// ============================================
export const NEXUS_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 79,
    originalPrice: 99,
    description: 'Pour démarrer avec l\'IA',
    includes: [
      'Dashboard & Réservations',
      'Facturation & Documents',
      'Agent IA Web',
      'Support email',
    ],
    modules: ['base', 'reservations'],
    maxIaModules: 1,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 199,
    originalPrice: 249,
    description: 'Pour les professionnels actifs',
    popular: true,
    includes: [
      'Tout Starter +',
      'WhatsApp & Téléphone IA',
      'Comptabilité complète',
      'CRM avancé & Stock',
      'Support prioritaire',
    ],
    modules: ['base', 'reservations', 'comptabilite', 'stock', 'whatsapp', 'telephone'],
    maxIaModules: 3,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 399,
    originalPrice: 499,
    description: 'Pour les entreprises exigeantes',
    includes: [
      'Tout Pro +',
      'Marketing & Pipeline',
      'Analytics & SEO',
      'RH & Planning',
      'API & Account manager',
    ],
    modules: ['base', 'reservations', 'rh_avance', 'comptabilite', 'stock', 'marketing', 'analytics', 'seo', 'sentinel', 'whatsapp', 'telephone'],
    maxIaModules: -1, // Illimité
  },
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
  return NEXUS_PLANS[planId] || NEXUS_PLANS.starter;
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

export default BUSINESS_TEMPLATES;
