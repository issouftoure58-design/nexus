// Configuration API centralisée
// En développement : utilise le proxy Vite (vide = même origine)
// En production : utilise VITE_API_URL

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  // Si path commence déjà par http, c'est une URL complète
  if (path.startsWith("http")) {
    return path;
  }
  // Sinon, préfixer avec l'URL de base
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Detect tenant ID from hostname
 * Used for multi-tenant routing
 */
export function getTenantFromHostname(): string {
  if (typeof window === 'undefined') return 'nexus-test'; // SSR fallback sûr

  const hostname = window.location.hostname;

  // Extraire le sous-domaine comme tenant ID
  // ex: fatshairafro.nexus-ai-saas.com → fatshairafro
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0]; // Sous-domaine = tenant slug
  }

  // Localhost / dev
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'nexus-test';
  }

  // Fallback: chercher dans le path ou retourner un défaut sûr
  return parts[0] || 'nexus-test';
}

// Wrapper fetch qui ajoute automatiquement l'URL de base et le tenant header
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api')) {
    const tenantId = getTenantFromHostname();
    const headers = new Headers(init?.headers);
    if (!headers.has('X-Tenant-ID')) {
      headers.set('X-Tenant-ID', tenantId);
    }
    return fetch(apiUrl(input), { ...init, headers });
  }
  return fetch(input, init);
}
