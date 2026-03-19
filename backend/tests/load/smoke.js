/**
 * Smoke Test — Vérification rapide que les endpoints répondent
 * Usage: k6 run tests/load/smoke.js
 * Avec URL custom: k6 run -e K6_BASE_URL=https://nexus-backend-dev.onrender.com tests/load/smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, publicHeaders } from './config.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`, publicHeaders());
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health has status field': (r) => {
      try { return JSON.parse(r.body).status !== undefined; } catch { return false; }
    },
  });

  sleep(0.5);

  // 2. CGV (public, no auth)
  const cgvRes = http.get(`${BASE_URL}/api/cgv`, publicHeaders());
  check(cgvRes, {
    'cgv status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 3. Status page
  const statusRes = http.get(`${BASE_URL}/api/status`, publicHeaders());
  check(statusRes, {
    'status page responds': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}
