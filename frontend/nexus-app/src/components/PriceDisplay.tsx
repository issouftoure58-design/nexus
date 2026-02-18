/**
 * Composant PriceDisplay
 * Affiche le prix d'un service avec gestion des prix variables ("A partir de")
 */

interface PriceDisplayProps {
  /** Prix en centimes */
  prix: number;
  /** True si le prix est variable */
  prixVariable?: boolean;
  /** Prix minimum en centimes (si variable) */
  prixMin?: number;
  /** Prix maximum en centimes (si variable) */
  prixMax?: number;
  /** Taille du texte (default: text-xl) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Afficher le range complet (ex: "50€ - 80€") */
  showRange?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
}

export function PriceDisplay({
  prix,
  prixVariable = false,
  prixMin,
  prixMax,
  size = 'xl',
  showRange = false,
  className = '',
}: PriceDisplayProps) {
  // Formater un prix en centimes vers euros
  const formatPrice = (centimes: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(centimes / 100);
  };

  // Classes de taille
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  // Prix a afficher (min si variable, sinon prix standard)
  const displayPrice = prixVariable && prixMin ? prixMin : prix;

  // Affichage avec range complet
  if (showRange && prixVariable && prixMin && prixMax) {
    return (
      <div className={`font-bold text-amber-600 ${sizeClasses[size]} ${className}`}>
        <span>{formatPrice(prixMin)} - {formatPrice(prixMax)}</span>
      </div>
    );
  }

  // Affichage standard avec "A partir de"
  return (
    <div className={`${className}`}>
      {prixVariable && (
        <span className="text-xs text-zinc-500 font-normal block">
          A partir de
        </span>
      )}
      <span className={`font-bold text-amber-600 ${sizeClasses[size]}`}>
        {formatPrice(displayPrice)}
      </span>
    </div>
  );
}

/**
 * Composant compact pour les cartes de services
 */
export function PriceTag({
  prix,
  prixVariable = false,
  prixMin,
  className = '',
}: Pick<PriceDisplayProps, 'prix' | 'prixVariable' | 'prixMin' | 'className'>) {
  const formatPrice = (centimes: number): string => {
    return `${(centimes / 100).toFixed(0)}€`;
  };

  const displayPrice = prixVariable && prixMin ? prixMin : prix;

  return (
    <span className={`text-xl font-bold text-amber-600 whitespace-nowrap ${className}`}>
      {prixVariable && (
        <span className="text-xs font-normal text-zinc-500 mr-1">dès</span>
      )}
      {formatPrice(displayPrice)}
    </span>
  );
}

export default PriceDisplay;
