import { Check, X, Shield, Zap, Sparkles, Crown } from 'lucide-react'

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 bg-dark-900/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choisissez votre{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              plan
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            Commencez gratuitement. Evoluez a votre rythme. Sans engagement.
          </p>
        </div>

        {/* Toggle Mensuel / Annuel pourrait etre ajoute ici */}

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
          {/* Free */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              GRATUIT A VIE
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-gray-400 text-sm mb-4">Pour decouvrir</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">0€</span>
                <span className="text-gray-500">/mois</span>
              </div>
            </div>
            <ul className="space-y-2 mb-8">
              {[
                { text: '5 clients, 5 RDV, 5 factures', included: true },
                { text: '1 utilisateur', included: true },
                { text: 'IA chat admin', included: true },
                { text: 'IA Tel / WhatsApp', included: false },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-2 text-sm text-gray-300">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? '' : 'text-gray-500'}>{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=free"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-white/10 rounded-xl font-semibold transition-colors"
            >
              Demarrer gratuitement
            </a>
          </div>

          {/* Starter */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 hover:border-neon-cyan/30 transition-colors relative">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-gray-400 text-sm mb-4">IA 24/7</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-neon-cyan">69€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">690€/an</p>
            </div>
            <ul className="space-y-2 mb-8">
              {[
                { text: 'Toutes les IA debloquees', included: true },
                { text: 'CRM avance', included: true },
                { text: '200 limites, 5 postes', included: true },
                { text: 'Facturation, Devis', included: false },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-2 text-sm text-gray-300">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? '' : 'text-gray-500'}>{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=starter"
              className="block w-full py-3 px-6 text-center bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Choisir Starter
            </a>
          </div>

          {/* Pro - Featured */}
          <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/50 rounded-2xl p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-neon-cyan to-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              POPULAIRE
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-gray-400 text-sm mb-4">PME etablie</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-neon-cyan">199€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">1 990€/an</p>
            </div>
            <ul className="space-y-2 mb-8">
              {[
                { text: 'Facturation, Devis, Pipeline', included: true },
                { text: 'Equipe, Planning, Fidelite', included: true },
                { text: 'Marketing complet, Stock', included: true },
                { text: 'Multi-sites, 20 postes', included: true },
                { text: 'Compta, SEO, API', included: false },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-2 text-sm text-gray-300">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? '' : 'text-gray-500'}>{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=pro"
              className="block w-full py-3 px-6 text-center bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Choisir Pro
            </a>
          </div>

          {/* Business */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 hover:border-yellow-500/30 transition-colors relative">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Business</h3>
              <p className="text-gray-400 text-sm mb-4">Gestion complete</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-yellow-400">499€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">4 990€/an</p>
            </div>
            <ul className="space-y-2 mb-8">
              {[
                { text: 'Comptabilite (rapports, FEC, TVA)', included: true },
                { text: 'SEO complet', included: true },
                { text: 'API + Webhooks', included: true },
                { text: '30 postes', included: true },
                { text: 'RH, Sentinel, SSO', included: false },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-2 text-sm text-gray-300">
                  {feature.included ? (
                    <Check className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? '' : 'text-gray-500'}>{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=business"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-yellow-500/30 rounded-xl font-semibold transition-colors"
            >
              Choisir Business
            </a>
          </div>

          {/* Enterprise */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              PREMIUM
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <p className="text-gray-400 text-sm mb-4">Full premium</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-purple-400">899€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">8 990€/an</p>
            </div>
            <ul className="space-y-2 mb-8">
              {[
                { text: 'RH complet (paie, DSN)', included: true },
                { text: 'Compta analytique', included: true },
                { text: 'Sentinel monitoring', included: true },
                { text: 'White-label + SSO', included: true },
                { text: 'Account Manager, 50 postes', included: true },
              ].map((feature) => (
                <li key={feature.text} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=enterprise"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-purple-500/30 rounded-xl font-semibold transition-colors"
            >
              Choisir Enterprise
            </a>
          </div>
        </div>

        {/* Utilisation supplementaire */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-semibold">Besoin de plus ?</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
              Utilisation supplementaire
            </h3>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Si vous depassez les limites de votre plan, ajoutez de la capacite avec des packs d'utilisation supplementaire. Plus vous achetez, plus vous economisez.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {/* Pack 50€ */}
            <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 text-center hover:border-neon-cyan/30 transition-colors">
              <div className="text-neon-cyan text-sm font-bold mb-2">PACK S</div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-3xl font-bold">50€</span>
              </div>
              <div className="text-sm text-green-400 font-semibold mb-3">-10% de reduction</div>
              <div className="text-xs text-gray-500">Ideal pour un complement ponctuel</div>
            </div>

            {/* Pack 200€ */}
            <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/40 rounded-2xl p-6 text-center relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon-cyan text-dark-900 text-xs font-bold px-3 py-1 rounded-full">
                POPULAIRE
              </div>
              <div className="text-neon-cyan text-sm font-bold mb-2">PACK M</div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-3xl font-bold">200€</span>
              </div>
              <div className="text-sm text-green-400 font-semibold mb-3">-20% de reduction</div>
              <div className="text-xs text-gray-500">Le plus choisi par nos clients</div>
            </div>

            {/* Pack 500€ */}
            <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 text-center hover:border-purple-500/30 transition-colors">
              <div className="text-purple-400 text-sm font-bold mb-2">PACK L</div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-3xl font-bold">500€</span>
              </div>
              <div className="text-sm text-green-400 font-semibold mb-3">-30% de reduction</div>
              <div className="text-xs text-gray-500">Pour les gros consommateurs</div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Les packs sont utilises pour etendre les limites de votre plan (clients, RDV, factures, utilisateurs, etc.).
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400 mt-12">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span>Plan Free gratuit a vie</span>
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
