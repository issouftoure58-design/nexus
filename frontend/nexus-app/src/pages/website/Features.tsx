import WebsiteLayout from "@/components/website/WebsiteLayout";
import { Link } from "wouter";
import {
  Bot, Calendar, Users, BarChart3, MessageCircle, Phone,
  Mail, Zap, Shield, TrendingUp, Check, ArrowRight,
  Smartphone, Globe, Clock, Brain, Target, PieChart,
  FileText, CreditCard, Settings, Sparkles
} from "lucide-react";

// Feature categories — Modèle pricing 2026 révision finale 9 avril 2026 : Free / Basic 29€ (1 000 cr) / Business 149€ (10 000 cr)
const FEATURE_CATEGORIES = [
  {
    id: "free",
    title: "Plan Free",
    subtitle: "Gratuit a vie — pour decouvrir NEXUS",
    icon: Zap,
    color: "cyan",
    features: [
      {
        name: "Reservations en ligne (30/mois)",
        description: "Systeme de prise de RDV 24/7 avec confirmation SMS et rappels automatiques",
        icon: Calendar,
      },
      {
        name: "Facturation (10/mois)",
        description: "Creation et envoi de factures avec watermark NEXUS, export comptable basique",
        icon: FileText,
      },
      {
        name: "CRM jusqu'a 30 clients",
        description: "Gestion clients basique avec historique et preferences",
        icon: Users,
      },
      {
        name: "Site vitrine public",
        description: "Page publique personnalisable pour presenter vos services et collecter les RDV",
        icon: Globe,
      },
      {
        name: "Tous les modules visibles",
        description: "Decouvrez toute la plateforme avant de passer en Basic",
        icon: BarChart3,
      },
      {
        name: "Support email",
        description: "Reponse sous 24h pour vous accompagner dans vos premiers pas",
        icon: Mail,
      },
    ],
  },
  {
    id: "basic",
    title: "Plan Basic — 29€/mois",
    subtitle: "Tout illimite + IA via credits pay-as-you-go",
    icon: Sparkles,
    color: "purple",
    features: [
      {
        name: "Reservations & Facturation illimitees",
        description: "Aucune limite, aucun watermark sur vos factures",
        icon: Calendar,
      },
      {
        name: "CRM illimite + segmentation",
        description: "Gestion clients complete avec historique, preferences et segmentation RFM",
        icon: Users,
      },
      {
        name: "Comptabilite & RH complets",
        description: "Suivi CA, depenses, P&L, gestion equipe, plannings et conges",
        icon: PieChart,
      },
      {
        name: "Workflows, Devis, Pipeline",
        description: "Automatisation marketing, devis pro, suivi commercial des opportunites",
        icon: Target,
      },
      {
        name: "Stock, Analytics, SEO",
        description: "Inventaire produits, rapports detailles, optimisation Google",
        icon: TrendingUp,
      },
      {
        name: "Toutes les fonctions IA en credits",
        description: "WhatsApp IA, Telephone IA, chat web, marketing IA, articles SEO — payez uniquement ce que vous consommez",
        icon: Bot,
      },
    ],
  },
  {
    id: "business",
    title: "Plan Business — 149€/mois",
    subtitle: "Pour les entreprises et chaines + 10 000 credits IA inclus (valeur 150€)",
    icon: Shield,
    color: "blue",
    features: [
      {
        name: "Multi-sites illimites",
        description: "Gerez plusieurs etablissements depuis un seul tableau de bord",
        icon: Globe,
      },
      {
        name: "White-label complet",
        description: "Personnalisez NEXUS avec votre logo, vos couleurs et votre domaine",
        icon: Sparkles,
      },
      {
        name: "API & Webhooks",
        description: "Connectez NEXUS a vos outils existants via notre API REST documentee",
        icon: Settings,
      },
      {
        name: "SSO entreprise",
        description: "Single Sign-On pour vos equipes via Google, Microsoft, SAML",
        icon: Shield,
      },
      {
        name: "10 000 credits IA inclus / mois",
        description: "Equivalent 150€ de credits IA inclus chaque mois au taux base (rechargeable a la demande avec le Pack 1000)",
        icon: Zap,
      },
      {
        name: "Support prioritaire 1h + Account Manager",
        description: "Premiere reponse en 1h, account manager dedie, sessions de formation",
        icon: Phone,
      },
    ],
  },
];

// Key benefits
const BENEFITS = [
  {
    title: "10h/semaine gagnees",
    description: "L'IA gere les taches repetitives pendant que vous vous concentrez sur votre metier",
    icon: Clock,
  },
  {
    title: "Disponible 24/7",
    description: "Vos clients peuvent reserver et obtenir des reponses meme la nuit et le week-end",
    icon: Zap,
  },
  {
    title: "0 RDV manque",
    description: "Rappels automatiques et confirmation SMS pour reduire les no-shows a zero",
    icon: Check,
  },
  {
    title: "Intelligence Artificielle",
    description: "Halimah comprend le langage naturel et s'ameliore avec chaque conversation",
    icon: Brain,
  },
];

export default function FeaturesPage() {
  const colorClasses = {
    cyan: "from-cyan-500 to-blue-500 bg-cyan-50 text-cyan-600 border-cyan-200",
    purple: "from-purple-500 to-indigo-500 bg-purple-50 text-purple-600 border-purple-200",
    blue: "from-blue-500 to-cyan-500 bg-blue-50 text-blue-600 border-blue-200",
  };

  return (
    <WebsiteLayout>
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Toutes les fonctionnalites NEXUS
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Decouvrez comment NEXUS automatise votre business de A a Z
              avec l'intelligence artificielle
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/website/pricing"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105"
              >
                Voir les tarifs
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/website/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Demander une demo
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {BENEFITS.map((benefit, i) => {
                const Icon = benefit.icon;
                return (
                  <div key={i} className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
                    <p className="text-gray-600">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Categories */}
        {FEATURE_CATEGORIES.map((category, catIdx) => {
          const CategoryIcon = category.icon;
          const colors = colorClasses[category.color as keyof typeof colorClasses];

          return (
            <section
              key={category.id}
              className={`py-20 ${catIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Category Header */}
                <div className="text-center mb-16">
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 ${colors.split(" ").slice(2).join(" ")}`}
                  >
                    <CategoryIcon className="w-4 h-4" />
                    {category.subtitle}
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                    {category.title}
                  </h2>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {category.features.map((feature, i) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={i}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all"
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${colors.split(" ").slice(0, 2).join(" ")}`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {feature.name}
                        </h3>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}

        {/* Mobile Section */}
        <section className="py-20 bg-gradient-to-br from-cyan-500 to-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-semibold mb-4">
                  <Smartphone className="w-4 h-4" />
                  100% Mobile
                </span>
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                  Gerez tout depuis votre smartphone
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  Dashboard, reservations, clients, analytics...
                  Tout est accessible en un clic, ou que vous soyez.
                </p>
                <ul className="space-y-4">
                  {[
                    "Interface optimisee mobile",
                    "Notifications push en temps reel",
                    "Validation RDV en un tap",
                    "Statistiques toujours accessibles",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-[3rem] transform rotate-3 blur-xl" />
                  <div className="relative bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                    <img
                      src="/screenshots/chat-halimah-client.png"
                      alt="NEXUS sur mobile"
                      className="rounded-[2rem] w-64"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Partners */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Integrations & Technologies
            </h2>
            <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
              NEXUS s'integre avec les meilleurs outils du marche
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {["Stripe", "Twilio", "WhatsApp", "OpenAI", "Google", "Supabase"].map(
                (partner, i) => (
                  <div
                    key={i}
                    className="px-6 py-3 bg-gray-100 rounded-lg text-gray-700 font-semibold"
                  >
                    {partner}
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Pret a automatiser votre business ?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Essai gratuit 14 jours - Sans carte bancaire - Setup en 30 min
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/website/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all hover:scale-105"
              >
                Demarrer l'essai gratuit
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/website/pricing"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </WebsiteLayout>
  );
}
