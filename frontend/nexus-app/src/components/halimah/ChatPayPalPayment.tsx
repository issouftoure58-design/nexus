import { useEffect, useRef, useState } from 'react';
import { Wallet, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiUrl, getTenantFromHostname } from '@/lib/api-config';
import { useChatBooking } from '@/contexts/ChatBookingContext';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'AUw5vAue8y3MGk_adqVUzjXZejFrJh9QveHVNiF1yB5jr58oIYAgjLH6kYcyXwaeI5MUNVZkB_JNcO3-';

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function ChatPayPalPayment() {
  const { service, clientInfo, createOrder, goBack, formatPrice } = useChatBooking();
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // Charger le SDK PayPal
  useEffect(() => {
    const loadPayPalScript = () => {
      if (window.paypal) {
        setSdkReady(true);
        setLoading(false);
        return;
      }

      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setSdkReady(true);
          setLoading(false);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR&locale=fr_FR`;
      script.async = true;

      script.onload = () => {
        setSdkReady(true);
        setLoading(false);
      };

      script.onerror = () => {
        setError('Impossible de charger PayPal');
        setLoading(false);
      };

      document.body.appendChild(script);
    };

    loadPayPalScript();
  }, []);

  // Initialiser les boutons PayPal
  useEffect(() => {
    if (!sdkReady || !paypalRef.current || !window.paypal || !service) return;

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

        createOrder: async () => {
          try {
            const response = await fetch(apiUrl('/api/public/payment/create-paypal'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': getTenantFromHostname(),
              },
              body: JSON.stringify({
                amount: service.prix,
                clientEmail: clientInfo.email || '',
                clientName: `${clientInfo.prenom || ''} ${clientInfo.nom}`.trim(),
                items: [{ serviceNom: service.nom }],
              }),
            });

            const result = await response.json();

            if (!result.success) {
              throw new Error(result.error || 'Erreur creation commande PayPal');
            }

            return result.orderId;
          } catch (err: any) {
            console.error('Erreur creation PayPal:', err);
            setError(err.message || 'Erreur lors de la creation du paiement');
            throw err;
          }
        },

        onApprove: async (data: { orderID: string }) => {
          try {
            const response = await fetch(apiUrl('/api/public/payment/capture-paypal'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': getTenantFromHostname(),
              },
              body: JSON.stringify({
                orderId: data.orderID,
              }),
            });

            const result = await response.json();

            if (!result.success) {
              throw new Error(result.error || 'Erreur capture paiement');
            }

            // Creer la commande avec l'ID PayPal
            await createOrder(result.payment.orderId);
          } catch (err: any) {
            console.error('Erreur capture PayPal:', err);
            setError(err.message || 'Erreur lors de la finalisation du paiement');
          }
        },

        onCancel: () => {
          goBack();
        },

        onError: (err: any) => {
          console.error('Erreur PayPal:', err);
          setError('Une erreur est survenue avec PayPal');
        },
      })
      .render(paypalRef.current);
  }, [sdkReady, service, clientInfo]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-amber-200 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span className="ml-2 text-zinc-500">Chargement de PayPal...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Erreur PayPal</span>
        </div>
        <p className="text-zinc-600 mb-4">{error}</p>
        <button
          onClick={goBack}
          className="w-full py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50
            flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
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
            <Wallet className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-zinc-700">Paiement PayPal</span>
          </div>
          <span className="text-lg font-bold text-amber-600">
            {service && formatPrice(service.prix)}
          </span>
        </div>
      </div>

      {/* PayPal Buttons */}
      <div className="p-4">
        <div ref={paypalRef} className="min-h-[50px]" />

        <button
          onClick={goBack}
          className="w-full mt-4 py-2 border border-zinc-300 text-zinc-600 rounded-lg
            hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Choisir un autre mode de paiement
        </button>

        <p className="text-xs text-center text-zinc-400 mt-3">
          Paiement securise via PayPal
        </p>
      </div>
    </div>
  );
}
