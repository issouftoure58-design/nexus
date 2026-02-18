import {
  Phone, MessageCircle, Calendar, BarChart3, Mail,
  ShoppingBag, Users, Globe, Search, Check, ArrowRight,
  Sparkles, Clock, Shield, Zap, Star, ChevronRight
} from 'lucide-react'

// Configuration des modules avec les vrais prix
const MODULES = [
  {
    id: 'telephone_ia',
    name: 'Telephone IA',
    description: 'Agent IA qui repond au telephone 24/7',
    price: 99,
    included: '300 min',
    icon: Phone,
    color: 'bg-blue-500',
    features: ['Prise de RDV automatique', 'Reponses aux questions', 'Transfert vers humain']
  },
  {
    id: 'whatsapp_ia',
    name: 'WhatsApp IA',
    description: 'Repondez a vos clients sur WhatsApp automatiquement',
    price: 49,
    included: '1500 msgs',
    icon: MessageCircle,
    color: 'bg-green-500',
    features: ['Reponses instantanees', 'Prise de RDV', 'Envoi de confirmations']
  },
  {
    id: 'web_chat',
    name: 'Chat Web IA',
    description: 'Chatbot intelligent sur votre site',
    price: 79,
    included: '800 sessions',
    icon: Globe,
    color: 'bg-purple-500',
    features: ['Widget personnalisable', 'Reponses contextuelles', 'Capture de leads']
  },
  {
    id: 'reservations',
    name: 'Reservations',
    description: 'Systeme de reservation en ligne complet',
    price: 19,
    included: 'Illimite',
    icon: Calendar,
    color: 'bg-orange-500',
    features: ['Calendrier en ligne', 'Rappels automatiques', 'Gestion des creneaux']
  },
  {
    id: 'sms_rdv',
    name: 'SMS Rappels',
    description: 'Rappels SMS automatiques pour vos RDV',
    price: 39,
    included: '200 SMS',
    icon: Mail,
    color: 'bg-pink-500',
    features: ['Rappels J-1', 'Confirmations', 'Annulations faciles']
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Gerez vos clients et prospects',
    price: 14.90,
    included: 'Illimite',
    icon: Users,
    color: 'bg-indigo-500',
    features: ['Fiches clients', 'Historique', 'Segmentation']
  },
  {
    id: 'comptabilite',
    name: 'Comptabilite',
    description: 'Factures, devis et suivi financier',
    price: 14.90,
    included: 'Illimite',
    icon: BarChart3,
    color: 'bg-emerald-500',
    features: ['Factures auto', 'Devis', 'Export comptable']
  },
  {
    id: 'marketing',
    name: 'Marketing Email',
    description: 'Campagnes email automatisees',
    price: 29,
    included: '5000 emails',
    icon: Mail,
    color: 'bg-red-500',
    features: ['Templates', 'Automatisations', 'Stats detaillees']
  },
  {
    id: 'site_web',
    name: 'Site Web',
    description: 'Site professionnel cle en main',
    price: 25.90,
    included: 'Illimite',
    icon: Globe,
    color: 'bg-cyan-500',
    features: ['Design moderne', 'SEO optimise', 'Mobile-first']
  },
  {
    id: 'seo',
    name: 'SEO',
    description: 'Optimisation referencement Google',
    price: 9.90,
    included: 'Illimite',
    icon: Search,
    color: 'bg-yellow-500',
    features: ['Audit SEO', 'Mots-cles', 'Suivi positions']
  },
  {
    id: 'stock',
    name: 'Gestion Stock',
    description: 'Inventaires et alertes',
    price: 9.90,
    included: 'Illimite',
    icon: ShoppingBag,
    color: 'bg-amber-500',
    features: ['Suivi temps reel', 'Alertes', 'Commandes auto']
  },
  {
    id: 'rh',
    name: 'RH',
    description: 'Planning et gestion equipe',
    price: 9.90,
    included: 'Illimite',
    icon: Users,
    color: 'bg-teal-500',
    features: ['Planning', 'Conges', 'Pointage']
  },
]

// Metiers cibles
const METIERS = [
  { name: 'Salons de coiffure', emoji: '✂️' },
  { name: 'Instituts de beaute', emoji: '💅' },
  { name: 'Restaurants', emoji: '🍽️' },
  { name: 'Cabinets medicaux', emoji: '🏥' },
  { name: 'Garages auto', emoji: '🔧' },
  { name: 'Commerces', emoji: '🛍️' },
]

// Temoignages
const TESTIMONIALS = [
  {
    name: 'Marie L.',
    business: 'Salon de coiffure, Lyon',
    text: "Depuis que j'utilise NEXUS, je ne rate plus aucun appel. L'IA repond a ma place et prend les RDV automatiquement.",
    avatar: 'ML',
    rating: 5
  },
  {
    name: 'Thomas R.',
    business: 'Restaurant, Paris',
    text: "Les reservations se font toutes seules via WhatsApp. Mes clients adorent la rapidite des reponses.",
    avatar: 'TR',
    rating: 5
  },
  {
    name: 'Sophie M.',
    business: 'Institut beaute, Marseille',
    text: "J'ai reduit mes no-shows de 80% grace aux rappels SMS automatiques. ROI immediat!",
    avatar: 'SM',
    rating: 5
  }
]

function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">NEXUS</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#modules" className="text-gray-600 hover:text-gray-900 transition">Modules</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Tarifs</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition">Temoignages</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="http://localhost:3002/login" className="text-gray-600 hover:text-gray-900 transition hidden sm:block">Connexion</a>
              <a href="http://localhost:3002/signup" className="btn-primary text-sm py-2 px-4">
                Essai gratuit
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Propulse par l'Intelligence Artificielle
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
            Automatisez votre<br />
            <span className="gradient-text">business avec l'IA</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Reservations, WhatsApp, appels telephoniques - tout fonctionne en autopilote.
            Concentrez-vous sur votre metier, NEXUS gere le reste.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <a href="http://localhost:3002/signup" className="btn-primary inline-flex items-center justify-center gap-2">
              Essai gratuit 14 jours
              <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#modules" className="btn-secondary inline-flex items-center justify-center gap-2">
              Voir les modules
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span>Donnees securisees</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>Setup en 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span>Sans engagement</span>
            </div>
          </div>
        </div>
      </section>

      {/* Metiers Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-500 mb-8">Concu pour les professionnels</p>
          <div className="flex flex-wrap justify-center gap-4">
            {METIERS.map((metier) => (
              <div key={metier.name} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                <span>{metier.emoji}</span>
                <span className="text-gray-700 font-medium">{metier.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Choisissez vos modules
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Composez votre solution sur-mesure. Payez uniquement ce dont vous avez besoin.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {MODULES.map((module) => {
              const Icon = module.icon
              return (
                <div key={module.id} className="card hover:shadow-xl transition-shadow duration-300">
                  <div className={`w-12 h-12 ${module.color} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{module.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{module.description}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-gray-900">{module.price}€</span>
                    <span className="text-gray-500">/mois</span>
                  </div>
                  <p className="text-sm text-primary-600 font-medium mb-4">{module.included} inclus</p>
                  <ul className="space-y-2">
                    {module.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Tarification simple et transparente
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Pas de frais caches. Pas d'engagement. Annulez a tout moment.
          </p>

          {/* Exemple de configuration */}
          <div className="card border-2 border-primary-500 p-8 mb-12">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
              Exemple: Salon de coiffure
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl">
                <Phone className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="font-semibold">Telephone IA</p>
                <p className="text-2xl font-bold">99€</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <MessageCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold">WhatsApp IA</p>
                <p className="text-2xl font-bold">49€</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <Calendar className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="font-semibold">Reservations</p>
                <p className="text-2xl font-bold">19€</p>
              </div>
            </div>
            <div className="border-t pt-6">
              <p className="text-gray-600 mb-2">Total mensuel</p>
              <p className="text-5xl font-bold text-gray-900 mb-4">167€<span className="text-lg font-normal text-gray-500">/mois</span></p>
              <a href="http://localhost:3002/signup" className="btn-primary inline-flex items-center gap-2">
                Commencer l'essai gratuit
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>

          <p className="text-gray-500">
            Essai gratuit de 14 jours - Aucune carte bancaire requise
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-xl text-gray-600">
              Decouvrez ce que nos clients disent de NEXUS
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.business}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-600 to-accent-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pret a automatiser votre business ?
          </h2>
          <p className="text-xl text-white/80 mb-10">
            Rejoignez des centaines de professionnels qui gagnent du temps chaque jour.
          </p>
          <a href="http://localhost:3002/signup" className="bg-white text-primary-600 font-semibold py-4 px-10 rounded-xl hover:bg-gray-100 transition-colors inline-flex items-center gap-2">
            Demarrer l'essai gratuit
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">NEXUS</span>
              </div>
              <p className="text-sm">
                Automatisez votre business avec l'intelligence artificielle.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#modules" className="hover:text-white transition">Modules</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">CGV</a></li>
                <li><a href="#" className="hover:text-white transition">Confidentialite</a></li>
                <li><a href="#" className="hover:text-white transition">Mentions legales</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2026 NEXUS. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
