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
 *
 * Modele 2026 (revise 9 avril 2026 — voir memory/business-model-2026.md) :
 * - free : aucun acces IA (bloque)
 * - basic : 1 000 credits IA inclus (~15€ valeur) + IA additionnelle via pack unique
 * - business : 10 000 credits IA inclus (~150€ valeur) + IA additionnelle via pack unique
 */
export const PLAN_BUDGETS = {
  free:     { ai: 0,   sms: 0,  voice: 0,  total: 0 },
  basic:    { ai: 15, sms: 0,  voice: 0,  total: 15 },  // 1 000 credits IA inclus
  business: { ai: 150, sms: 0,  voice: 0,  total: 150 },  // 10 000 credits IA inclus
  // ⚠️ DEPRECATED — Aliases retro-compat (a supprimer apres migration consommateurs)
  starter:  { ai: 0,   sms: 0,  voice: 0,  total: 0 },
  pro:      { ai: 15, sms: 0,  voice: 0,  total: 15 },
};

/**
 * Prix des abonnements (EUR)
 *
 * Modele 2026 (revise 9 avril 2026 — voir memory/business-model-2026.md) :
 * - Free 0€ (freemium a vie, 10 RDV/mois, 10 factures/mois)
 * - Basic 29€/mois (acces illimite non-IA + 1 000 credits IA inclus)
 * - Business 149€/mois (Basic + multi-site + white-label + API + SSO + 10 000 credits IA inclus)
 */
export const PLAN_PRICES = {
  free:     { monthly: 0,   yearly: 0 },
  basic:    { monthly: 29,  yearly: 290 },   // 2 mois offerts en annuel
  business: { monthly: 149, yearly: 1490 },  // 2 mois offerts en annuel
  // ⚠️ DEPRECATED — Aliases retro-compat (a supprimer apres migration consommateurs)
  starter:  { monthly: 0,   yearly: 0 },     // alias de free
  pro:      { monthly: 29,  yearly: 290 },   // alias de basic
};

/**
 * Pack de credits IA additionnel (one-shot) — UN SEUL pack depuis la revision du 9 avril 2026.
 *
 * Base : 1,5€ = 100 credits (0,015€/credit). Voir memory/business-model-2026.md.
 */
export const CREDIT_PACKS = {
  pack_1000: { price: 15, credits: 1000, bonus: 0, label: 'Pack 1000 crédits', code: 'nexus_credits_1000' },
};

/**
 * Cout en credits IA par action (voir business-model-2026.md pour le detail des marges)
 */
export const CREDIT_COSTS = {
  chat_admin_haiku:        7,   // 1 question chat IA admin
  whatsapp_message:        7,   // 1 message WhatsApp IA repondu
  whatsapp_voice_note:    10,   // 1 note vocale WhatsApp (7 msg + 3 Whisper transcription)
  devis_ia:                9,   // 1 devis IA
  anti_churn_whatsapp:     9,   // 1 message Anti-Churn WhatsApp
  email_ia_sent:           9,   // 1 email IA genere + envoi Resend
  agent_web_conversation: 12,   // 1 conversation Agent IA Web (~5 msgs Sonnet)
  social_post_generated:  12,   // 1 post reseaux genere (Sonnet + image)
  phone_minute:           18,   // 1 minute appel Telephone IA
  anti_churn_sms_fr:      19,   // 1 message Anti-Churn SMS FR (cher)
  seo_article_full:       69,   // 1 article SEO complet (1500 mots, Sonnet)
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
