import { useState } from 'react';
import { Mail, Phone, MapPin, Send, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', business: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

      // Succès
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', business: '', message: '' });

    } catch (err: any) {
      console.error('Contact error:', err);
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-24 px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Message envoyé !</h2>
          <p className="text-gray-600 mb-6">
            Nous vous recontactons sous 24h pour planifier votre démo personnalisée.
          </p>
          <button onClick={() => setSubmitted(false)} className="text-cyan-600 hover:text-cyan-700 font-medium">
            Envoyer un autre message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-24" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Contactez-nous</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Une question ? Besoin d'une démo ? Notre équipe est là pour vous accompagner.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Parlons de votre projet</h2>

            <div className="space-y-6 mb-8">
              {[
                { icon: Mail, label: 'Email', value: 'contact@nexus.app', href: 'mailto:contact@nexus.app' },
                { icon: Phone, label: 'Telephone', value: '+33 7 60 53 76 94', href: 'tel:+33760537694' },
                { icon: MapPin, label: 'Localisation', value: '8 rue des Monts Rouges, 95130 Franconville', href: '' },
              ].map((c, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <c.icon className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">{c.label}</div>
                    {c.href ? (
                      <a href={c.href} className="text-cyan-600 hover:text-cyan-700">{c.value}</a>
                    ) : (
                      <div className="text-gray-600">{c.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-8 rounded-2xl text-white">
              <h3 className="text-xl font-bold mb-4">Démo Gratuite</h3>
              <p className="mb-6">Découvrez NEXUS en action avec une démo personnalisée de 30 minutes.</p>
              <ul className="space-y-2">
                {['Sans engagement', 'Adaptée à votre activité', 'Questions/réponses en direct'].map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              {[
                { id: 'name', label: 'Nom complet *', type: 'text', required: true, placeholder: 'Jean Dupont' },
                { id: 'email', label: 'Email *', type: 'email', required: true, placeholder: 'jean@exemple.fr' },
                { id: 'phone', label: 'Téléphone', type: 'tel', required: false, placeholder: '06 12 34 56 78' },
              ].map(f => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{f.label}</label>
                  <input
                    type={f.type}
                    required={f.required}
                    value={(formData as any)[f.id]}
                    onChange={e => setFormData({ ...formData, [f.id]: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type d'activité</label>
                <select
                  value={formData.business}
                  onChange={e => setFormData({ ...formData, business: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                >
                  <option value="">Sélectionnez...</option>
                  <option value="coiffure">Salon de coiffure</option>
                  <option value="beaute">Institut de beauté</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="hotel">Hôtel</option>
                  <option value="commerce">Commerce</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                <textarea
                  required
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none outline-none"
                  placeholder="Parlez-nous de votre projet..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Envoyer le message
                    <Send className="w-5 h-5" />
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                En envoyant ce formulaire, vous acceptez d'être recontacté par notre équipe.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
