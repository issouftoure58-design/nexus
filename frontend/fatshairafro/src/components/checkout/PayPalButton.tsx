import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-config';
import { Loader2, AlertCircle } from 'lucide-react';

// PayPal Client ID (sandbox ou live)
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'AUw5vAue8y3MGk_adqVUzjXZejFrJh9QveHVNiF1yB5jr58oIYAgjLH6kYcyXwaeI5MUNVZkB_JNcO3-';

interface PayPalButtonProps {
  amount: number; // en centimes
  onSuccess: (captureId: string, orderId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  clientEmail?: string;
  clientName?: string;
  items?: Array<{ serviceNom: string }>;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalButton({
  amount,
  onSuccess,
  onError,
  onCancel,
  clientEmail,
  clientName,
  items,
}: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // Charger le SDK PayPal
  useEffect(() => {
    const loadPayPalScript = () => {
      // Vérifier si le script est déjà chargé
      if (window.paypal) {
        setSdkReady(true);
        setLoading(false);
        return;
      }

      // Vérifier si le script est en cours de chargement
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setSdkReady(true);
          setLoading(false);
        });
        return;
      }

      // Créer et charger le script
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR&locale=fr_FR`;
      script.async = true;

      script.onload = () => {
        setSdkReady(true);
        setLoading(false);
      };

      script.onerror = () => {
        setError('Impossible de charger PayPal. Veuillez réessayer.');
        setLoading(false);
      };

      document.body.appendChild(script);
    };

    loadPayPalScript();
  }, []);

  // Initialiser les boutons PayPal une fois le SDK prêt
  useEffect(() => {
    if (!sdkReady || !paypalRef.current || !window.paypal) return;

    // Nettoyer les boutons existants
    paypalRef.current.innerHTML = '';

    window.paypal
      .Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 45,
        },

        // Créer la commande PayPal
        createOrder: async () => {
          try {
            const response = await fetch(apiUrl('/api/payment/order/create-paypal'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount,
                clientEmail,
                clientName,
                items,
              }),
            });

            const result = await response.json();

            if (!result.success) {
              throw new Error(result.error || 'Erreur création commande PayPal');
            }

            return result.orderId;
          } catch (err: any) {
            console.error('Erreur création PayPal:', err);
            onError(err.message || 'Erreur lors de la création du paiement');
            throw err;
          }
        },

        // Capturer le paiement après approbation
        onApprove: async (data: { orderID: string }) => {
          try {
            const response = await fetch(apiUrl('/api/payment/order/capture-paypal'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderID,
              }),
            });

            const result = await response.json();

            if (!result.success) {
              throw new Error(result.error || 'Erreur capture paiement');
            }

            onSuccess(result.payment.captureId, result.payment.orderId);
          } catch (err: any) {
            console.error('Erreur capture PayPal:', err);
            onError(err.message || 'Erreur lors de la finalisation du paiement');
          }
        },

        // Annulation par l'utilisateur
        onCancel: () => {
          onCancel();
        },

        // Erreur PayPal
        onError: (err: any) => {
          console.error('Erreur PayPal:', err);
          onError('Une erreur est survenue avec PayPal. Veuillez réessayer.');
        },
      })
      .render(paypalRef.current);
  }, [sdkReady, amount, clientEmail, clientName, items, onSuccess, onError, onCancel]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="ml-3 text-zinc-600">Chargement de PayPal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-700 font-medium">Erreur PayPal</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-zinc-500 mb-2">
        Montant : <span className="font-semibold text-zinc-700">{formatPrice(amount)}</span>
      </div>
      <div ref={paypalRef} className="min-h-[50px]" />
      <p className="text-xs text-center text-zinc-400">
        Paiement sécurisé via PayPal
      </p>
    </div>
  );
}
