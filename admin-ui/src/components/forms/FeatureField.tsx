/**
 * FeatureField - Affiche un champ uniquement si une feature est activée
 *
 * Usage:
 *   <FeatureField feature="travelFees">
 *     <Input name="frais_deplacement" />
 *   </FeatureField>
 */

import { ReactNode } from 'react';
import { useFeature } from '@/contexts/ProfileContext';

interface FeatureFieldProps {
  /** Nom de la feature à vérifier */
  feature: string;
  /** Contenu à afficher si la feature est activée */
  children: ReactNode;
  /** Contenu alternatif si la feature est désactivée */
  fallback?: ReactNode;
  /** Inverser la logique (afficher si feature désactivée) */
  not?: boolean;
}

export function FeatureField({ feature, children, fallback = null, not = false }: FeatureFieldProps) {
  const hasFeature = useFeature(feature);

  const shouldShow = not ? !hasFeature : hasFeature;

  if (shouldShow) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Hook pour vérifier plusieurs features à la fois
 */
export function useFeatures(features: string[]): Record<string, boolean> {
  const hasFeatureFn = (feature: string) => useFeature(feature);

  return features.reduce((acc, feature) => {
    acc[feature] = hasFeatureFn(feature);
    return acc;
  }, {} as Record<string, boolean>);
}

export default FeatureField;
