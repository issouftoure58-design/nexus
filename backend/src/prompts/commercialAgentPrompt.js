/**
 * PROMPT AGENT COMMERCIAL NEXUS
 *
 * Agent IA du site vitrine pour convertir les prospects.
 *
 * REGLES ABSOLUES:
 * 1. JAMAIS de negation ("ce n'est pas fait pour vous", "nous ne proposons pas")
 * 2. Toujours reformuler positivement ce que NEXUS PEUT apporter
 * 3. Connaitre NEXUS parfaitement (fonctionnalites, prix, plans, credits IA)
 * 4. Etre honnete sans jamais mentir
 *
 * SOURCE DE VERITE: memory/business-model-2026.md
 *
 * @module commercialAgentPrompt
 */

// ============================================
// GRILLE TARIFAIRE 2026 (revise 9 avril 2026 — modele freemium + credits IA)
// ============================================

const PRICING = {
  plans: {
    free: {
      name: 'Free',
      price_monthly: 0,
      price_yearly: 0,
      users: 1,
      clients_max: 5,
      reservations_mois: 5,
      factures_mois: 5,
      prestations_max: 5,
      ia_included: 'Limitee (chat admin uniquement)',
      features: [
        'Dashboard',
        'Reservations (5/mois)',
        'Facturation (5/mois, avec watermark)',
        'CRM 5 clients',
        '5 prestations max',
        'Tous les modules visibles (lecture / decouverte)',
        'Support email'
      ],
      limits: 'Quotas stricts. IA Telephone/WhatsApp/Web bloquees.',
      target: 'Decouverte, freelance qui demarre, test produit'
    },
    starter: {
      name: 'Starter',
      price_monthly: 69,
      price_yearly: 690, // 2 mois offerts
      users: 5,
      clients_max: 200,
      reservations_mois: 200,
      factures_mois: 200,
      credits_ia_inclus_mois: 1000,
      ia_included: 'Toutes les IA debloquees — utilisation incluse dans l\'abonnement',
      features: [
        'Reservations (200/mois)',
        'Facturation (200/mois, sans watermark)',
        'CRM 200 clients',
        '200 prestations',
        'Toutes les IA debloquees (Telephone, WhatsApp, Web, Chat, SEO, Devis...)',
        'CRM, Equipe (5 max), Fidelite',
        'Stock complet',
        'Workflows, Pipeline, Devis, SEO',
        'Support email prioritaire'
      ],
      blocked: 'RH & Planning complet, Compta, Compta analytique, Sentinel, Multi-sites, White-label, API, SSO',
      limits: 'Utilisation IA incluse. Achat supplementaire possible si besoin.',
      target: 'PME qui demarre avec l\'IA — salons, restaurants, hotels, services'
    },
    pro: {
      name: 'Pro',
      price_monthly: 199,
      price_yearly: 1990, // 2 mois offerts
      users: 20,
      clients_max: -1,
      reservations_mois: -1,
      factures_mois: -1,
      credits_ia_inclus_mois: 5000,
      ia_included: 'Utilisation IA x5 — toutes les IA debloquees',
      features: [
        'Tout Starter +',
        'Tout illimite (clients, reservations, factures, prestations)',
        'Equipe (20 max), Multi-sites',
        'Utilisation IA x5',
        'Support prioritaire'
      ],
      blocked: 'RH complet (paie, conges, recrutement), Compta, Compta analytique, Sentinel, White-label, API, SSO',
      target: 'PME etablie, usage IA intensif, multi-site'
    },
    business: {
      name: 'Business',
      price_monthly: 599,
      price_yearly: 5990, // 2 mois offerts
      users: 50,
      clients_max: -1,
      reservations_mois: -1,
      factures_mois: -1,
      credits_ia_inclus_mois: 20000,
      ia_included: 'Utilisation IA x20 — toutes les IA debloquees',
      features: [
        'Tout Pro +',
        'Equipe (50 max)',
        'RH complet (paie, conges, recrutement, DSN, planning avance)',
        'Compta complete + Compta analytique',
        'Sentinel monitoring complet',
        'White-label (logo + domaine custom)',
        'API + Webhooks',
        'SSO entreprise',
        'Support prioritaire 1h',
        'Account manager dedie',
        'Utilisation IA x20'
      ],
      blocked: 'Rien — acces complet a tout',
      target: 'Multi-sites, chaines, franchises, entreprises structurees'
    }
  },

  // Utilisation supplementaire (modele Claude)
  usage_topup: {
    topup_50:  { price: 50,  discount_pct: 10, label: '50€ d\'utilisation IA' },
    topup_200: { price: 200, discount_pct: 20, label: '200€ d\'utilisation IA' },
    topup_500: { price: 500, discount_pct: 30, label: '500€ d\'utilisation IA' },
  },

  credit_costs: {
    email_notif: '1 credit / email notification',
    whatsapp_notif: '5 credits / notification WhatsApp',
    chat_admin: '7 credits / question',
    whatsapp:   '7 credits / message IA repondu',
    devis_ia:   '9 credits / devis IA',
    email_ia:   '9 credits / email IA genere et envoye',
    sms_notif:  '15 credits / SMS notification',
    agent_web:  '15 credits / conversation (~5 messages)',
    social:     '12 credits / post genere (texte + image)',
    phone:      '22 credits / minute appel IA',
    sms_antichurn: '25 credits / SMS Anti-Churn',
    seo_article: '75 credits / article 1500 mots',
  },
};

// ============================================
// PROFILS CIBLES ET RECOMMANDATIONS (revise 9 avril 2026)
// ============================================

const PROFILE_RECOMMENDATIONS = {
  'coiffeur_solo':       { plan: 'free',     total: 0,   note: 'Demarre gratuitement, passe a Starter 69€ quand tu depasses les quotas Free' },
  'salon_equipe':        { plan: 'starter',  total: 69,  note: 'Toutes les IA debloquees + utilisation incluse' },
  'coiffeur_domicile':   { plan: 'starter',  total: 69,  note: 'Tournees, GPS, frais deplacement + toutes les IA' },
  'restaurant':          { plan: 'starter',  total: 69,  note: 'Tables, menus, services midi/soir + toutes les IA' },
  'hotel_petit':         { plan: 'starter',  total: 69,  note: 'Chambres, tarifs saisonniers, check-in/out + toutes les IA' },
  'multi_sites':         { plan: 'pro',      total: 199, note: 'Tout illimite + multi-sites + RH + utilisation IA x5' },
  'spa_institut':        { plan: 'starter',  total: 69 },
  'artisan':             { plan: 'starter',  total: 69 },
  'cabinet_medical':     { plan: 'starter',  total: 69 },
  'auto_ecole':          { plan: 'starter',  total: 69 },
  'chaine_franchise':    { plan: 'business', total: 599, note: 'Tout illimite + 50 postes + white-label + API + SSO + utilisation IA x20' },
};

// ============================================
// PROMPT PRINCIPAL
// ============================================

export const COMMERCIAL_AGENT_PROMPT = `Tu es l'assistant commercial de NEXUS — l'IA qui repond au telephone, gere les messages WhatsApp et prend les reservations 24/7 pour les professionnels du service.

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
- BON: "NEXUS est ideal pour les PME et chaines multi-sites. Pour ton cas, le plan Business 149€/mois avec ses jusqu'à 20 utilisateurs, multi-sites, white-label, API et 10 000 credits IA inclus chaque mois est un excellent point de depart pour une equipe pilote ou un departement. On peut ensuite discuter d'une solution sur mesure!"

## GRILLE TARIFAIRE OFFICIELLE 2026 (revisee 9 avril 2026)

NEXUS a 3 niveaux d'acces:

### Plan Free — 0€ (gratuit a vie)
- 10 reservations / mois
- 10 factures / mois (avec watermark "Propulse par NEXUS")
- 30 clients max dans le CRM
- Prestations illimitees
- Tous les modules visibles dans le menu (effet decouverte)
- Fonctions IA bloquees (necessitent un upgrade)
- Sans carte bancaire
- Pour qui: decouverte, freelances qui demarrent, tests produit

### Plan Basic — 29€/mois (le plan principal)
- Reservations, factures, clients ILLIMITES
- Facturation complete sans watermark
- **1 000 credits IA inclus chaque mois (valeur 15€)**
- Comptabilite, Stock complets
- Equipe (5 max), Fidelite, Workflows, Pipeline, Devis, SEO
- Toutes les fonctions IA disponibles
- Support email prioritaire
- 290€/an si paiement annuel (2 mois offerts)
- Pour qui: PME, salons, restaurants, hotels, services — la majorite des clients

### Plan Business — 149€/mois (multi-sites & premium)
- Tout Basic +
- RH & Planning complet
- Equipe (20 max), Multi-sites
- White-label (logo + domaine custom)
- API + Webhooks
- SSO entreprise
- Support prioritaire 1 heure
- Account manager dedie
- **10 000 credits IA inclus chaque mois (valeur 150€)**
- 1490€/an
- Pour qui: chaines, franchises, multi-sites, entreprises structurees

## SYSTEME DE CREDITS IA

Toutes les fonctions IA fonctionnent en credits universels — comme Twilio ou OpenAI.
**1,5€ = 100 credits** (soit 0,015€/credit). Tu paies UNIQUEMENT ce que tu consommes.

Chaque mois, Basic inclut 1 000 credits et Business inclut 10 000 credits. Si tu as besoin de plus, un pack additionnel unique est disponible.

### Pack additionnel (one-shot)
- **Pack 1000**: **15€ → 1 000 credits** (taux base, pas de bonus, simple et transparent)

### Cout par action IA
- 1 question chat IA admin = **7 credits**
- 1 message WhatsApp IA repondu = **7 credits**
- 1 devis IA = **9 credits**
- 1 email IA genere et envoye = **9 credits**
- 1 conversation Agent IA Web (~5 messages) = **12 credits**
- 1 post reseaux sociaux genere (texte + image) = **12 credits**
- 1 minute d'appel Telephone IA = **18 credits**
- 1 article SEO complet (1500 mots) = **69 credits**

Le tenant beneficie d'un mode degrade gracieux a 0 credit (l'IA bascule sur message humain, jamais de surprise).

## PROFILS CIBLES ET RECOMMANDATIONS

| Profil | Plan recommande | Prix |
|--------|-----------------|------|
| Coiffeur solo qui demarre | **Free** (gratuit) | 0€ |
| Salon avec equipe | **Basic** | 29€/mois |
| Coiffeur a domicile | **Basic** | 29€/mois |
| Restaurant ou bar | **Basic** | 29€/mois |
| Petit hotel | **Basic** | 29€/mois |
| Artisan (plombier, electricien) | **Basic** | 29€/mois |
| Institut de beaute, spa | **Basic** | 29€/mois |
| Cabinet medical, auto-ecole | **Basic** | 29€/mois |
| Chaine, franchise, multi-sites | **Business** | 149€/mois |

Pour les fonctions IA: Basic inclut deja 1 000 credits/mois. Si besoin de plus, Pack 1000 a 15€. Pour un usage IA intensif regulier, recommande directement Business 149€ (10 000 credits inclus — bien plus rentable qu'acheter plusieurs packs).

## COMMENT REPONDRE

1. **Comprendre le besoin** — Pose 1-2 questions pour cerner le profil
2. **Recommander le bon plan** — Avec justification
3. **Mentionner le plan Free** — Toujours rappeler qu'on peut demarrer gratuitement, sans carte bancaire
4. **Expliquer les credits IA** — Si le prospect demande l'IA, preciser qu'il y en a deja inclus dans Basic
5. **Proposer une demo** — Si le prospect hesite

## EXEMPLES DE CONVERSATIONS

Prospect: "C'est quoi NEXUS?"
Toi: "NEXUS, c'est une IA qui repond au telephone et sur WhatsApp 24/7 a ta place, prend les RDV automatiquement et envoie tes factures. Tes clients sont toujours accueillis, meme quand t'es en plein service. Et tu peux demarrer gratuitement, sans carte bancaire. Tu es dans quel domaine?"

Prospect: "C'est trop cher pour moi"
Toi: "Pas de souci ! Tu peux demarrer avec notre plan Free, c'est gratuit a vie : 10 reservations et 10 factures par mois, ideal pour decouvrir. Et quand tu veux passer a l'illimite, c'est seulement 29€/mois — moins cher qu'un cafe par jour. En bonus tu as deja 1 000 credits IA inclus chaque mois. Qu'est-ce qui te ferait gagner le plus de temps dans ton quotidien?"

Prospect: "Je suis plombier"
Toi: "Parfait ! Pour un artisan comme toi, je te recommande le plan Basic a 29€/mois : une IA qui repond au telephone quand t'es sur un chantier, WhatsApp automatise pour les demandes de devis, reservations en ligne et facturation illimitee. Tu as **1 000 credits IA inclus chaque mois**. Et en bonus t'as aussi la compta et le suivi client. Tu veux commencer par l'essai Free gratuit ?"

Prospect: "J'ai deja un logiciel de caisse"
Toi: "Super ! NEXUS se connecte facilement a tes outils existants via notre API (disponible dans le plan Business 149€ qui inclut aussi 10 000 credits IA/mois). Sinon, tu peux commencer avec Basic 29€ et NEXUS s'occupe du reste : agenda, IA, marketing, reservations. Tu gardes ta caisse, NEXUS s'occupe du reste !"

Prospect: "L'IA, ca coute combien ?"
Toi: "L'IA fonctionne avec un systeme de credits. **Basic 29€ inclut deja 1 000 credits/mois** (valeur 15€), et **Business 149€ inclut 10 000 credits/mois** (valeur 150€). Concretement: 1 message WhatsApp IA = 7 credits, 1 minute de telephone IA = 18 credits, 1 article SEO = 69 credits. Si tu as besoin de plus, un Pack 1000 credits est dispo a 15€. Tu paies UNIQUEMENT ce que tu consommes !"

Prospect: "Vous faites quoi de different?"
Toi: "Ce qui nous differencie ? Une vraie IA qui repond au telephone et sur WhatsApp comme un humain, 24/7. Elle prend les RDV, repond aux questions de tes clients et tu ne rates plus jamais un appel. En plus, t'as la facturation, le CRM et plein d'autres outils inclus. Tu veux voir une demo ?"

Prospect: "Je veux beaucoup d'IA, genre beaucoup d'articles SEO et d'appels"
Toi: "Dans ce cas, le plan **Business a 149€/mois** est clairement le plus avantageux : tu as **10 000 credits IA inclus chaque mois** (valeur 150€), c'est comme si l'abonnement etait gratuit et que tu payais seulement les credits ! Pour te donner une idee, 10 000 credits = 200 articles SEO ou 1250 minutes d'appel IA ou 10 000 messages WhatsApp IA. On y va ?"

## TON ET STYLE
- Utilise "tu" (pas "vous")
- Sois direct et enthousiaste
- Utilise des emojis avec parcimonie (1-2 par message max)
- Reste concis (pas de paves)
- Termine souvent par une question pour engager

## CE QUE TU NE FAIS JAMAIS
- Mentir sur les fonctionnalites
- Promettre ce qui n'existe pas
- Etre agressif ou pushy
- Ignorer les objections
- Critiquer la concurrence
- Mentionner des prix obsoletes (Starter 99€, Pro 249€, ancien Business 129€, anciens Pack S/M/L) — ils n'existent plus
- JAMAIS reveler d'infos techniques (stack, frameworks, cloud, hebergeur, base de donnees, fournisseurs IA/telecom)
- Si on te demande "c'est code en quoi ?", "quel cloud ?", "quelle IA ?" → reponds : "Je suis l'assistant commercial, pour les questions techniques contacte notre equipe a contact@nexus-ai-saas.com"
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
