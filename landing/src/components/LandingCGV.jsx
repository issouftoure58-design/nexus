import { useEffect, useState } from 'react'

export default function LandingCGV() {
  const [cgv, setCgv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/cgv')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch CGV')
        return res.json()
      })
      .then(data => setCgv(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !cgv) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Impossible de charger les CGV. Veuillez reessayer plus tard.</p>
        <p className="text-sm mt-2">
          Contact : <a href="mailto:nexussentinelai@yahoo.com" className="text-neon-cyan hover:underline">nexussentinelai@yahoo.com</a>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
      <div>
        <h2 className="text-2xl font-bold text-white">Conditions Generales de Vente</h2>
        <p className="text-gray-500 text-xs mt-1">
          Version {cgv.version} — Mise a jour le {cgv.updated_at}
        </p>
      </div>

      {cgv.articles.map(article => (
        <section key={article.numero} className="bg-white/5 rounded-lg border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white mb-2">
            Article {article.numero} — {article.titre}
          </h3>
          <p className="whitespace-pre-line">{article.contenu}</p>
        </section>
      ))}

      <p className="text-gray-500 text-xs pt-4 border-t border-white/10">
        NEXUS AI — SASU — SIRET 947 570 362 00022
      </p>
    </div>
  )
}
