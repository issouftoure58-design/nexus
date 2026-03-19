/**
 * Load Test — 100 utilisateurs simultanés
 *
 * Scénarios testés:
 * 1. Health check (baseline)
 * 2. Login admin (auth)
 * 3. Liste clients (read-heavy, authentifié)
 * 4. Liste réservations (read-heavy, authentifié)
 * 5. CGV (public, cache)
 *
 * Usage:
 *   k6 run tests/load/load-100users.js
 *   k6 run -e K6_BASE_URL=https://nexus-backend-dev.onrender.com tests/load/load-100users.js
 *   k6 run -e K6_ADMIN_EMAIL=admin@salon.com -e K6_ADMIN_PASSWORD=secret tests/load/load-100users.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, ADMIN_CREDENTIALS, publicHeaders, authHeaders } from './config.js';

// Métriques custom
const loginSuccess = new Rate('login_success');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    // Ramp-up: 0 → 50 users en 30s
    { duration: '30s', target: 50 },
    // Ramp-up: 50 → 100 users en 30s
    { duration: '30s', target: 100 },
    // Plateau: 100 users pendant 2min
    { duration: '2m', target: 100 },
    // Ramp-down: 100 → 0 en 30s
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    login_success: ['rate>0.9'],
    api_latency: ['p(95)<800'],
  },
};

export default function () {
  let token = null;

  // 1. Health check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, publicHeaders());
    check(res, {
      'health 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 2. Login
  group('Admin Login', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/admin/auth/login`,
      JSON.stringify({
        email: ADMIN_CREDENTIALS.email,
        password: ADMIN_CREDENTIALS.password,
      }),
      publicHeaders()
    );

    const success = loginRes.status === 200;
    loginSuccess.add(success);

    if (success) {
      try {
        const body = JSON.parse(loginRes.body);
        token = body.token || body.access_token;
      } catch {
        // parse error
      }
    }
  });

  sleep(0.5);

  // Si login réussi, tester les endpoints authentifiés
  if (token) {
    // 3. Liste clients
    group('List Clients', () => {
      const res = http.get(`${BASE_URL}/api/admin/clients`, authHeaders(token));
      check(res, {
        'clients 200': (r) => r.status === 200,
        'clients returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.clients || body.data || body);
          } catch {
            return false;
          }
        },
      });
      apiLatency.add(res.timings.duration);
    });

    sleep(0.5);

    // 4. Liste réservations
    group('List Reservations', () => {
      const res = http.get(`${BASE_URL}/api/admin/reservations`, authHeaders(token));
      check(res, {
        'reservations 200': (r) => r.status === 200,
      });
      apiLatency.add(res.timings.duration);
    });

    sleep(0.5);

    // 5. Stats
    group('Stats Dashboard', () => {
      const res = http.get(`${BASE_URL}/api/admin/stats`, authHeaders(token));
      check(res, {
        'stats 200': (r) => r.status === 200,
      });
      apiLatency.add(res.timings.duration);
    });
  }

  sleep(0.5);

  // 6. CGV (public, souvent mis en cache)
  group('CGV Public', () => {
    const res = http.get(`${BASE_URL}/api/cgv`, publicHeaders());
    check(res, {
      'cgv 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
