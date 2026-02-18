import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TenantContextType {
  tenantId: string | null; // null = contexte NEXUS (pas de tenant)
  isNexusSite: boolean;    // true quand on est sur le site NEXUS
  setTenantId: (id: string | null) => void;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  isNexusSite: true,
  setTenantId: () => {},
});

/**
 * Detecte le tenant depuis l'URL.
 * Retourne null si contexte NEXUS (pas de tenant).
 */
function detectTenant(): string | null {
  // 1. Query param ?tenant=
  const params = new URLSearchParams(window.location.search);
  const param = params.get('tenant');
  if (param) return param;

  // 2. Subdomain in production (fatshairafro.nexus.com → 'fatshairafro')
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'nexus' && subdomain !== 'www') {
      return subdomain;
    }
  }

  // 3. Pas de tenant detecte = contexte NEXUS
  return null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(detectTenant);

  useEffect(() => {
    const handlePopState = () => setTenantId(detectTenant());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isNexusSite = tenantId === null;

  return (
    <TenantContext.Provider value={{ tenantId, isNexusSite, setTenantId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export default TenantContext;
