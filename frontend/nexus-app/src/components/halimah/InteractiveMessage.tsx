import { useChatBooking } from '@/contexts/ChatBookingContext';
import ServiceSelector from './ServiceSelector';
import DayCalendar from './DayCalendar';
import ClientInfoForm from './ClientInfoForm';
import PaymentSelector from './PaymentSelector';
import ChatStripePayment from './ChatStripePayment';
import ChatPayPalPayment from './ChatPayPalPayment';
import BookingConfirmation from './BookingConfirmation';
import { Loader2 } from 'lucide-react';

export default function InteractiveMessage() {
  const { stage, paymentMethod } = useChatBooking();

  // Rendu selon l'etape du booking
  switch (stage) {
    case 'idle':
      return null;

    case 'service':
      return <ServiceSelector />;

    case 'date':
      return <DayCalendar />;

    case 'client':
      return <ClientInfoForm />;

    case 'payment':
      // Si methode selectionnee, afficher le formulaire correspondant
      if (paymentMethod === 'stripe') {
        return <ChatStripePayment />;
      }
      if (paymentMethod === 'paypal') {
        return <ChatPayPalPayment />;
      }
      // Sinon afficher le selecteur
      return <PaymentSelector />;

    case 'processing':
      return (
        <div className="bg-white rounded-xl p-6 border border-amber-200 shadow-sm">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="ml-2 text-zinc-500">Finalisation de votre reservation...</span>
          </div>
        </div>
      );

    case 'confirmed':
      return <BookingConfirmation />;

    case 'error':
      return (
        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
          <div className="text-red-600 text-center">
            Une erreur est survenue. Veuillez reessayer.
          </div>
        </div>
      );

    default:
      return null;
  }
}
