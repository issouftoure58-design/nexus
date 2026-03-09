import { Check, Shield, Zap } from 'lucide-react'

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 bg-dark-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choisissez votre{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              plan
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            Pas de frais caches. 14 jours d'essai gratuit. Annulez a tout moment.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Starter */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-white/20 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              OFFRE DE LANCEMENT
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-gray-400 text-sm mb-4">Pour demarrer avec l'IA</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">79€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1"><span className="line-through">99€</span> — 100 premiers clients</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '200 clients max',
                'Agent IA Web 24/7',
                'Agenda & Reservations',
                'Facturation & Documents',
                'Support email',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://nexus-admin-yedu.onrender.com/signup?plan=starter"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-white/10 rounded-xl font-semibold transition-colors"
            >
              Commencer l'essai
            </a>
          </div>

          {/* Pro - Featured */}
          <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/50 rounded-2xl p-6 lg:p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              OFFRE DE LANCEMENT
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-gray-400 text-sm mb-4">Pour les professionnels</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-neon-cyan">199€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1"><span className="line-through">249€</span> — 100 premiers clients</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '2 000 clients max',
                'WhatsApp IA + Telephone IA',
                'Comptabilite & Devis',
                'CRM avance',
                'Stock & Inventaire',
                'Support prioritaire',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://nexus-admin-yedu.onrender.com/signup?plan=pro"
              className="block w-full py-3 px-6 text-center bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Commencer l'essai
            </a>
          </div>

          {/* Business */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-purple-500/30 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              OFFRE DE LANCEMENT
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Business</h3>
              <p className="text-gray-400 text-sm mb-4">Pour les entreprises</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-purple-400">399€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1"><span className="line-through">499€</span> — 100 premiers clients</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Clients illimites',
                'Marketing automatise',
                'Pipeline commercial',
                'Analytics avances & SEO',
                'RH & Planning equipe',
                'API & Account manager dedie',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://nexus-admin-yedu.onrender.com/signup?plan=business"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-purple-500/30 rounded-xl font-semibold transition-colors"
            >
              Contacter les ventes
            </a>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400 mt-12">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span>14 jours d'essai gratuit</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span>Sans carte bancaire</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span>Sans engagement</span>
          </div>
        </div>
      </div>
    </section>
  )
}
