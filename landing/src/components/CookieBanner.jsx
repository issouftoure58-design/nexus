import { useState, useEffect } from 'react'
import { Shield, X } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'nexus_cookie_consent'
const CONSENT_EXPIRY_DAYS = 365

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(COOKIE_CONSENT_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function storeConsent(preferences) {
  const data = {
    ...preferences,
    timestamp: new Date().toISOString(),
    expiry: Date.now() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  }
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data))
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    const consent = getStoredConsent()
    if (!consent) setVisible(true)
  }, [])

  const acceptAll = () => {
    storeConsent({ essential: true, analytics: true })
    setVisible(false)
  }

  const refuseAll = () => {
    storeConsent({ essential: true, analytics: false })
    setVisible(false)
  }

  const saveCustom = () => {
    storeConsent({ essential: true, analytics })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
      <div className="max-w-4xl mx-auto bg-dark-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-6">
        {!showCustomize ? (
          <>
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-neon-cyan flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">Respect de votre vie privee</h3>
                <p className="text-gray-400 text-sm">
                  Nous utilisons des cookies essentiels au fonctionnement du site.
                  Des cookies analytiques optionnels nous aident a ameliorer votre experience.
                  Vous pouvez accepter, refuser ou personnaliser vos choix.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
              <button
                onClick={acceptAll}
                className="bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-semibold py-2.5 px-6 rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Accepter tout
              </button>
              <button
                onClick={refuseAll}
                className="bg-dark-700 border border-white/10 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-dark-600 transition-colors text-sm"
              >
                Refuser tout
              </button>
              <button
                onClick={() => setShowCustomize(true)}
                className="text-gray-400 hover:text-white transition-colors text-sm underline underline-offset-2"
              >
                Personnaliser
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Gestion des cookies</h3>
              <button onClick={() => setShowCustomize(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white text-sm font-medium">Cookies essentiels</p>
                  <p className="text-gray-500 text-xs">Necessaires au fonctionnement du site</p>
                </div>
                <div className="bg-neon-cyan/20 text-neon-cyan text-xs font-medium px-3 py-1 rounded-full">
                  Toujours actifs
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="text-white text-sm font-medium">Cookies analytiques</p>
                  <p className="text-gray-500 text-xs">Nous aident a ameliorer le site (non actifs actuellement)</p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    analytics ? 'bg-neon-cyan' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      analytics ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveCustom}
                className="bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-semibold py-2.5 px-6 rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Enregistrer mes choix
              </button>
              <button
                onClick={refuseAll}
                className="bg-dark-700 border border-white/10 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-dark-600 transition-colors text-sm"
              >
                Tout refuser
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
