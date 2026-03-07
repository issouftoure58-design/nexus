/**
 * NEXUS — Source unique de vérité pour tous les prix
 *
 * Tous les prix sont en EUR.
 * Tous les services de coûts DOIVENT importer depuis ce fichier.
 * Ne JAMAIS définir de prix ailleurs dans le codebase.
 */

export const PRICING = {
  anthropic: {
    // Prix par 1M tokens (EUR)
    haiku:  { input: 0.25,  output: 1.25 },
    sonnet: { input: 3.00,  output: 15.00 },
    opus:   { input: 15.00, output: 75.00 },
  },

  twilio: {
    sms_outbound_fr: 0.0725,   // EUR par SMS sortant France
    sms_inbound: 0.0075,       // EUR par SMS entrant
    voice_per_minute: 0.015,   // EUR par minute d'appel
    whatsapp_session: 0.005,   // EUR par session WhatsApp
  },

  elevenlabs: {
    turbo: 0.00015,            // EUR par caractère (turbo v2.5)
    multilingual: 0.00030,     // EUR par caractère (multilingual v2)
  },

  email: {
    per_email: 0.001,          // EUR par email (Resend)
  },

  dalle: {
    standard_1024: 0.040,      // EUR par image
    standard_1792: 0.080,
    hd_1024: 0.080,
    hd_1792: 0.120,
  },

  tavily: {
    search: 0.003,             // EUR par recherche
  },
};

/**
 * Budgets mensuels par plan (EUR/mois par tenant)
 */
export const PLAN_BUDGETS = {
  starter:  { ai: 5,  sms: 8,  voice: 3,  total: 16 },
  pro:      { ai: 15, sms: 20, voice: 8,  total: 43 },
  business: { ai: 30, sms: 40, voice: 15, total: 85 },
};

/**
 * Prix des abonnements (EUR)
 */
export const PLAN_PRICES = {
  starter:  { monthly: 99,  yearly: 950 },
  pro:      { monthly: 249, yearly: 2390 },
  business: { monthly: 499, yearly: 4790 },
};

/**
 * Helper : coût Claude par tokens (EUR)
 */
export function claudeCost(inputTokens, outputTokens, model = 'sonnet') {
  const m = PRICING.anthropic[model] || PRICING.anthropic.sonnet;
  return (inputTokens * m.input + outputTokens * m.output) / 1_000_000;
}

/**
 * Helper : coût SMS (EUR)
 */
export function smsCost(count, direction = 'outbound') {
  return count * (direction === 'outbound' ? PRICING.twilio.sms_outbound_fr : PRICING.twilio.sms_inbound);
}

/**
 * Helper : coût voix par durée en secondes (EUR)
 */
export function voiceCost(durationSeconds) {
  return (durationSeconds / 60) * PRICING.twilio.voice_per_minute;
}
