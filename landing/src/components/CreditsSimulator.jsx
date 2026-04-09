/**
 * NEXUS AI — Simulateur de cout credits IA (révisé 9 avril 2026)
 *
 * Permet aux visiteurs de la landing d'estimer leur consommation mensuelle
 * de credits IA et de choisir entre Basic (1 000 cr inclus), Business (10 000 cr inclus),
 * et un pack additionnel unique Pack 1000 (15€/1000cr).
 */

import { useState, useMemo } from 'react'
import { Calculator, Phone, MessageCircle, Globe, Megaphone, FileText, Sparkles, ArrowRight } from 'lucide-react'

// Couts en credits — alignés avec backend/src/config/pricing.js (modele 2026)
const CREDIT_COSTS = {
  whatsapp: 4,        // 1 message WhatsApp IA = 4 credits
  webChat: 9,         // 1 conversation chat web = 9 credits (~5 messages)
  phoneMin: 15,       // 1 minute telephone IA = 15 credits
  socialPost: 9,      // 1 post reseaux sociaux genere = 9 credits
  email: 6,           // 1 email IA personnalise = 6 credits
  seoArticle: 66,     // 1 article SEO complet (1500 mots) = 66 credits
}

// Credits inclus par plan (source de verite : creditsService.js)
const BASIC_INCLUDED = 1000
const BUSINESS_INCLUDED = 10000

// Pack unique additionnel
const PACK_1000 = { credits: 1000, price: 15 }

// Prix mensuels
const BASIC_PRICE = 29
const BUSINESS_PRICE = 149

const USAGE_PRESETS = [
  {
    id: 'starter',
    label: 'Demarrage',
    description: 'Premiers tests, quelques canaux IA',
    values: { whatsapp: 100, webChat: 20, phoneMin: 30, socialPost: 0, email: 0, seoArticle: 0 },
  },
  {
    id: 'regular',
    label: 'Usage regulier',
    description: 'Activite stable, IA quotidienne',
    values: { whatsapp: 500, webChat: 100, phoneMin: 120, socialPost: 8, email: 50, seoArticle: 2 },
  },
  {
    id: 'intensive',
    label: 'Usage intensif',
    description: 'Marketing IA, telephone IA actif',
    values: { whatsapp: 1500, webChat: 300, phoneMin: 400, socialPost: 30, email: 200, seoArticle: 8 },
  },
]

const ITEMS = [
  { key: 'whatsapp', icon: MessageCircle, label: 'Messages WhatsApp IA', unit: 'msg/mois', cost: CREDIT_COSTS.whatsapp, costLabel: '4 cr / msg' },
  { key: 'webChat', icon: Globe, label: 'Conversations chat web', unit: 'conv/mois', cost: CREDIT_COSTS.webChat, costLabel: '9 cr / conv' },
  { key: 'phoneMin', icon: Phone, label: 'Minutes telephone IA', unit: 'min/mois', cost: CREDIT_COSTS.phoneMin, costLabel: '15 cr / min' },
  { key: 'socialPost', icon: Megaphone, label: 'Posts reseaux sociaux', unit: 'posts/mois', cost: CREDIT_COSTS.socialPost, costLabel: '9 cr / post' },
  { key: 'email', icon: FileText, label: 'Emails IA personnalises', unit: 'emails/mois', cost: CREDIT_COSTS.email, costLabel: '6 cr / email' },
  { key: 'seoArticle', icon: FileText, label: 'Articles SEO complets', unit: 'articles/mois', cost: CREDIT_COSTS.seoArticle, costLabel: '66 cr / article' },
]

export default function CreditsSimulator() {
  const [usage, setUsage] = useState(USAGE_PRESETS[1].values)
  const [activePreset, setActivePreset] = useState('regular')

  const totalCredits = useMemo(() => {
    return ITEMS.reduce((sum, item) => sum + (usage[item.key] || 0) * item.cost, 0)
  }, [usage])

  // Recommandation :
  //   • ≤ 1 000 cr    → Basic suffit (aucun pack nécessaire)
  //   • ≤ 10 000 cr   → Basic + n packs additionnels OU Business selon rentabilité
  //   • > 10 000 cr   → Business + packs 1000 pour le surplus
  const recommendation = useMemo(() => {
    if (totalCredits === 0) {
      return { type: 'none' }
    }

    // Option A : Basic + packs additionnels pour couvrir le besoin
    const basicOverflow = Math.max(0, totalCredits - BASIC_INCLUDED)
    const basicPacksNeeded = Math.ceil(basicOverflow / PACK_1000.credits)
    const basicTotalCost = BASIC_PRICE + basicPacksNeeded * PACK_1000.price

    // Option B : Business + packs additionnels
    const businessOverflow = Math.max(0, totalCredits - BUSINESS_INCLUDED)
    const businessPacksNeeded = Math.ceil(businessOverflow / PACK_1000.credits)
    const businessTotalCost = BUSINESS_PRICE + businessPacksNeeded * PACK_1000.price

    if (businessTotalCost < basicTotalCost) {
      return {
        type: 'business',
        cost: businessTotalCost,
        packsExtra: businessPacksNeeded,
        savings: basicTotalCost - businessTotalCost,
      }
    }

    return {
      type: 'basic',
      cost: basicTotalCost,
      packsExtra: basicPacksNeeded,
    }
  }, [totalCredits])

  const handleChange = (key, value) => {
    const num = Math.max(0, parseInt(value) || 0)
    setUsage((prev) => ({ ...prev, [key]: num }))
    setActivePreset(null)
  }

  const applyPreset = (preset) => {
    setUsage(preset.values)
    setActivePreset(preset.id)
  }

  return (
    <section id="simulateur" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-4">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-semibold">Simulateur de cout IA</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Combien va vous couter{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              l'IA NEXUS ?
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Basic inclut 1 000 credits/mois, Business inclut 10 000 credits/mois.
            Estimez votre consommation et nous vous dirons quel plan est le plus avantageux.
          </p>
        </div>

        {/* Presets rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {USAGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                activePreset === preset.id
                  ? 'border-neon-cyan bg-neon-cyan/10'
                  : 'border-white/10 bg-dark-800/50 hover:border-white/20'
              }`}
            >
              <div className="text-sm font-bold text-white mb-1">{preset.label}</div>
              <div className="text-xs text-gray-400">{preset.description}</div>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Colonne de gauche : sliders / inputs */}
          <div className="bg-dark-800/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">Votre consommation mensuelle</h3>
            <div className="space-y-4">
              {ITEMS.map((item) => {
                const Icon = item.icon
                const count = usage[item.key] || 0
                const subtotal = count * item.cost
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300 truncate">{item.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">{item.costLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        value={count}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        className="w-24 px-3 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-white text-sm focus:border-neon-cyan focus:outline-none"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                      <span className="ml-auto text-xs text-gray-400 font-mono">
                        = {subtotal.toLocaleString('fr-FR')} cr
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Colonne de droite : recommandation */}
          <div className="bg-gradient-to-b from-neon-cyan/5 to-dark-800/50 border border-neon-cyan/20 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-white">Notre recommandation</h3>

            <div className="text-center py-6">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Credits necessaires</div>
              <div className="text-5xl font-bold text-neon-cyan mb-2">
                {totalCredits.toLocaleString('fr-FR')}
              </div>
              <div className="text-sm text-gray-400">credits / mois</div>
            </div>

            {recommendation.type === 'none' ? (
              <div className="text-center text-sm text-gray-500 py-6">
                Ajustez votre consommation pour obtenir une recommandation.
              </div>
            ) : recommendation.type === 'business' ? (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5 mt-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 text-xs font-bold uppercase tracking-wider">
                    Plan Business recommande
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {recommendation.cost}€<span className="text-sm text-gray-400">/mois</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Plan Business {BUSINESS_PRICE}€ ({BUSINESS_INCLUDED.toLocaleString('fr-FR')} credits inclus, valeur 150€)
                  {recommendation.packsExtra > 0 && ` + ${recommendation.packsExtra} Pack 1000 additionnel${recommendation.packsExtra > 1 ? 's' : ''}`}.
                  {recommendation.savings > 0 && ` Economie de ${recommendation.savings}€/mois vs Basic + packs.`}
                </p>
                <a
                  href="https://app.nexus-ai-saas.com/signup?plan=business"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-purple-200"
                >
                  Choisir Business <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5 mt-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    Plan Basic {recommendation.packsExtra > 0 ? `+ ${recommendation.packsExtra} Pack 1000` : 'suffit'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {recommendation.cost}€<span className="text-sm text-gray-400">/mois</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Plan Basic {BASIC_PRICE}€ (tout illimite non-IA + {BASIC_INCLUDED} credits inclus)
                  {recommendation.packsExtra > 0 && ` + ${recommendation.packsExtra} Pack 1000 additionnel${recommendation.packsExtra > 1 ? 's' : ''} (${recommendation.packsExtra * PACK_1000.price}€)`}.
                </p>
                <a
                  href="https://app.nexus-ai-saas.com/signup?plan=basic"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Demarrer avec Basic <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6 max-w-2xl mx-auto">
          Estimation indicative. Mode degrade gracieux a 0 credit (les autres fonctions continuent de marcher).
          Pas de surfacturation, pas de surprise.
        </p>
      </div>
    </section>
  )
}
