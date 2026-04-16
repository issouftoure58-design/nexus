import { Check, Shield, Zap, Sparkles } from 'lucide-react'

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
            Commencez gratuitement. Passez a Basic des que vous etes pret. Sans engagement.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Free */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-white/20 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              GRATUIT A VIE
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-gray-400 text-sm mb-4">Pour decouvrir NEXUS</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">0€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Sans carte bancaire</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '10 reservations / mois',
                '10 factures / mois (avec watermark)',
                '30 clients max dans le CRM',
                'Prestations illimitees',
                'Tous les modules visibles',
                'Fonctions IA bloquees',
                'Support email',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>{feature}</span>
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

          {/* Basic - Featured */}
          <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/50 rounded-2xl p-6 lg:p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-neon-cyan to-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              LE PLUS POPULAIRE
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Basic</h3>
              <p className="text-gray-400 text-sm mb-4">Tout illimite, prix imbattable</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-neon-cyan">29€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Acces illimite non-IA</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Reservations illimitees',
                'Facturation illimitee (sans watermark)',
                '1 000 credits IA inclus / mois (valeur 15€)',
                'CRM, Equipe (5 max), Fidelite',
                'Comptabilite, Stock complets',
                'Workflows, Pipeline, Devis, SEO',
                'Support email prioritaire',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=basic"
              className="block w-full py-3 px-6 text-center bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Choisir Basic
            </a>
          </div>

          {/* Business */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 lg:p-8 hover:border-purple-500/30 transition-colors relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              MULTI-SITES
            </div>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Business</h3>
              <p className="text-gray-400 text-sm mb-4">Pour les entreprises et chaines</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-purple-400">149€</span>
                <span className="text-gray-500">/mois</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">10 000 credits IA inclus / mois</p>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Tout Basic + RH & Planning',
                'Multi-sites',
                'White-label (logo + domaine custom)',
                'API + Webhooks',
                'SSO entreprise',
                '10 000 credits IA inclus / mois (valeur 150€)',
                'Support prioritaire 1h',
                'Account manager dedie',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://app.nexus-ai-saas.com/signup?plan=business"
              className="block w-full py-3 px-6 text-center bg-dark-700 hover:bg-dark-600 border border-purple-500/30 rounded-xl font-semibold transition-colors"
            >
              Choisir Business
            </a>
          </div>
        </div>

        {/* Credits IA - Pack additionnel unique */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-semibold">Credits IA inclus et rechargeables</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-2">
              Credits IA inclus dans chaque plan
            </h3>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Basic inclut 1 000 credits/mois, Business inclut 10 000 credits/mois. Si vous avez besoin de plus,
              un pack unique additionnel est disponible. Simple, sans bonus degressifs, au taux base.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-gradient-to-b from-neon-cyan/10 to-dark-800 border-2 border-neon-cyan/40 rounded-2xl p-8 text-center relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon-cyan text-dark-900 text-xs font-bold px-3 py-1 rounded-full">
                PACK UNIQUE
              </div>
              <div className="text-neon-cyan text-sm font-bold mb-2">PACK 1000</div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-bold">15€</span>
              </div>
              <div className="text-gray-300 text-lg mb-3">1 000 credits</div>
              <div className="text-xs text-gray-500 mb-4">Taux base 0,015€/credit — sans bonus, sans surprise</div>
              <ul className="text-sm text-gray-300 space-y-1 text-left">
                <li>≈ 250 messages WhatsApp IA</li>
                <li>≈ 66 minutes de Telephone IA</li>
                <li>≈ 15 articles SEO complets</li>
              </ul>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Mode degrade gracieux a 0 credit. Aucune surprise.
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
