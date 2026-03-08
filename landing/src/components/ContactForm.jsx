import { Send, Calendar } from 'lucide-react'

export default function ContactForm() {
  return (
    <section className="py-20 px-4" id="contact">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Contactez-nous
          </h2>
          <p className="text-gray-400">Une question ? Demandez une demo personnalisee.</p>
          <a
            href="https://calendly.com/nexus-saas/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-neon-cyan hover:text-white transition-colors text-sm font-medium"
          >
            <Calendar className="w-4 h-4" />
            Ou reservez directement un creneau demo
          </a>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.target
            alert('Merci ! Nous vous recontactons sous 24h.')
            form.reset()
          }}
          className="bg-dark-800/50 border border-white/10 rounded-2xl p-8 space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Nom *</label>
              <input name="nom" required className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none" placeholder="Votre nom" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Email *</label>
              <input name="email" type="email" required className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none" placeholder="votre@email.com" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Type de business</label>
            <select name="business_type" className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan/50 focus:outline-none">
              <option value="">Selectionnez...</option>
              <option value="salon">Salon de coiffure</option>
              <option value="restaurant">Restaurant</option>
              <option value="hotel">Hotel</option>
              <option value="beaute">Institut beaute</option>
              <option value="service">Service a domicile</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Message *</label>
            <textarea name="message" required rows={4} className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none resize-none" placeholder="Decrivez votre besoin..." />
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Envoyer
          </button>
        </form>
      </div>
    </section>
  )
}
