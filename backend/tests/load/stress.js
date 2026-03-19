/**
 * Stress Test — Trouver le point de rupture
 * Monte progressivement jusqu'à 200 users pour identifier les limites
 *
 * Usage: k6 run tests/load/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, publicHeaders } from './config.js';

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '20s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 150 },
    { duration: '30s', target: 200 },
    // Maintenir le pic
    { duration: '1m', target: 200 },
    // Ramp-down
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`, publicHeaders());
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  sleep(0.3);

  const cgvRes = http.get(`${BASE_URL}/api/cgv`, publicHeaders());
  check(cgvRes, {
    'cgv responds': (r) => r.status === 200,
  });

  sleep(0.5);
}
