import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COOKIE_CONSENT_KEY = 'nexus_cookie_consent';
const CONSENT_EXPIRY_DAYS = 365;

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(preferences: { essential: boolean; analytics: boolean }) {
  const data = {
    ...preferences,
    timestamp: new Date().toISOString(),
    expiry: Date.now() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) setVisible(true);
  }, []);

  const acceptAll = () => {
    storeConsent({ essential: true, analytics: true });
    setVisible(false);
  };

  const refuseAll = () => {
    storeConsent({ essential: true, analytics: false });
    setVisible(false);
  };

  const saveCustom = () => {
    storeConsent({ essential: true, analytics });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl shadow-lg p-5">
        {!showCustomize ? (
          <>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">Respect de votre vie privee</h3>
                <p className="text-gray-500 text-xs">
                  Nous utilisons des cookies essentiels au fonctionnement du site.
                  Des cookies analytiques optionnels nous aident a ameliorer votre experience.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={acceptAll}>Accepter tout</Button>
              <Button size="sm" variant="outline" onClick={refuseAll}>Refuser tout</Button>
              <button
                onClick={() => setShowCustomize(true)}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
              >
                Personnaliser
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Gestion des cookies</h3>
              <button onClick={() => setShowCustomize(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Cookies essentiels</p>
                  <p className="text-xs text-gray-400">Necessaires au fonctionnement</p>
                </div>
                <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">Toujours actifs</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Cookies analytiques</p>
                  <p className="text-xs text-gray-400">Amelioration du site</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${analytics ? 'bg-cyan-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${analytics ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveCustom}>Enregistrer</Button>
              <Button size="sm" variant="outline" onClick={refuseAll}>Tout refuser</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
