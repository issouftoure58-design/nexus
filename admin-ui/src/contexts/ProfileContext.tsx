/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROFILE CONTEXT
 * Contexte React pour la gestion du profil métier
 * Charge et expose la configuration métier du tenant
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Types
interface Terminology {
  singular: string;
  plural: string;
}

interface PricingConfig {
  mode: 'fixed' | 'hourly' | 'daily' | 'package';
  allowedModes: string[];
}

interface DurationConfig {
  mode: 'fixed' | 'flexible' | 'range';
  allowMultiDay: boolean;
  allowOvernight: boolean;
}

interface FieldConfig {
  required: string[];
  optional: string[];
  forbidden: string[];
}

interface BusinessRules {
  [key: string]: boolean | number | string;
}

// V2 - Business Info (infos tenant enrichies)
interface BusinessInfo {
  nom?: string;
  gerant?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  assistant_name?: string;
}

// V2 - Features flags
interface Features {
  travelFees?: boolean;
  clientAddress?: boolean;
  multiStaff?: boolean;
  products?: boolean;
  tableManagement?: boolean;
  roomManagement?: boolean;
  extras?: boolean;
  checkInOut?: boolean;
  [key: string]: boolean | undefined;
}

// V2 - Business types
export type BusinessType = 'service_domicile' | 'salon' | 'restaurant' | 'hotel';

export interface BusinessProfile {
  id: string;
  label: string;
  description: string;
  icon: string;
  pricing: PricingConfig;
  duration: DurationConfig;
  terminology: {
    reservation: Terminology;
    service: Terminology;
    client: Terminology;
    employee: Terminology;
    duration: string;
    quantity: string;
  };
  fields: {
    service: FieldConfig;
    reservation: FieldConfig;
  };
  rules: BusinessRules;
  // V2 - Nouveaux champs
  tenantId?: string;
  businessType?: BusinessType;
  businessTypeName?: string;
  businessInfo?: BusinessInfo;
  features?: Features;
  businessRules?: BusinessRules;
  fieldConfig?: {
    service?: FieldConfig;
    reservation?: FieldConfig;
  };
}

interface ProfileContextType {
  profile: BusinessProfile | null;
  loading: boolean;
  error: string | null;

  // Helpers terminologie
  t: (key: string, plural?: boolean) => string;

  // Helpers champs
  isFieldRequired: (context: 'service' | 'reservation', field: string) => boolean;
  isFieldForbidden: (context: 'service' | 'reservation', field: string) => boolean;
  isFieldVisible: (context: 'service' | 'reservation', field: string) => boolean;

  // Helpers règles
  getRule: <T = boolean>(ruleName: string, defaultValue?: T) => T;

  // Helpers pricing
  isPricingMode: (mode: string) => boolean;
  getPricingModes: () => string[];

  // V2 - Business type helpers
  businessType: BusinessType;
  businessInfo: BusinessInfo;
  hasFeature: (feature: string) => boolean;
  isBusinessType: (type: BusinessType) => boolean;

  // Actions
  refreshProfile: () => Promise<void>;
}

// Valeurs par défaut (profil service_domicile - le plus courant)
const defaultProfile: BusinessProfile = {
  id: 'service_domicile',
  label: 'Service à Domicile',
  description: 'Prestataires de services à domicile',
  icon: 'Home',
  pricing: {
    mode: 'fixed',
    allowedModes: ['fixed'],
  },
  duration: {
    mode: 'fixed',
    allowMultiDay: false,
    allowOvernight: false,
  },
  terminology: {
    reservation: { singular: 'RDV', plural: 'RDV' },
    service: { singular: 'Service', plural: 'Services' },
    client: { singular: 'Client', plural: 'Clients' },
    employee: { singular: 'Prestataire', plural: 'Prestataires' },
    duration: 'Durée',
    quantity: 'Quantité',
  },
  fields: {
    service: { required: ['nom', 'prix', 'duree_minutes'], optional: [], forbidden: ['taux_horaire'] },
    reservation: { required: ['date_rdv', 'heure_rdv', 'adresse_client'], optional: [], forbidden: [] },
  },
  rules: {},
  // V2 defaults
  businessType: 'service_domicile',
  businessTypeName: 'Service à Domicile',
  businessInfo: {},
  features: {
    travelFees: true,
    clientAddress: true,
    multiStaff: false,
    products: false,
  },
};

// V2 - Business Info par défaut
const defaultBusinessInfo: BusinessInfo = {};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('nexus_admin_token');

  // Charger le profil depuis l'API
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setProfile(defaultProfile);
        return;
      }

      const response = await fetch('/api/admin/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Si erreur, utiliser le profil par défaut
        console.warn('[ProfileContext] API non disponible, utilisation du profil par défaut');
        setProfile(defaultProfile);
        return;
      }

      const data = await response.json();
      setProfile(data.profile || defaultProfile);
    } catch (err) {
      console.error('[ProfileContext] Erreur chargement profil:', err);
      setProfile(defaultProfile);
      setError('Erreur de chargement du profil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Helper: Traduction terminologie
  const t = useCallback((key: string, plural = false): string => {
    if (!profile?.terminology) return key;

    const term = profile.terminology[key as keyof typeof profile.terminology];
    if (!term) return key;

    if (typeof term === 'string') return term;
    return plural ? term.plural : term.singular;
  }, [profile]);

  // Helper: Vérifier si un champ est requis
  const isFieldRequired = useCallback((context: 'service' | 'reservation', field: string): boolean => {
    if (!profile?.fields?.[context]) return false;
    return profile.fields[context].required?.includes(field) || false;
  }, [profile]);

  // Helper: Vérifier si un champ est interdit
  const isFieldForbidden = useCallback((context: 'service' | 'reservation', field: string): boolean => {
    if (!profile?.fields?.[context]) return false;
    return profile.fields[context].forbidden?.includes(field) || false;
  }, [profile]);

  // Helper: Vérifier si un champ est visible (pas interdit)
  const isFieldVisible = useCallback((context: 'service' | 'reservation', field: string): boolean => {
    return !isFieldForbidden(context, field);
  }, [isFieldForbidden]);

  // Helper: Obtenir une règle métier
  const getRule = useCallback(<T = boolean>(ruleName: string, defaultValue?: T): T => {
    if (!profile?.rules) return defaultValue as T;
    const value = profile.rules[ruleName];
    return (value !== undefined ? value : defaultValue) as T;
  }, [profile]);

  // Helper: Vérifier le mode de tarification
  const isPricingMode = useCallback((mode: string): boolean => {
    return profile?.pricing?.mode === mode;
  }, [profile]);

  // Helper: Obtenir les modes de tarification autorisés
  const getPricingModes = useCallback((): string[] => {
    return profile?.pricing?.allowedModes || ['fixed'];
  }, [profile]);

  // V2 - Helper: Vérifier si une feature est activée
  const hasFeature = useCallback((feature: string): boolean => {
    return profile?.features?.[feature] === true;
  }, [profile]);

  // V2 - Helper: Vérifier le type de business
  const isBusinessType = useCallback((type: BusinessType): boolean => {
    return profile?.businessType === type;
  }, [profile]);

  // V2 - Business type actuel
  const businessType: BusinessType = profile?.businessType || 'service_domicile';

  // V2 - Business info
  const businessInfo: BusinessInfo = profile?.businessInfo || defaultBusinessInfo;

  const value: ProfileContextType = {
    profile,
    loading,
    error,
    t,
    isFieldRequired,
    isFieldForbidden,
    isFieldVisible,
    getRule,
    isPricingMode,
    getPricingModes,
    // V2
    businessType,
    businessInfo,
    hasFeature,
    isBusinessType,
    refreshProfile: loadProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// Hook personnalisé
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

// Hook pour les labels (raccourci)
export function useProfileLabel() {
  const { t } = useProfile();
  return t;
}

// Hook pour vérifier si on est dans un profil spécifique
export function useIsProfile(profileId: string) {
  const { profile } = useProfile();
  return profile?.id === profileId;
}

// Hook pour les règles métier
export function useBusinessRule<T = boolean>(ruleName: string, defaultValue?: T): T {
  const { getRule } = useProfile();
  return getRule<T>(ruleName, defaultValue);
}

// V2 - Hook pour le type de business
export function useBusinessType(): BusinessType {
  const { businessType } = useProfile();
  return businessType;
}

// V2 - Hook pour vérifier si on est un type de business spécifique
export function useIsBusinessType(type: BusinessType): boolean {
  const { isBusinessType } = useProfile();
  return isBusinessType(type);
}

// V2 - Hook pour les features
export function useFeature(feature: string): boolean {
  const { hasFeature } = useProfile();
  return hasFeature(feature);
}

// V2 - Hook pour les infos business
export function useBusinessInfo(): BusinessInfo {
  const { businessInfo } = useProfile();
  return businessInfo;
}

// V2 - Hook raccourci pour les 4 types de business
export function useBusinessTypeChecks() {
  const { isBusinessType } = useProfile();
  return {
    isServiceDomicile: isBusinessType('service_domicile'),
    isSalon: isBusinessType('salon'),
    isRestaurant: isBusinessType('restaurant'),
    isHotel: isBusinessType('hotel'),
  };
}

export default ProfileContext;
