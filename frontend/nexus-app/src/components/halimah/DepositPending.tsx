import { Clock, Calendar, MapPin, User, Phone, CreditCard, MessageSquare } from 'lucide-react';
import { useChatBooking } from '@/contexts/ChatBookingContext';

export default function DepositPending() {
  const {
    service,
    selectedDate,
    selectedTime,
    clientInfo,
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

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header acompte */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-6 text-white text-center">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-white/20 rounded-full">
            <CreditCard className="h-8 w-8" />
          </div>
        </div>
        <h3 className="text-xl font-bold">Acompte requis</h3>
        <p className="text-amber-100 mt-1">
          Un lien de paiement vous a ete envoye par SMS
        </p>
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* Info acompte */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="p-2 bg-amber-100 rounded-full text-amber-600">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-amber-800">Consultez vos SMS</div>
            <div className="text-sm text-amber-700 mt-1">
              Votre reservation sera confirmee des reception du paiement de l'acompte.
            </div>
          </div>
        </div>

        {/* Service */}
        <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
          <div className="p-2 bg-zinc-200 rounded-full text-zinc-600">
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
            <div className="font-medium text-zinc-800">Sur place</div>
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
