/**
 * BusinessTypeField - Affiche un champ selon le type de business
 *
 * Usage:
 *   <BusinessTypeField types={['service_domicile', 'salon']}>
 *     <Input name="adresse_client" />
 *   </BusinessTypeField>
 *
 *   <BusinessTypeField exclude={['hotel']}>
 *     <Input name="duree" />
 *   </BusinessTypeField>
 */

import { ReactNode } from 'react';
import { useBusinessType, type BusinessType } from '@/contexts/ProfileContext';

interface BusinessTypeFieldProps {
  /** Types de business pour lesquels afficher le champ */
  types?: BusinessType[];
  /** Types de business pour lesquels masquer le champ */
  exclude?: BusinessType[];
  /** Contenu à afficher */
  children: ReactNode;
  /** Contenu alternatif si le type ne correspond pas */
  fallback?: ReactNode;
}

export function BusinessTypeField({
  types,
  exclude,
  children,
  fallback = null
}: BusinessTypeFieldProps) {
  const currentType = useBusinessType();

  // Si types est défini, vérifier si le type actuel est dans la liste
  if (types && types.length > 0) {
    if (!types.includes(currentType)) {
      return <>{fallback}</>;
    }
  }

  // Si exclude est défini, vérifier si le type actuel n'est pas dans la liste
  if (exclude && exclude.length > 0) {
    if (exclude.includes(currentType)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Composants raccourcis pour chaque type de business
 */
export function ServiceDomicileOnly({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['service_domicile']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

export function SalonOnly({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['salon']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

export function RestaurantOnly({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['restaurant']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

export function HotelOnly({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['hotel']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

/**
 * Composant pour services avec lieu (salon, service_domicile)
 */
export function ServiceBasedBusiness({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['service_domicile', 'salon']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

/**
 * Composant pour business avec réservations temporelles (restaurant, hotel)
 */
export function BookingBasedBusiness({ children, fallback }: Omit<BusinessTypeFieldProps, 'types' | 'exclude'>) {
  return (
    <BusinessTypeField types={['restaurant', 'hotel']} fallback={fallback}>
      {children}
    </BusinessTypeField>
  );
}

export default BusinessTypeField;
