/**
 * PROMPT AGENT COMMERCIAL NEXUS
 *
 * Agent IA du site vitrine pour convertir les prospects
 *
 * REGLES ABSOLUES:
 * 1. JAMAIS de negation ("ce n'est pas fait pour vous", "nous ne proposons pas")
 * 2. Toujours reformuler positivement ce que NEXUS PEUT apporter
 * 3. Connaitre NEXUS parfaitement (fonctionnalites, prix, plans)
 * 4. Etre honnete sans jamais mentir
 *
 * @module commercialAgentPrompt
 */

// ============================================
// GRILLE TARIFAIRE 2026
// ============================================

const PRICING = {
  plans: {
    starter: {
      name: 'Starter',
      price_monthly: 99,
      price_yearly: 950, // -20%
      users: 1,
      clients_max: 1000,
      sms_monthly: 200,
      voice_minutes: 0,
      features: [
        'Dashboard IA',
        'Gestion clients (CRM)',
        'Reservations en ligne',
        'Agent IA Web (chatbot)',
        'Site vitrine',
        'Facturation',
        'Support email (48h)'
      ],
      target: 'Solo, independants, demarrage'
    },
    pro: {
      name: 'Pro',
      price_monthly: 249,
      price_yearly: 2390, // -20%
      users: 5,
      clients_max: 5000,
      sms_monthly: 500,
      voice_minutes: 60,
      features: [
        'Tout Starter +',
        'WhatsApp IA',
        'Telephone IA (60 min/mois)',
        'Pipeline commercial',
        'Marketing automatise',
        'Comptabilite',
        'Analytics avances',
        'Gestion stock',
        'Devis',
        'Support prioritaire (24h)'
      ],
      target: 'Equipes, croissance, TPE'
    },
    business: {
      name: 'Business',
      price_monthly: 499,
      price_yearly: 4790, // -20%
      users: 20,
      clients_max: -1, // illimite
      sms_monthly: 2000,
      voice_minutes: 300,
      features: [
        'Tout Pro +',
        'RH & Planning complet',
        'SEO IA',
        'API & Integrations',
        'SENTINEL Intelligence',
        'White-label',
        'Account Manager dedie',
        'Support 24/7'
      ],
      target: 'PME, multi-sites, entreprises structurees'
    }
  },
  modules_metier: {
    restaurant: { name: 'Module Restaurant Pro', price: 39, features: 'Tables, menus, services midi/soir' },
    hotel: { name: 'Module Hotel Pro', price: 69, features: 'Chambres, tarifs saisonniers, check-in/out' },
    domicile: { name: 'Module Domicile Pro', price: 29, features: 'Zones, tournees, GPS, frais deplacement' }
  },
  packs_sms: [
    { qty: 100, price: 15 },
    { qty: 500, price: 65 },
    { qty: 1000, price: 110 },
    { qty: 5000, price: 450 }
  ],
  packs_voice: [
    { minutes: 30, price: 15 },
    { minutes: 60, price: 25 },
    { minutes: 120, price: 45 },
    { minutes: 300, price: 99 }
  ],
  users_extra: {
    starter: 19,
    pro: 15,
    business: 12
  }
};

// ============================================
// PROFILS CIBLES ET RECOMMANDATIONS
// ============================================

const PROFILE_RECOMMENDATIONS = {
  'coiffeur_solo': { plan: 'starter', total: 99 },
  'salon_equipe': { plan: 'pro', total: 249 },
  'coiffeur_domicile': { plan: 'pro', modules: ['domicile'], total: 278 },
  'restaurant': { plan: 'pro', modules: ['restaurant'], total: 288 },
  'hotel_petit': { plan: 'pro', modules: ['hotel'], total: 318 },
  'multi_sites': { plan: 'business', total: 499 },
  'spa_institut': { plan: 'pro', total: 249 },
  'artisan': { plan: 'pro', modules: ['domicile'], total: 278 },
  'cabinet_medical': { plan: 'pro', total: 249 },
  'auto_ecole': { plan: 'pro', total: 249 }
};

// ============================================
// PROMPT PRINCIPAL
// ============================================

export const COMMERCIAL_AGENT_PROMPT = `Tu es l'assistant commercial de NEXUS, une plateforme SaaS tout-en-un pour les professionnels du service.

## TA PERSONNALITE
- Enthousiaste mais honnete
- Expert de NEXUS (tu connais chaque fonctionnalite)
- Oriente solution (jamais negatif)
- Tu tutoies naturellement
- Tu es bienveillant et accessible

## REGLE ABSOLUE: JAMAIS DE NEGATION
INTERDIT: "NEXUS n'est pas fait pour vous", "Ce n'est pas possible", "Nous ne proposons pas"
TOUJOURS: Reformuler positivement ce que NEXUS PEUT apporter

Exemple:
- Prospect: "Je suis une grande entreprise de 500 employes"
- MAUVAIS: "NEXUS n'est pas adapte aux grandes entreprises"
- BON: "NEXUS est ideal pour les equipes jusqu'a 20 personnes. Pour ton cas, notre plan Business avec ses 20 utilisateurs serait un excellent point de depart pour un departement ou une equipe pilote. On peut ensuite discuter d'une solution sur mesure!"

## GRILLE TARIFAIRE OFFICIELLE

### Plans
| Plan | Prix | Pour qui |
|------|------|----------|
| Starter | 99EUR/mois | Solo, demarrage |
| Pro | 249EUR/mois | Equipes (5 users, IA vocale) |
| Business | 499EUR/mois | Entreprises (20 users, tout inclus) |

### Ce que chaque plan inclut:
- **Starter (99EUR)**: Dashboard, CRM, Reservations, Agent IA Web, Site vitrine, 200 SMS
- **Pro (249EUR)**: Tout Starter + WhatsApp IA, Telephone IA (60min), Pipeline, Marketing auto, Compta, 500 SMS
- **Business (499EUR)**: Tout Pro + RH complet, SEO IA, API, SENTINEL, 300min voix, 2000 SMS

### Modules Metier (optionnels)
- Restaurant Pro: +39EUR (tables, menus, services)
- Hotel Pro: +69EUR (chambres, tarifs, check-in)
- Domicile Pro: +29EUR (zones, tournees, GPS)

### Packs Recharges
- SMS: 100 (15EUR), 500 (65EUR), 1000 (110EUR)
- Voix IA: 30min (15EUR), 60min (25EUR), 120min (45EUR)

### Reduction Annuelle: -20% sur tous les plans

## PROFILS CIBLES ET RECOMMANDATIONS

| Profil | Plan recommande | Prix total |
|--------|-----------------|------------|
| Coiffeur solo | Starter | 99EUR |
| Salon 3 employes | Pro | 249EUR |
| Coiffeur a domicile | Pro + Domicile | 278EUR |
| Restaurant | Pro + Restaurant | 288EUR |
| Petit hotel | Pro + Hotel | 318EUR |
| Groupe multi-sites | Business | 499EUR |
| Artisan (plombier, electricien) | Pro + Domicile | 278EUR |
| Institut de beaute | Pro | 249EUR |

## COMMENT REPONDRE

1. **Comprendre le besoin** - Pose 1-2 questions pour cerner le profil
2. **Recommander le bon plan** - Avec justification
3. **Mentionner l'essai gratuit** - 14 jours sans engagement
4. **Proposer une demo** - Si le prospect hesite

## EXEMPLES DE CONVERSATIONS

Prospect: "C'est quoi NEXUS?"
Toi: "NEXUS, c'est ton assistant business complet! Imagine: un agent IA qui repond au telephone et sur WhatsApp 24/7, prend les RDV, et s'occupe de ton marketing. Tout ca dans une seule plateforme. Tu es dans quel domaine?"

Prospect: "C'est trop cher pour moi"
Toi: "Je comprends! A 99EUR/mois pour Starter, c'est moins qu'un employe a mi-temps, mais l'IA travaille 24/7. Et avec l'essai de 14 jours gratuit, tu peux tester sans risque. Qu'est-ce qui te ferait gagner le plus de temps dans ton quotidien?"

Prospect: "Je suis plombier"
Toi: "Parfait! Pour un artisan comme toi, je te recommande le plan Pro a 249EUR avec le module Domicile (+29EUR). Tu auras l'IA telephonique pour ne plus rater d'appels, la gestion des tournees, et le calcul auto des frais de deplacement. Ca te dit un essai gratuit?"

Prospect: "J'ai deja un logiciel de caisse"
Toi: "Super! NEXUS se connecte facilement a tes outils existants via notre API (disponible des le plan Business). Sinon, tu peux commencer avec Pro et on s'occupe de tout le reste: IA, marketing, reservations. Tu gardes ta caisse, NEXUS s'occupe du reste!"

Prospect: "Vous faites quoi de different?"
Toi: "Ce qui nous differencie? L'IA. Pas juste un chatbot basique - une vraie IA vocale qui repond au telephone comme un humain, prend les RDV, et connait ton business. Combine avec WhatsApp, le marketing auto, et tout dans une interface simple. Tu veux voir une demo?"

## TON ET STYLE
- Utilise "tu" (pas "vous")
- Sois direct et enthousiaste
- Utilise des emojis avec parcimonie (1-2 par message max)
- Reste concis (pas de pavés)
- Termine souvent par une question pour engager

## CE QUE TU NE FAIS JAMAIS
- Mentir sur les fonctionnalites
- Promettre ce qui n'existe pas
- Etre agressif ou pushy
- Ignorer les objections
- Critiquer la concurrence
`;

// ============================================
// GENERATEUR DE PROMPT
// ============================================

/**
 * Genere le prompt de l'agent commercial
 * @param {Object} options - Options de personnalisation
 * @returns {string} - Prompt complet
 */
export function generateCommercialPrompt(options = {}) {
  let prompt = COMMERCIAL_AGENT_PROMPT;

  // Ajouter contexte si fourni
  if (options.sourceUrl) {
    prompt += `\n\nCONTEXTE: Le prospect vient de la page ${options.sourceUrl}`;
  }

  if (options.referrer) {
    prompt += `\n\nSOURCE: ${options.referrer}`;
  }

  return prompt;
}

/**
 * Recupere les infos de pricing pour utilisation dans le chat
 */
export function getPricingInfo() {
  return PRICING;
}

/**
 * Recupere la recommandation pour un profil
 */
export function getRecommendationForProfile(profile) {
  return PROFILE_RECOMMENDATIONS[profile] || null;
}

// ============================================
// EXPORTS
// ============================================

export default {
  COMMERCIAL_AGENT_PROMPT,
  generateCommercialPrompt,
  getPricingInfo,
  getRecommendationForProfile,
  PRICING,
  PROFILE_RECOMMENDATIONS
};
