import { CreditCard, Wallet, Banknote, Calendar, Clock, MapPin } from 'lucide-react';
import { useChatBooking, PaymentMethod } from '@/contexts/ChatBookingContext';

export default function PaymentSelector() {
  const {
    service,
    selectedDate,
    selectedTime,
    clientInfo,
    selectPaymentMethod,
    createOrder,
    formatPrice,
    formatDuration,
  } = useChatBooking();

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const handleSelect = async (method: PaymentMethod) => {
    selectPaymentMethod(method);

    // Pour paiement sur place, créer directement la commande
    if (method === 'sur_place') {
      await createOrder();
    }
    // Pour Stripe/PayPal, le composant de paiement sera affiché par InteractiveMessage
  };

  const paymentOptions = [
    {
      id: 'sur_place' as PaymentMethod,
      label: 'Payer sur place',
      description: 'Reglement lors du rendez-vous',
      icon: Banknote,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      hoverBg: 'hover:bg-emerald-50',
      hoverBorder: 'hover:border-emerald-400',
    },
    {
      id: 'stripe' as PaymentMethod,
      label: 'Carte bancaire',
      description: 'Paiement securise par carte',
      icon: CreditCard,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      hoverBg: 'hover:bg-blue-50',
      hoverBorder: 'hover:border-blue-400',
    },
    {
      id: 'paypal' as PaymentMethod,
      label: 'PayPal',
      description: 'Paiement via votre compte PayPal',
      icon: Wallet,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      hoverBg: 'hover:bg-amber-50',
      hoverBorder: 'hover:border-amber-400',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-zinc-700">Mode de paiement</span>
        </div>

        {/* Recapitulatif complet */}
        <div className="bg-white/60 rounded-lg p-3 space-y-2">
          {/* Service */}
          <div className="flex justify-between items-start">
            <span className="font-medium text-zinc-700">{service?.nom}</span>
            <span className="text-amber-600 font-semibold">
              {service && formatPrice(service.prix)}
            </span>
          </div>

          {/* Date & Heure */}
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="capitalize">{formatSelectedDate()}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {selectedTime}
            </span>
          </div>

          {/* Lieu */}
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>Chez Fatou</span>
          </div>

          {/* Client */}
          <div className="text-sm text-zinc-500 pt-1 border-t border-zinc-100">
            {clientInfo.prenom && `${clientInfo.prenom} `}{clientInfo.nom} - {clientInfo.telephone}
          </div>
        </div>
      </div>

      {/* Options de paiement */}
      <div className="p-4 space-y-3">
        {paymentOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all
                ${option.hoverBorder} ${option.hoverBg}
                border-zinc-200 bg-white
                flex items-center gap-4 text-left group`}
            >
              <div className={`p-3 rounded-full ${option.iconBg} ${option.iconColor} transition-colors`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-800">{option.label}</div>
                <div className="text-sm text-zinc-500">{option.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Total */}
      <div className="px-4 pb-4">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total a payer</span>
            <span className="text-2xl font-bold">
              {service && formatPrice(service.prix)}
            </span>
          </div>
          <div className="text-amber-100 text-sm mt-1">
            Duree: {service && formatDuration(service.duree)}
          </div>
        </div>
      </div>
    </div>
  );
}
