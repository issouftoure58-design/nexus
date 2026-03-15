import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';

export default function SSOCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    console.log('[SSO] Callback reached', { code: code?.substring(0, 10), state: state?.substring(0, 10) });

    if (!code) {
      console.error('[SSO] No code in URL');
      setError('Code d\'autorisation manquant');
      return;
    }

    const ssoState = localStorage.getItem('nexus_sso_state');
    console.log('[SSO] Stored state:', ssoState);

    if (!ssoState) {
      console.error('[SSO] No SSO state in localStorage');
      setError('Session SSO expirée');
      return;
    }

    const { tenant_id, provider_id, state: savedState } = JSON.parse(ssoState);

    if (state !== savedState) {
      console.error('[SSO] State mismatch', { received: state, saved: savedState });
      setError('State SSO invalide (possible attaque CSRF)');
      return;
    }

    console.log('[SSO] Exchanging code for token...', { tenant_id, provider_id });

    api.post<{ token: string; admin: { id: string; email: string; nom: string; role: string; tenant_id: string } }>(
      '/sso/oidc/callback',
      { tenant_id, provider_id, code },
      { skipAuth: true, skipTenant: true }
    )
      .then((data) => {
        console.log('[SSO] Success!', { email: data.admin?.email, tenant: data.admin?.tenant_id });
        api.setToken(data.token);
        localStorage.removeItem('nexus_sso_state');
        // Full reload to properly initialize auth state
        window.location.href = '/';
      })
      .catch((err) => {
        console.error('[SSO] Error:', err);
        setError(err instanceof Error ? err.message : 'Erreur d\'authentification SSO');
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur SSO</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            Retour au login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Authentification en cours...</p>
      </div>
    </div>
  );
}
