/**
 * Sentry Shim — Redirects to SENTINEL errorTracker
 * Drop-in replacement: existing imports from sentry.js continue to work
 */

import { captureException, captureMessage } from '../services/errorTracker.js';

export { captureException, captureMessage };

export function initSentry() {
  // No-op: error tracking is now handled by SENTINEL errorTracker
}

export function sentryErrorHandler() {
  // Return passthrough middleware
  return (err, req, res, next) => next(err);
}

export default { initSentry, sentryErrorHandler, captureException, captureMessage };
