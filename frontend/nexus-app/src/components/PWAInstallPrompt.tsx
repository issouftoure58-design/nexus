import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (24h)
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay for better UX
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-amber-500/10">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Smartphone className="w-7 h-7 text-zinc-900" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-lg">
              Installer l'application
            </h3>
            <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
              Accédez rapidement à Fat's Hair-Afro depuis votre écran d'accueil
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Plus tard
          </Button>
          <Button
            onClick={handleInstall}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-zinc-900 font-semibold"
          >
            <Download className="w-4 h-4 mr-2" />
            Installer
          </Button>
        </div>
      </div>
    </div>
  );
}
