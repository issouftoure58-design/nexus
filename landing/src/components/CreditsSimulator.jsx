/**
 * NEXUS AI — Simulateur de cout IA (revise 21 avril 2026)
 *
 * Permet aux visiteurs de la landing d'estimer leur consommation mensuelle
 * et de choisir entre Starter (69€), Pro (199€), Business (499€) et Enterprise (899€).
 * Les credits internes ne sont JAMAIS montres au client.
 */

import { useState, useMemo } from 'react'
import { Calculator, Phone, MessageCircle, Globe, Megaphone, FileText, Sparkles, ArrowRight } from 'lucide-react'

// Couts en credits — internes uniquement (JAMAIS visible client)
const CREDIT_COSTS = {
  whatsapp: 7,        // 1 message WhatsApp IA = 7 credits
  webChat: 12,        // 1 conversation chat web = 12 credits (~5 messages)
  phoneMin: 18,       // 1 minute telephone IA = 18 credits
  socialPost: 12,     // 1 post reseaux sociaux genere = 12 credits
  email: 9,           // 1 email IA personnalise = 9 credits
  seoArticle: 69,     // 1 article SEO complet (1500 mots) = 69 credits
}

// Credits inclus par plan — internes (JAMAIS visible client)
const STARTER_INCLUDED = 4000
const PRO_INCLUDED = 20000
const BUSINESS_INCLUDED = 50000
const ENTERPRISE_INCLUDED = 100000

// Prix mensuels
const STARTER_PRICE = 69
const PRO_PRICE = 199
const BUSINESS_PRICE = 499
const ENTERPRISE_PRICE = 899

const USAGE_PRESETS = [
  {
    id: 'light',
    label: 'Demarrage',
    description: 'Premiers tests, quelques canaux IA',
    values: { whatsapp: 50, webChat: 10, phoneMin: 15, socialPost: 0, email: 0, seoArticle: 0 },
  },
  {
    id: 'regular',
    label: 'Usage regulier',
    description: 'Activite stable, IA quotidienne',
    values: { whatsapp: 300, webChat: 60, phoneMin: 80, socialPost: 8, email: 30, seoArticle: 2 },
  },
  {
    id: 'intensive',
    label: 'Usage intensif',
    description: 'Marketing IA, telephone IA actif',
    values: { whatsapp: 1500, webChat: 300, phoneMin: 400, socialPost: 30, email: 200, seoArticle: 8 },
  },
]

const ITEMS = [
  { key: 'whatsapp', icon: MessageCircle, label: 'Messages WhatsApp IA', unit: 'msg/mois' },
  { key: 'webChat', icon: Globe, label: 'Conversations chat web', unit: 'conv/mois' },
  { key: 'phoneMin', icon: Phone, label: 'Minutes telephone IA', unit: 'min/mois' },
  { key: 'socialPost', icon: Megaphone, label: 'Posts reseaux sociaux', unit: 'posts/mois' },
  { key: 'email', icon: FileText, label: 'Emails IA personnalises', unit: 'emails/mois' },
  { key: 'seoArticle', icon: FileText, label: 'Articles SEO complets', unit: 'articles/mois' },
]

export default function CreditsSimulator() {
  const [usage, setUsage] = useState(USAGE_PRESETS[1].values)
  const [activePreset, setActivePreset] = useState('regular')

  // Total credits internes (pour la logique de recommandation uniquement)
  const totalCredits = useMemo(() => {
    return ITEMS.reduce((sum, item) => sum + (usage[item.key] || 0) * CREDIT_COSTS[item.key], 0)
  }, [usage])

  // Recommandation basee sur les credits internes
  const recommendation = useMemo(() => {
    if (totalCredits === 0) {
      return { type: 'none' }
    }

    if (totalCredits <= STARTER_INCLUDED) {
      return {
        type: 'starter',
        cost: STARTER_PRICE,
        description: 'Votre usage rentre dans le plan Starter.',
      }
    }

    if (totalCredits <= PRO_INCLUDED) {
      return {
        type: 'pro',
        cost: PRO_PRICE,
        description: 'Votre usage necessite le plan Pro pour une couverture optimale.',
      }
    }

    if (totalCredits <= BUSINESS_INCLUDED) {
      return {
        type: 'business',
        cost: BUSINESS_PRICE,
        description: 'Votre usage intensif est couvert par le plan Business.',
      }
    }

    if (totalCredits <= ENTERPRISE_INCLUDED) {
      return {
        type: 'enterprise',
        cost: ENTERPRISE_PRICE,
        description: 'Votre usage est couvert par le plan Enterprise.',
      }
    }

    // Au-dela de Enterprise included
    return {
      type: 'enterprise_plus',
      cost: ENTERPRISE_PRICE,
      description: 'Votre usage depasse les inclusions Enterprise. Un pack d\'utilisation supplementaire sera necessaire.',
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

  const getRecommendedPlan = () => {
    if (recommendation.type === 'starter') return 'starter'
    if (recommendation.type === 'pro') return 'pro'
    if (recommendation.type === 'business') return 'business'
    return 'enterprise'
  }

  const getRecommendedColor = () => {
    if (recommendation.type === 'starter') return { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', icon: 'text-cyan-400' }
    if (recommendation.type === 'pro') return { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', icon: 'text-cyan-400' }
    if (recommendation.type === 'business') return { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', icon: 'text-purple-400' }
    return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'text-amber-400' }
  }

  const getRecommendedLabel = () => {
    if (recommendation.type === 'starter') return 'Plan Starter recommande'
    if (recommendation.type === 'pro') return 'Plan Pro recommande'
    if (recommendation.type === 'business') return 'Plan Business recommande'
    if (recommendation.type === 'enterprise') return 'Plan Enterprise recommande'
    return 'Plan Enterprise + supplement recommande'
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
            Estimez votre consommation mensuelle et decouvrez quel plan est le plus adapte a vos besoins.
            Starter a 69€, Pro a 199€, Business a 499€ ou Enterprise a 899€ — nous vous guidons.
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
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300 truncate">{item.label}</span>
                      </div>
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
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Colonne de droite : recommandation */}
          <div className="bg-gradient-to-b from-neon-cyan/5 to-dark-800/50 border border-neon-cyan/20 rounded-2xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-white">Notre recommandation</h3>

            {recommendation.type === 'none' ? (
              <div className="text-center text-sm text-gray-500 py-6 flex-1 flex items-center justify-center">
                Ajustez votre consommation pour obtenir une recommandation.
              </div>
            ) : (
              <div className={`${getRecommendedColor().bg} border ${getRecommendedColor().border} rounded-xl p-5 mt-auto`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={`w-4 h-4 ${getRecommendedColor().icon}`} />
                  <span className={`${getRecommendedColor().text} text-xs font-bold uppercase tracking-wider`}>
                    {getRecommendedLabel()}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {recommendation.cost}€<span className="text-sm text-gray-400">/mois</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {recommendation.description}
                </p>
                <a
                  href={`https://app.nexus-ai-saas.com/signup?plan=${getRecommendedPlan()}`}
                  className={`inline-flex items-center gap-2 text-sm font-semibold ${
                    recommendation.type === 'starter' || recommendation.type === 'pro'
                      ? 'text-cyan-300 hover:text-cyan-200'
                      : recommendation.type === 'business'
                        ? 'text-purple-300 hover:text-purple-200'
                        : 'text-amber-300 hover:text-amber-200'
                  }`}
                >
                  Choisir {recommendation.type === 'starter' ? 'Starter' : recommendation.type === 'pro' ? 'Pro' : recommendation.type === 'business' ? 'Business' : 'Enterprise'} <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6 max-w-2xl mx-auto">
          Estimation indicative. L'usage IA est inclus dans votre plan. Si vous depassez les limites,
          des packs d'utilisation supplementaire sont disponibles (50€ / 200€ / 500€ avec reductions).
        </p>
      </div>
    </section>
  )
}
