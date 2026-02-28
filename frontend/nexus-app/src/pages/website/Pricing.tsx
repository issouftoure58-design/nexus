import { useState } from 'react';
import {
  Check,
  X,
  ArrowRight,
  Phone,
  MessageCircle,
  Users,
  HelpCircle,
  Sparkles,
  Crown,
  Zap,
  Building2,
  ChefHat,
  Hotel,
  Car,
} from 'lucide-react';
import { Link } from 'wouter';
import './Pricing.css';

// Plans principaux - Grille tarifaire 2026
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    yearlyPrice: 950,
    description: 'Pour demarrer votre activite',
    icon: Zap,
    color: 'from-gray-500 to-gray-600',
    features: [
      { text: '1 utilisateur', included: true },
      { text: '1000 clients max', included: true },
      { text: '200 SMS/mois', included: true },
      { text: 'Dashboard IA', included: true },
      { text: 'CRM & Gestion clients', included: true },
      { text: 'Reservations en ligne', included: true },
      { text: 'Agent IA Web (chatbot)', included: true },
      { text: 'Site vitrine', included: true },
      { text: 'Facturation', included: true },
      { text: 'Support email (48h)', included: true },
      { text: 'WhatsApp IA', included: false },
      { text: 'Telephone IA', included: false },
      { text: 'Marketing automatise', included: false },
    ],
    cta: 'Commencer',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 249,
    yearlyPrice: 2390,
    description: 'Le plus populaire',
    icon: Crown,
    color: 'from-purple-500 to-indigo-600',
    popular: true,
    features: [
      { text: '5 utilisateurs inclus', included: true },
      { text: '5000 clients max', included: true },
      { text: '500 SMS/mois', included: true },
      { text: '60 min voix IA/mois', included: true },
      { text: 'Tout Starter +', included: true },
      { text: 'WhatsApp IA', included: true },
      { text: 'Telephone IA', included: true },
      { text: 'Pipeline commercial', included: true },
      { text: 'Marketing automatise', included: true },
      { text: 'Comptabilite', included: true },
      { text: 'Analytics avances', included: true },
      { text: 'Support prioritaire (24h)', included: true },
      { text: 'RH complet', included: false },
    ],
    cta: 'Essai gratuit 14 jours',
  },
  {
    id: 'business',
    name: 'Business',
    price: 499,
    yearlyPrice: 4790,
    description: 'Pour les entreprises',
    icon: Building2,
    color: 'from-cyan-500 to-blue-600',
    features: [
      { text: '20 utilisateurs inclus', included: true },
      { text: 'Clients illimites', included: true },
      { text: '2000 SMS/mois', included: true },
      { text: '300 min voix IA/mois', included: true },
      { text: 'Tout Pro +', included: true },
      { text: 'RH & Planning complet', included: true },
      { text: 'SEO IA', included: true },
      { text: 'API & Integrations', included: true },
      { text: 'SENTINEL Intelligence', included: true },
      { text: 'White-label', included: true },
      { text: 'Account Manager dedie', included: true },
      { text: 'Support 24/7', included: true },
    ],
    cta: 'Contacter les ventes',
  },
];

// Modules metier optionnels
const MODULES_METIER = [
  {
    id: 'restaurant',
    name: 'Restaurant Pro',
    price: 39,
    icon: ChefHat,
    description: 'Gestion tables, menus digitaux, services midi/soir',
  },
  {
    id: 'hotel',
    name: 'Hotel Pro',
    price: 69,
    icon: Hotel,
    description: 'Chambres, tarifs saisonniers, check-in/out automatise',
  },
  {
    id: 'domicile',
    name: 'Domicile Pro',
    price: 29,
    icon: Car,
    description: 'Zones de couverture, tournees, GPS, frais deplacement',
  },
];

// Packs recharges
const PACKS = {
  sms: [
    { qty: 100, price: 15 },
    { qty: 500, price: 65 },
    { qty: 1000, price: 110 },
  ],
  voice: [
    { minutes: 30, price: 15 },
    { minutes: 60, price: 25 },
    { minutes: 120, price: 45 },
  ],
};

// Exemples de configurations
const EXAMPLES = [
  {
    name: 'Coiffeur solo',
    emoji: '💇',
    plan: 'Starter',
    modules: [],
    total: 99,
  },
  {
    name: 'Salon de coiffure',
    emoji: '✂️',
    plan: 'Pro',
    modules: [],
    total: 249,
    featured: true,
  },
  {
    name: 'Restaurant',
    emoji: '🍽️',
    plan: 'Pro',
    modules: ['Restaurant Pro'],
    total: 288,
  },
  {
    name: 'Hotel boutique',
    emoji: '🏨',
    plan: 'Pro',
    modules: ['Hotel Pro'],
    total: 318,
  },
  {
    name: 'Artisan a domicile',
    emoji: '🔧',
    plan: 'Pro',
    modules: ['Domicile Pro'],
    total: 278,
    subtitle: 'Plombier, Electricien...',
  },
  {
    name: 'Groupe multi-sites',
    emoji: '🏢',
    plan: 'Business',
    modules: [],
    total: 499,
  },
];

// FAQ
const FAQS = [
  {
    q: 'Y a-t-il un engagement minimum ?',
    a: 'Non, aucun engagement. Vous pouvez annuler a tout moment. Nous facturons mois par mois.',
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "14 jours d'essai complet sur le plan Pro, sans carte bancaire. Vous testez toutes les fonctionnalites.",
  },
  {
    q: 'Puis-je changer de plan en cours de mois ?',
    a: 'Oui, les changements sont effectifs immediatement et factures au prorata.',
  },
  {
    q: 'Que se passe-t-il si je depasse mes quotas SMS/Voix ?',
    a: 'Vous pouvez acheter des packs recharges a tout moment. Pas de surfacturation surprise.',
  },
  {
    q: 'Les modules metier sont-ils obligatoires ?',
    a: 'Non, ils sont optionnels. Ajoutez-les uniquement si votre secteur le necessite.',
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
    const monthlyTotal = plan.price * 12;
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
            3 plans, tout inclus. Pas de frais caches.
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
              Essai gratuit 14 jours
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Sans engagement
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Setup inclus
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
                    <span className="price-period">/mois</span>
                  </div>

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

      {/* Modules Metier */}
      <section className="modules-section">
        <div className="modules-container">
          <div className="section-header">
            <h2>Modules metier optionnels</h2>
            <p>Ajoutez des fonctionnalites specifiques a votre secteur</p>
          </div>

          <div className="modules-grid">
            {MODULES_METIER.map((mod) => {
              const Icon = mod.icon;
              return (
                <div key={mod.id} className="module-card">
                  <div className="module-icon">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="module-info">
                    <h4 className="module-name">{mod.name}</h4>
                    <p className="module-description">{mod.description}</p>
                  </div>
                  <div className="module-price">
                    +{mod.price}
                    <span>/mois</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Packs Recharges */}
      <section className="packs-section">
        <div className="packs-container">
          <div className="section-header">
            <h2>Packs recharges</h2>
            <p>Besoin de plus de SMS ou de minutes voix IA ?</p>
          </div>

          <div className="packs-grid">
            <div className="pack-category">
              <h3>
                <MessageCircle className="w-5 h-5" />
                Packs SMS
              </h3>
              <div className="pack-items">
                {PACKS.sms.map((pack, idx) => (
                  <div key={idx} className="pack-item">
                    <span className="pack-qty">{pack.qty} SMS</span>
                    <span className="pack-price">{pack.price} EUR</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pack-category">
              <h3>
                <Phone className="w-5 h-5" />
                Packs Voix IA
              </h3>
              <div className="pack-items">
                {PACKS.voice.map((pack, idx) => (
                  <div key={idx} className="pack-item">
                    <span className="pack-qty">{pack.minutes} min</span>
                    <span className="pack-price">{pack.price} EUR</span>
                  </div>
                ))}
              </div>
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

          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Fonctionnalite</th>
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Business</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Utilisateurs inclus</td>
                  <td>1</td>
                  <td>5</td>
                  <td>20</td>
                </tr>
                <tr>
                  <td>Clients max</td>
                  <td>1 000</td>
                  <td>5 000</td>
                  <td>Illimite</td>
                </tr>
                <tr>
                  <td>SMS/mois</td>
                  <td>200</td>
                  <td>500</td>
                  <td>2 000</td>
                </tr>
                <tr>
                  <td>Voix IA/mois</td>
                  <td>-</td>
                  <td>60 min</td>
                  <td>300 min</td>
                </tr>
                <tr>
                  <td>Agent IA Web</td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>WhatsApp IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Telephone IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Marketing auto</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>RH complet</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>SEO IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>API</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Support</td>
                  <td>Email 48h</td>
                  <td>Prioritaire 24h</td>
                  <td>24/7 + AM dedie</td>
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
            Essai gratuit 14 jours - Sans carte bancaire - Setup en 30 min
          </p>
          <div className="cta-buttons">
            <Link to="/website/contact" className="cta-button primary">
              Demarrer l'essai gratuit
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
