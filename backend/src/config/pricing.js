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
 * Budgets mensuels par plan (EUR/mois par tenant) — modele Claude
 *
 * Modele 2026 (revise 21 avril 2026 — voir memory/business-model-2026.md) :
 * - Free     : 200 credits (chat admin limité, pas tel/WA/web)
 * - Starter  : 1 000 credits (toutes IA débloquées)
 * - Pro      : 5 000 credits (5x Starter)
 * - Business : 20 000 credits (20x Starter)
 */
export const PLAN_BUDGETS = {
  free:     { ai: 3,    sms: 0,  voice: 0,  total: 3 },     // 200 credits
  starter:  { ai: 15,   sms: 0,  voice: 0,  total: 15 },    // 1 000 credits
  pro:      { ai: 75,   sms: 0,  voice: 0,  total: 75 },    // 5 000 credits
  business: { ai: 300,  sms: 0,  voice: 0,  total: 300 },   // 20 000 credits
  // Legacy alias
  basic:    { ai: 15,   sms: 0,  voice: 0,  total: 15 },
};

/**
 * Prix des abonnements (EUR)
 *
 * Modele 2026 (revise 21 avril 2026 — voir memory/business-model-2026.md) :
 * - Free     0€ (freemium, 5 RDV/factures/clients/presta/mois, chat admin limité)
 * - Starter  69€/mois (toutes IA, 200 limites)
 * - Pro     199€/mois (illimité, 20 postes, multi-site, RH)
 * - Business 599€/mois (illimité, 50 postes, RH complet, compta, Sentinel, white-label, API, SSO, AM)
 */
export const PLAN_PRICES = {
  free:     { monthly: 0,   yearly: 0 },
  starter:  { monthly: 69,  yearly: 690 },   // 2 mois offerts en annuel
  pro:      { monthly: 199, yearly: 1990 },  // 2 mois offerts en annuel
  business: { monthly: 599, yearly: 5990 },  // 2 mois offerts en annuel
  // Legacy alias
  basic:    { monthly: 69,  yearly: 690 },
};

/**
 * Utilisation supplementaire (modele Claude) — presets avec réductions volume
 * Base : 1,5€ = 100 credits (0,015€/credit). Voir memory/business-model-2026.md.
 */
export const USAGE_TOPUP = {
  topup_50:  { price: 50,  discount_pct: 10, label: '50€ d\'utilisation IA',  code: 'nexus_usage_50' },
  topup_200: { price: 200, discount_pct: 20, label: '200€ d\'utilisation IA', code: 'nexus_usage_200' },
  topup_500: { price: 500, discount_pct: 30, label: '500€ d\'utilisation IA', code: 'nexus_usage_500' },
};

/**
 * Legacy — Pack de credits (retro-compat, a retirer quand tous les tenants sont migrés)
 */
export const CREDIT_PACKS = {
  pack_1000: { price: 15, credits: 1000, bonus: 0, label: 'Pack 1000 crédits', code: 'nexus_credits_1000' },
};

/**
 * Cout en credits IA par action (voir business-model-2026.md pour le detail des marges)
 */
export const CREDIT_COSTS = {
  email_notification:      1,   // 1 email notification (cout NEXUS: 0,001€)
  whatsapp_notification:   5,   // 1 notification WhatsApp sortante (cout NEXUS: 0,005€)
  chat_admin_question:     7,   // 1 question chat IA admin
  whatsapp_message:        7,   // 1 message WhatsApp IA repondu
  devis_ia:                9,   // 1 devis IA
  antichurn_whatsapp:      9,   // 1 message Anti-Churn WhatsApp
  email_ia_sent:           9,   // 1 email IA genere + envoi Resend
  whatsapp_voice_note:    10,   // 1 note vocale WhatsApp (7 msg + 3 Whisper transcription)
  social_post_generated:  12,   // 1 post reseaux genere (Sonnet + image)
  sms_notification:       15,   // 1 SMS notification sortant FR (cout NEXUS: 0,0725€)
  web_chat_conversation:  15,   // 1 conversation Agent IA Web (~5 msgs Sonnet)
  phone_minute:           22,   // 1 minute appel Telephone IA
  antichurn_sms_fr:       25,   // 1 message Anti-Churn SMS FR (IA + envoi)
  seo_article:            75,   // 1 article SEO complet (1500 mots, Sonnet)
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
