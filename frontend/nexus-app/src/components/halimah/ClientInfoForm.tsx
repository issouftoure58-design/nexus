import { useState } from 'react';
import { User, Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useChatBooking } from '@/contexts/ChatBookingContext';

export default function ClientInfoForm() {
  const { setClientInfo, service, selectedDate, selectedTime, formatPrice, formatDuration } = useChatBooking();

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/[\s.-]/g, '');
    const regex = /^(?:0[1-9][0-9]{8}|\+33[1-9][0-9]{8})$/;
    return regex.test(cleaned);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }

    if (!form.telephone.trim()) {
      newErrors.telephone = 'Le telephone est requis';
    } else if (!validatePhone(form.telephone)) {
      newErrors.telephone = 'Format invalide (ex: 0612345678)';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    setSubmitting(true);

    // Nettoyer le telephone
    const cleanedPhone = form.telephone.replace(/[\s.-]/g, '');

    setClientInfo({
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      telephone: cleanedPhone,
      email: form.email.trim() || undefined,
    });
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-zinc-700">Vos coordonnees</span>
        </div>

        {/* Recapitulatif */}
        {service && selectedDate && selectedTime && (
          <div className="mt-2 p-2 bg-white/60 rounded-lg text-sm">
            <div className="font-medium text-zinc-700">{service.nom}</div>
            <div className="text-zinc-500 flex items-center gap-2 mt-0.5">
              <span className="capitalize">{formatSelectedDate()}</span>
              <span>a</span>
              <span className="font-medium text-amber-600">{selectedTime}</span>
            </div>
            <div className="text-amber-600 font-semibold mt-1">
              {formatPrice(service.prix)} - {formatDuration(service.duree)}
            </div>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <div className="p-4 space-y-4">
        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Votre nom"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                errors.nom ? 'border-red-300 bg-red-50' : 'border-zinc-200'
              } focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all`}
            />
          </div>
          {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
        </div>

        {/* Prenom */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Prenom
          </label>
          <input
            type="text"
            value={form.prenom}
            onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            placeholder="Votre prenom (optionnel)"
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-200
              focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
          />
        </div>

        {/* Telephone */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Telephone <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="tel"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              placeholder="06 12 34 56 78"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                errors.telephone ? 'border-red-300 bg-red-50' : 'border-zinc-200'
              } focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all`}
            />
          </div>
          {errors.telephone && <p className="text-red-500 text-xs mt-1">{errors.telephone}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="votre@email.com (optionnel)"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-zinc-200'
              } focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all`}
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500
            text-white font-medium rounded-lg shadow-md
            hover:from-amber-600 hover:to-orange-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validation...
            </>
          ) : (
            <>
              Continuer
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
