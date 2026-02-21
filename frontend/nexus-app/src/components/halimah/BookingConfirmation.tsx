import { CheckCircle2, Calendar, Clock, MapPin, User, CreditCard, Phone } from 'lucide-react';
import { useChatBooking } from '@/contexts/ChatBookingContext';

export default function BookingConfirmation() {
  const {
    service,
    selectedDate,
    selectedTime,
    clientInfo,
    paymentMethod,
    orderId,
    formatPrice,
    formatDuration,
    resetBooking,
  } = useChatBooking();

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const date = new Date(selectedDate);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getPaymentLabel = () => {
    switch (paymentMethod) {
      case 'sur_place':
        return 'Paiement sur place';
      case 'stripe':
        return 'Carte bancaire';
      case 'paypal':
        return 'PayPal';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden">
      {/* Header succes */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-6 text-white text-center">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-white/20 rounded-full">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
        <h3 className="text-xl font-bold">Reservation confirmee !</h3>
        <p className="text-green-100 mt-1">
          Vous allez recevoir une confirmation par SMS
        </p>
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* Service */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
          <div className="p-2 bg-amber-100 rounded-full text-amber-600">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-zinc-800">{service?.nom}</div>
            <div className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
              <Clock className="h-3.5 w-3.5" />
              {service && formatDuration(service.duree)}
            </div>
          </div>
          <div className="text-amber-600 font-bold">
            {service && formatPrice(service.prix)}
          </div>
        </div>

        {/* Date & Heure */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <div className="p-2 bg-zinc-200 rounded-full text-zinc-600">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-zinc-800 capitalize">
              {formatSelectedDate()}
            </div>
            <div className="text-sm text-zinc-500">a {selectedTime}</div>
          </div>
        </div>

        {/* Lieu */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <div className="p-2 bg-zinc-200 rounded-full text-zinc-600">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-zinc-800">Chez Fatou</div>
            <div className="text-sm text-zinc-500">Adresse communiquee par SMS</div>
          </div>
        </div>

        {/* Client */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <div className="p-2 bg-zinc-200 rounded-full text-zinc-600">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-zinc-800">
              {clientInfo.prenom && `${clientInfo.prenom} `}{clientInfo.nom}
            </div>
            <div className="text-sm text-zinc-500 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {clientInfo.telephone}
            </div>
          </div>
        </div>

        {/* Paiement */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
          <div className="p-2 bg-zinc-200 rounded-full text-zinc-600">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-zinc-800">{getPaymentLabel()}</div>
            {paymentMethod === 'sur_place' && (
              <div className="text-sm text-zinc-500">A regler lors du rendez-vous</div>
            )}
            {(paymentMethod === 'stripe' || paymentMethod === 'paypal') && (
              <div className="text-sm text-green-600">Paiement effectue</div>
            )}
          </div>
        </div>
      </div>

      {/* Numero de reservation */}
      {orderId && (
        <div className="mx-4 mb-4 p-3 bg-zinc-100 rounded-lg text-center">
          <span className="text-xs text-zinc-500">Numero de reservation</span>
          <div className="font-mono font-bold text-zinc-700">#{orderId}</div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-t border-zinc-100">
        <button
          onClick={resetBooking}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500
            text-white font-medium rounded-lg shadow-md
            hover:from-amber-600 hover:to-orange-600 transition-all"
        >
          Nouvelle reservation
        </button>
      </div>
    </div>
  );
}
