/**
 * PricingFields - Champs de tarification adaptatifs selon le mode de pricing
 *
 * Modes supportés:
 * - fixed: Prix fixe (€)
 * - hourly: Taux horaire (€/h)
 * - daily: Taux journalier (€/jour)
 * - package: Forfait (€)
 *
 * Usage:
 *   <PricingFields
 *     value={formData.prix}
 *     onChange={(prix) => setFormData({ ...formData, prix })}
 *     tauxHoraire={formData.taux_horaire}
 *     onTauxChange={(taux) => setFormData({ ...formData, taux_horaire: taux })}
 *   />
 */

import { useProfile } from '@/contexts/ProfileContext';
import { Input } from '@/components/ui/input';
import { Euro, Clock, Calendar } from 'lucide-react';

type PricingMode = 'fixed' | 'hourly' | 'daily' | 'package';

interface PricingFieldsProps {
  /** Prix fixe en euros (pour mode fixed) */
  value?: number;
  /** Callback pour le prix fixe */
  onChange?: (value: number) => void;
  /** Taux horaire en euros (pour mode hourly) */
  tauxHoraire?: number;
  /** Callback pour le taux horaire */
  onTauxHoraireChange?: (value: number) => void;
  /** Taux journalier en euros (pour mode daily) */
  tauxJournalier?: number;
  /** Callback pour le taux journalier */
  onTauxJournalierChange?: (value: number) => void;
  /** Prix forfait en euros (pour mode package) */
  prixForfait?: number;
  /** Callback pour le prix forfait */
  onPrixForfaitChange?: (value: number) => void;
  /** Forcer un mode spécifique (ignore le profil) */
  forceMode?: PricingMode;
  /** Permettre le switch entre modes */
  allowModeSwitch?: boolean;
  /** Mode actuel si switch autorisé */
  currentMode?: PricingMode;
  /** Callback pour changement de mode */
  onModeChange?: (mode: PricingMode) => void;
  /** Classes CSS additionnelles */
  className?: string;
  /** Désactiver les champs */
  disabled?: boolean;
  /** Label personnalisé */
  label?: string;
  /** Afficher le label */
  showLabel?: boolean;
}

export function PricingFields({
  value = 0,
  onChange,
  tauxHoraire = 0,
  onTauxHoraireChange,
  tauxJournalier = 0,
  onTauxJournalierChange,
  prixForfait = 0,
  onPrixForfaitChange,
  forceMode,
  allowModeSwitch = false,
  currentMode,
  onModeChange,
  className = '',
  disabled = false,
  label,
  showLabel = true,
}: PricingFieldsProps) {
  const { profile, isPricingMode, getPricingModes } = useProfile();

  // Déterminer le mode actif
  const activeMode = forceMode || currentMode || profile?.pricing?.mode || 'fixed';
  const allowedModes = getPricingModes();

  // Config par mode
  const modeConfig: Record<PricingMode, {
    label: string;
    placeholder: string;
    icon: typeof Euro;
    suffix: string;
  }> = {
    fixed: {
      label: label || 'Prix TTC',
      placeholder: 'Ex: 50',
      icon: Euro,
      suffix: '€',
    },
    hourly: {
      label: label || 'Taux horaire',
      placeholder: 'Ex: 25',
      icon: Clock,
      suffix: '€/h',
    },
    daily: {
      label: label || 'Taux journalier',
      placeholder: 'Ex: 200',
      icon: Calendar,
      suffix: '€/jour',
    },
    package: {
      label: label || 'Prix forfait',
      placeholder: 'Ex: 500',
      icon: Euro,
      suffix: '€',
    },
  };

  const config = modeConfig[activeMode];
  const Icon = config.icon;

  // Valeurs et callbacks selon le mode
  const getValue = () => {
    switch (activeMode) {
      case 'hourly': return tauxHoraire;
      case 'daily': return tauxJournalier;
      case 'package': return prixForfait;
      default: return value;
    }
  };

  const handleChange = (newValue: number) => {
    switch (activeMode) {
      case 'hourly':
        onTauxHoraireChange?.(newValue);
        break;
      case 'daily':
        onTauxJournalierChange?.(newValue);
        break;
      case 'package':
        onPrixForfaitChange?.(newValue);
        break;
      default:
        onChange?.(newValue);
    }
  };

  return (
    <div className={className}>
      {/* Sélecteur de mode si autorisé */}
      {allowModeSwitch && allowedModes.length > 1 && (
        <div className="flex gap-2 mb-2">
          {allowedModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange?.(mode as PricingMode)}
              disabled={disabled}
              className={`
                px-3 py-1 text-xs rounded-full transition-colors
                ${activeMode === mode
                  ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {modeConfig[mode as PricingMode].label}
            </button>
          ))}
        </div>
      )}

      {/* Champ de prix */}
      <div>
        {showLabel && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.label} *
          </label>
        )}
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="number"
            min={0}
            step={activeMode === 'hourly' ? 0.5 : 1}
            value={getValue()}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
            placeholder={config.placeholder}
            disabled={disabled}
            className="pl-10 pr-16"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            {config.suffix}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Composant pour afficher le prix formaté selon le mode
 */
interface PriceDisplayProps {
  /** Prix en centimes */
  amount: number;
  /** Mode de tarification */
  mode?: PricingMode;
  /** Taux horaire en centimes (si mode hourly) */
  tauxHoraire?: number;
  /** Classes CSS */
  className?: string;
}

export function PriceDisplay({ amount, mode, tauxHoraire, className = '' }: PriceDisplayProps) {
  const { profile } = useProfile();
  const activeMode = mode || profile?.pricing?.mode || 'fixed';

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  if (activeMode === 'hourly' && tauxHoraire) {
    return (
      <span className={className}>
        {formatCurrency(tauxHoraire)}/h
      </span>
    );
  }

  return (
    <span className={className}>
      {formatCurrency(amount)}
      {activeMode === 'daily' && '/jour'}
    </span>
  );
}

export default PricingFields;
