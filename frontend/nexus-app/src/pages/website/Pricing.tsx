import { useState } from 'react';
import {
  Check,
  X,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Crown,
  Zap,
  Building2,
} from 'lucide-react';
import { Link } from 'wouter';
import './Pricing.css';

// Plans principaux — Modele 2026 revision 27 avril 2026 (voir memory/business-model-2026.md)
// Free 0€ / Starter 69€ / Pro 199€ / Business 499€ / Enterprise 899€
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    originalPrice: 0,
    yearlyPrice: 0,
    launchOffer: 'Gratuit a vie, sans carte bancaire',
    description: 'Pour decouvrir NEXUS',
    icon: Zap,
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: '5 reservations / mois', included: true },
      { text: '5 factures / mois', included: true },
      { text: '5 clients max', included: true },
      { text: '1 utilisateur', included: true },
      { text: 'IA chat admin uniquement', included: true },
      { text: 'Tous les modules visibles', included: true },
      { text: 'Support email', included: true },
      { text: 'Telephone IA, WhatsApp IA', included: false },
      { text: 'Facturation, Devis, Pipeline', included: false },
    ],
    cta: 'Demarrer gratuitement',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 69,
    originalPrice: 69,
    yearlyPrice: 690,
    launchOffer: 'Toute l\'IA debloquee + CRM avance',
    description: 'IA 24/7 pour independants',
    icon: Sparkles,
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: 'Toutes les IA (Telephone, WhatsApp, Web)', included: true },
      { text: 'CRM avance (contacts, segments)', included: true },
      { text: '200 limites (clients, RDV, factures)', included: true },
      { text: '5 postes', included: true },
      { text: 'Utilisation IA incluse', included: true },
      { text: 'Support email prioritaire', included: true },
      { text: 'Facturation, Devis, Pipeline', included: false },
      { text: 'Multi-sites', included: false },
    ],
    cta: 'Choisir Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    originalPrice: 199,
    yearlyPrice: 1990,
    launchOffer: 'Facturation + Marketing complet + Equipe',
    description: 'Pour les PME etablies',
    icon: Crown,
    color: 'from-blue-500 to-indigo-600',
    popular: true,
    features: [
      { text: 'Tout Starter +', included: true },
      { text: 'Facturation, Devis, Pipeline, Stock', included: true },
      { text: 'Marketing complet (campagnes, posts, reseaux)', included: true },
      { text: 'Equipe, Planning, Fidelite', included: true },
      { text: 'Multi-sites, tout illimite', included: true },
      { text: '20 postes', included: true },
      { text: 'Utilisation IA 5x', included: true },
      { text: 'Compta, SEO, API', included: false },
    ],
    cta: 'Choisir Pro',
  },
  {
    id: 'business',
    name: 'Business',
    price: 499,
    originalPrice: 499,
    yearlyPrice: 4990,
    launchOffer: 'Compta + SEO + API integres',
    description: 'Gestion complete sans 5 outils',
    icon: Building2,
    color: 'from-yellow-500 to-orange-600',
    features: [
      { text: 'Tout Pro +', included: true },
      { text: 'Comptabilite (rapports, FEC, TVA)', included: true },
      { text: 'SEO complet (articles IA, meta, audit)', included: true },
      { text: 'API + Webhooks', included: true },
      { text: '30 postes, multi-sites', included: true },
      { text: 'Utilisation IA 12.5x', included: true },
      { text: 'RH, Sentinel, White-label, SSO', included: false },
    ],
    cta: 'Choisir Business',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 899,
    originalPrice: 899,
    yearlyPrice: 8990,
    launchOffer: 'TOUT sans exception + Account Manager',
    description: 'Full premium pour entreprises',
    icon: Building2,
    color: 'from-purple-500 to-pink-600',
    features: [
      { text: 'Tout Business +', included: true },
      { text: 'RH complet (paie, DSN, conges)', included: true },
      { text: 'Compta analytique', included: true },
      { text: 'SENTINEL monitoring', included: true },
      { text: 'White-label + SSO entreprise', included: true },
      { text: 'Account Manager dedie', included: true },
      { text: '50 postes', included: true },
      { text: 'Utilisation IA 25x', included: true },
    ],
    cta: 'Choisir Enterprise',
  },
];

// Utilisation supplementaire — presets avec reductions volume (modele Claude)
const CREDIT_PACKS = [
  {
    id: '50',
    label: '50€',
    price: 50,
    credits: 3700,
    bonus: '-10%',
    description: 'Complement ponctuel',
    featured: false,
  },
  {
    id: '200',
    label: '200€',
    price: 200,
    credits: 16600,
    bonus: '-20%',
    description: 'Le plus choisi',
    featured: true,
  },
  {
    id: '500',
    label: '500€',
    price: 500,
    credits: 47600,
    bonus: '-30%',
    description: 'Pour les gros consommateurs',
    featured: false,
  },
];

// Cout en credits par action IA (pay-as-you-go)
const CREDIT_COSTS = [
  { action: '1 question chat IA admin', cost: '7 credits' },
  { action: '1 message WhatsApp IA repondu', cost: '7 credits' },
  { action: '1 devis IA', cost: '9 credits' },
  { action: '1 email IA envoye', cost: '9 credits' },
  { action: '1 conversation Agent IA Web', cost: '12 credits' },
  { action: '1 post reseaux sociaux genere', cost: '12 credits' },
  { action: '1 minute Telephone IA', cost: '18 credits' },
  { action: '1 article SEO (1500 mots)', cost: '69 credits' },
];

// Exemples de configurations (modele 2026 — revision 27 avril)
const EXAMPLES = [
  {
    name: 'Coiffeur solo qui demarre',
    emoji: '💇',
    plan: 'Free',
    modules: [],
    total: 0,
    subtitle: 'Gratuit a vie',
  },
  {
    name: 'Salon avec IA telephone',
    emoji: '✂️',
    plan: 'Starter',
    modules: ['IA Tel + WhatsApp + Web'],
    total: 69,
    subtitle: '69€/mois toute l\'IA',
  },
  {
    name: 'Restaurant avec equipe',
    emoji: '🍽️',
    plan: 'Pro',
    modules: ['Facturation, Equipe, Marketing'],
    total: 199,
    featured: true,
    subtitle: 'Gestion complete 199€/mois',
  },
  {
    name: 'Artisan avec devis',
    emoji: '🔧',
    plan: 'Pro',
    modules: ['Devis, Pipeline, Equipe'],
    total: 199,
    subtitle: 'Plombier, electricien, plaquiste...',
  },
  {
    name: 'PME avec compta',
    emoji: '📊',
    plan: 'Business',
    modules: ['Compta, SEO, API'],
    total: 499,
    subtitle: 'Tout integre sans 5 outils',
  },
  {
    name: 'Groupe multi-sites',
    emoji: '🏢',
    plan: 'Enterprise',
    modules: ['RH, Sentinel, White-label'],
    total: 899,
    subtitle: 'Full premium entreprise',
  },
];

// FAQ
const FAQS = [
  {
    q: 'Y a-t-il un engagement minimum ?',
    a: 'Aucun engagement. Vous pouvez annuler a tout moment. Nous facturons mois par mois.',
  },
  {
    q: 'Puis-je essayer NEXUS gratuitement ?',
    a: "Oui, le plan Free est gratuit a vie, sans carte bancaire. Vous avez 10 reservations/mois, 10 factures/mois et 30 clients dans le CRM. Tous les modules sont visibles pour decouvrir la plateforme.",
  },
  {
    q: 'Quelle est la difference entre les plans ?',
    a: "Free (0€) : pour decouvrir, quotas stricts, IA bloquee. Starter (69€) : toute l'IA + CRM. Pro (199€) : + facturation, devis, pipeline, equipe, marketing complet. Business (499€) : + compta, SEO, API. Enterprise (899€) : + RH, sentinel, white-label, SSO.",
  },
  {
    q: 'Comment fonctionne l\'utilisation IA ?',
    a: "Chaque plan inclut une enveloppe d'utilisation IA. Vous voyez une barre de progression en %. Si vous atteignez la limite, achetez de l'utilisation supplementaire (50€ / 200€ / 500€) avec des reductions volume jusqu'a -30%.",
  },
  {
    q: 'Puis-je changer de plan en cours de mois ?',
    a: 'Oui, les changements sont effectifs immediatement et factures au prorata.',
  },
  {
    q: 'Que se passe-t-il si j\'atteins ma limite d\'utilisation IA ?',
    a: "Mode degrade gracieux : l'IA bascule sur un message humain, jamais de surprise. Vous pouvez acheter de l'utilisation supplementaire a tout moment.",
  },
  {
    q: 'Le setup est-il inclus ?',
    a: 'Oui, configuration complete en 30 minutes incluse. Aucun frais supplementaire.',
  },
];

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const getPrice = (plan: (typeof PLANS)[0]) => {
    if (billingPeriod === 'yearly') {
      return Math.round(plan.yearlyPrice / 12);
    }
    return plan.price;
  };

  const getSavings = (plan: (typeof PLANS)[0]) => {
    const monthlyTotal = ((plan as any).originalPrice || plan.price) * 12;
    const yearlySavings = monthlyTotal - plan.yearlyPrice;
    return yearlySavings;
  };

  return (
    <div className="pricing-page">
      {/* Header */}
      <section className="pricing-header">
        <div className="pricing-header-content">
          <h1>Des tarifs simples et transparents</h1>
          <p className="pricing-subtitle">
            5 plans, tout inclus. Pas de frais caches.
          </p>

          {/* Toggle Mensuel/Annuel */}
          <div className="billing-toggle">
            <button
              className={`toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Mensuel
            </button>
            <button
              className={`toggle-btn ${billingPeriod === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('yearly')}
            >
              Annuel
              <span className="toggle-badge">-20%</span>
            </button>
          </div>

          <div className="pricing-badges">
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Plan Free gratuit a vie
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Sans carte bancaire
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Sans engagement
            </span>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="plans-section">
        <div className="plans-container">
          <div className="plans-grid">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const displayPrice = getPrice(plan);
              const savings = getSavings(plan);

              return (
                <div
                  key={plan.id}
                  className={`plan-card ${plan.popular ? 'plan-popular' : ''}`}
                >
                  {plan.popular && (
                    <div className="plan-badge">Le plus populaire</div>
                  )}

                  <div className={`plan-icon bg-gradient-to-br ${plan.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="plan-name">{plan.name}</h3>
                  <p className="plan-description">{plan.description}</p>

                  <div className="plan-price">
                    <span className="price-amount">{displayPrice}</span>
                    <span className="price-period">€/mois</span>
                  </div>
                  {(plan as any).launchOffer && (
                    <p style={{ color: '#e65100', fontSize: '0.75rem', fontWeight: 600, marginTop: '-0.5rem', marginBottom: '0.5rem' }}>{(plan as any).launchOffer}</p>
                  )}

                  {billingPeriod === 'yearly' && (
                    <p className="plan-savings">
                      Economisez {savings} EUR/an
                    </p>
                  )}

                  <ul className="plan-features">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className={feature.included ? '' : 'feature-disabled'}>
                        {feature.included ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/website/contact"
                    className={`plan-cta ${plan.popular ? 'cta-primary' : ''}`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pack unique additionnel */}
      <section className="packs-section">
        <div className="packs-container">
          <div className="section-header">
            <h2>Utilisation supplementaire</h2>
            <p>
              Chaque plan inclut une enveloppe d'utilisation IA. Si vous avez besoin de plus,
              achetez de l'utilisation supplementaire — plus vous achetez, plus vous economisez.
            </p>
          </div>

          <div className="plans-grid" style={{ justifyContent: 'center', maxWidth: '420px', margin: '0 auto' }}>
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`plan-card ${pack.featured ? 'plan-popular' : ''}`}
              >
                {pack.featured && <div className="plan-badge">Pack unique</div>}
                <div className="plan-icon bg-gradient-to-br from-orange-500 to-pink-600">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="plan-name">{pack.label}</h3>
                <p className="plan-description">{pack.description}</p>
                <div className="plan-price">
                  <span className="price-amount">{pack.price}</span>
                  <span className="price-period"> EUR</span>
                </div>
                <p style={{ color: '#0891b2', fontSize: '0.875rem', fontWeight: 600, marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                  {pack.credits.toLocaleString('fr-FR')} credits (taux base)
                </p>
                <ul className="plan-features">
                  <li>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{pack.credits.toLocaleString('fr-FR')} credits IA additionnels</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Taux base 0,015€/credit</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Mode degrade gracieux a 0</span>
                  </li>
                  <li>
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Sans engagement</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          <div className="modules-container" style={{ marginTop: '3rem' }}>
            <div className="section-header">
              <h3>Cout par action IA</h3>
              <p>Pas de forfait inutilise — vous payez a la consommation</p>
            </div>
            <div className="modules-grid">
              {CREDIT_COSTS.map((item, i) => (
                <div key={i} className="module-card">
                  <div className="module-icon">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="module-info">
                    <h4 className="module-name">{item.action}</h4>
                  </div>
                  <div className="module-price" style={{ fontSize: '1rem' }}>
                    {item.cost}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Exemples */}
      <section className="examples-section">
        <div className="examples-container">
          <div className="section-header">
            <h2>Exemples de configurations</h2>
            <p>Trouvez l'offre adaptee a votre activite</p>
          </div>

          <div className="examples-grid">
            {EXAMPLES.map((ex, i) => (
              <div key={i} className={`example-card ${ex.featured ? 'example-featured' : ''}`}>
                {ex.featured && <span className="example-badge">Populaire</span>}

                <div className="example-emoji">{ex.emoji}</div>
                <h3 className="example-name">{ex.name}</h3>
                {'subtitle' in ex && <span className="example-subtitle">{ex.subtitle}</span>}

                <div className="example-config">
                  <span className="config-plan">{ex.plan}</span>
                  {ex.modules.map((m, j) => (
                    <span key={j} className="config-module">+ {m}</span>
                  ))}
                </div>

                <div className="example-total">
                  {ex.total}
                  <span>/mois</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparaison */}
      <section className="comparison-section">
        <div className="comparison-container">
          <div className="section-header">
            <h2>Comparatif detaille</h2>
          </div>

          <div className="comparison-table" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Fonctionnalite</th>
                  <th>Free</th>
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Business</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Prix</td>
                  <td>0 EUR</td>
                  <td>69 EUR/mois</td>
                  <td>199 EUR/mois</td>
                  <td>499 EUR/mois</td>
                  <td>899 EUR/mois</td>
                </tr>
                <tr>
                  <td>Utilisateurs</td>
                  <td>1</td>
                  <td>5</td>
                  <td>20</td>
                  <td>30</td>
                  <td>50</td>
                </tr>
                <tr>
                  <td>Clients / RDV / Factures</td>
                  <td>5 / 5 / 5</td>
                  <td>200 / 200 / 200</td>
                  <td>Illimite</td>
                  <td>Illimite</td>
                  <td>Illimite</td>
                </tr>
                <tr>
                  <td>IA (Tel, WhatsApp, Web)</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Facturation, Devis, Pipeline</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Equipe, Planning, Fidelite</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Marketing complet, Stock</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Comptabilite, SEO</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>API + Webhooks</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>RH (paie, DSN)</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Sentinel, White-label, SSO</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Support</td>
                  <td>Email</td>
                  <td>Email prioritaire</td>
                  <td>Prioritaire</td>
                  <td>Prioritaire</td>
                  <td>Prioritaire + AM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="faq-container">
          <div className="section-header">
            <h2>Questions frequentes</h2>
          </div>

          <div className="faq-grid">
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item">
                <h3 className="faq-question">
                  <HelpCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  {faq.q}
                </h3>
                <p className="faq-answer">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="cta-section">
        <div className="cta-container">
          <h2 className="cta-title">Pret a automatiser votre business ?</h2>
          <p className="cta-subtitle">
            Plan Free gratuit a vie - Sans carte bancaire - Setup en 30 min
          </p>
          <div className="cta-buttons">
            <Link to="/website/contact" className="cta-button primary">
              Demarrer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/website/contact" className="cta-button secondary">
              Parler a un conseiller
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
