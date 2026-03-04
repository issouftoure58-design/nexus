import { Link } from 'wouter';
import {
  Bot, Zap, Shield, TrendingUp, Users, Calendar,
  ArrowRight, Check, Star, Sparkles, MessageCircle,
  BarChart3, Smartphone
} from 'lucide-react';
import './Home.css';

// Screenshots flottants pour le hero
const floatingScreenshots = [
  { src: '/screenshots/dashboard.png', alt: 'Dashboard', size: 'lg', delay: 0 },
  { src: '/screenshots/reservations.png', alt: 'Réservations', size: 'md', delay: 1 },
  { src: '/screenshots/clients.png', alt: 'Clients', size: 'sm', delay: 2 },
  { src: '/screenshots/analytics-kpis.png', alt: 'Analytics', size: 'md', delay: 3 },
  { src: '/screenshots/chat-ia-backoffice.png', alt: 'Assistant IA', size: 'sm', delay: 4 },
  { src: '/screenshots/comptabilite.png', alt: 'Comptabilité', size: 'xs', delay: 5 },
  { src: '/screenshots/marketing.png', alt: 'Marketing', size: 'xs', delay: 6 },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Hero Section with Floating Screenshots */}
      <section className="hero-section">
        {/* Floating Screenshots Background */}
        <div className="floating-screenshots">
          {floatingScreenshots.map((shot, i) => (
            <div
              key={i}
              className={`floating-bubble bubble-${shot.size} bubble-${i + 1}`}
              style={{ animationDelay: `${shot.delay * 0.5}s` }}
            >
              <img src={shot.src} alt={shot.alt} />
            </div>
          ))}
        </div>

        {/* Gradient Orbs */}
        <div className="hero-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        {/* Content */}
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <Sparkles className="w-4 h-4" />
              <span>L'IA qui fait tourner votre business</span>
            </div>

            <h1 className="hero-title">
              NEXUS
              <br />
              <span className="hero-title-gradient">
                Votre Business en Autopilote
              </span>
            </h1>

            <p className="hero-subtitle">
              L'IA qui gère vos clients, rendez-vous et ventes 24/7.
              Sans effort, sans stress.
            </p>

            <div className="hero-buttons">
              <Link to="/website/contact" className="hero-btn-primary">
                Réserver une démo
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className="hero-btn-secondary">
                Voir comment ça marche
              </a>
            </div>

            <div className="hero-features">
              <div className="hero-feature">
                <Check className="w-4 h-4" />
                <span>Démo gratuite</span>
              </div>
              <div className="hero-feature">
                <Check className="w-4 h-4" />
                <span>Setup 30 min</span>
              </div>
              <div className="hero-feature">
                <Check className="w-4 h-4" />
                <span>Sans engagement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="hero-wave">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              fill="#ffffff"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-12">
            Vous perdez des heures chaque jour à...
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              "Répondre aux mêmes questions sur WhatsApp",
              "Jongler entre agenda papier et téléphone",
              "Relancer les clients manuellement",
              "Faire la compta le soir après le boulot"
            ].map((problem, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-red-50 rounded-xl text-left">
                <span className="text-2xl">❌</span>
                <p className="text-gray-700">{problem}</p>
              </div>
            ))}
          </div>

          <p className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-600">
            Et si une IA faisait tout ça pour vous ?
          </p>
        </div>
      </section>

      {/* Features Showcase with Screenshots */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              NEXUS automatise votre business de A à Z
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Découvrez comment nos clients gagnent 10h par semaine
            </p>
          </div>

          {/* Feature 1: Réservations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl transform -rotate-2 opacity-20" />
                <img
                  src="/screenshots/reservations.png"
                  alt="Système de réservations automatiques NEXUS"
                  className="relative rounded-2xl shadow-xl w-full"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block px-4 py-2 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold mb-4">
                <Calendar className="w-4 h-4 inline mr-2" />
                Réservations
              </span>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Agenda Intelligent 24/7
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                Vos clients prennent rendez-vous jour et nuit, sans vous déranger.
                Halimah gère tout automatiquement.
              </p>
              <ul className="space-y-3">
                {[
                  "Prise de RDV par chat, WhatsApp ou téléphone",
                  "SMS de confirmation instantané",
                  "Rappels automatiques 24h avant",
                  "Gestion annulations et reports"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 2: CRM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <span className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
                <Users className="w-4 h-4 inline mr-2" />
                CRM
              </span>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Tous vos clients au même endroit
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                Fini les post-its et carnets d'adresses.
                Toutes les infos clients centralisées et accessibles.
              </p>
              <ul className="space-y-3">
                {[
                  "Fiches clients créées automatiquement",
                  "Historique complet des RDV et achats",
                  "Notes personnelles et préférences",
                  "Segmentation intelligente"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-500 rounded-2xl transform rotate-2 opacity-20" />
              <img
                src="/screenshots/clients.png"
                alt="Gestion clients et CRM NEXUS"
                className="relative rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>

          {/* Feature 3: Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl transform -rotate-2 opacity-20" />
                <img
                  src="/screenshots/analytics-kpis.png"
                  alt="Analytics et statistiques en temps réel"
                  className="relative rounded-2xl shadow-xl w-full"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-4">
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Analytics
              </span>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Pilotez votre activité d'un coup d'œil
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                CA, tendances, services stars...
                Toutes vos données transformées en décisions.
              </p>
              <ul className="space-y-3">
                {[
                  "Dashboard temps réel (CA, RDV, clients)",
                  "Graphiques évolution mensuelle",
                  "Services les plus demandés",
                  "Insights IA automatiques"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 4: Chat Halimah */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold mb-4">
                <MessageCircle className="w-4 h-4 inline mr-2" />
                Agent IA
              </span>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Halimah, votre assistante virtuelle
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                Elle répond à vos clients 24/7, prend les RDV,
                et vous libère du temps pour votre métier.
              </p>
              <ul className="space-y-3">
                {[
                  "Conversations naturelles en français",
                  "Disponible sur chat, WhatsApp, téléphone",
                  "Répond aux questions fréquentes",
                  "Propose les créneaux disponibles"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl transform rotate-2 opacity-20" />
              <img
                src="/screenshots/chat-halimah-client.png"
                alt="Chat avec l'agent IA Halimah"
                className="relative rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Assistant IA Interne Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-4">
                <Bot className="w-4 h-4 inline mr-2" />
                Inclus dans le Socle
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Votre Assistant IA Interne
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Un copilote IA qui vous aide au quotidien dans le backoffice.
                Posez vos questions, obtenez des réponses instantanées.
              </p>
              <ul className="space-y-4">
                {[
                  "Réponses instantanées sur vos données",
                  "Suggestions de décisions business",
                  "Rédaction d'emails et SMS",
                  "Analyse automatique des tendances"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-2xl transform rotate-2 opacity-20" />
              <img
                src="/screenshots/chat-ia-backoffice.png"
                alt="Assistant IA interne NEXUS"
                className="relative rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Modules Preview */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Et ce n'est que le début...
            </h2>
            <p className="text-xl text-gray-600">
              Modules avancés disponibles selon votre plan
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { img: 'comptabilite.png', title: 'Comptabilité', desc: 'Suivi CA, dépenses, P&L', icon: '📊' },
              { img: 'marketing.png', title: 'Marketing IA', desc: 'Posts générés par IA', icon: '📱' },
              { img: 'commercial.png', title: 'Commercial', desc: 'Relances automatiques', icon: '💼' },
              { img: 'equipe-ia.png', title: 'Équipe IA', desc: 'Agents personnalisables', icon: '🤖' },
            ].map((m, i) => (
              <div key={i} className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100">
                <div className="aspect-video overflow-hidden">
                  <img
                    src={`/screenshots/${m.img}`}
                    alt={m.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-2">
                    <span className="mr-2">{m.icon}</span>
                    {m.title}
                  </h4>
                  <p className="text-gray-600 text-sm">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Study */}
      <section className="py-24 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ils automatisent déjà avec NEXUS
            </h2>
            <p className="text-xl text-white/80">
              Rejoignez les TPE/PME qui gagnent 10h par semaine
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 lg:p-12">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Fat's Hair-Afro</h3>
                  <p className="text-gray-600">Salon coiffure afro • Franconville (95)</p>
                </div>

                <blockquote className="text-lg text-gray-700 italic border-l-4 border-cyan-500 pl-4 mb-6">
                  "Depuis que Halimah gère mes réservations, j'ai récupéré mes soirées.
                  Mes clientes adorent pouvoir réserver par WhatsApp à 23h !"
                </blockquote>
                <p className="text-gray-600 mb-8">— Fatou Touré, Gérante</p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-cyan-600">+80%</div>
                    <div className="text-sm text-gray-600">Temps gagné</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-cyan-600">0</div>
                    <div className="text-sm text-gray-600">RDV manqué</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-cyan-600">24/7</div>
                    <div className="text-sm text-gray-600">Disponible</div>
                  </div>
                </div>

                <a
                  href="https://fatshairafro.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-600 font-semibold hover:text-cyan-700"
                >
                  Voir le site en action
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-gray-100 p-8 flex items-center justify-center">
                <img
                  src="/screenshots/dashboard.png"
                  alt="Dashboard Fat's Hair-Afro"
                  className="rounded-xl shadow-lg max-w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: '80%', label: 'RDV automatisés' },
              { val: '30min', label: 'Installation moyenne' },
              { val: '24/7', label: 'Disponibilité IA' },
              { val: '+40%', label: 'CA moyen clients' },
            ].map((s, i) => (
              <div key={i} className="p-6">
                <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-600 mb-2">
                  {s.val}
                </div>
                <div className="text-gray-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile Preview */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
                <Smartphone className="w-4 h-4 inline mr-2" />
                100% Mobile
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Gérez tout depuis votre smartphone
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Dashboard, réservations, clients, analytics...
                Tout est accessible en un clic, où que vous soyez.
              </p>
              <ul className="space-y-4">
                {[
                  "Interface optimisée mobile",
                  "Notifications push en temps réel",
                  "Validation RDV en un tap",
                  "Statistiques toujours accessibles"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-[3rem] transform rotate-3 opacity-20 blur-xl" />
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

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Prêt à automatiser votre business ?
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            Démo gratuite de 30 minutes pour voir NEXUS en action
          </p>
          <Link
            to="/website/contact"
            className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl transition-all hover:scale-105"
          >
            Réserver ma démo gratuite
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-400 mt-8 flex flex-wrap items-center justify-center gap-6">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              Sans carte bancaire
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              Setup en 30 min
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              Support français
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
