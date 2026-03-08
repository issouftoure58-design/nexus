import { Star } from 'lucide-react'

const TESTIMONIALS = [
  { name: 'Sophie L.', role: 'Salon de coiffure, Paris', quote: 'Depuis que j\'ai NEXUS, mes reservations se font automatiquement via WhatsApp. Je gagne 2h par jour !', rating: 5 },
  { name: 'Marc D.', role: 'Restaurant, Lyon', quote: 'L\'assistant telephone IA prend les reservations quand on est en service. Plus aucun appel manque.', rating: 5 },
  { name: 'Amelie R.', role: 'Institut beaute, Bordeaux', quote: 'La comptabilite et la gestion d\'equipe simplifiees. Mon expert-comptable est impressionne par les exports.', rating: 5 },
]

export default function TestimonialsSection() {
  return (
    <section className="py-20 px-4" id="temoignages">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ils nous font{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              confiance
            </span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">Des professionnels comme vous utilisent NEXUS au quotidien</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-dark-800/50 border border-white/10 rounded-2xl p-6 hover:border-neon-cyan/30 transition-colors">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-primary-500 flex items-center justify-center text-white font-bold text-sm">
                  {t.name[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
