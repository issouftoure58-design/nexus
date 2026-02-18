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

// Wrapper fetch qui ajoute automatiquement l'URL de base pour les appels API
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api')) {
    return fetch(apiUrl(input), init);
  }
  return fetch(input, init);
}
