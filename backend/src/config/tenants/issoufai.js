/**
 * Configuration tenant : issouf-ai
 * Tenant pour le projet freelance Issouf.ai — IA conversationnelle demo
 *
 * WhatsApp Meta : +33 9 39 24 56 51 (WABA 1329219092461656, phone_number_id 1075773385622278)
 * Twilio Voice : +33 9 39 24 56 51 (webhook issouf-ai.onrender.com)
 *
 * Ce tenant route les messages WhatsApp via NEXUS webhook,
 * mais l'IA repond en tant qu'assistant issouf.ai (pas NEXUS).
 */

const tenant = {
  // === IDENTITE ===
  id: 'issouf-ai',
  name: 'Issouf.ai',
  domain: 'issouf.ai',
  isDemoTenant: true,
  assistantName: 'Issouf.ai',
  telephone: '+33939245651',
  gerante: 'Issouf Toure',
  adresse: 'Paris, France',
  concept: 'Issouf.ai — Expert IA conversationnelle. Telephone, WhatsApp, Chat automatises pour entreprises.',
  peutRecevoirChezElle: false,
  secteur: 'Services IA',
  ville: 'Paris',

  // === BRANDING ===
  branding: {
    primaryColor: '#6366F1',
    accentColor: '#8B5CF6',
  },

  // === HORAIRES ===
  businessHours: {
    0: null,
    1: { open: '09:00', close: '19:00' },
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: null,
  },
  daysOpen: [1, 2, 3, 4, 5],

  // === REGLES ===
  bookingRules: {
    MIN_ADVANCE_HOURS: 24,
    MAX_ADVANCE_DAYS: 60,
  },

  // === PERSONNALITE DE L'ASSISTANT ===
  personality: {
    tutoiement: false,
    ton: 'professionnel',
    emojis: 'moderation',
    description: 'Expert IA, professionnel, chaleureux, oriente solutions',
  },

  horairesTexte: `• Lundi - Vendredi : 9h - 19h
• Samedi - Dimanche : Fermé`,

  // === PROTECTION ===
  frozen: false,
  nexusVersion: '1.0.0',

  // === FEATURES ===
  features: {
    assistant_chat: true,
    assistant_whatsapp: true,
    assistant_telephone: true,
  },
};

export default tenant;
