import { useState } from 'react';
import { Check, Bot, Phone, MessageCircle, Briefcase, ArrowRight, Calendar, Globe, ShoppingCart, CreditCard, Building2, HelpCircle } from 'lucide-react';
import { Link } from 'wouter';
import './Pricing.css';

// Socle obligatoire
const socleFeatures = [
  'Dashboard IA intelligent',
  'Facturation et Comptabilité automatisées',
  'CRM et Commercial',
  'Marketing automation',
  'Assistant IA interne',
];

// Modules par catégorie
const moduleCategories = [
  {
    name: 'Canaux Clients',
    description: 'Communiquez avec vos clients partout',
    modules: [
      {
        id: 'agent_web',
        name: 'Agent IA Web',
        price: 29,
        icon: Bot,
        features: ['Chat conversationnel sur site', 'Répond questions 24/7', 'Qualifie leads', 'Capture coordonnées'],
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        price: 39,
        icon: MessageCircle,
        features: ['Conversations illimitées', 'Prise commandes/RDV', 'Notifications automatiques', 'Intégration CRM'],
      },
      {
        id: 'telephone',
        name: 'Téléphone IA',
        price: 89,
        icon: Phone,
        features: ['Standard IA (120 min/mois inclus)', 'Transferts intelligents', 'Voicemail → texte', 'Synthèse appels'],
      },
    ],
  },
  {
    name: 'Outils Business',
    description: 'Développez votre activité',
    modules: [
      {
        id: 'reservations',
        name: 'Réservations',
        price: 29,
        icon: Calendar,
        features: ['Calendrier intelligent', 'Prise RDV automatique', 'Rappels SMS/Email', 'Optimisation planning'],
      },
      {
        id: 'site_web',
        name: 'Site web',
        price: 29,
        icon: Globe,
        features: ['5 pages personnalisables', 'Design professionnel', 'Hébergement inclus', 'SSL gratuit'],
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        price: 49,
        icon: ShoppingCart,
        features: ['Boutique en ligne', 'Gestion stock', 'Paiements intégrés', 'Suivi commandes'],
      },
      {
        id: 'paiements',
        name: 'Paiements en ligne',
        price: 29,
        icon: CreditCard,
        features: ['Stripe + PayPal', 'Facturation auto', 'Relances impayés', 'Dashboard encaissements'],
      },
    ],
  },
  {
    name: 'Modules Métier',
    description: 'Solutions spécialisées',
    modules: [
      {
        id: 'module_metier',
        name: 'Module Métier',
        price: 49,
        icon: Building2,
        features: ['Spécifique à votre activité', 'Outils dédiés métier', 'Workflows adaptés', 'Vocabulaire personnalisé'],
        examples: 'Salon, Restaurant, Garage, Consultant, Cabinet médical...',
      },
    ],
  },
];

// Flatten modules for calculator
const allModules = moduleCategories.flatMap(cat => cat.modules);

// Exemples de configurations
const examples = [
  {
    name: 'Consultant Freelance',
    emoji: '💼',
    description: 'Gestion clients + Facturation + Lead gen',
    modules: ['Agent IA Web'],
    moduleIds: ['agent_web'],
    total: 128,
  },
  {
    name: 'Restaurant',
    emoji: '🍽️',
    description: 'Réservations téléphoniques automatiques',
    modules: ['Téléphone IA', 'Réservations', 'Module Resto'],
    moduleIds: ['telephone', 'reservations', 'module_metier'],
    total: 266,
  },
  {
    name: 'Salon de coiffure',
    emoji: '💇',
    description: 'Tout automatisé de A à Z',
    modules: ['Agent IA Web', 'WhatsApp', 'Téléphone IA', 'Réservations', 'Site web', 'Module Salon'],
    moduleIds: ['agent_web', 'whatsapp', 'telephone', 'reservations', 'site_web', 'module_metier'],
    total: 363,
    featured: true,
    link: 'https://fatshairafro.fr',
    linkText: "Voir Fat's Hair-Afro →",
  },
  {
    name: 'Artisan',
    emoji: '🔧',
    description: 'Standard téléphonique + Interventions',
    modules: ['Téléphone IA', 'Réservations'],
    moduleIds: ['telephone', 'reservations'],
    total: 217,
    subtitle: 'Plombier, Électricien...',
  },
];

// FAQ
const faqs = [
  {
    q: "Y a-t-il un engagement minimum ?",
    a: "Non, aucun engagement. Vous pouvez annuler à tout moment. Nous facturons mois par mois.",
  },
  {
    q: 'Puis-je changer de modules en cours de mois ?',
    a: 'Oui, vous pouvez ajouter ou retirer des modules à tout moment. Les changements sont effectifs immédiatement et facturés au prorata.',
  },
  {
    q: "Le setup est-il inclus ?",
    a: "Oui, configuration complète en 30 minutes. Aucun frais d'installation.",
  },
  {
    q: "Que se passe-t-il si je dépasse les limites ?",
    a: "Contactez-nous, nous avons des formules adaptées pour les entreprises en croissance.",
  },
  {
    q: "Puis-je tester avant de m'abonner ?",
    a: "Oui ! Réservez une démo gratuite de 30 minutes pour voir NEXUS en action.",
  },
  {
    q: "Comment fonctionne le Module Métier ?",
    a: "Nous analysons votre activité et configurons des workflows, vocabulaire et outils spécifiques à votre secteur (coiffure, restaurant, garage, etc.).",
  },
];

export default function Pricing() {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const soclePrice = 99;

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const calculateTotal = () => {
    const modulesTotal = selectedModules.reduce((sum, moduleId) => {
      const module = allModules.find(m => m.id === moduleId);
      return sum + (module?.price || 0);
    }, 0);
    return soclePrice + modulesTotal;
  };

  return (
    <div className="pricing-page">

      {/* Header */}
      <section className="pricing-header">
        <div className="pricing-header-content">
          <h1>Tarifs transparents, sans surprise</h1>
          <p className="pricing-subtitle">
            Payez uniquement ce que vous utilisez. Sans engagement.
          </p>
          <div className="pricing-badges">
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Démo gratuite
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Setup 30 min
            </span>
            <span className="pricing-badge">
              <Check className="w-4 h-4" />
              Annulation libre
            </span>
          </div>
        </div>
      </section>

      {/* Socle Obligatoire */}
      <section className="socle-section">
        <div className="socle-container">
          <div className="socle-card">
            <div className="socle-header">
              <span className="socle-badge">SOCLE OBLIGATOIRE</span>
            </div>

            <div className="socle-body">
              <div className="socle-price">
                <span className="price-amount">99€</span>
                <span className="price-period">/mois</span>
              </div>
              <p className="socle-description">
                Tout ce dont vous avez besoin pour gérer votre business
              </p>

              <div className="socle-features">
                {socleFeatures.map((feature, i) => (
                  <div key={i} className="socle-feature">
                    <Check className="feature-check" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="socle-note">
                Ce socle est inclus avec tous les abonnements NEXUS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Additionnels */}
      <section className="modules-section">
        <div className="modules-container">
          <div className="section-header">
            <h2>Ajoutez les modules dont vous avez besoin</h2>
            <p>Sélectionnez les options qui correspondent à votre activité</p>
          </div>

          {moduleCategories.map((category, catIndex) => (
            <div key={catIndex} className="module-category">
              <div className="category-header">
                <h3>{category.name}</h3>
                <span className="category-description">{category.description}</span>
              </div>

              <div className={`modules-grid modules-grid-${category.modules.length}`}>
                {category.modules.map(module => {
                  const Icon = module.icon;
                  const isSelected = selectedModules.includes(module.id);

                  return (
                    <button
                      key={module.id}
                      onClick={() => toggleModule(module.id)}
                      className={`module-card ${isSelected ? 'module-selected' : ''}`}
                    >
                      <div className="module-header">
                        <div className={`module-icon ${isSelected ? 'icon-selected' : ''}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="module-price">
                          +{module.price}€
                          <span className="module-price-period">/mois</span>
                        </span>
                      </div>

                      <h4 className="module-name">{module.name}</h4>

                      <ul className="module-features">
                        {module.features.map((f, i) => (
                          <li key={i}>
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {'examples' in module && (
                        <p className="module-examples">{module.examples}</p>
                      )}

                      <div className={`module-action ${isSelected ? 'action-selected' : ''}`}>
                        {isSelected ? '✓ Sélectionné' : 'Ajouter'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Calculateur */}
      <section className="calculator-section">
        <div className="calculator-container">
          <div className="calculator-card">
            <h2 className="calculator-title">Votre tarif personnalisé</h2>

            <div className="calculator-breakdown">
              <div className="calculator-line">
                <span className="line-label">Socle NEXUS</span>
                <span className="line-price">{soclePrice}€</span>
              </div>

              {selectedModules.map(moduleId => {
                const module = allModules.find(m => m.id === moduleId);
                return module ? (
                  <div key={moduleId} className="calculator-line module-line">
                    <span className="line-label">+ {module.name}</span>
                    <span className="line-price">{module.price}€</span>
                  </div>
                ) : null;
              })}

              {selectedModules.length === 0 && (
                <div className="calculator-empty">
                  Sélectionnez des modules ci-dessus
                </div>
              )}
            </div>

            <div className="calculator-total">
              <span className="total-label">Total mensuel</span>
              <span className="total-price">{calculateTotal()}€</span>
            </div>

            <Link to="/website/contact" className="calculator-cta">
              Réserver ma démo gratuite
              <ArrowRight className="w-5 h-5" />
            </Link>

            <p className="calculator-note">
              ✓ Sans engagement • ✓ Annulation à tout moment
            </p>
          </div>
        </div>
      </section>

      {/* Exemples configurations */}
      <section className="examples-section">
        <div className="examples-container">
          <div className="section-header">
            <h2>Exemples de configurations</h2>
            <p>Trouvez l'offre adaptée à votre activité</p>
          </div>

          <div className="examples-grid">
            {examples.map((ex, i) => (
              <div key={i} className={`example-card ${ex.featured ? 'example-featured' : ''}`}>
                {ex.featured && (
                  <span className="example-badge">Populaire</span>
                )}

                <div className="example-emoji">{ex.emoji}</div>
                <h3 className="example-name">{ex.name}</h3>
                {'subtitle' in ex && (
                  <span className="example-subtitle">{ex.subtitle}</span>
                )}
                <p className="example-description">{ex.description}</p>

                <div className="example-modules">
                  <span className="example-module socle-tag">Socle 99€</span>
                  {ex.modules.map((m, j) => (
                    <span key={j} className="example-module">
                      {m}
                    </span>
                  ))}
                </div>

                <div className="example-total">
                  {ex.total}€
                  <span className="example-period">/mois</span>
                </div>

                {ex.link && (
                  <a
                    href={ex.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="example-link"
                  >
                    {ex.linkText}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="faq-container">
          <div className="section-header">
            <h2>Questions fréquentes</h2>
          </div>

          <div className="faq-grid">
            {faqs.map((faq, i) => (
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
          <h2 className="cta-title">Prêt à automatiser votre business ?</h2>
          <p className="cta-subtitle">
            Démo gratuite • Setup en 30 min • Sans engagement
          </p>
          <Link to="/website/contact" className="cta-button">
            Réserver ma démo gratuite
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
