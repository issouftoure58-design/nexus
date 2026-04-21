/**
 * InsufficientCreditsModal — Modal affichée quand une action IA est bloquée
 * faute de crédits suffisants. Propose l'achat du Pack 1000 additionnel.
 *
 * Modele 2026 (revision 21 avril 2026) :
 *   • Pack unique additionnel : Pack 1000 → 15€ pour 1 000 credits (0% bonus)
 *   • Business 599€/mois inclut deja 20 000 credits (upsell si usage intensif)
 *
 * Usage :
 *   const [showModal, setShowModal] = useState(false);
 *   const { canAfford, costOf } = useCredits();
 *
 *   const handleAction = () => {
 *     if (!canAfford('phone_minute', 5)) {
 *       setShowModal(true);
 *       return;
 *     }
 *     // ... action IA
 *   };
 *
 *   <InsufficientCreditsModal
 *     open={showModal}
 *     onClose={() => setShowModal(false)}
 *     action="phone_minute"
 *     required={costOf('phone_minute', 5)}
 *   />
 */

import { X, Sparkles, Zap, AlertCircle, ArrowRight } from 'lucide-react';
import { useCredits, type CreditAction } from '@/hooks/useCredits';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CreditPack {
  id: 'pack_1000';
  code: string;
  credits: number;
  price_cents: number;
  price_eur: number;
  bonus_pct: number;
}

const ACTION_LABELS: Record<CreditAction, string> = {
  chat_admin_haiku: 'une question chat IA admin',
  whatsapp_message: 'un message WhatsApp IA',
  whatsapp_voice_note: 'une note vocale WhatsApp',
  devis_ia: 'un devis IA',
  anti_churn_whatsapp: 'un message anti-churn WhatsApp',
  email_ia_sent: 'un email IA',
  agent_web_conversation: 'une conversation chat web',
  social_post_generated: 'un post réseaux',
  phone_minute: 'une minute de téléphone IA',
  anti_churn_sms_fr: 'un SMS anti-churn',
  seo_article_full: 'un article SEO complet',
};

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  action?: CreditAction;
  required?: number;
}

export function InsufficientCreditsModal({
  open,
  onClose,
  action,
  required = 0,
}: InsufficientCreditsModalProps) {
  const { balance, purchasePack, isPurchasing } = useCredits();

  const { data: packsData } = useQuery<{ packs: CreditPack[] }>({
    queryKey: ['credits-packs'],
    queryFn: () => api.get('/billing/credits/packs'),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  if (!open) return null;

  const currentBalance = balance?.balance ?? 0;
  const missing = Math.max(0, required - currentBalance);
  const actionLabel = action ? ACTION_LABELS[action] : 'cette action';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header avec gradient */}
        <div className="relative bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 backdrop-blur rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">Crédits insuffisants</h2>
          </div>

          <p className="text-white/90">
            Vous n'avez pas assez de crédits pour {actionLabel}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Statut crédits */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Solde actuel</p>
              <p className="text-2xl font-bold text-gray-900">{currentBalance}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Requis</p>
              <p className="text-2xl font-bold text-gray-900">{required}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
              <p className="text-xs text-red-600 mb-1">Manquant</p>
              <p className="text-2xl font-bold text-red-600">{missing}</p>
            </div>
          </div>

          {/* Packs proposés */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Recharger maintenant
            </h3>

            {packsData?.packs && packsData.packs.length > 0 ? (
              <div className="flex justify-center">
                {packsData.packs.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => purchasePack(pack.id as 'pack_1000')}
                    disabled={isPurchasing}
                    className={cn(
                      'relative rounded-xl border-2 p-5 text-center transition-all max-w-xs w-full',
                      'hover:shadow-md hover:border-purple-400 disabled:opacity-50',
                      'border-purple-500 bg-purple-50'
                    )}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                        PACK UNIQUE
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                      Pack 1000
                    </p>

                    <div className="flex items-baseline justify-center gap-1 my-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {pack.credits.toLocaleString('fr-FR')}
                      </span>
                      <span className="text-xs text-gray-500">crédits</span>
                    </div>
                    <p className="text-xl font-semibold text-gray-900">{pack.price_eur}€</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">taux base · sans bonus</p>
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs text-purple-600 font-medium">
                      Acheter maintenant
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Chargement du pack...</p>
            )}
          </div>

          {/* Bandeau Business upsell */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  Vous consommez beaucoup de crédits ?
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Le plan <strong>Business 599€/mois</strong> inclut <strong>20 000 credits/mois</strong> + tous les modules premium (RH, Compta, Sentinel, White-label, API, SSO).
                </p>
                <a
                  href="/admin/subscription"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  Découvrir Business
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

export default InsufficientCreditsModal;
