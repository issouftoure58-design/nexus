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

// Plans principaux — Modele 2026 revision finale 9 avril 2026 (voir memory/business-model-2026.md)
// Free freemium / Basic 29€ illimite non-IA + 1 000 credits IA / Business 149€ multi-sites + 10 000 credits IA
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
      { text: '10 reservations / mois', included: true },
      { text: '10 factures / mois (avec watermark)', included: true },
      { text: '30 clients max dans le CRM', included: true },
      { text: '3 prestations max', included: true },
      { text: '1 utilisateur', included: true },
      { text: 'Tous les modules visibles', included: true },
      { text: 'Support email', included: true },
      { text: 'Reservations illimitees', included: false },
      { text: 'Facturation illimitee', included: false },
      { text: 'WhatsApp IA, Telephone IA', included: false },
      { text: 'Marketing automatise', included: false },
    ],
    cta: 'Demarrer gratuitement',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    originalPrice: 29,
    yearlyPrice: 290,
    launchOffer: '1 000 credits IA inclus / mois (valeur 15€)',
    description: 'Tout illimite non-IA + credits IA inclus',
    icon: Crown,
    color: 'from-cyan-500 to-blue-600',
    popular: true,
    features: [
      { text: 'Reservations illimitees', included: true },
      { text: 'Facturation illimitee (sans watermark)', included: true },
      { text: 'CRM, Equipe, Fidelite illimites', included: true },
      { text: 'Comptabilite, RH, Stock complets', included: true },
      { text: 'Workflows, Pipeline, Devis, SEO', included: true },
      { text: '1 000 credits IA inclus chaque mois', included: true },
      { text: 'WhatsApp IA, Telephone IA, Marketing IA', included: true },
      { text: 'Support email prioritaire', included: true },
      { text: 'Multi-sites', included: false },
      { text: 'White-label + API', included: false },
      { text: 'Account manager dedie', included: false },
    ],
    cta: 'Choisir Basic',
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    originalPrice: 149,
    yearlyPrice: 1490,
    launchOffer: '10 000 credits IA inclus chaque mois (valeur 150€)',
    description: 'Multi-sites, white-label, premium',
    icon: Building2,
    color: 'from-purple-500 to-indigo-600',
    features: [
      { text: 'Tout Basic +', included: true },
      { text: 'Multi-sites illimites', included: true },
      { text: 'White-label (logo + domaine)', included: true },
      { text: 'API + Webhooks', included: true },
      { text: 'SSO entreprise', included: true },
      { text: 'Support prioritaire 1h', included: true },
      { text: 'Account Manager dedie', included: true },
      { text: '10 000 credits IA inclus / mois (valeur 150€)', included: true },
      { text: 'Formation personnalisee', included: true },
    ],
    cta: 'Choisir Business',
  },
];

// Pack unique additionnel (one-shot, 1,5€ = 100 credits, taux base, sans bonus)
const CREDIT_PACKS = [
  {
    id: '1000',
    label: 'Pack 1000',
    price: 15,
    credits: 1000,
    bonus: '',
    description: 'Pack unique additionnel au taux base',
    featured: true,
  },
];

// Cout en credits par action IA (pay-as-you-go)
const CREDIT_COSTS = [
  { action: '1 question chat IA admin', cost: '4 credits' },
  { action: '1 message WhatsApp IA repondu', cost: '4 credits' },
  { action: '1 devis IA', cost: '6 credits' },
  { action: '1 email IA envoye', cost: '6 credits' },
  { action: '1 conversation Agent IA Web', cost: '9 credits' },
  { action: '1 post reseaux sociaux genere', cost: '9 credits' },
  { action: '1 minute Telephone IA', cost: '15 credits' },
  { action: '1 article SEO (1500 mots)', cost: '66 credits' },
];

// Exemples de configurations (modele 2026 — revision finale 9 avril 2026)
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
    name: 'Salon de coiffure',
    emoji: '✂️',
    plan: 'Basic',
    modules: ['1 000 credits IA inclus'],
    total: 29,
    featured: true,
    subtitle: '29€/mois credits IA inclus',
  },
  {
    name: 'Restaurant',
    emoji: '🍽️',
    plan: 'Basic',
    modules: ['1 000 credits IA inclus'],
    total: 29,
    subtitle: 'Tables, menus, services midi/soir',
  },
  {
    name: 'Petit hotel',
    emoji: '🏨',
    plan: 'Basic',
    modules: ['1 000 credits IA inclus'],
    total: 29,
    subtitle: 'Chambres, tarifs, check-in/out',
  },
  {
    name: 'Artisan a domicile',
    emoji: '🔧',
    plan: 'Basic',
    modules: ['1 000 credits IA inclus'],
    total: 29,
    subtitle: 'Plombier, electricien, plaquiste...',
  },
  {
    name: 'Groupe multi-sites',
    emoji: '🏢',
    plan: 'Business',
    modules: ['10 000 credits IA inclus'],
    total: 149,
    subtitle: 'Chaines, franchises',
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
    q: 'Quelle est la difference entre Free, Basic et Business ?',
    a: "Free (0€) : pour decouvrir, quotas mensuels stricts, IA bloquee. Basic (29€/mois) : tout illimite non-IA + 1 000 credits IA inclus chaque mois (valeur 15€). Business (149€/mois) : Basic + multi-sites, white-label, API, SSO et 10 000 credits IA inclus chaque mois (valeur 150€).",
  },
  {
    q: 'Comment fonctionnent les credits IA ?',
    a: "1,5 euro = 100 credits (0,015€/credit — taux base). Chaque plan payant inclut deja des credits : Basic 1 000 credits/mois, Business 10 000 credits/mois. Si vous avez besoin de plus, un pack unique additionnel est disponible : Pack 1000 a 15€ pour 1 000 credits au taux base (sans bonus). 1 message WhatsApp IA = 4 credits, 1 minute Telephone IA = 15 credits, 1 article SEO = 66 credits.",
  },
  {
    q: 'Puis-je changer de plan en cours de mois ?',
    a: 'Oui, les changements sont effectifs immediatement et factures au prorata.',
  },
  {
    q: 'Que se passe-t-il si je tombe a 0 credit IA ?',
    a: "Mode degrade gracieux : l'IA bascule sur un message humain, jamais de surprise. Vous pouvez recharger avec le Pack 1000 a 15€ pour ajouter 1 000 credits additionnels.",
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
            <h2>Pack additionnel de credits IA</h2>
            <p>
              Basic inclut 1 000 credits/mois, Business inclut 10 000 credits/mois. Si vous avez besoin de plus,
              un pack unique additionnel est disponible — au taux base, sans bonus, sans surprise.
              <br />
              <strong>1,5 euro = 100 credits</strong> (0,015€/credit).
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

          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Fonctionnalite</th>
                  <th>Free</th>
                  <th>Basic</th>
                  <th>Business</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Prix</td>
                  <td>0 EUR</td>
                  <td>29 EUR/mois</td>
                  <td>149 EUR/mois</td>
                </tr>
                <tr>
                  <td>Utilisateurs</td>
                  <td>1</td>
                  <td>Illimite</td>
                  <td>Illimite</td>
                </tr>
                <tr>
                  <td>Reservations / mois</td>
                  <td>10</td>
                  <td>Illimitees</td>
                  <td>Illimitees</td>
                </tr>
                <tr>
                  <td>Factures / mois</td>
                  <td>10 (avec watermark)</td>
                  <td>Illimitees</td>
                  <td>Illimitees</td>
                </tr>
                <tr>
                  <td>Clients max</td>
                  <td>30</td>
                  <td>Illimite</td>
                  <td>Illimite</td>
                </tr>
                <tr>
                  <td>CRM, Equipe, Fidelite</td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Comptabilite, RH, Stock</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Workflows, Pipeline, Devis</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Fonctions IA</td>
                  <td>Bloquees</td>
                  <td>1 000 credits inclus / mois</td>
                  <td>10 000 credits inclus / mois</td>
                </tr>
                <tr>
                  <td>WhatsApp IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td>4 credits / message</td>
                  <td>4 credits / message</td>
                </tr>
                <tr>
                  <td>Telephone IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td>15 credits / minute</td>
                  <td>15 credits / minute</td>
                </tr>
                <tr>
                  <td>Marketing IA, SEO IA</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td>Via credits</td>
                  <td>Via credits</td>
                </tr>
                <tr>
                  <td>Multi-sites</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>White-label (logo + domaine)</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>API + Webhooks</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>SSO entreprise</td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><X className="w-4 h-4 text-gray-300" /></td>
                  <td><Check className="w-4 h-4 text-green-500" /></td>
                </tr>
                <tr>
                  <td>Support</td>
                  <td>Email</td>
                  <td>Email prioritaire</td>
                  <td>Prioritaire 1h + Account Manager</td>
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
