import { Shield, Globe, Zap } from 'lucide-react'

const BADGES = [
  { icon: Shield, label: 'RGPD Conforme', desc: 'Donnees hebergees en France' },
  { icon: Shield, label: 'SSL / HTTPS', desc: 'Chiffrement bout en bout' },
  { icon: Globe, label: 'Hebergement FR', desc: 'Serveurs en Europe' },
  { icon: Zap, label: '99.9% Uptime', desc: 'Disponibilite garantie' },
]

export default function TrustBadges() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {BADGES.map((badge, i) => {
            const Icon = badge.icon
            return (
              <div key={i} className="text-center p-4 bg-dark-800/30 border border-white/5 rounded-xl">
                <Icon className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="font-semibold text-sm">{badge.label}</p>
                <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
