import { ChevronRight } from 'lucide-react'

const FAQS = [
  { q: 'Puis-je essayer NEXUS gratuitement ?', a: 'Oui ! Essai gratuit de 14 jours sans carte bancaire. Annulez a tout moment.' },
  { q: 'Quels types de business supportez-vous ?', a: 'Salons de coiffure, restaurants, hotels, instituts beaute, services a domicile, consultants, et bien d\'autres PME.' },
  { q: 'L\'assistant IA comprend-il le francais ?', a: 'Parfaitement. Nos assistants WhatsApp, telephone et web communiquent naturellement en francais.' },
  { q: 'Mes donnees sont-elles securisees ?', a: 'Absolument. Hebergement en France, chiffrement SSL, conformite RGPD. Chaque tenant est completement isole.' },
  { q: 'Puis-je changer de plan a tout moment ?', a: 'Oui, vous pouvez upgrader ou downgrader votre plan a tout moment. La facturation est ajustee au prorata.' },
  { q: 'Comment fonctionne le support ?', a: 'Support par email pour tous les plans, support prioritaire pour Pro, et account manager dedie pour Business.' },
]

export default function FAQSection() {
  return (
    <section className="py-20 px-4" id="faq">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Questions{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              frequentes
            </span>
          </h2>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <details key={i} className="group bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors">
                <span className="font-medium text-sm">{faq.q}</span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
