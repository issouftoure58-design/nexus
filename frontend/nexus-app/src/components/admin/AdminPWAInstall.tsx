import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AdminPWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Changer le manifest pour l'admin
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-admin.webmanifest');
    }

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);

      // Vérifier si l'utilisateur a déjà refusé
      const dismissed = localStorage.getItem('admin-pwa-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Écouter l'installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('admin-pwa-dismissed', 'true');
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-4 shadow-2xl shadow-amber-500/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">Installer l'app Admin</h3>
            <p className="text-white/80 text-sm mb-3">
              Accédez rapidement au dashboard depuis votre écran d'accueil
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                className="bg-white text-amber-600 hover:bg-white/90 text-sm"
                size="sm"
              >
                <Download className="w-4 h-4 mr-1" />
                Installer
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 text-sm"
                size="sm"
              >
                Plus tard
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
