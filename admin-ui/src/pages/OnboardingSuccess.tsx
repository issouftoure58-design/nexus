import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function OnboardingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/login', { replace: true });
      return;
    }

    api.post('/billing/verify-checkout', { session_id: sessionId })
      .then(() => setStatus('success'))
      .catch(() => setStatus('success')); // Even if verify fails, show success (Stripe webhook handles it)

    // Auto-redirect after 4s
    const timer = setTimeout(() => {
      navigate('/configuration', { replace: true });
    }, 4000);

    return () => clearTimeout(timer);
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50">
      <div className="text-center max-w-md mx-auto p-8">
        {status === 'verifying' ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-cyan-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Validation du paiement...</h1>
            <p className="text-gray-500">Un instant, nous configurons votre compte.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Paiement confirmé !</h1>
            <p className="text-gray-500 mb-6">
              Votre abonnement est actif. Vous allez être redirigé vers la configuration de votre espace.
            </p>
            <button
              onClick={() => navigate('/configuration', { replace: true })}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all"
            >
              Configurer mon espace
            </button>
          </>
        )}
      </div>
    </div>
  );
}
