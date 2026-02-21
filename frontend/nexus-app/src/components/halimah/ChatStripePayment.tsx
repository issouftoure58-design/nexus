import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-config';
import { useChatBooking } from '@/contexts/ChatBookingContext';

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : null;

function StripeForm({ clientSecret, onSuccess, onCancel }: {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Erreur de paiement');
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-zinc-300 text-zinc-700
            font-medium rounded-lg hover:bg-zinc-50 transition-colors
            flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500
            text-white font-medium rounded-lg shadow-md
            hover:from-amber-600 hover:to-orange-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Paiement...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Payer
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function ChatStripePayment() {
  const { service, clientInfo, createOrder, goBack, formatPrice } = useChatBooking();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createPaymentIntent();
  }, []);

  const createPaymentIntent = async () => {
    if (!service) return;

    try {
      const response = await apiFetch('/api/payment/order/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: service.prix,
          clientEmail: clientInfo.email || '',
          clientName: `${clientInfo.prenom || ''} ${clientInfo.nom}`.trim(),
          items: [{ serviceNom: service.nom }],
        }),
      });

      const data = await response.json();

      if (data.success && data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.error || 'Erreur initialisation paiement');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur reseau');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async (paymentIntentId: string) => {
    await createOrder(paymentIntentId);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-amber-200 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="ml-2 text-zinc-500">Preparation du paiement...</span>
        </div>
      </div>
    );
  }

  if (error || !clientSecret || !stripePromise) {
    return (
      <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Erreur</span>
        </div>
        <p className="text-zinc-600 mb-4">{error || 'Stripe non configure'}</p>
        <button
          onClick={goBack}
          className="w-full py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-zinc-700">Paiement par carte</span>
          </div>
          <span className="text-lg font-bold text-amber-600">
            {service && formatPrice(service.prix)}
          </span>
        </div>
      </div>

      {/* Stripe Form */}
      <div className="p-4">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#f59e0b',
                borderRadius: '8px',
              },
            },
            locale: 'fr',
          }}
        >
          <StripeForm
            clientSecret={clientSecret}
            onSuccess={handleSuccess}
            onCancel={goBack}
          />
        </Elements>
      </div>
    </div>
  );
}
