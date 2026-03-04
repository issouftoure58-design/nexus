import { useState } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Lock } from 'lucide-react';

// Clé publique Stripe (depuis env ou hardcoded pour dev)
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SqH6eKFWxw28loTNqPdGNqVtDFjIGdKnNIECb2OYLLZlHZ3qVkHvvZm6RcH4R3cHnKrVDqHMxKHhLxjWjGm0vk500NvGr5FSJ'
);

interface StripePaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

// Composant interne avec les hooks Stripe
function CheckoutForm({ amount, onSuccess, onError, onCancel }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/panier?payment=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setErrorMessage(error.message || 'Une erreur est survenue');
        } else {
          setErrorMessage('Une erreur inattendue est survenue');
        }
        onError(error.message || 'Erreur de paiement');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // 3D Secure ou autre action requise - géré automatiquement par Stripe
        setErrorMessage('Action supplémentaire requise. Veuillez suivre les instructions.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage('Erreur lors du paiement');
      onError('Erreur lors du paiement');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-zinc-50 rounded-xl p-4 border">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
        <Lock className="h-3 w-3" />
        <span>Paiement sécurisé par Stripe</span>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-amber-500 hover:bg-amber-600"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Payer {formatPrice(amount)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Composant wrapper avec le Provider Stripe
export default function StripePaymentForm({
  clientSecret,
  amount,
  onSuccess,
  onError,
  onCancel,
}: StripePaymentFormProps) {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#f59e0b',
        colorBackground: '#ffffff',
        colorText: '#18181b',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
    locale: 'fr' as const,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  );
}

// Export du provider pour utilisation externe si nécessaire
export { stripePromise };
