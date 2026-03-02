/**
 * TenantContext - Fournit les données tenant à toute l'app
 *
 * Usage:
 * 1. Wrapper l'app avec <TenantProvider>
 * 2. Utiliser useTenantContext() dans les composants
 */

import { createContext, useContext, ReactNode } from 'react';
import { useTenant, UseTenantReturn } from '@/hooks/useTenant';

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════════════════

const TenantContext = createContext<UseTenantReturn | null>(null);

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenant = useTenant();

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Hook pour accéder au contexte tenant
 * @throws Si utilisé hors du TenantProvider
 */
export function useTenantContext(): UseTenantReturn {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }

  return context;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export { TenantContext };
export default TenantProvider;
