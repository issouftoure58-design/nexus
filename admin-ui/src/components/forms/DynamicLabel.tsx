/**
 * DynamicLabel - Affiche un label avec la terminologie du profil métier
 *
 * Usage:
 *   <DynamicLabel term="service" /> → "Service" ou "Prestation" selon le profil
 *   <DynamicLabel term="reservation" plural /> → "RDV" ou "Réservations"
 *   <DynamicLabel term="client" /> → "Client" ou "Hôte"
 */

import { ReactNode } from 'react';
import { useProfile } from '@/contexts/ProfileContext';

type TermKey = 'reservation' | 'service' | 'client' | 'employee' | 'duration' | 'quantity';

interface DynamicLabelProps {
  /** Clé de terminologie */
  term: TermKey;
  /** Utiliser la forme plurielle */
  plural?: boolean;
  /** Préfixe avant le terme */
  prefix?: string;
  /** Suffixe après le terme */
  suffix?: string;
  /** Mettre en majuscule la première lettre */
  capitalize?: boolean;
  /** Mettre tout en minuscules */
  lowercase?: boolean;
  /** Classe CSS additionnelle */
  className?: string;
  /** Contenu additionnel après le label */
  children?: ReactNode;
}

export function DynamicLabel({
  term,
  plural = false,
  prefix = '',
  suffix = '',
  capitalize = false,
  lowercase = false,
  className = '',
  children,
}: DynamicLabelProps) {
  const { t } = useProfile();

  let label = t(term, plural);

  if (lowercase) {
    label = label.toLowerCase();
  } else if (capitalize) {
    label = label.charAt(0).toUpperCase() + label.slice(1);
  }

  const fullText = `${prefix}${label}${suffix}`;

  if (className || children) {
    return (
      <span className={className}>
        {fullText}
        {children}
      </span>
    );
  }

  return <>{fullText}</>;
}

/**
 * Hook pour obtenir tous les termes traduits
 */
export function useTerminology() {
  const { t } = useProfile();

  return {
    // Singuliers
    reservation: t('reservation'),
    service: t('service'),
    client: t('client'),
    employee: t('employee'),
    duration: t('duration'),
    quantity: t('quantity'),
    // Pluriels
    reservations: t('reservation', true),
    services: t('service', true),
    clients: t('client', true),
    employees: t('employee', true),
  };
}

/**
 * Composants raccourcis pour les termes courants
 */
export function ReservationLabel({ plural, ...props }: Omit<DynamicLabelProps, 'term'>) {
  return <DynamicLabel term="reservation" plural={plural} {...props} />;
}

export function ServiceLabel({ plural, ...props }: Omit<DynamicLabelProps, 'term'>) {
  return <DynamicLabel term="service" plural={plural} {...props} />;
}

export function ClientLabel({ plural, ...props }: Omit<DynamicLabelProps, 'term'>) {
  return <DynamicLabel term="client" plural={plural} {...props} />;
}

export function EmployeeLabel({ plural, ...props }: Omit<DynamicLabelProps, 'term'>) {
  return <DynamicLabel term="employee" plural={plural} {...props} />;
}

export default DynamicLabel;
