/**
 * Configuration partagée pour les tests de charge k6
 */

// Base URL du backend (override via env: K6_BASE_URL)
export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5000';

// Credentials admin pour les tests authentifiés
export const ADMIN_CREDENTIALS = {
  email: __ENV.K6_ADMIN_EMAIL || 'test@nexus.dev',
  password: __ENV.K6_ADMIN_PASSWORD || 'test-password',
};

// Seuils de performance acceptables
export const THRESHOLDS = {
  // 95% des requêtes < 500ms
  http_req_duration: ['p(95)<500'],
  // Taux d'erreur < 1%
  http_req_failed: ['rate<0.01'],
  // 99% des requêtes < 2s
  http_req_duration_p99: ['p(99)<2000'],
};

// Headers communs
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

export function publicHeaders() {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
  };
}
